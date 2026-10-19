//! Running the dedicated server: starting and stopping it, its live console,
//! and whether it's up.
//!
//! Only process-level facts and Valve's query protocol are relied on, never
//! the wording of the server's log: the server is "running" once it answers
//! queries ([`super::a2s`]), "stopped" once its process has exited, and it is
//! stopped the way an admin would at its console, with Ctrl+Break, which
//! makes it save the world first.

use std::collections::VecDeque;
use std::net::{SocketAddr, UdpSocket};
use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use serde::Serialize;
use tokio::sync::{mpsc, oneshot, watch};
use tokio_util::sync::CancellationToken;

use super::processes::{self, Usage, UsageSampler};
use super::settings::ServerSettings;
use super::{a2s, SERVER_EXECUTABLE};
use crate::error::{Error, Result};
use crate::pty::{self, Output, PtyProcess};
use crate::util::{now, now_ms};

/// Console lines kept for the UI (the server's own log file has the rest).
pub const MAX_LOG_LINES: usize = 5000;
/// Player counts kept for the chart: one a minute for a day.
const MAX_HISTORY: usize = 24 * 60;
const HISTORY_INTERVAL: Duration = Duration::from_mins(1);
/// How often CPU/memory are sampled and the status is pushed to the UI.
const SAMPLE_INTERVAL: Duration = Duration::from_secs(2);
/// How often the server is queried while it starts up, then once it's up.
const QUERY_INTERVAL_STARTING: Duration = Duration::from_secs(2);
const QUERY_INTERVAL_RUNNING: Duration = Duration::from_secs(5);
const QUERY_TIMEOUT: Duration = Duration::from_millis(1500);
/// Missed queries in a row before a running server counts as unresponsive.
const UNRESPONSIVE_AFTER: u32 = 3;
/// Console output is sent to the UI in batches at most this often.
const LOG_FLUSH_INTERVAL: Duration = Duration::from_millis(100);
/// How long a big world gets to save before the server is forced to close.
pub const STOP_TIMEOUT: Duration = Duration::from_mins(3);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
  Stopped,
  /// The process is up but hasn't answered a query yet.
  Starting,
  Running,
  /// Asked to shut down; saving and closing.
  Stopping,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ExitReason {
  /// Shut down when asked.
  Requested,
  /// Force-closed (by the user, or after not stopping in time).
  Forced,
  /// Exited without being asked: a crash, or closed from outside.
  Unexpected,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitInfo {
  pub reason: ExitReason,
  pub code: Option<u32>,
  /// Unix ms.
  pub at: u64,
  pub ran_for_ms: u64,
}

/// What the server reports about itself over the query protocol.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryInfo {
  pub name: String,
  pub version: String,
  pub players: u8,
  pub max_players: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlinePlayer {
  pub name: String,
  pub connected_secs: u64,
}

/// Everything the UI shows about the running server. Pushed on every change
/// as the `server://status` event.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
  /// Increases with every change, so out-of-order updates can be dropped.
  pub revision: u64,
  pub phase: Phase,
  pub pid: Option<u32>,
  /// Unix ms.
  pub started_at: Option<u64>,
  /// When it first answered a query (unix ms).
  pub online_at: Option<u64>,
  pub stop_requested_at: Option<u64>,
  /// Address queries are sent to, e.g. `127.0.0.1:15637`.
  pub query_address: Option<String>,
  /// `false` when a running server stopped answering queries.
  pub responding: bool,
  pub usage: Option<Usage>,
  pub total_memory_bytes: u64,
  pub query: Option<QueryInfo>,
  pub players: Vec<OnlinePlayer>,
  pub last_exit: Option<ExitInfo>,
  /// A server running from the same folder that the manager didn't start.
  pub external_pid: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LineKind {
  /// Printed by the server.
  Output,
  /// A note from the manager (e.g. "Stopping the server…").
  Info,
  /// A problem the manager ran into.
  Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
  /// Increases by one per line, across runs.
  pub seq: u64,
  /// Unix ms.
  pub at: u64,
  pub kind: LineKind,
  pub text: String,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerSample {
  /// Unix seconds.
  pub at: u64,
  pub players: u8,
}

/// Where status changes and console output go (the UI, in the app).
pub trait Events: Send + Sync + 'static {
  fn status(&self, status: &RuntimeStatus);
  fn log(&self, lines: &[LogLine]);
}

pub const STATUS_EVENT: &str = "server://status";
pub const LOG_EVENT: &str = "server://log";

impl<R: tauri::Runtime> Events for tauri::AppHandle<R> {
  fn status(&self, status: &RuntimeStatus) {
    use tauri::Emitter;
    let _ = self.emit(STATUS_EVENT, status);
  }

  fn log(&self, lines: &[LogLine]) {
    use tauri::Emitter;
    let _ = self.emit(LOG_EVENT, lines);
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StopKind {
  Requested,
  Forced,
}

/// The process we started, while it runs.
struct Run {
  process: Arc<PtyProcess>,
  started: Instant,
  started_at: u64,
  online_at: Option<u64>,
  stop: Option<(StopKind, Instant, u64)>,
  query_address: SocketAddr,
  failed_queries: u32,
  usage: Option<Usage>,
  query: Option<QueryInfo>,
  players: Vec<OnlinePlayer>,
}

struct State {
  revision: u64,
  phase: Phase,
  run: Option<Run>,
  last_exit: Option<ExitInfo>,
  external_pid: Option<u32>,
}

struct Shared {
  events: Arc<dyn Events>,
  state: Mutex<State>,
  log: Mutex<LogBuffer>,
  history: Mutex<VecDeque<PlayerSample>>,
  phase: watch::Sender<Phase>,
  total_memory: u64,
  /// Held for the whole of a start so two can't race.
  starting: Mutex<()>,
}

/// The dedicated server process and everything known about it while it runs.
pub struct ServerRuntime {
  shared: Arc<Shared>,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
  // Every critical section leaves the data consistent, so a panic elsewhere
  // doesn't make it unusable.
  m.lock().unwrap_or_else(PoisonError::into_inner)
}

impl ServerRuntime {
  pub fn new(events: Arc<dyn Events>) -> Self {
    Self {
      shared: Arc::new(Shared {
        events,
        state: Mutex::new(State {
          revision: 0,
          phase: Phase::Stopped,
          run: None,
          last_exit: None,
          external_pid: None,
        }),
        log: Mutex::new(LogBuffer::default()),
        history: Mutex::new(VecDeque::new()),
        phase: watch::channel(Phase::Stopped).0,
        total_memory: processes::total_memory(),
        starting: Mutex::new(()),
      }),
    }
  }

  pub fn status(&self) -> RuntimeStatus {
    self.shared.status()
  }

  /// The status, after checking whether a server the manager didn't start
  /// is running from `install_dir` (only looked for while ours is stopped).
  pub fn status_checking_external(&self, install_dir: Option<&Path>) -> RuntimeStatus {
    if self.phase() == Phase::Stopped {
      let external = install_dir.and_then(processes::find_server);
      if external != lock(&self.shared.state).external_pid {
        self.shared.change(|s| s.external_pid = external);
      }
    }
    self.status()
  }

  pub fn phase(&self) -> Phase {
    lock(&self.shared.state).phase
  }

  /// Whether the server process is up (in any phase but stopped).
  pub fn is_active(&self) -> bool {
    self.phase() != Phase::Stopped
  }

  /// Fails with a message about `action` while the server is running.
  pub fn ensure_stopped(&self, action: &str) -> Result<()> {
    if self.is_active() {
      return Err(Error::ServerRunning(format!(
        "Stop the server first: {action} while it's running."
      )));
    }
    Ok(())
  }

  pub fn log_lines(&self) -> Vec<LogLine> {
    lock(&self.shared.log).lines.iter().cloned().collect()
  }

  pub fn player_history(&self) -> Vec<PlayerSample> {
    lock(&self.shared.history).iter().copied().collect()
  }

  /// Start the server installed in `install_dir`. The caller has checked
  /// that the install is complete and that nothing is changing its files.
  pub fn start(&self, install_dir: &Path) -> Result<RuntimeStatus> {
    let _starting = lock(&self.shared.starting);
    if self.is_active() {
      return Err(Error::ServerRunning(
        "The server is already running.".into(),
      ));
    }
    let exe = install_dir.join(SERVER_EXECUTABLE);
    if !exe.is_file() {
      return Err(Error::Server(format!("{} is missing.", exe.display())));
    }
    if let Some(pid) = processes::find_server(install_dir) {
      self.shared.change(|s| s.external_pid = Some(pid));
      return Err(Error::ServerRunning(format!(
        "The server in this folder is already running outside the manager (process {pid}). Stop it there first."
      )));
    }
    let settings = ServerSettings::read(install_dir);
    if let Some(problem) = &settings.problem {
      self.shared.log(
        LineKind::Error,
        [format!("{problem} The server may not start.")],
      );
    }
    let address = settings.query_addr();
    check_port_free(&settings)?;

    self
      .shared
      .log(LineKind::Info, [format!("> {}", quote(&exe))]);
    let spawned = pty::spawn(&exe, &[], install_dir).map_err(|e| {
      let message = format!("Couldn't start the server: {e}");
      self.shared.log(LineKind::Error, [message.clone()]);
      Error::Server(message)
    })?;
    let process = Arc::new(spawned.process);
    let pid = process.pid();
    let done = CancellationToken::new();
    let status = self.shared.change(|s| {
      s.phase = Phase::Starting;
      s.external_pid = None;
      s.run = Some(Run {
        process,
        started: Instant::now(),
        started_at: now_ms(),
        online_at: None,
        stop: None,
        query_address: address,
        failed_queries: 0,
        usage: None,
        query: None,
        players: Vec::new(),
      });
    });
    tauri::async_runtime::spawn(watch_process(
      Arc::clone(&self.shared),
      spawned.output,
      spawned.exit,
      done.clone(),
    ));
    tauri::async_runtime::spawn(monitor(Arc::clone(&self.shared), pid, address, done));
    Ok(status)
  }

  /// Ask the server to save and shut down. Returns straight away; the status
  /// moves to stopped once it has exited.
  pub fn stop(&self) -> Result<RuntimeStatus> {
    let mut process = None;
    let status = self.shared.change(|s| {
      if let Some(run) = s.run.as_mut().filter(|r| r.stop.is_none()) {
        run.stop = Some((StopKind::Requested, Instant::now(), now_ms()));
        process = Some(Arc::clone(&run.process));
        s.phase = Phase::Stopping;
      }
    });
    let Some(process) = process else {
      return Ok(status);
    };
    self.shared.log(
      LineKind::Info,
      ["Asking the server to save the world and shut down…".to_owned()],
    );
    if let Err(err) = process.send_ctrl_break() {
      // Without its console there's no way to ask nicely.
      self.shared.log(
        LineKind::Error,
        [format!(
          "Couldn't reach the server's console ({err}). Forcing it to close."
        )],
      );
      return self.kill();
    }
    Ok(self.status())
  }

  /// Close the server immediately. Anything since its last save is lost.
  pub fn kill(&self) -> Result<RuntimeStatus> {
    let mut process = None;
    let status = self.shared.change(|s| {
      if let Some(run) = s.run.as_mut() {
        let requested = run
          .stop
          .map_or((Instant::now(), now_ms()), |(_, i, at)| (i, at));
        run.stop = Some((StopKind::Forced, requested.0, requested.1));
        process = Some(Arc::clone(&run.process));
        s.phase = Phase::Stopping;
      }
    });
    if let Some(process) = process {
      self
        .shared
        .log(LineKind::Info, ["Forcing the server to close.".to_owned()]);
      process
        .kill()
        .map_err(|e| Error::Server(format!("Couldn't force the server to close: {e}")))?;
    }
    Ok(status)
  }

  /// Wait until the server process has exited (immediately if it isn't
  /// running).
  pub async fn wait_stopped(&self) {
    let mut phase = self.shared.phase.subscribe();
    let _ = phase.wait_for(|p| *p == Phase::Stopped).await;
  }

  /// Stop the server and wait for it to exit, forcing it after `timeout`.
  pub async fn shut_down(&self, timeout: Duration) {
    if !self.is_active() {
      return;
    }
    if self.stop().is_err() {
      let _ = self.kill();
    }
    if tokio::time::timeout(timeout, self.wait_stopped())
      .await
      .is_err()
    {
      let _ = self.kill();
      let _ = tokio::time::timeout(Duration::from_secs(10), self.wait_stopped()).await;
    }
  }

  /// Force-close a server that the manager didn't start.
  pub fn kill_external(&self, pid: u32, install_dir: &Path) -> Result<RuntimeStatus> {
    if !processes::kill_server(pid, install_dir) {
      return Err(Error::Server(format!(
        "Process {pid} isn't the server from this folder any more, or couldn't be closed."
      )));
    }
    self.shared.log(
      LineKind::Info,
      [format!(
        "Forced the server started outside the manager (process {pid}) to close."
      )],
    );
    // Give Windows a moment to tear it down before looking again.
    for _ in 0..20 {
      if processes::find_server(install_dir).is_none() {
        break;
      }
      std::thread::sleep(Duration::from_millis(100));
    }
    Ok(self.status_checking_external(Some(install_dir)))
  }
}

impl Shared {
  fn status(&self) -> RuntimeStatus {
    lock(&self.state).status(self.total_memory)
  }

  /// Apply a change, then tell the UI. Returns the new status.
  fn change(&self, f: impl FnOnce(&mut State)) -> RuntimeStatus {
    let status = {
      let mut state = lock(&self.state);
      f(&mut state);
      state.revision += 1;
      self.phase.send_replace(state.phase);
      state.status(self.total_memory)
    };
    self.events.status(&status);
    status
  }

  fn log(&self, kind: LineKind, texts: impl IntoIterator<Item = String>) {
    let lines = lock(&self.log).push(kind, texts);
    if !lines.is_empty() {
      self.events.log(&lines);
    }
  }

  fn record_players(&self, players: u8) {
    let mut history = lock(&self.history);
    if history.len() == MAX_HISTORY {
      history.pop_front();
    }
    history.push_back(PlayerSample { at: now(), players });
  }

  /// The process has exited: record how, and go back to stopped.
  fn finished(&self, code: Option<u32>) {
    let mut exit = None;
    self.change(|s| {
      s.phase = Phase::Stopped;
      if let Some(run) = s.run.take() {
        let reason = match run.stop {
          None => ExitReason::Unexpected,
          Some((StopKind::Requested, ..)) => ExitReason::Requested,
          Some((StopKind::Forced, ..)) => ExitReason::Forced,
        };
        let info = ExitInfo {
          reason,
          code,
          at: now_ms(),
          ran_for_ms: u64::try_from(run.started.elapsed().as_millis()).unwrap_or(u64::MAX),
        };
        exit = Some(info.clone());
        s.last_exit = Some(info);
      }
    });
    let code_text = code.map_or_else(|| "unknown".to_owned(), describe_exit_code);
    match exit.map(|e| e.reason) {
      Some(ExitReason::Requested) => self.log(
        LineKind::Info,
        [format!(
          "The server saved and stopped (exit code {code_text})."
        )],
      ),
      Some(ExitReason::Forced) => self.log(
        LineKind::Info,
        ["The server was forced to close.".to_owned()],
      ),
      _ => self.log(
        LineKind::Error,
        [format!(
          "The server stopped unexpectedly (exit code {code_text})."
        )],
      ),
    }
    self.record_players(0);
  }
}

impl State {
  fn status(&self, total_memory: u64) -> RuntimeStatus {
    let run = self.run.as_ref();
    RuntimeStatus {
      revision: self.revision,
      phase: self.phase,
      pid: run.and_then(|r| r.process.pid()),
      started_at: run.map(|r| r.started_at),
      online_at: run.and_then(|r| r.online_at),
      stop_requested_at: run.and_then(|r| r.stop.map(|(_, _, at)| at)),
      query_address: run.map(|r| r.query_address.to_string()),
      responding: run
        .is_some_and(|r| r.online_at.is_some() && r.failed_queries < UNRESPONSIVE_AFTER),
      usage: run.and_then(|r| r.usage),
      total_memory_bytes: total_memory,
      query: run.and_then(|r| r.query.clone()),
      players: run.map(|r| r.players.clone()).unwrap_or_default(),
      last_exit: self.last_exit.clone(),
      external_pid: self.external_pid,
    }
  }
}

/// Forward the server's console to the log until it exits, then record the
/// exit.
async fn watch_process(
  shared: Arc<Shared>,
  mut output: mpsc::UnboundedReceiver<Output>,
  exit: oneshot::Receiver<Option<u32>>,
  done: CancellationToken,
) {
  let mut batch = Vec::new();
  let mut flush = tokio::time::interval(LOG_FLUSH_INTERVAL);
  flush.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
  loop {
    tokio::select! {
      line = output.recv() => match line {
        Some(Output::Line(text)) => batch.push(text),
        // The server prints whole lines; partial ones are just the same line
        // seen early.
        Some(Output::Partial(_)) => {}
        None => break,
      },
      _ = flush.tick(), if !batch.is_empty() => {
        shared.log(LineKind::Output, std::mem::take(&mut batch));
      }
    }
  }
  shared.log(LineKind::Output, batch);
  let code = exit.await.ok().flatten();
  done.cancel();
  shared.finished(code);
}

/// While the server runs: sample its CPU/memory, ask it whether it's up and
/// who's on, push the status to the UI, and enforce the stop timeout.
async fn monitor(
  shared: Arc<Shared>,
  pid: Option<u32>,
  address: SocketAddr,
  done: CancellationToken,
) {
  let mut sampler = pid.map(UsageSampler::new);
  let mut tick = tokio::time::interval(SAMPLE_INTERVAL);
  tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
  let mut next_query = Instant::now();
  let mut next_sample = Instant::now() + HISTORY_INTERVAL;

  loop {
    tokio::select! {
      () = done.cancelled() => return,
      _ = tick.tick() => {}
    }

    // Reading process stats is a blocking OS call.
    let usage = match sampler.take() {
      Some(mut s) => match tokio::task::spawn_blocking(move || (s.sample(), s)).await {
        Ok((usage, s)) => {
          sampler = Some(s);
          usage
        }
        Err(_) => None,
      },
      None => None,
    };

    let phase = *shared.phase.borrow();
    let query = if matches!(phase, Phase::Starting | Phase::Running) && Instant::now() >= next_query
    {
      next_query = Instant::now()
        + if phase == Phase::Starting {
          QUERY_INTERVAL_STARTING
        } else {
          QUERY_INTERVAL_RUNNING
        };
      Some(query(address).await)
    } else {
      None
    };
    if done.is_cancelled() {
      return;
    }

    let mut came_online = None;
    let mut overdue = false;
    let status = shared.change(|s| {
      let Some(run) = s.run.as_mut() else { return };
      run.usage = usage.or(run.usage);
      match query {
        Some(Ok((info, players))) => {
          run.failed_queries = 0;
          if let Some(players) = players {
            run.players = players;
          }
          run.query = Some(info);
          if s.phase == Phase::Starting {
            s.phase = Phase::Running;
            run.online_at = Some(now_ms());
            came_online = Some(run.started.elapsed());
          }
        }
        Some(Err(_)) => run.failed_queries = run.failed_queries.saturating_add(1),
        None => {}
      }
      overdue =
        matches!(run.stop, Some((StopKind::Requested, since, _)) if since.elapsed() > STOP_TIMEOUT);
    });

    if let Some(took) = came_online {
      shared.log(
        LineKind::Info,
        [format!(
          "The server is up: answering on {address} after {}s.",
          took.as_secs()
        )],
      );
    }
    if status.phase == Phase::Running && Instant::now() >= next_sample {
      next_sample = Instant::now() + HISTORY_INTERVAL;
      shared.record_players(status.query.as_ref().map_or(0, |q| q.players));
    }
    if overdue {
      shared.log(
        LineKind::Error,
        [format!(
          "The server didn't shut down within {} minutes.",
          STOP_TIMEOUT.as_secs() / 60
        )],
      );
      let process = lock(&shared.state)
        .run
        .as_ref()
        .map(|r| Arc::clone(&r.process));
      shared.change(|s| {
        if let Some(run) = s.run.as_mut() {
          run.stop = run.stop.map(|(_, i, at)| (StopKind::Forced, i, at));
        }
      });
      if let Some(process) = process {
        let _ = process.kill();
      }
    }
  }
}

/// Ask the server for its info and, if anyone is on, the player list.
async fn query(address: SocketAddr) -> std::io::Result<(QueryInfo, Option<Vec<OnlinePlayer>>)> {
  let info = a2s::info(address, QUERY_TIMEOUT).await?;
  let players = if info.players == 0 {
    Some(Vec::new())
  } else {
    // The count alone is still useful if the list doesn't come back.
    a2s::players(address, QUERY_TIMEOUT).await.ok().map(|list| {
      list
        .into_iter()
        .filter(|p| !p.name.is_empty())
        .map(|p| OnlinePlayer {
          name: p.name,
          connected_secs: p.duration.as_secs(),
        })
        .collect()
    })
  };
  Ok((
    QueryInfo {
      name: info.name,
      version: info.version,
      players: info.players,
      max_players: info.max_players,
    },
    players,
  ))
}

/// The query port must be free, or the server can't take it: usually a
/// sign that another server is already running.
fn check_port_free(settings: &ServerSettings) -> Result<()> {
  match UdpSocket::bind((settings.ip, settings.query_port)) {
    Err(err) if err.kind() == std::io::ErrorKind::AddrInUse => Err(Error::ServerRunning(format!(
      "Port {} is already in use, probably by another server. Stop it, or change \"queryPort\" in the server's settings.",
      settings.query_port
    ))),
    Err(err) if err.kind() == std::io::ErrorKind::AddrNotAvailable => Err(Error::Server(format!(
      "This PC doesn't have the address {} that the server is set to listen on (\"ip\" in its settings).",
      settings.ip
    ))),
    // Free, or a problem for the server itself to report.
    _ => Ok(()),
  }
}

/// Exit codes from a crash are Windows status codes, which are only
/// recognisable in hex (e.g. `0xC0000005`, an access violation).
fn describe_exit_code(code: u32) -> String {
  if code >= 0x8000_0000 {
    format!("{code} / 0x{code:08X}")
  } else {
    code.to_string()
  }
}

fn quote(path: &Path) -> String {
  let s = path.display().to_string();
  if s.contains(' ') {
    format!("\"{s}\"")
  } else {
    s
  }
}

#[derive(Default)]
struct LogBuffer {
  lines: VecDeque<LogLine>,
  next_seq: u64,
}

impl LogBuffer {
  /// Append lines, dropping the oldest past [`MAX_LOG_LINES`]. Returns the
  /// lines as stored.
  fn push(&mut self, kind: LineKind, texts: impl IntoIterator<Item = String>) -> Vec<LogLine> {
    let at = now_ms();
    let added: Vec<LogLine> = texts
      .into_iter()
      .map(|text| {
        self.next_seq += 1;
        LogLine {
          seq: self.next_seq,
          at,
          kind,
          text,
        }
      })
      .collect();
    self.lines.extend(added.iter().cloned());
    let excess = self.lines.len().saturating_sub(MAX_LOG_LINES);
    self.lines.drain(..excess);
    added
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn log_buffer_numbers_lines_and_drops_the_oldest() {
    let mut log = LogBuffer::default();
    let added = log.push(LineKind::Output, ["a".to_owned(), "b".to_owned()]);
    assert_eq!(added.iter().map(|l| l.seq).collect::<Vec<_>>(), [1, 2]);
    log.push(LineKind::Info, (0..MAX_LOG_LINES).map(|i| i.to_string()));
    assert_eq!(log.lines.len(), MAX_LOG_LINES);
    assert_eq!(log.lines.front().map(|l| l.text.as_str()), Some("0"));
    assert_eq!(
      log.lines.back().map(|l| l.seq),
      Some(2 + MAX_LOG_LINES as u64)
    );
  }

  /// Records what the runtime reports, for the live test.
  #[derive(Default)]
  struct Recorder {
    phases: Mutex<Vec<Phase>>,
    lines: Mutex<Vec<String>>,
  }

  impl Events for Recorder {
    fn status(&self, status: &RuntimeStatus) {
      let mut phases = lock(&self.phases);
      if phases.last() != Some(&status.phase) {
        phases.push(status.phase);
      }
    }
    fn log(&self, lines: &[LogLine]) {
      lock(&self.lines).extend(lines.iter().map(|l| l.text.clone()));
    }
  }

  /// Runs the real server: start, wait until it answers queries, stop it
  /// and check it saved. Point `ESM_TEST_SERVER_DIR` at a server install
  /// (not one holding a world you care about), then:
  /// `cargo test -- --ignored live_server_lifecycle --nocapture`
  #[tokio::test(flavor = "multi_thread")]
  #[ignore = "runs the real dedicated server"]
  async fn live_server_lifecycle() -> Result<()> {
    let Some(dir) = std::env::var_os("ESM_TEST_SERVER_DIR").map(std::path::PathBuf::from) else {
      eprintln!("ESM_TEST_SERVER_DIR isn't set; skipping");
      return Ok(());
    };
    let recorder = Arc::new(Recorder::default());
    let runtime = ServerRuntime::new(recorder.clone());

    let started = runtime.start(&dir)?;
    assert_eq!(started.phase, Phase::Starting);
    assert!(runtime.start(&dir).is_err(), "a second start is refused");

    let mut phase = runtime.shared.phase.subscribe();
    // `wait_for` hands back a read guard on the phase; drop it at once, or
    // the runtime can't publish the next change.
    let up = tokio::time::timeout(
      Duration::from_mins(5),
      phase.wait_for(|p| *p == Phase::Running),
    )
    .await
    .is_ok_and(|r| r.is_ok());
    assert!(up, "the server answered queries within 5 minutes");
    // Let a couple of samples come in.
    tokio::time::sleep(SAMPLE_INTERVAL * 3).await;
    let running = runtime.status();
    println!("running: {running:#?}");
    assert!(running.query.is_some());
    assert!(running.usage.is_some_and(|u| u.memory_bytes > 0));
    assert!(running.responding);

    let save_dir = std::path::PathBuf::from(ServerSettings::read(&dir).save_dir);
    let newest_save = || {
      std::fs::read_dir(&save_dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok()?.metadata().ok()?.modified().ok())
        .max()
    };
    let before = newest_save();
    runtime.stop()?;
    assert_eq!(runtime.phase(), Phase::Stopping);
    let stopped = tokio::time::timeout(STOP_TIMEOUT, runtime.wait_stopped()).await;
    assert!(stopped.is_ok(), "the server stopped when asked");

    let status = runtime.status();
    println!("exit: {:?}", status.last_exit);
    assert!(status
      .last_exit
      .is_some_and(|e| e.reason == ExitReason::Requested && e.code == Some(0)));
    assert_eq!(
      *lock(&recorder.phases),
      [
        Phase::Starting,
        Phase::Running,
        Phase::Stopping,
        Phase::Stopped
      ]
    );
    let after = newest_save();
    println!("newest save file: {before:?} before stopping, {after:?} after");
    assert!(after > before, "the world was saved on the way out");
    assert!(runtime.log_lines().len() > 10);

    // A restart: start again the moment it has stopped (the port has to be
    // free by then).
    runtime.start(&dir)?;
    let mut phase = runtime.shared.phase.subscribe();
    let up_again = tokio::time::timeout(
      Duration::from_mins(5),
      phase.wait_for(|p| *p == Phase::Running),
    )
    .await
    .is_ok_and(|r| r.is_ok());
    assert!(up_again, "the server came back up after stopping");

    // A crash: the process dies without being asked.
    let pid = runtime.status().pid;
    assert!(pid.is_some());
    assert_eq!(
      processes::find_server(&dir),
      pid,
      "the running server is found by its folder"
    );
    assert!(pid.is_some_and(|pid| processes::kill_server(pid, &dir)));
    let gone = tokio::time::timeout(Duration::from_secs(30), runtime.wait_stopped()).await;
    assert!(gone.is_ok());
    let exit = runtime.status().last_exit;
    println!("after a crash: {exit:?}");
    assert!(exit.is_some_and(|e| e.reason == ExitReason::Unexpected));
    assert_eq!(processes::find_server(&dir), None);
    Ok(())
  }
}
