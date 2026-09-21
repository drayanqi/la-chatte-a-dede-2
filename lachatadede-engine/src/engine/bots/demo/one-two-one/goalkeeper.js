// Demo 1-2-1 goalkeeper (slot 1, tactic "GK + 1-2-1"): hold the goal line on
// the ball -> own goal centre axis, sweep free or opponent-carried balls that
// reach the box, and open play with a short pass to the deepest open teammate
// when in possession.
function update(game) {
  const { me, ball, teammates, opponents } = game;
  const home = me.team === 'home';
  const lineX = home ? 6 : 94;
  const goalX = home ? 0 : 100;

  if (me.hasBall) {
    distribute(me, teammates, opponents, home);
    return;
  }

  const ownerTeam = ball.owner === null ? null : ball.owner.split('-')[0];

  // Sweep: a free or opponent-carried ball inside our box, close enough to
  // claim it before the attacker does.
  const inOwnBox = home ? ball.position.x < 20 : ball.position.x > 80;
  if (ownerTeam !== me.team && inOwnBox
      && distance(me.position, ball.position) < 16) {
    chase(me, ball);
    return;
  }

  // Hold the line: stand where the ball owner -> goal centre segment crosses
  // the keeper line; shade to the ball itself when the source is already
  // between the keeper and the goal.
  let source = ball.position;
  if (ball.owner !== null) {
    const [ownerTeam, ownerSlot] = ball.owner.split('-');
    const roster = ownerTeam === me.team ? teammates : opponents;
    const owner = roster.find((player) => player.slot === Number(ownerSlot));
    if (owner) source = owner.position;
  }
  let targetY = 25;
  const deltaX = goalX - source.x;
  const crossing = deltaX === 0 ? -1 : (lineX - source.x) / deltaX;
  if (crossing > 0) {
    targetY = source.y + crossing * (25 - source.y);
  } else {
    targetY = ball.position.y;
  }
  me.moveToward(lineX, clamp(targetY, 15, 35));
}

function distribute(me, teammates, opponents, home) {
  if (nearestOpponentDistance(me.position, opponents) >= 4.5) {
    const target = bestPass(me, teammates, opponents, home ? 1 : -1);
    if (target) {
      me.shoot(
        target.position.x,
        target.position.y,
        passPower(distance(me.position, target.position)),
      );
      return;
    }
  }
  // Pressed with no outlet, or no open teammate: clear toward midfield.
  me.shoot(home ? 58 : 42, clamp(me.position.y >= 25 ? 40 : 10, 6, 44), 0.95);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nearestOpponentDistance(point, opponents) {
  let best = Infinity;
  for (const o of opponents) {
    best = Math.min(best, distance(point, o.position));
  }
  return best;
}

function laneBlocked(from, to, opponents, margin) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  for (const o of opponents) {
    let t = lengthSq === 0
      ? 0
      : ((o.position.x - from.x) * dx + (o.position.y - from.y) * dy) / lengthSq;
    t = clamp(t, 0, 1);
    if (distance({ x: from.x + t * dx, y: from.y + t * dy }, o.position) < margin) {
      return true;
    }
  }
  return false;
}

// Most advanced open teammate: clear pass lane, target not crowded, scored
// by forward progress + openness - length.
function bestPass(me, teammates, opponents, dir) {
  let best = null;
  let bestScore = -Infinity;
  for (const mate of teammates) {
    const d = distance(me.position, mate.position);
    if (d < 6 || d > 46) continue;
    const openness = nearestOpponentDistance(mate.position, opponents);
    if (openness < 5) continue;
    if (laneBlocked(me.position, mate.position, opponents, 4)) continue;
    const score = dir * (mate.position.x - me.position.x)
      + 1.5 * Math.min(openness, 12)
      - 0.2 * d;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

// Friction-aware pass power: with 0.95/tick decay the ball travels about
// 42 units per 1.0 of power, so aim just past the receiver.
function passPower(d) {
  return clamp(d / 42, 0.45, 0.95);
}

// Lead pursuit: aim slightly ahead of a moving ball.
function chase(me, ball) {
  me.moveToward(
    clamp(ball.position.x + ball.velocity.vx * 3, 0, 100),
    clamp(ball.position.y + ball.velocity.vy * 3, 0, 50),
  );
}
