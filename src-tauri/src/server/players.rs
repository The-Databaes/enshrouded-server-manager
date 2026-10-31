//! Who is on the server, as its console tells it.
//!
//! Queries ([`super::a2s`]) say how many players are on, but the console is
//! the only place the server names them along with their Steam IDs. Its
//! wording can change with any Enshrouded update, so this only ever adds
//! detail: lines it doesn't recognise are ignored, and the runtime keeps
//! relying on queries for the player count and whether the server is up.
//!
//! A join prints, in this order (with other lines in between):
//!
//! ```text
//! [online] Added peer 0(1) (steamid:76561198400081236)
//! [session] Unable to find machine for peer 0(1).
//! [session] Add remote machine index 1 (id: 809705657).
//! [server] Machine '1': Player '0(0)' logged in
//! [server] Player 'Brownie' logged in with Permissions:
//! ```
//!
//! so the Steam ID belongs to a peer, the peer to a machine, the machine to
//! a player handle, and the name to the player who logged in just before.
//! A leave prints `[server] Remove Player 'Brownie'`, then
//! `[online] Removed peer 0(1)`, then `[session] Player removed. Player
//! handle: 0(0)`; any one of them is enough.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlinePlayer {
  /// Missing until the server logs it.
  pub name: Option<String>,
  /// 64-bit, so sent as text: JavaScript numbers can't hold it exactly.
  pub steam_id: Option<String>,
  /// The server's handle for the player this session, e.g. `0(0)`.
  pub handle: Option<String>,
  /// Unix ms.
  pub joined_at: u64,
}

#[derive(Debug)]
struct Entry {
  player: OnlinePlayer,
  peer: Option<String>,
}

/// The players the console says are on.
#[derive(Debug, Default)]
pub struct Roster {
  /// Connected peers and their Steam IDs, oldest first.
  peers: Vec<(String, String)>,
  /// Remote machine index → the peer it was added for.
  machines: Vec<(String, String)>,
  /// The peer the server is about to add a machine for.
  peer_awaiting_machine: Option<String>,
  players: Vec<Entry>,
}

impl Roster {
  pub fn is_empty(&self) -> bool {
    self.players.is_empty()
  }

  /// In the order they joined.
  pub fn players(&self) -> Vec<OnlinePlayer> {
    self.players.iter().map(|e| e.player.clone()).collect()
  }

  /// Follow one console line, printed at `at` (unix ms). Returns whether
  /// the player list changed.
  pub fn observe(&mut self, line: &str, at: u64) -> bool {
    if let Some((peer, steam_id)) = added_peer(line) {
      self.peers.retain(|(p, _)| p != peer);
      self.peers.push((peer.to_owned(), steam_id.to_owned()));
      false
    } else if let Some(peer) = after(line, "Unable to find machine for peer ") {
      self.peer_awaiting_machine = Some(peer.trim_end().trim_end_matches('.').to_owned());
      false
    } else if let Some(machine) = after(line, "Add remote machine index ").and_then(first_word) {
      if let Some(peer) = self.peer_awaiting_machine.take() {
        self.machines.retain(|(m, _)| m != machine);
        self.machines.push((machine.to_owned(), peer));
      }
      false
    } else if let Some((machine, handle)) = machine_login(line) {
      self.logged_in(machine, handle, at);
      true
    } else if let Some(name) = named_login(line) {
      self.named(name, at);
      true
    } else if let Some(name) =
      after(line, "[server] Remove Player '").and_then(|r| r.trim_end().strip_suffix('\''))
    {
      self.remove(|e| e.player.name.as_deref() == Some(name))
    } else if let Some(handle) = after(line, "Player removed. Player handle: ").and_then(first_word)
    {
      self.remove(|e| e.player.handle.as_deref() == Some(handle))
    } else if let Some(peer) = after(line, "[online] Removed peer ").and_then(first_word) {
      self.peers.retain(|(p, _)| p != peer);
      self.machines.retain(|(_, p)| p != peer);
      self.remove(|e| e.peer.as_deref() == Some(peer))
    } else {
      false
    }
  }

  /// Drop players who joined before `cutoff` (unix ms): for when queries
  /// say nobody is on, in case a leave was missed.
  pub fn forget_joined_before(&mut self, cutoff: u64) -> bool {
    self.remove(|e| e.player.joined_at < cutoff)
  }

  fn logged_in(&mut self, machine: &str, handle: &str, at: u64) {
    let peer = self
      .machines
      .iter()
      .find(|(m, _)| m == machine)
      .map(|(_, p)| p.clone())
      // Without the machine lines, a peer is still certain when it's the
      // only one waiting for a player.
      .or_else(|| match self.unclaimed_peers().as_slice() {
        [only] => Some((*only).to_owned()),
        _ => None,
      });
    let steam_id = peer.as_deref().and_then(|peer| {
      self
        .peers
        .iter()
        .find(|(p, _)| p == peer)
        .map(|(_, id)| id.clone())
    });
    self
      .players
      .retain(|e| e.player.handle.as_deref() != Some(handle));
    self.players.push(Entry {
      player: OnlinePlayer {
        name: None,
        steam_id,
        handle: Some(handle.to_owned()),
        joined_at: at,
      },
      peer,
    });
  }

  fn named(&mut self, name: &str, at: u64) {
    let latest_unnamed = self
      .players
      .iter_mut()
      .rev()
      .find(|e| e.player.name.is_none());
    match latest_unnamed {
      Some(entry) => entry.player.name = Some(name.to_owned()),
      // The handle line is missing (its wording changed?): the name alone
      // is still worth showing.
      None => self.players.push(Entry {
        player: OnlinePlayer {
          name: Some(name.to_owned()),
          steam_id: None,
          handle: None,
          joined_at: at,
        },
        peer: None,
      }),
    }
  }

  fn unclaimed_peers(&self) -> Vec<&str> {
    self
      .peers
      .iter()
      .map(|(p, _)| p.as_str())
      .filter(|p| !self.players.iter().any(|e| e.peer.as_deref() == Some(*p)))
      .collect()
  }

  /// Remove the first player matching `which`; `true` if there was one.
  fn remove(&mut self, which: impl Fn(&Entry) -> bool) -> bool {
    match self.players.iter().position(which) {
      Some(i) => {
        self.players.remove(i);
        true
      }
      None => false,
    }
  }
}

/// The rest of `line` after `marker`, wherever it is (the log file puts a
/// timestamp in front of what the console shows).
fn after<'a>(line: &'a str, marker: &str) -> Option<&'a str> {
  line.split_once(marker).map(|(_, rest)| rest)
}

fn first_word(s: &str) -> Option<&str> {
  s.split_whitespace().next()
}

/// `[online] Added peer 0(1) (steamid:76561198400081236)`
fn added_peer(line: &str) -> Option<(&str, &str)> {
  let (peer, rest) = after(line, "[online] Added peer ")?.split_once(" (steamid:")?;
  let (steam_id, _) = rest.split_once(')')?;
  let valid =
    !peer.is_empty() && !steam_id.is_empty() && steam_id.bytes().all(|b| b.is_ascii_digit());
  valid.then_some((peer, steam_id))
}

/// `[server] Machine '1': Player '0(0)' logged in` → `("1", "0(0)")`
fn machine_login(line: &str) -> Option<(&str, &str)> {
  let (machine, rest) = after(line, "[server] Machine '")?.split_once("': Player '")?;
  let (handle, rest) = rest.split_once('\'')?;
  rest
    .trim_start()
    .starts_with("logged in")
    .then_some((machine, handle))
}

/// `[server] Player 'Brownie' logged in with Permissions:` → `"Brownie"`
fn named_login(line: &str) -> Option<&str> {
  let (name, _) = after(line, "[server] Player '")?.rsplit_once("' logged in")?;
  (!name.is_empty()).then_some(name)
}

#[cfg(test)]
mod tests {
  use super::*;

  /// What the console printed for a real join (Enshrouded 0.0.15.0).
  const JOIN: &str = r"[online] Session accepted with peer (steamid:76561198400081236)
[online] Added peer 0(1) (steamid:76561198400081236)
[online] Begin auth session with peer 0(1)
[online] Client '76561198400081236' authenticated by steam
[session] Unable to find machine for peer 0(1).
[session] Unable to find machine for peer 0(1).
[session] Add remote machine index 1 (id: 809705657).
[SessionPlayer] started transition from 'Free' to 'Remote_InSession' (current='<invalid>')!
[session] Remote player added. Player handle: 0(0)
[SessionPlayer] 'Reserve' (up)!
[SessionPlayer] 'WaitForJoin' (up)!
[SessionPlayer] finished transition from 'Free' to 'Remote_InSession' (current='Remote_InSession')!
[session] Setting block mask of client 0(0) to 00000001:00000000
[session] Sending new communication allowed mask 00000001 to player 0(0)
[Server] Creating player knowledge replication state for player index 0
[impact] Allocator Usage: 6.37 Peak: 1'069'128
Impact d0d96649-12c8-485f-b697-680278e62f20 runs      3 Times
[twitch_drop] Request succeeded Player '0(0)' drops:
[server] Machine '1': Player '0(0)' logged in
[server] Player 'Brownie' logged in with Permissions:
         - CanAccessInventories
         - CanEditBase
         - CanEditWorld
         - CanExtendBase
         - CanReceiveEXP
[ecss] Replication Checkpoint 1 Set for Player 0 in Tick 107,019
[ecss] Replication Checkpoint Reached for Player 0 in Tick 107,065
[session] Congestion baseline established for machine 1(0)";

  /// And for that player leaving.
  const LEAVE: &str = r"[save2] Server sent final client save for 0(0).
[save2] Received final savegame ack from 0(0)
[server] Remove Entity for Player 'Brownie'
[server] Remove Player 'Brownie'
[Server] Destroying player knowledge replication state for player index 0
[online] Disconnecting peer 0(1)
[online] Removed peer 0(1)
[session] Remove player from session. Not found in online game info. Player Handle: 0(0)
[SessionPlayer] started transition from 'Remote_InSession' to 'Free' (current='<invalid>')!
[SessionPlayer] 'WaitForJoin' (down)!
[session] Player removed. Player handle: 0(0)
[SessionPlayer] 'Reserve' (down)!
[SessionPlayer] finished transition from 'Remote_InSession' to 'Free' (current='Free')!";

  fn feed(roster: &mut Roster, text: &str, at: u64) {
    for line in text.lines() {
      roster.observe(line, at);
    }
  }

  fn player(name: &str, steam_id: &str, handle: &str, joined_at: u64) -> OnlinePlayer {
    OnlinePlayer {
      name: Some(name.into()),
      steam_id: Some(steam_id.into()),
      handle: Some(handle.into()),
      joined_at,
    }
  }

  #[test]
  fn follows_a_real_join_and_leave() {
    let mut roster = Roster::default();
    feed(&mut roster, JOIN, 1000);
    assert_eq!(
      roster.players(),
      [player("Brownie", "76561198400081236", "0(0)", 1000)]
    );
    feed(&mut roster, LEAVE, 2000);
    assert!(roster.is_empty());
    assert!(roster.peers.is_empty() && roster.machines.is_empty());
  }

  #[test]
  fn tells_apart_players_joining_at_once() {
    let mut roster = Roster::default();
    for line in [
      "[online] Added peer 0(1) (steamid:76561198000000001)",
      "[online] Added peer 1(2) (steamid:76561198000000002)",
      "[session] Unable to find machine for peer 1(2).",
      "[session] Add remote machine index 2 (id: 1).",
      "[session] Unable to find machine for peer 0(1).",
      "[session] Add remote machine index 1 (id: 2).",
      "[server] Machine '1': Player '0(0)' logged in",
      "[server] Player 'Thalia' logged in with Permissions:",
      "[server] Machine '2': Player '1(1)' logged in",
      "[server] Player 'Brannoc' logged in with Permissions:",
    ] {
      roster.observe(line, 5);
    }
    assert_eq!(
      roster.players(),
      [
        player("Thalia", "76561198000000001", "0(0)", 5),
        player("Brannoc", "76561198000000002", "1(1)", 5),
      ]
    );
    // Either leave line is enough on its own.
    assert!(roster.observe("[online] Removed peer 1(2)", 6));
    assert!(roster.observe("[session] Player removed. Player handle: 0(0)", 6));
    assert!(roster.is_empty());
  }

  #[test]
  fn reads_log_file_lines_with_timestamps() {
    let mut roster = Roster::default();
    for line in JOIN.lines() {
      roster.observe(&format!("[I 01:02:03,456] {line}"), 7);
    }
    assert_eq!(
      roster.players(),
      [player("Brownie", "76561198400081236", "0(0)", 7)]
    );
  }

  #[test]
  fn keeps_what_it_can_when_lines_change() {
    // No machine lines: the only peer waiting is still theirs.
    let mut roster = Roster::default();
    roster.observe("[online] Added peer 0(1) (steamid:76561198400081236)", 1);
    roster.observe("[server] Machine '1': Player '0(0)' logged in", 1);
    roster.observe("[server] Player 'O'Neil' logged in with Permissions:", 1);
    assert_eq!(
      roster.players(),
      [player("O'Neil", "76561198400081236", "0(0)", 1)]
    );

    // Only the name line: shown without the rest.
    let mut roster = Roster::default();
    assert!(roster.observe("[server] Player 'Brownie' logged in with Permissions:", 1));
    assert_eq!(roster.players()[0].name.as_deref(), Some("Brownie"));
    assert_eq!(roster.players()[0].steam_id, None);
    assert!(roster.observe("[server] Remove Player 'Brownie'", 2));
    assert!(roster.is_empty());
  }

  #[test]
  fn ignores_unrelated_lines() {
    let mut roster = Roster::default();
    for line in [
      "[online] Removing all peers",
      "[session] Add local machine index 0 (id: 0).",
      "[twitch_drop] Request succeeded Player '0(0)' drops:",
      "[server] Remove Entity for Player 'Brownie'",
      "[online] Added peer 0(1) (steamid:not-a-number)",
    ] {
      assert!(!roster.observe(line, 1), "{line}");
    }
    assert!(roster.is_empty() && roster.peers.is_empty() && roster.machines.is_empty());
  }

  #[test]
  fn forgets_players_who_joined_before_a_time() {
    let mut roster = Roster::default();
    feed(&mut roster, JOIN, 1000);
    assert!(!roster.forget_joined_before(1000));
    assert!(roster.forget_joined_before(1001));
    assert!(roster.is_empty());
  }
}
