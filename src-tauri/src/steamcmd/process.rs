//! Running SteamCMD and streaming its console output live.
//!
//! SteamCMD only writes output as it happens when it's attached to a console;
//! with plain pipes it buffers everything until it exits. So it runs inside a
//! pseudo-console (ConPTY on Windows, a pty elsewhere): it sees a real
//! terminal, and we read what it "draws" as it draws it.

use std::io::{Read, Write};
use std::path::Path;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tokio::sync::{mpsc, oneshot};
use tokio_util::sync::CancellationToken;

use crate::error::{Error, Result};

/// Wide enough that SteamCMD's longest lines never wrap.
const CONSOLE_SIZE: PtySize = PtySize {
  rows: 50,
  cols: 300,
  pixel_width: 0,
  pixel_height: 0,
};

/// What SteamCMD has printed: a finished line, or the line it is still in
/// the middle of (e.g. `Waiting for user info...` before the `OK` arrives).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Output {
  Line(String),
  Partial(String),
}

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
  let start_err =
    |e: &dyn std::fmt::Display| Error::SteamCmd(format!("Couldn't start {}: {e}", exe.display()));

  let pair = native_pty_system()
    .openpty(CONSOLE_SIZE)
    .map_err(|e| start_err(&e))?;
  let mut cmd = CommandBuilder::new(exe);
  cmd.args(args);
  if let Some(dir) = exe.parent() {
    cmd.cwd(dir);
  }
  let mut child = pair.slave.spawn_command(cmd).map_err(|e| start_err(&e))?;
  drop(pair.slave);
  let mut killer = child.clone_killer();
  let reader = pair.master.try_clone_reader().map_err(|e| start_err(&e))?;
  let writer = pair.master.take_writer().map_err(|e| start_err(&e))?;
  let mut master = Some(pair.master);

  // Both the console and the child only offer blocking APIs, so each gets a
  // small thread that reports back over a channel.
  let (line_tx, mut lines) = mpsc::unbounded_channel::<Output>();
  std::thread::spawn(move || pump(reader, writer, &line_tx));
  let (exit_tx, mut exited) = oneshot::channel();
  std::thread::spawn(move || {
    let _ = exit_tx.send(child.wait());
  });

  let mut cancelled = false;
  let mut exit_code = None;
  loop {
    tokio::select! {
      () = cancel.cancelled(), if !cancelled && exit_code.is_none() => {
        cancelled = true;
        let _ = killer.kill();
      }
      status = &mut exited, if exit_code.is_none() => {
        exit_code = Some(match status {
          Ok(Ok(status)) => status.exit_code(),
          _ => u32::MAX,
        });
        // The console only reports end-of-output once it is closed. Closing
        // it flushes whatever SteamCMD printed last, which `pump` still reads.
        let master = master.take();
        tokio::task::spawn_blocking(move || drop(master));
      }
      line = lines.recv() => match line {
        Some(output) => on_output(output),
        None => break,
      },
    }
  }

  if cancelled {
    return Err(Error::Cancelled);
  }
  Ok(exit_code.unwrap_or(u32::MAX))
}

fn pump(
  mut reader: Box<dyn Read + Send>,
  mut writer: Box<dyn Write + Send>,
  tx: &mpsc::UnboundedSender<Output>,
) {
  let mut decoder = ConsoleDecoder::default();
  let mut shown_partial = String::new();
  let mut buf = [0u8; 8192];
  loop {
    match reader.read(&mut buf) {
      Ok(0) | Err(_) => break,
      Ok(n) => {
        let out = decoder.push(&buf[..n]);
        if out.cursor_queries > 0 {
          // ConPTY asks where the cursor is when it starts and waits for an
          // answer before running the program.
          let _ = writer.write_all(&b"\x1b[1;1R".repeat(out.cursor_queries));
          let _ = writer.flush();
        }
        let finished_line = !out.lines.is_empty();
        for line in out.lines {
          if tx.send(Output::Line(line)).is_err() {
            return;
          }
        }
        if finished_line {
          shown_partial.clear();
        }
        // Show an unfinished line as soon as it appears, like a terminal.
        let partial = decoder.partial();
        if partial != shown_partial {
          if !partial.is_empty() && tx.send(Output::Partial(partial.clone())).is_err() {
            return;
          }
          shown_partial = partial;
        }
      }
    }
  }
  if let Some(line) = decoder.finish() {
    let _ = tx.send(Output::Line(line));
  }
}

#[derive(Default)]
enum EscState {
  #[default]
  Text,
  Escape,
  Csi(Vec<u8>),
  Osc,
  OscEscape,
}

#[derive(Debug, Default, PartialEq, Eq)]
struct Decoded {
  lines: Vec<String>,
  /// How many "where is the cursor?" (`ESC [6n`) queries were seen.
  cursor_queries: usize,
}

/// Turns raw console output into plain text lines: drops terminal control
/// sequences (colours, window title, cursor moves) and splits on `\n` or
/// `\r`. Bytes can arrive split anywhere, including mid-sequence.
#[derive(Default)]
struct ConsoleDecoder {
  state: EscState,
  pending: Vec<u8>,
}

impl ConsoleDecoder {
  fn push(&mut self, bytes: &[u8]) -> Decoded {
    let mut out = Decoded::default();
    for &b in bytes {
      self.state = match std::mem::take(&mut self.state) {
        EscState::Text => match b {
          0x1b => EscState::Escape,
          b'\n' | b'\r' => {
            out.lines.extend(self.take_line());
            EscState::Text
          }
          b'\t' => {
            self.pending.push(b);
            EscState::Text
          }
          // Other control characters (bell, backspace, …) carry no text.
          0x00..=0x1f | 0x7f => EscState::Text,
          _ => {
            self.pending.push(b);
            EscState::Text
          }
        },
        EscState::Escape => match b {
          b'[' => EscState::Csi(Vec::new()),
          b']' => EscState::Osc,
          // Two-byte sequences such as `ESC 7` or `ESC =`.
          _ => EscState::Text,
        },
        EscState::Csi(mut params) => {
          if (0x40..=0x7e).contains(&b) {
            if b == b'n' && params == b"6" {
              out.cursor_queries += 1;
            }
            EscState::Text
          } else {
            params.push(b);
            EscState::Csi(params)
          }
        }
        // Operating-system commands (e.g. set window title) end with BEL or
        // `ESC \`.
        EscState::Osc => match b {
          0x07 => EscState::Text,
          0x1b => EscState::OscEscape,
          _ => EscState::Osc,
        },
        EscState::OscEscape => match b {
          b'\\' => EscState::Text,
          _ => EscState::Osc,
        },
      };
    }
    out
  }

  /// The text of the line SteamCMD hasn't finished yet ("" if none).
  fn partial(&self) -> String {
    String::from_utf8_lossy(&self.pending).trim().to_owned()
  }

  fn finish(&mut self) -> Option<String> {
    self.take_line()
  }

  fn take_line(&mut self) -> Option<String> {
    let line = String::from_utf8_lossy(&self.pending).trim_end().to_owned();
    self.pending.clear();
    (!line.is_empty()).then_some(line)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn lines(d: &Decoded) -> Vec<&str> {
    d.lines.iter().map(String::as_str).collect()
  }

  #[test]
  fn strips_conpty_startup_sequences_and_answers_cursor_query() {
    let mut d = ConsoleDecoder::default();
    // Captured from a real ConPTY session, split across reads as it arrived.
    assert_eq!(d.push(b"\x1b[?9001h\x1b[?1004h"), Decoded::default());
    assert_eq!(d.push(b"\x1b[6n").cursor_queries, 1);
    let out = d.push(
      b"\x1b[m\x1b]0;C:\\steamcmd\\steamcmd.exe\x07\x1b[?25h\x1b[mRedirecting stderr\r\n[  0%] Checking...\r\n",
    );
    assert_eq!(lines(&out), ["Redirecting stderr", "[  0%] Checking..."]);
  }

  #[test]
  fn joins_text_split_across_reads_and_line_endings() {
    let mut d = ConsoleDecoder::default();
    assert_eq!(lines(&d.push(b"Loading Steam API...")), Vec::<&str>::new());
    assert_eq!(d.partial(), "Loading Steam API...");
    assert_eq!(lines(&d.push(b"OK\r")), ["Loading Steam API...OK"]);
    assert_eq!(lines(&d.push(b"\n[ 93%] Down")), Vec::<&str>::new());
    assert_eq!(lines(&d.push(b"loading\x1b")), Vec::<&str>::new());
    assert_eq!(lines(&d.push(b"[K\r\n")), ["[ 93%] Downloading"]);
    assert_eq!(d.finish(), None);
  }

  #[test]
  fn osc_terminated_by_string_terminator() {
    let mut d = ConsoleDecoder::default();
    let out = d.push(b"\x1b]0;title\x1b\\after\n");
    assert_eq!(lines(&out), ["after"]);
  }
}
