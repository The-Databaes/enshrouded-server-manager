//! SteamCMD: required to download and update the Enshrouded server files.
//! Either the app downloads and manages its own copy, or the user points it at
//! an existing install.

pub mod commands;
mod install;
pub mod locate;
pub mod output;
mod process;

use std::path::Path;

use serde::Serialize;
use tokio_util::sync::CancellationToken;

use crate::error::Result;
use crate::pty::Output;

/// Progress updates streamed to the UI over a Tauri channel while SteamCMD
/// (or its download) runs.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum SteamCmdEvent {
  #[serde(rename_all = "camelCase")]
  Stage { stage: Stage },
  /// Bytes of the SteamCMD installer zip received so far.
  #[serde(rename_all = "camelCase")]
  Download { received: u64, total: Option<u64> },
  /// A progress line from SteamCMD itself.
  #[serde(rename_all = "camelCase")]
  Progress {
    percent: f64,
    label: Option<String>,
    current: Option<u64>,
    total: Option<u64>,
  },
  /// How much an `app_update` will really download (`download_total`) to
  /// produce `stage_total` bytes of files, which is what `Progress` counts.
  #[serde(rename_all = "camelCase")]
  DownloadPlan {
    download_total: u64,
    stage_total: u64,
  },
  /// One line of console output, sent as soon as SteamCMD prints it.
  #[serde(rename_all = "camelCase")]
  Log { line: String },
  /// The line SteamCMD is still writing; replaced by the next `Log`.
  #[serde(rename_all = "camelCase")]
  Partial { line: String },
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Stage {
  Downloading,
  Extracting,
  Updating,
}

/// Run SteamCMD, forwarding every line of its console to `emit` (plus parsed
/// progress) and to `inspect` so callers can watch for result lines. Returns
/// the exit code.
pub async fn run_streamed(
  exe: &Path,
  args: &[&str],
  cancel: &CancellationToken,
  emit: &impl Fn(SteamCmdEvent),
  mut inspect: impl FnMut(&str),
) -> Result<u32> {
  emit(SteamCmdEvent::Log {
    line: format!("> {}", command_line(exe, args)),
  });
  let code = process::run(exe, args, cancel, |out| {
    let line = match out {
      Output::Line(line) => line,
      Output::Partial(line) => {
        emit(SteamCmdEvent::Partial { line });
        return;
      }
    };
    let line = line.as_str();
    if let Some(p) = output::parse_progress(line) {
      emit(SteamCmdEvent::Progress {
        percent: p.percent,
        label: p.label,
        current: p.current,
        total: p.total,
      });
    }
    inspect(line);
    emit(SteamCmdEvent::Log {
      line: line.to_owned(),
    });
  })
  .await?;
  emit(SteamCmdEvent::Log {
    line: format!("SteamCMD exited with code {code}"),
  });
  Ok(code)
}

/// How the command would be typed in a terminal, for the console log.
fn command_line(exe: &Path, args: &[&str]) -> String {
  let quote = |s: &str| {
    if s.contains(' ') {
      format!("\"{s}\"")
    } else {
      s.to_owned()
    }
  };
  std::iter::once(quote(&exe.to_string_lossy()))
    .chain(args.iter().map(|a| quote(a)))
    .collect::<Vec<_>>()
    .join(" ")
}
