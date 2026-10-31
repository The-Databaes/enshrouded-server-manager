//! The Enshrouded dedicated server: installing, updating and verifying its
//! files with SteamCMD, and running it ([`runtime`]).

pub mod a2s;
pub mod commands;
pub mod players;
mod processes;
pub mod runtime;
pub mod settings;
pub mod settings_file;

use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::Duration;

use tokio_util::sync::CancellationToken;

use crate::error::{Error, IoContext, Result};
use crate::steamcmd::output::{
  is_refused_manifest, parse_app_update_result, parse_update_started, AppUpdateResult,
};
use crate::steamcmd::{run_streamed, SteamCmdEvent};

/// Steam app ID of "Enshrouded Dedicated Server" (free, anonymous login).
pub const APP_ID: &str = "2278520";
/// Present in every complete install.
pub const SERVER_EXECUTABLE: &str = "enshrouded_server.exe";

/// What SteamCMD records about an install in
/// `steamapps/appmanifest_2278520.acf`.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Manifest {
  pub build_id: Option<String>,
  pub size_on_disk: Option<u64>,
  pub last_updated: Option<u64>,
  pub state_flags: Option<u32>,
}

impl Manifest {
  pub fn path(install_dir: &Path) -> PathBuf {
    install_dir
      .join("steamapps")
      .join(format!("appmanifest_{APP_ID}.acf"))
  }

  pub fn read(install_dir: &Path) -> Option<Self> {
    std::fs::read_to_string(Self::path(install_dir))
      .ok()
      .map(|t| Self::parse(&t))
  }

  /// Pull the top-level fields we need out of the KeyValues ("VDF") text.
  fn parse(text: &str) -> Self {
    let mut m = Self::default();
    for line in text.lines() {
      let [key, value] = quoted_tokens(line)[..] else {
        continue;
      };
      match key.to_ascii_lowercase().as_str() {
        "buildid" if m.build_id.is_none() => m.build_id = Some(value.to_owned()),
        "sizeondisk" if m.size_on_disk.is_none() => m.size_on_disk = value.parse().ok(),
        "lastupdated" if m.last_updated.is_none() => m.last_updated = value.parse().ok(),
        "stateflags" if m.state_flags.is_none() => m.state_flags = value.parse().ok(),
        _ => {}
      }
    }
    m
  }

  /// StateFlags 4 means "fully installed" with nothing pending.
  pub fn is_complete(&self) -> bool {
    self.state_flags == Some(4)
  }
}

/// The `"quoted"` tokens on one line of KeyValues text.
fn quoted_tokens(line: &str) -> Vec<&str> {
  line.split('"').skip(1).step_by(2).collect()
}

/// Find the public branch's build ID (and when it was published) in the
/// output of `app_info_print`.
pub fn parse_public_build(lines: &[String]) -> Option<(String, Option<u64>)> {
  let (mut in_branches, mut in_public) = (false, false);
  let (mut build, mut time) = (None, None);
  for line in lines {
    let tokens = quoted_tokens(line);
    match tokens[..] {
      ["branches"] => in_branches = true,
      ["public"] if in_branches => in_public = true,
      ["buildid", id] if in_public => build = Some(id.to_owned()),
      ["timeupdated", t] if in_public => time = t.parse().ok(),
      _ if in_public && line.trim() == "}" => break,
      _ => {}
    }
  }
  build.map(|b| (b, time))
}

/// `app_update` the server into `install_dir`; with `validate`, every file
/// is also checked against Steam and repaired.
pub async fn app_update(
  steamcmd: &Path,
  install_dir: &Path,
  validate: bool,
  cancel: &CancellationToken,
  emit: &impl Fn(SteamCmdEvent),
) -> Result<()> {
  let mut validate = validate;
  let mut retried_config = false;
  let mut set_aside: Option<SetAsideManifest> = None;
  loop {
    let run = update_once(steamcmd, install_dir, validate, cancel, emit).await?;
    match run.result {
      Some(AppUpdateResult::Success) => {
        if let Some(manifest) = set_aside {
          manifest.discard();
        }
        return Ok(());
      }
      // "Missing configuration" happens when SteamCMD hasn't cached the
      // app's details yet (typically its very first app_update); a second
      // run works.
      Some(AppUpdateResult::Failed(msg))
        if !retried_config && msg.contains("Missing configuration") =>
      {
        retried_config = true;
        emit(SteamCmdEvent::Log {
          line: "Steam hadn't sent the server's details yet. Trying again…".into(),
        });
      }
      // Steam refused the installed build's file list, so SteamCMD can't
      // work out an update from it. Without the app manifest SteamCMD treats
      // the folder as a new install: it checks the files already there
      // against the new build and fetches what differs. Files that aren't
      // part of the game (settings, saves, logs) are left alone.
      _ if run.refused_manifest && set_aside.is_none() => {
        set_aside = Some(SetAsideManifest::new(install_dir)?);
        validate = true;
        emit(SteamCmdEvent::Log {
          line: "Steam no longer provides the file list of the installed build, so the update can't be worked out from it. Checking every file against the new build instead…".into(),
        });
      }
      result => {
        if let Some(manifest) = set_aside {
          manifest.restore_if_unreplaced();
        }
        return Err(Error::SteamCmd(match result {
          Some(AppUpdateResult::Failed(msg)) if msg.contains("Missing configuration") => {
            "Steam still hadn't sent the server's details after a retry. Try again in a minute.".into()
          }
          Some(AppUpdateResult::Failed(msg)) => msg,
          _ => format!(
            "SteamCMD exited (code {}) without saying whether the server was installed. Check the console output.",
            run.code
          ),
        }));
      }
    }
  }
}

struct UpdateRun {
  code: u32,
  result: Option<AppUpdateResult>,
  /// Steam refused the installed build's manifest.
  refused_manifest: bool,
}

/// One SteamCMD `app_update` run.
async fn update_once(
  steamcmd: &Path,
  install_dir: &Path,
  validate: bool,
  cancel: &CancellationToken,
  emit: &impl Fn(SteamCmdEvent),
) -> Result<UpdateRun> {
  let dir = install_dir.to_string_lossy();
  let mut args = vec![
    "+force_install_dir",
    &dir,
    "+login",
    "anonymous",
    "+app_update",
    APP_ID,
  ];
  if validate {
    args.push("validate");
  }
  args.push("+quit");

  let mut result = None;
  // The console only reports uncompressed bytes written; the real download
  // size is in SteamCMD's content log, so follow that alongside.
  let content_log = ContentLog::open(steamcmd);
  let run_done = CancellationToken::new();
  let run = async {
    let code = run_streamed(steamcmd, &args, cancel, emit, |line| {
      if let Some(r) = parse_app_update_result(line) {
        result = Some(r);
      }
    })
    .await;
    run_done.cancel();
    code
  };
  let (code, refused_manifest) = tokio::join!(run, content_log.watch(&run_done, emit));
  Ok(UpdateRun {
    code: code?,
    result,
    refused_manifest,
  })
}

/// The app manifest, moved out of SteamCMD's way while it reinstalls over the
/// existing files.
struct SetAsideManifest {
  path: PathBuf,
  aside: PathBuf,
}

impl SetAsideManifest {
  fn new(install_dir: &Path) -> Result<Self> {
    let path = Manifest::path(install_dir);
    let aside = path.with_extension("acf.stale");
    std::fs::rename(&path, &aside).at("set aside", &path)?;
    Ok(Self { path, aside })
  }

  fn discard(self) {
    let _ = std::fs::remove_file(&self.aside);
  }

  /// SteamCMD writes a new manifest as soon as it starts installing; if it
  /// failed before that, put the old one back so the install still shows its
  /// build.
  fn restore_if_unreplaced(self) {
    if self.path.exists() {
      self.discard();
    } else {
      let _ = std::fs::rename(&self.aside, &self.path);
    }
  }
}

/// Follows `logs/content_log.txt` next to SteamCMD from the point a job
/// starts, reporting the download plan for the server when Steam logs it.
struct ContentLog {
  path: PathBuf,
  offset: u64,
}

impl ContentLog {
  fn open(steamcmd: &Path) -> Self {
    let path = steamcmd
      .parent()
      .unwrap_or(Path::new("."))
      .join("logs")
      .join("content_log.txt");
    let offset = std::fs::metadata(&path).map_or(0, |m| m.len());
    Self { path, offset }
  }

  /// Returns whether Steam refused the installed build's manifest.
  async fn watch(mut self, done: &CancellationToken, emit: &impl Fn(SteamCmdEvent)) -> bool {
    let mut pending = String::new();
    let mut refused_manifest = false;
    loop {
      // Read once more after SteamCMD exits so nothing logged at the end is missed.
      let finished = done.is_cancelled();
      for line in self.read_new(&mut pending) {
        if let Some(plan) = parse_update_started(&line, APP_ID) {
          emit(SteamCmdEvent::DownloadPlan {
            download_total: plan.download_total,
            stage_total: plan.stage_total,
          });
        }
        refused_manifest |= is_refused_manifest(&line, APP_ID);
      }
      if finished {
        return refused_manifest;
      }
      tokio::select! {
        () = done.cancelled() => {}
        () = tokio::time::sleep(Duration::from_millis(750)) => {}
      }
    }
  }

  /// Complete lines appended since the last call. A missing or unreadable
  /// log just yields nothing: the UI then falls back to the console numbers.
  fn read_new(&mut self, pending: &mut String) -> Vec<String> {
    let Ok(mut file) = std::fs::File::open(&self.path) else {
      return Vec::new();
    };
    let len = file.metadata().map_or(0, |m| m.len());
    if len < self.offset {
      // Steam rotated the log.
      self.offset = 0;
    }
    let mut bytes = Vec::new();
    if file.seek(SeekFrom::Start(self.offset)).is_err() || file.read_to_end(&mut bytes).is_err() {
      return Vec::new();
    }
    self.offset += bytes.len() as u64;
    pending.push_str(&String::from_utf8_lossy(&bytes));
    let mut lines = Vec::new();
    while let Some(end) = pending.find('\n') {
      lines.push(
        pending
          .drain(..=end)
          .collect::<String>()
          .trim_end()
          .to_owned(),
      );
    }
    lines
  }
}

/// Ask Steam for the newest public build of the server, without downloading.
pub async fn latest_build(
  steamcmd: &Path,
  cancel: &CancellationToken,
  emit: &impl Fn(SteamCmdEvent),
) -> Result<(String, Option<u64>)> {
  let args = [
    "+login",
    "anonymous",
    "+app_info_update",
    "1",
    "+app_info_print",
    APP_ID,
    "+quit",
  ];
  let mut lines = Vec::new();
  run_streamed(steamcmd, &args, cancel, emit, |line| {
    lines.push(line.to_owned());
  })
  .await?;
  parse_public_build(&lines).ok_or_else(|| {
    Error::SteamCmd("Steam didn't report the server's latest build. Try again in a minute.".into())
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_app_manifest() {
    // Trimmed from a real steamapps/appmanifest_2278520.acf.
    let text = r#""AppState"
{
	"appid"		"2278520"
	"name"		"Enshrouded Dedicated Server"
	"StateFlags"		"4"
	"LastUpdated"		"1791651395"
	"SizeOnDisk"		"8811579458"
	"buildid"		"23178631"
	"InstalledDepots"
	{
		"2278521"
		{
			"manifest"		"7604377918839582995"
			"size"		"8786470930"
		}
	}
}"#;
    let m = Manifest::parse(text);
    assert_eq!(
      m,
      Manifest {
        build_id: Some("23178631".into()),
        size_on_disk: Some(8_811_579_458),
        last_updated: Some(1_791_651_395),
        state_flags: Some(4),
      }
    );
    assert!(m.is_complete());
  }

  /// Updates a server copy with SteamCMD. To check the refused-manifest
  /// recovery, give the copy a manifest from a build Steam no longer serves.
  /// ```text
  /// ESM_TEST_STEAMCMD=…\steamcmd.exe ESM_TEST_SERVER_DIR=…\server-copy
  ///   cargo test -- --ignored live_app_update --nocapture
  /// ```
  #[tokio::test]
  #[ignore = "runs SteamCMD against Valve's servers"]
  async fn live_app_update() -> Result<()> {
    let (Some(steamcmd), Some(dir)) = (
      std::env::var_os("ESM_TEST_STEAMCMD").map(PathBuf::from),
      std::env::var_os("ESM_TEST_SERVER_DIR").map(PathBuf::from),
    ) else {
      eprintln!("ESM_TEST_STEAMCMD or ESM_TEST_SERVER_DIR isn't set; skipping");
      return Ok(());
    };
    app_update(
      &steamcmd,
      &dir,
      false,
      &CancellationToken::new(),
      &|event| {
        if let SteamCmdEvent::Log { line } = event {
          println!("{line}");
        }
      },
    )
    .await?;
    assert!(Manifest::read(&dir).is_some_and(|m| m.is_complete()));
    assert!(!Manifest::path(&dir).with_extension("acf.stale").exists());
    Ok(())
  }

  #[test]
  fn finds_public_build_in_app_info() {
    let lines: Vec<String> = [
      r#""2278520""#,
      "{",
      r#"        "depots""#,
      "        {",
      r#"                "branches""#,
      "                {",
      r#"                        "public""#,
      "                        {",
      r#"                                "buildid"               "23178631""#,
      r#"                                "timeupdated"           "1778508351""#,
      "                        }",
      "                }",
      "        }",
      "}",
    ]
    .iter()
    .map(ToString::to_string)
    .collect();
    assert_eq!(
      parse_public_build(&lines),
      Some(("23178631".into(), Some(1_778_508_351)))
    );
    assert_eq!(parse_public_build(&["nothing".into()]), None);
  }
}
