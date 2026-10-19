//! Valve's server query protocol (A2S), which the Steam game server library
//! inside the Enshrouded server answers on its query port. It's how the
//! Steam server browser sees a server, so it is the stable way to tell that
//! the server is up and who is on it: unlike its log lines, it doesn't change
//! when Enshrouded updates.
//!
//! <https://developer.valvesoftware.com/wiki/Server_queries>

use std::io::{self, ErrorKind};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use std::time::Duration;

use tokio::net::UdpSocket;

/// Every single-packet message starts with this.
const SIMPLE_HEADER: [u8; 4] = [0xFF; 4];
/// Responses too big for one packet start with this instead.
const SPLIT_HEADER: [u8; 4] = [0xFE, 0xFF, 0xFF, 0xFF];

const A2S_INFO: u8 = b'T';
const A2S_PLAYER: u8 = b'U';
const S2A_INFO: u8 = b'I';
const S2A_PLAYER: u8 = b'D';
const S2C_CHALLENGE: u8 = b'A';

/// Servers may insist on a fresh challenge more than once; give up after this.
const MAX_CHALLENGES: usize = 3;
/// Big enough for any single A2S packet.
const MAX_PACKET: usize = 1400;

/// What the server says about itself (`A2S_INFO`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Info {
  pub name: String,
  pub map: String,
  pub game: String,
  pub version: String,
  pub players: u8,
  pub max_players: u8,
  pub bots: u8,
}

/// One connected player (`A2S_PLAYER`).
#[derive(Debug, Clone, PartialEq)]
pub struct Player {
  pub name: String,
  pub score: i32,
  /// How long they've been connected.
  pub duration: Duration,
}

/// Ask the server at `addr` for its [`Info`].
///
/// # Errors
/// Timeouts, network errors, or a reply that isn't a valid A2S response.
pub async fn info(addr: SocketAddr, timeout: Duration) -> io::Result<Info> {
  let mut request = SIMPLE_HEADER.to_vec();
  request.push(A2S_INFO);
  request.extend_from_slice(b"Source Engine Query\0");
  // A challenge is appended to the same request when the server asks for one.
  let reply = exchange(addr, timeout, S2A_INFO, |challenge| {
    let mut r = request.clone();
    if let Some(c) = challenge {
      r.extend_from_slice(&c);
    }
    r
  })
  .await?;
  parse_info(&reply)
}

/// Ask the server at `addr` who is connected.
///
/// # Errors
/// Timeouts, network errors, or a reply that isn't a valid A2S response.
pub async fn players(addr: SocketAddr, timeout: Duration) -> io::Result<Vec<Player>> {
  let reply = exchange(addr, timeout, S2A_PLAYER, |challenge| {
    let mut r = SIMPLE_HEADER.to_vec();
    r.push(A2S_PLAYER);
    // -1 asks for a challenge.
    r.extend_from_slice(&challenge.unwrap_or([0xFF; 4]));
    r
  })
  .await?;
  parse_players(&reply)
}

/// Send a request (built for the current challenge, if any) and return the
/// body of the `expected` reply, answering challenges along the way.
async fn exchange(
  addr: SocketAddr,
  timeout: Duration,
  expected: u8,
  request: impl Fn(Option<[u8; 4]>) -> Vec<u8>,
) -> io::Result<Vec<u8>> {
  let local: SocketAddr = if addr.is_ipv4() {
    (Ipv4Addr::UNSPECIFIED, 0).into()
  } else {
    (Ipv6Addr::UNSPECIFIED, 0).into()
  };
  let socket = UdpSocket::bind(local).await?;
  socket.connect(addr).await?;

  let mut challenge = None;
  let mut buf = [0u8; MAX_PACKET];
  for _ in 0..MAX_CHALLENGES {
    socket.send(&request(challenge)).await?;
    let len = tokio::time::timeout(timeout, socket.recv(&mut buf))
      .await
      .map_err(|_| io::Error::new(ErrorKind::TimedOut, "the server didn't answer"))??;
    let packet = buf.get(..len).unwrap_or_default();
    let body = match packet.split_at_checked(4) {
      Some((header, body)) if header == SIMPLE_HEADER => body,
      Some((header, _)) if header == SPLIT_HEADER => {
        return Err(invalid("multi-packet replies aren't supported"));
      }
      _ => return Err(invalid("not an A2S reply")),
    };
    match body.split_first() {
      Some((&kind, rest)) if kind == expected => return Ok(rest.to_vec()),
      Some((&S2C_CHALLENGE, rest)) => {
        challenge = Some(
          rest
            .get(..4)
            .and_then(|c| c.try_into().ok())
            .ok_or_else(|| invalid("truncated challenge"))?,
        );
      }
      Some((&kind, _)) => {
        return Err(invalid(&format!("unexpected reply type 0x{kind:02X}")));
      }
      None => return Err(invalid("empty reply")),
    }
  }
  Err(invalid("the server kept asking for a new challenge"))
}

fn invalid(what: &str) -> io::Error {
  io::Error::new(ErrorKind::InvalidData, what.to_owned())
}

/// The body of an `S2A_INFO` reply (after the type byte).
fn parse_info(body: &[u8]) -> io::Result<Info> {
  let mut r = Reader(body);
  let _protocol = r.u8()?;
  let name = r.string()?;
  let map = r.string()?;
  let _folder = r.string()?;
  let game = r.string()?;
  let _app_id = r.bytes(2)?;
  let players = r.u8()?;
  let max_players = r.u8()?;
  let bots = r.u8()?;
  let _server_type = r.u8()?;
  let _environment = r.u8()?;
  let _visibility = r.u8()?;
  let _vac = r.u8()?;
  // Everything after this is optional; older servers stop early.
  let version = r.string().unwrap_or_default();
  Ok(Info {
    name,
    map,
    game,
    version,
    players,
    max_players,
    bots,
  })
}

/// The body of an `S2A_PLAYER` reply (after the type byte). A list cut short
/// returns the players read so far.
fn parse_players(body: &[u8]) -> io::Result<Vec<Player>> {
  let mut r = Reader(body);
  let count = r.u8()?;
  let mut players = Vec::with_capacity(count.into());
  for _ in 0..count {
    let player = (|| {
      let _index = r.u8()?;
      let name = r.string()?;
      let score = i32::from_le_bytes(r.array()?);
      let seconds = f32::from_le_bytes(r.array()?);
      Ok::<_, io::Error>(Player {
        name,
        score,
        duration: Duration::try_from_secs_f32(seconds).unwrap_or_default(),
      })
    })();
    match player {
      Ok(p) => players.push(p),
      Err(_) => break,
    }
  }
  Ok(players)
}

/// Little-endian reader over a reply.
struct Reader<'a>(&'a [u8]);

impl<'a> Reader<'a> {
  fn bytes(&mut self, n: usize) -> io::Result<&'a [u8]> {
    let (head, rest) = self
      .0
      .split_at_checked(n)
      .ok_or_else(|| invalid("reply ended early"))?;
    self.0 = rest;
    Ok(head)
  }

  fn array<const N: usize>(&mut self) -> io::Result<[u8; N]> {
    self
      .bytes(N)?
      .try_into()
      .map_err(|_| invalid("reply ended early"))
  }

  fn u8(&mut self) -> io::Result<u8> {
    Ok(self.array::<1>()?[0])
  }

  /// A NUL-terminated string. Invalid UTF-8 is replaced, not rejected.
  fn string(&mut self) -> io::Result<String> {
    let end = self
      .0
      .iter()
      .position(|&b| b == 0)
      .ok_or_else(|| invalid("unterminated string"))?;
    let text = String::from_utf8_lossy(self.bytes(end)?).into_owned();
    self.bytes(1)?;
    Ok(text)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn info_body() -> Vec<u8> {
    let mut b = vec![17];
    for s in ["Embervale", "Embervale", "enshrouded", "Enshrouded"] {
      b.extend_from_slice(s.as_bytes());
      b.push(0);
    }
    b.extend_from_slice(&[0, 0]); // app id
    b.extend_from_slice(&[3, 16, 0, b'd', b'w', 0, 0]);
    b.extend_from_slice(b"1.0.0\0");
    b
  }

  #[test]
  fn parses_info() -> io::Result<()> {
    let info = parse_info(&info_body())?;
    assert_eq!(info.name, "Embervale");
    assert_eq!(info.game, "Enshrouded");
    assert_eq!((info.players, info.max_players, info.bots), (3, 16, 0));
    assert_eq!(info.version, "1.0.0");
    Ok(())
  }

  #[test]
  fn info_without_version_is_accepted_but_truncated_info_is_not() {
    let body = info_body();
    let without_version = &body[..body.len() - 6];
    assert!(parse_info(without_version).is_ok_and(|i| i.version.is_empty()));
    assert!(parse_info(&body[..10]).is_err());
  }

  #[test]
  fn parses_players_and_tolerates_a_short_list() -> io::Result<()> {
    let mut body = vec![2, 0];
    body.extend_from_slice(b"Thalia\0");
    body.extend_from_slice(&5i32.to_le_bytes());
    body.extend_from_slice(&90.5f32.to_le_bytes());
    body.extend_from_slice(&[1, b'B']); // second player cut off
    let players = parse_players(&body)?;
    assert_eq!(players.len(), 1);
    assert_eq!(players[0].name, "Thalia");
    assert_eq!(players[0].score, 5);
    assert_eq!(players[0].duration, Duration::from_secs_f32(90.5));
    Ok(())
  }

  /// A fake server that demands a challenge first, like current Steam
  /// game servers do.
  #[tokio::test]
  async fn answers_a_challenge() -> io::Result<()> {
    let server = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0)).await?;
    let addr = server.local_addr()?;
    let fake = tokio::spawn(async move {
      let mut buf = [0u8; MAX_PACKET];
      let (_, from) = server.recv_from(&mut buf).await?;
      server
        .send_to(&[0xFF, 0xFF, 0xFF, 0xFF, S2C_CHALLENGE, 1, 2, 3, 4], from)
        .await?;
      let (len, from) = server.recv_from(&mut buf).await?;
      assert_eq!(&buf[len - 4..len], &[1, 2, 3, 4], "challenge echoed");
      let mut reply = vec![0xFF, 0xFF, 0xFF, 0xFF, S2A_INFO];
      reply.extend(info_body());
      server.send_to(&reply, from).await?;
      Ok::<_, io::Error>(())
    });
    let info = info(addr, Duration::from_secs(2)).await?;
    assert_eq!(info.max_players, 16);
    fake.await.map_err(io::Error::other)??;
    Ok(())
  }
}
