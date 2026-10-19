//! Running SteamCMD to completion with live output (see [`crate::pty`]).

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::error::{Error, Result};
use crate::pty::{self, Output};

/// Run `exe` with `args` from its own folder (SteamCMD writes next to
/// itself), calling `on_output` with everything it prints, as it prints it.
/// Returns the exit code. Cancelling `cancel` kills the process and returns
/// [`Error::Cancelled`].
pub async fn run(
  exe: &Path,
  args: &[&str],
  cancel: &CancellationToken,
  mut on_output: impl FnMut(Output),
) -> Result<u32> {
  let cwd = exe.parent().unwrap_or(Path::new("."));
  let pty::Spawned {
    process,
    mut output,
    exit,
  } = pty::spawn(exe, args, cwd)
    .map_err(|e| Error::SteamCmd(format!("Couldn't start {}: {e}", exe.display())))?;

  let mut cancelled = false;
  loop {
    tokio::select! {
      () = cancel.cancelled(), if !cancelled => {
        cancelled = true;
        let _ = process.kill();
      }
      // Ends once SteamCMD has exited and everything it printed is read.
      line = output.recv() => match line {
        Some(line) => on_output(line),
        None => break,
      },
    }
  }

  if cancelled {
    return Err(Error::Cancelled);
  }
  Ok(exit.await.ok().flatten().unwrap_or(u32::MAX))
}
