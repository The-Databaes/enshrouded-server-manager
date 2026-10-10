//! Understanding SteamCMD's console output.

/// A progress report parsed from one line of output.
#[derive(Debug, Clone, PartialEq)]
pub struct Progress {
  /// 0–100.
  pub percent: f64,
  /// What SteamCMD says it is doing, e.g. "downloading", "verifying install".
  pub label: Option<String>,
  /// Bytes done / bytes in total, when SteamCMD reports them.
  pub current: Option<u64>,
  pub total: Option<u64>,
}

/// Parse a progress line. Understands SteamCMD's self-update format
/// (`[ 45%] Downloading update (17,768 of 39,457 KB)...`) and the
/// `app_update` format
/// (`Update state (0x61) downloading, progress: 54.03 (4760829688 / 8811579458)`).
pub fn parse_progress(line: &str) -> Option<Progress> {
  let line = line.trim();
  if let Some((pct, rest)) = line.strip_prefix('[').and_then(|r| r.split_once("%]")) {
    let percent = pct.trim().parse::<f64>().ok()?;
    let rest = rest.trim();
    let label = rest
      .split_once(" (")
      .map_or(rest, |(l, _)| l)
      .trim_end_matches('.');
    // "(17,768 of 39,457 KB)"
    let (current, total) = rest
      .split_once('(')
      .and_then(|(_, r)| r.split_once(" KB)"))
      .and_then(|(nums, _)| nums.split_once(" of "))
      .map_or((None, None), |(a, b)| (kb(a), kb(b)));
    return Some(Progress {
      percent: clamp(percent),
      label: (!label.is_empty()).then(|| label.to_owned()),
      current,
      total,
    });
  }

  let (head, rest) = line.split_once(", progress: ")?;
  let label = head
    .strip_prefix("Update state (")
    .and_then(|r| r.split_once(") "))
    .map(|(_, l)| l.trim().to_owned());
  let mut parts = rest.split_whitespace();
  let percent = parts.next()?.parse::<f64>().ok()?;
  // "(4760829688 / 8811579458)"
  let current = parts
    .next()
    .and_then(|s| s.trim_start_matches('(').parse().ok());
  let total = parts
    .nth(1)
    .and_then(|s| s.trim_end_matches(')').parse().ok());
  Some(Progress {
    percent: clamp(percent),
    label,
    current,
    total: total.filter(|&t: &u64| t > 0),
  })
}

fn kb(s: &str) -> Option<u64> {
  s.trim()
    .replace(',', "")
    .parse::<u64>()
    .ok()
    .map(|k| k * 1024)
}

fn clamp(p: f64) -> f64 {
  if p.is_finite() {
    p.clamp(0.0, 100.0)
  } else {
    0.0
  }
}

/// Sizes SteamCMD logs when an `app_update` starts transferring. The console
/// progress counter tracks `stage` bytes (the uncompressed files being
/// written), while `download` is what actually comes over the network:
/// Steam's chunks are compressed, so it is typically far smaller (for the
/// Enshrouded server, 3.7 GB of downloads become 8.8 GB of files).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UpdatePlan {
  pub download_total: u64,
  pub stage_total: u64,
}

/// Parse `content_log.txt`'s
/// `AppID 2278520 update started : download 0/3734339456, store 0/0, reuse 0/0, delta 0/0, stage 0/8811579458`.
pub fn parse_update_started(line: &str, app_id: &str) -> Option<UpdatePlan> {
  let (_, rest) = line.split_once(&format!("AppID {app_id} update started : "))?;
  let (mut download_total, mut stage_total) = (None, None);
  for part in rest.split(',') {
    let Some((name, counts)) = part.trim().split_once(' ') else {
      continue;
    };
    let total = counts
      .split_once('/')
      .and_then(|(_, t)| t.trim().parse::<u64>().ok());
    match name {
      "download" => download_total = total,
      "stage" => stage_total = total,
      _ => {}
    }
  }
  Some(UpdatePlan {
    download_total: download_total?,
    stage_total: stage_total?,
  })
}

/// The verdict SteamCMD prints at the end of an `app_update`.
#[derive(Debug, PartialEq, Eq)]
pub enum AppUpdateResult {
  Success,
  Failed(String),
}

/// Recognise `Success! App '2278520' fully installed.` and the various
/// `ERROR! …` / `Error! App '…' state is 0x… after update job.` lines.
pub fn parse_app_update_result(line: &str) -> Option<AppUpdateResult> {
  let line = line.trim();
  if line.starts_with("Success! App ") {
    return Some(AppUpdateResult::Success);
  }
  if line
    .get(..6)
    .is_some_and(|p| p.eq_ignore_ascii_case("error!"))
  {
    return Some(AppUpdateResult::Failed(explain_error(line)));
  }
  None
}

/// Add a plain-English hint to the error codes people actually hit.
fn explain_error(line: &str) -> String {
  let hint = if line.contains("0x202") {
    Some("There isn't enough free disk space.")
  } else if line.contains("No subscription") {
    Some("Steam refused the download for this account.")
  } else if line.contains("Missing configuration") {
    Some("Steam hadn't sent the app's details yet. Trying again usually fixes it.")
  } else {
    None
  };
  match hint {
    Some(hint) => format!("{line} {hint}"),
    None => line.to_owned(),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_self_update_progress() {
    assert_eq!(
      parse_progress("[ 45%] Downloading update (17,768 of 39,457 KB)..."),
      Some(Progress {
        percent: 45.0,
        label: Some("Downloading update".into()),
        current: Some(17_768 * 1024),
        total: Some(39_457 * 1024),
      })
    );
    assert_eq!(
      parse_progress("[100%] Download Complete.").map(|p| p.percent),
      Some(100.0)
    );
    assert_eq!(parse_progress("[----] Verifying installation..."), None);
  }

  #[test]
  fn parses_app_update_progress() {
    assert_eq!(
      parse_progress(" Update state (0x61) downloading, progress: 54.03 (4760829688 / 8811579458)"),
      Some(Progress {
        percent: 54.03,
        label: Some("downloading".into()),
        current: Some(4_760_829_688),
        total: Some(8_811_579_458),
      })
    );
    assert_eq!(
      parse_progress(
        " Update state (0x5) verifying install, progress: 89.85 (7917294592 / 8811579458)"
      )
      .and_then(|p| p.label),
      Some("verifying install".into())
    );
    let reconfiguring = parse_progress(" Update state (0x3) reconfiguring, progress: 0.00 (0 / 0)");
    assert_eq!(reconfiguring.and_then(|p| p.total), None);
    assert_eq!(parse_progress("Loading Steam API...OK"), None);
  }

  #[test]
  fn parses_update_plan_from_content_log() {
    // Real lines from steamcmd/logs/content_log.txt.
    let line = "[2026-10-10 19:44:25] AppID 2278520 update started : download 0/3734339456, store 0/0, reuse 0/0, delta 0/0, stage 0/8811579458 ";
    assert_eq!(
      parse_update_started(line, "2278520"),
      Some(UpdatePlan {
        download_total: 3_734_339_456,
        stage_total: 8_811_579_458,
      })
    );
    // The Steamworks redistributable is updated alongside; ignore it.
    let redist = "[2026-10-10 19:44:25] AppID 228980 update started : download 0/25108528, store 0/0, reuse 0/0, delta 0/0, stage 0/25674515 ";
    assert_eq!(parse_update_started(redist, "2278520"), None);
    assert_eq!(
      parse_update_started("Current download rate: 370.133 Mbps", "2278520"),
      None
    );
  }

  #[test]
  fn parses_app_update_results() {
    assert_eq!(
      parse_app_update_result("Success! App '2278520' fully installed."),
      Some(AppUpdateResult::Success)
    );
    let Some(AppUpdateResult::Failed(msg)) =
      parse_app_update_result("ERROR! Failed to install app '2278520' (Missing configuration)")
    else {
      panic!("expected a failure");
    };
    assert!(msg.contains("Trying again"));
    let Some(AppUpdateResult::Failed(msg)) =
      parse_app_update_result("Error! App '2278520' state is 0x202 after update job.")
    else {
      panic!("expected a failure");
    };
    assert!(msg.contains("disk space"));
    assert_eq!(
      parse_app_update_result("Connecting anonymously to Steam Public...OK"),
      None
    );
  }
}
