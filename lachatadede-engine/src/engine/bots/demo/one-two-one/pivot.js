// Demo 1-2-1 pivot (slot 5, tactic "GK + 1-2-1"): the high central striker.
// Posts up in front of the box to finish moves in possession, and presses
// high when defending: jumps at the opponent build-up from the midfield line
// as soon as the ball is in reach, looking to force turnovers up the field.
var held = 0;

function update(game) {
  const { me, ball, teammates, opponents } = game;
  const home = me.team === 'home';
  const X = (x) => (home ? x : 100 - x);
  held = me.hasBall ? held + 1 : 0;

  if (me.hasBall) {
    onBall(me, teammates, opponents, X(100), home ? 1 : -1, home, held);
    return;
  }

  const ownerTeam = ball.owner === null ? null : ball.owner.split('-')[0];
  if (ownerTeam === me.team) {
    // Attack: post deep between the last defender line and the keeper,
    // offset from the ball line so a mirroring defence cannot track the post.
    const bx = home ? ball.position.x : 100 - ball.position.x;
    me.moveToward(
      X(clamp(bx + 20, 86, 88)),
      ball.position.y < 25 ? 20 : 28,
    );
    return;
  }
  if (ownerTeam !== null) {
    // Harass: press the carrier as the closest player, and jump at the
    // opponent build-up from the high line whenever the ball is in reach.
    if (me.isClosestToBall() || distance(me.position, ball.position) < 30) {
      chase(me, ball);
      return;
    }
    // Hold the high pressing line, ready to jump.
    me.moveToward(X(52), clamp(25 + (ball.position.y - 25) * 0.5, 12, 38));
    return;
  }
  if (me.isClosestToBall()) {
    chase(me, ball);
    return;
  }
  me.moveToward(X(62), 25);
}

function onBall(me, teammates, opponents, attackX, dir, home, held) {
  const distGoal = Math.abs(me.position.x - attackX);
  const keeper = opponents.find((o) => o.slot === 1) ?? null;
  const cornerY = keeper && keeper.position.y >= 25 ? 17 : 33;

  // Tap-in: the keeper cannot cover the far corner from this close; an open
  // shot is also taken whenever the keeper is drawn far enough off it.
  const keeperGap = keeper ? Math.abs(keeper.position.y - cornerY) : Infinity;
  // A keeper holding the carrier's side is committed away from the far
  // corner, so he no longer clogs the shot lane.
  const keeperCommitted = Boolean(
    keeper
    && Math.abs(keeper.position.y - 25) > 1
    && (keeper.position.y - 25) * (me.position.y >= 25 ? 1 : -1) > 0,
  );
  const blockers = keeperCommitted ? opponents.filter((o) => o !== keeper) : opponents;
  const laneClear = !laneBlocked(me.position, { x: attackX, y: cornerY }, blockers, 2.5);
  if (laneClear
      && (distGoal < 12
        || (distGoal < 30 && keeperGap > 0.26 * distGoal + 2.4))) {
    me.shoot(attackX, cornerY, 1);
    return;
  }

  // Pressed: release the ball to the least-marked open teammate, or clear —
  // but only once the reception shield has allowed a first turn (markers
  // converge on the reception point, so an instant outlet restarts the
  // scramble). A defender inside 3 forces the release immediately.
  const nearest = nearestOpponentDistance(me.position, opponents);
  if (nearest < 4.5 && (held >= 2 || nearest < 3)) {
    const outlet = bestPass(me, teammates, opponents, dir, false);
    if (outlet) {
      me.shoot(
        outlet.position.x,
        outlet.position.y,
        passPower(distance(me.position, outlet.position)),
      );
      return;
    }
    me.shoot(home ? 62 : 38, me.position.y >= 25 ? 40 : 10, 0.95);
    return;
  }

  // In space: carry the ball forward; release it only to a teammate who is
  // clearly better placed (well ahead, open, lane clear), after the shield.
  const target = held >= 2 ? bestPass(me, teammates, opponents, dir, true) : null;
  if (target) {
    me.shoot(
      target.position.x,
      target.position.y,
      passPower(distance(me.position, target.position)),
    );
    return;
  }

  dribbleAtGoal(me, opponents, attackX);
}

function dribbleAtGoal(me, opponents, attackX) {
  let nearest = null;
  let nd = Infinity;
  for (const o of opponents) {
    const d = distance(me.position, o.position);
    if (d < nd) {
      nd = d;
      nearest = o;
    }
  }
  const ty = nearest && nd < 8
    ? me.position.y + (me.position.y >= nearest.position.y ? 12 : -12)
    : 25 + (me.position.y - 25) * 0.5;
  me.dribble(attackX, clamp(ty, 4, 46));
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
function bestPass(me, teammates, opponents, dir, strict) {
  let best = null;
  let bestScore = -Infinity;
  for (const mate of teammates) {
    const d = distance(me.position, mate.position);
    if (d < 6 || d > 46) continue;
    const openness = nearestOpponentDistance(mate.position, opponents);
    if (openness < 5) continue;
    if (laneBlocked(me.position, mate.position, opponents, 4)) continue;
    const progress = dir * (mate.position.x - me.position.x);
    if (strict && progress < 10) continue;
    const score = progress
      + 1.5 * Math.min(openness, 12)
      - 0.2 * d;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

// Friction-aware pass power: deliveries arrive with about 1.0 of residual
// speed (v0 = 0.05*d + v), so markers converge one step too late.
function passPower(d) {
  return clamp((d + 20) / 50, 0.35, 1);
}

// Lead pursuit: aim slightly ahead of a moving ball.
function chase(me, ball) {
  me.moveToward(
    clamp(ball.position.x + ball.velocity.vx * 3, 0, 100),
    clamp(ball.position.y + ball.velocity.vy * 3, 0, 50),
  );
}
