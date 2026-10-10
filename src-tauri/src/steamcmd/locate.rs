//! Finding and validating a SteamCMD executable on disk.

use std::path::{Path, PathBuf};

#[cfg(windows)]
pub const EXECUTABLE_NAME: &str = "steamcmd.exe";
#[cfg(not(windows))]
pub const EXECUTABLE_NAME: &str = "steamcmd.sh";

/// Turn whatever the user typed or picked (the SteamCMD folder, or the
/// executable itself) into the path of the executable. The error is a
/// sentence suitable for showing under the input.
pub fn resolve_executable(input: &Path) -> Result<PathBuf, String> {
  if input.as_os_str().is_empty() {
    return Err("Enter the folder SteamCMD is installed in.".into());
  }
  if !input.is_absolute() {
    return Err("Use a full path, e.g. C:\\steamcmd.".into());
  }
  if input.is_dir() {
    let exe = input.join(EXECUTABLE_NAME);
    return if exe.is_file() {
      Ok(exe)
    } else {
      Err(format!("There's no {EXECUTABLE_NAME} in this folder."))
    };
  }
  if input.is_file() {
    return if is_executable_name(input) {
      Ok(input.to_path_buf())
    } else {
      Err(format!("That file isn't {EXECUTABLE_NAME}."))
    };
  }
  Err("That path doesn't exist.".into())
}

fn is_executable_name(path: &Path) -> bool {
  path
    .file_name()
    .and_then(|n| n.to_str())
    .is_some_and(|n| n.eq_ignore_ascii_case(EXECUTABLE_NAME))
}

/// Look in the usual places people install SteamCMD (plus `PATH`) and return
/// every executable found, so the UI can offer them as one-click choices.
pub fn detect(exclude_dir: &Path) -> Vec<PathBuf> {
  let mut dirs: Vec<PathBuf> = Vec::new();
  if let Some(path) = std::env::var_os("PATH") {
    dirs.extend(std::env::split_paths(&path));
  }
  #[cfg(windows)]
  {
    let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
    for name in [
      "steamcmd",
      "SteamCMD",
      "Steam\\steamcmd",
      "Servers\\steamcmd",
    ] {
      dirs.push(PathBuf::from(format!("{drive}\\{name}")));
    }
    for var in [
      "ProgramFiles",
      "ProgramFiles(x86)",
      "USERPROFILE",
      "LOCALAPPDATA",
    ] {
      if let Some(base) = std::env::var_os(var) {
        dirs.push(PathBuf::from(base).join("steamcmd"));
      }
    }
  }
  #[cfg(not(windows))]
  if let Some(home) = std::env::var_os("HOME") {
    dirs.push(PathBuf::from(&home).join("steamcmd"));
    dirs.push(PathBuf::from(&home).join(".steam/steamcmd"));
  }

  let mut found: Vec<PathBuf> = Vec::new();
  for dir in dirs {
    if same_path(&dir, exclude_dir) {
      continue;
    }
    let exe = dir.join(EXECUTABLE_NAME);
    if exe.is_file() && !found.iter().any(|f| same_path(f, &exe)) {
      found.push(exe);
    }
  }
  found
}

/// Path equality that ignores case and trailing separators on Windows, where
/// the filesystem does too.
pub fn same_path(a: &Path, b: &Path) -> bool {
  let norm = |p: &Path| {
    let s = p.to_string_lossy();
    let s = s.trim_end_matches(['\\', '/']);
    if cfg!(windows) {
      s.replace('/', "\\").to_lowercase()
    } else {
      s.to_owned()
    }
  };
  norm(a) == norm(b)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn accepts_folder_or_executable() -> std::io::Result<()> {
    let dir = tempfile::tempdir()?;
    let exe = dir.path().join(EXECUTABLE_NAME);
    std::fs::write(&exe, b"")?;

    assert_eq!(resolve_executable(dir.path()), Ok(exe.clone()));
    assert_eq!(resolve_executable(&exe), Ok(exe));
    Ok(())
  }

  #[test]
  fn rejects_bad_input_with_a_reason() -> std::io::Result<()> {
    let dir = tempfile::tempdir()?;
    let other = dir.path().join("notes.txt");
    std::fs::write(&other, b"")?;

    assert!(resolve_executable(Path::new("")).is_err_and(|e| e.contains("Enter")));
    assert!(resolve_executable(Path::new("steamcmd")).is_err_and(|e| e.contains("full path")));
    assert!(resolve_executable(dir.path()).is_err_and(|e| e.contains("no ")));
    assert!(resolve_executable(&other).is_err_and(|e| e.contains("isn't")));
    assert!(
      resolve_executable(&dir.path().join("missing")).is_err_and(|e| e.contains("doesn't exist"))
    );
    Ok(())
  }

  #[cfg(windows)]
  #[test]
  fn same_path_ignores_case_and_trailing_slash() {
    assert!(same_path(
      Path::new(r"C:\SteamCMD\"),
      Path::new("c:/steamcmd")
    ));
    assert!(!same_path(
      Path::new(r"C:\steamcmd"),
      Path::new(r"C:\steamcmd2")
    ));
  }
}
