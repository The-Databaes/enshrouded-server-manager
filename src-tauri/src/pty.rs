//! Running console programs inside a pseudo-console.
//!
//! SteamCMD and the Enshrouded server only write output as it happens when
//! they're attached to a console; with plain pipes it sits in a buffer until
//! they exit. So they run inside a pseudo-console (ConPTY on Windows, a pty
//! elsewhere): they see a real terminal, and we read what they "draw" as they
//! draw it. The console also gives us a way to ask a program to shut down the
//! way a user would, from the keyboard (see [`PtyProcess::send_ctrl_break`]).

use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex, PoisonError};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use tokio::sync::{mpsc, oneshot};

/// Wide enough that long log lines never wrap.
const CONSOLE_SIZE: PtySize = PtySize {
  rows: 50,
  cols: 300,
  pixel_width: 0,
  pixel_height: 0,
};

/// What the program has printed: a finished line, or the line it is still in
/// the middle of (e.g. `Waiting for user info...` before the `OK` arrives).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Output {
  Line(String),
  Partial(String),
}

/// Ctrl+Break, pressed and released, as win32-input-mode key events
/// (`ESC [ Vk ; Sc ; Uc ; Kd ; Cs ; Rc _`): `VK_CANCEL`, its scan code, no
/// character, Left Ctrl + "enhanced key". portable-pty opens the console in
/// that mode, so this is how a key press is written to it.
///
/// Ctrl+Break rather than Ctrl+C: a process can be started with Ctrl+C
/// disabled, and that setting is inherited by everything it launches (it is
/// whenever the manager itself was started that way), while Ctrl+Break always
/// gets through. The Enshrouded server treats both as "save and shut down".
const CTRL_BREAK: &[u8] = b"\x1b[3;70;0;1;264;1_\x1b[3;70;0;0;264;1_";

type SharedInput = Arc<Mutex<Box<dyn Write + Send>>>;

/// A program running in its own pseudo-console.
pub struct PtyProcess {
  pid: Option<u32>,
  killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
  input: SharedInput,
}

/// A started program plus everything it will report.
pub struct Spawned {
  pub process: PtyProcess,
  /// Everything it prints, as it prints it. Closes once the program has
  /// exited and its last output has been read.
  pub output: mpsc::UnboundedReceiver<Output>,
  /// Its exit code (`None` if it couldn't be read).
  pub exit: oneshot::Receiver<Option<u32>>,
}

/// Start `exe` with `args` in `cwd`, inside a new pseudo-console.
///
/// # Errors
/// A description of why the console or the process couldn't be created.
pub fn spawn(exe: &Path, args: &[&str], cwd: &Path) -> Result<Spawned, String> {
  let err = |e: &dyn std::fmt::Display| e.to_string();
  let pair = native_pty_system()
    .openpty(CONSOLE_SIZE)
    .map_err(|e| err(&e))?;
  let mut cmd = CommandBuilder::new(exe);
  cmd.args(args);
  cmd.cwd(cwd);
  let mut child = pair.slave.spawn_command(cmd).map_err(|e| err(&e))?;
  drop(pair.slave);
  let pid = child.process_id();
  let killer = child.clone_killer();
  let reader = pair.master.try_clone_reader().map_err(|e| err(&e))?;
  let input: SharedInput = Arc::new(Mutex::new(pair.master.take_writer().map_err(|e| err(&e))?));
  let master = pair.master;

  // Both the console and the child only offer blocking APIs, so each gets a
  // small thread that reports back over a channel.
  let (line_tx, output) = mpsc::unbounded_channel();
  let pump_input = Arc::clone(&input);
  std::thread::spawn(move || pump(reader, &pump_input, &line_tx));
  let (exit_tx, exit) = oneshot::channel();
  std::thread::spawn(move || {
    let code = child.wait().ok().map(|status| status.exit_code());
    // The console only reports end-of-output once it is closed. Closing it
    // flushes whatever the program printed last, which `pump` still reads.
    drop(master);
    let _ = exit_tx.send(code);
  });

  Ok(Spawned {
    process: PtyProcess {
      pid,
      killer: Mutex::new(killer),
      input,
    },
    output,
    exit,
  })
}

impl PtyProcess {
  pub const fn pid(&self) -> Option<u32> {
    self.pid
  }

  /// Press Ctrl+Break in the program's console: the way to ask a console
  /// program to shut down, giving it the chance to save first.
  ///
  /// # Errors
  /// If the console has already closed.
  pub fn send_ctrl_break(&self) -> std::io::Result<()> {
    let mut input = self.input.lock().unwrap_or_else(PoisonError::into_inner);
    input.write_all(CTRL_BREAK)?;
    input.flush()
  }

  /// End the program immediately, without letting it clean up.
  ///
  /// # Errors
  /// If the OS refuses (e.g. the program has already exited).
  pub fn kill(&self) -> std::io::Result<()> {
    self
      .killer
      .lock()
      .unwrap_or_else(PoisonError::into_inner)
      .kill()
  }
}

fn pump(mut reader: Box<dyn Read + Send>, input: &SharedInput, tx: &mpsc::UnboundedSender<Output>) {
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
          let mut input = input.lock().unwrap_or_else(PoisonError::into_inner);
          let _ = input.write_all(&b"\x1b[1;1R".repeat(out.cursor_queries));
          let _ = input.flush();
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
