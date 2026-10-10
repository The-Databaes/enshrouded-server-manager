//! Downloading SteamCMD from Valve and bringing it up to date.
//!
//! SteamCMD's licence doesn't let us ship it, so the app fetches Valve's
//! official bootstrapper zip at runtime. The zip only holds a small
//! `steamcmd.exe`; the first run then downloads the rest of SteamCMD.

use std::io::Cursor;
use std::path::{Path, PathBuf};

use tokio_util::sync::CancellationToken;

use super::locate::EXECUTABLE_NAME;
use super::{run_streamed, Stage, SteamCmdEvent};
use crate::error::{Error, IoContext, Result};

/// Valve's official Windows download, as listed on
/// <https://developer.valvesoftware.com/wiki/SteamCMD>.
pub const DOWNLOAD_URL: &str = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip";

/// Download, unpack and self-update SteamCMD into `dest`, returning the path
/// of the executable.
pub async fn install(
  dest: &Path,
  cancel: &CancellationToken,
  emit: &impl Fn(SteamCmdEvent),
) -> Result<PathBuf> {
  emit(SteamCmdEvent::Stage {
    stage: Stage::Downloading,
  });
  emit(SteamCmdEvent::Log {
    line: format!("Downloading {DOWNLOAD_URL}"),
  });
  let archive = download(DOWNLOAD_URL, cancel, |received, total| {
    emit(SteamCmdEvent::Download { received, total });
  })
  .await?;

  emit(SteamCmdEvent::Stage {
    stage: Stage::Extracting,
  });
  emit(SteamCmdEvent::Log {
    line: format!("Unpacking into {}", dest.display()),
  });
  let owned_dest = dest.to_path_buf();
  tokio::task::spawn_blocking(move || extract(&archive, &owned_dest))
    .await
    .map_err(|e| Error::SteamCmd(format!("Unpacking stopped unexpectedly: {e}")))??;

  let exe = dest.join(EXECUTABLE_NAME);
  if !exe.is_file() {
    return Err(Error::SteamCmd(format!(
      "The downloaded archive didn't contain {EXECUTABLE_NAME}."
    )));
  }

  self_update(&exe, cancel, emit).await?;
  Ok(exe)
}

/// Run `steamcmd +quit`, which makes SteamCMD fetch any updates to itself
/// (or, on a fresh install, the bulk of its files) and then exit.
pub async fn self_update(
  exe: &Path,
  cancel: &CancellationToken,
  emit: &impl Fn(SteamCmdEvent),
) -> Result<()> {
  emit(SteamCmdEvent::Stage {
    stage: Stage::Updating,
  });
  let code = run_streamed(exe, &["+quit"], cancel, emit, |_| {}).await?;

  // SteamCMD exits with 7 after it has replaced its own files on first run,
  // which is a success from our point of view.
  match code {
    0 | 7 => Ok(()),
    code => Err(Error::SteamCmd(format!(
      "SteamCMD exited with code {code}. Check the console output for details."
    ))),
  }
}

async fn download(
  url: &str,
  cancel: &CancellationToken,
  mut on_progress: impl FnMut(u64, Option<u64>),
) -> Result<Vec<u8>> {
  let client = reqwest::Client::builder()
    .user_agent(concat!(
      "enshrouded-server-manager/",
      env!("CARGO_PKG_VERSION")
    ))
    .build()?;
  let mut response = tokio::select! {
    () = cancel.cancelled() => return Err(Error::Cancelled),
    r = client.get(url).send() => r?.error_for_status()?,
  };

  let total = response.content_length();
  let mut bytes = Vec::with_capacity(total.and_then(|t| usize::try_from(t).ok()).unwrap_or(0));
  on_progress(0, total);
  loop {
    let chunk = tokio::select! {
      () = cancel.cancelled() => return Err(Error::Cancelled),
      c = response.chunk() => c?,
    };
    let Some(chunk) = chunk else { break };
    bytes.extend_from_slice(&chunk);
    on_progress(bytes.len() as u64, total);
  }
  Ok(bytes)
}

/// Unpack a zip into `dest`, refusing entries that would escape it.
fn extract(archive: &[u8], dest: &Path) -> Result<()> {
  std::fs::create_dir_all(dest).at("create", dest)?;
  let mut zip = zip::ZipArchive::new(Cursor::new(archive))?;
  for i in 0..zip.len() {
    let mut entry = zip.by_index(i)?;
    let Some(relative) = entry.enclosed_name() else {
      return Err(Error::SteamCmd(format!(
        "The archive contains an unsafe path: {}",
        String::from_utf8_lossy(entry.name_raw())
      )));
    };
    let out = dest.join(relative);
    if entry.is_dir() {
      std::fs::create_dir_all(&out).at("create", &out)?;
      continue;
    }
    if let Some(parent) = out.parent() {
      std::fs::create_dir_all(parent).at("create", parent)?;
    }
    let mut file = std::fs::File::create(&out).at("create", &out)?;
    std::io::copy(&mut entry, &mut file).at("write", &out)?;
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use std::io::Write;

  use super::*;

  fn zip_of(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    {
      let mut zip = zip::ZipWriter::new(&mut buf);
      let opts = zip::write::SimpleFileOptions::default();
      for (name, data) in entries {
        zip
          .start_file(*name, opts)
          .unwrap_or_else(|e| panic!("{e}"));
        zip.write_all(data).unwrap_or_else(|e| panic!("{e}"));
      }
      zip.finish().unwrap_or_else(|e| panic!("{e}"));
    }
    buf.into_inner()
  }

  #[test]
  fn extracts_into_destination() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    extract(
      &zip_of(&[("steamcmd.exe", b"MZ"), ("sub/a.txt", b"hi")]),
      dir.path(),
    )?;
    assert_eq!(
      std::fs::read(dir.path().join("steamcmd.exe")).ok(),
      Some(b"MZ".to_vec())
    );
    assert!(dir.path().join("sub").join("a.txt").is_file());
    Ok(())
  }

  #[test]
  fn refuses_path_traversal() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    let dest = dir.path().join("dest");
    let result = extract(&zip_of(&[("../evil.exe", b"x")]), &dest);
    assert!(matches!(result, Err(Error::SteamCmd(_))));
    assert!(!dir.path().join("evil.exe").exists());
    Ok(())
  }

  /// Real end-to-end install from Valve's CDN. Needs network access and takes
  /// a minute: `cargo test -- --ignored live_install --nocapture`.
  #[cfg(windows)]
  #[tokio::test]
  #[ignore = "downloads from Valve's CDN"]
  async fn live_install() -> Result<()> {
    let dir = tempfile::tempdir().at("create", Path::new("tempdir"))?;
    let exe = install(dir.path(), &CancellationToken::new(), &|event| {
      if let SteamCmdEvent::Log { line } = event {
        println!("{line}");
      }
    })
    .await?;
    assert!(exe.is_file());
    Ok(())
  }
}
