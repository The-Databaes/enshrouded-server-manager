//! What the OS knows about server processes: resource use of the one we run,
//! and copies of the server started some other way.

use std::path::Path;

use serde::Serialize;
use sysinfo::{
  MemoryRefreshKind, Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System, UpdateKind,
};

use super::SERVER_EXECUTABLE;
use crate::steamcmd::locate::same_path;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
  /// Share of the whole machine's CPU time, 0–100.
  pub cpu_percent: f32,
  /// Physical memory in use (the working set).
  pub memory_bytes: u64,
}

/// The machine's installed memory.
pub fn total_memory() -> u64 {
  System::new_with_specifics(
    RefreshKind::nothing().with_memory(MemoryRefreshKind::nothing().with_ram()),
  )
  .total_memory()
}

/// Samples CPU and memory use of one process. CPU use is measured between
/// two samples, so the first sample only reports memory.
pub struct UsageSampler {
  system: System,
  pid: Pid,
  cpus: f32,
  primed: bool,
}

impl UsageSampler {
  pub fn new(pid: u32) -> Self {
    let cpus = std::thread::available_parallelism().map_or(1, std::num::NonZero::get);
    Self {
      system: System::new(),
      pid: Pid::from_u32(pid),
      // Never more than a few hundred; f32 holds that exactly.
      #[allow(clippy::cast_precision_loss)]
      cpus: cpus as f32,
      primed: false,
    }
  }

  /// `None` once the process has gone.
  pub fn sample(&mut self) -> Option<Usage> {
    self.system.refresh_processes_specifics(
      ProcessesToUpdate::Some(&[self.pid]),
      true,
      ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );
    let process = self.system.process(self.pid)?;
    let cpu = if self.primed {
      (process.cpu_usage() / self.cpus).clamp(0.0, 100.0)
    } else {
      0.0
    };
    self.primed = true;
    Some(Usage {
      cpu_percent: cpu,
      memory_bytes: process.memory(),
    })
  }
}

/// A server process running from `install_dir` (started outside the
/// manager, or left over from an earlier session).
pub fn find_server(install_dir: &Path) -> Option<u32> {
  let mut system = System::new();
  system.refresh_processes_specifics(
    ProcessesToUpdate::All,
    true,
    ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
  );
  system
    .processes()
    .values()
    .find(|p| is_server_in(p, install_dir))
    .map(|p| p.pid().as_u32())
}

/// Force-close the server process `pid`, but only if it really is the
/// server from `install_dir` (process IDs get reused).
pub fn kill_server(pid: u32, install_dir: &Path) -> bool {
  let pid = Pid::from_u32(pid);
  let mut system = System::new();
  system.refresh_processes_specifics(
    ProcessesToUpdate::Some(&[pid]),
    true,
    ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet),
  );
  system
    .process(pid)
    .filter(|p| is_server_in(p, install_dir))
    .is_some_and(sysinfo::Process::kill)
}

fn is_server_in(process: &sysinfo::Process, install_dir: &Path) -> bool {
  process.name().eq_ignore_ascii_case(SERVER_EXECUTABLE)
    && process
      .exe()
      .and_then(Path::parent)
      .is_some_and(|dir| same_path(dir, install_dir))
}
