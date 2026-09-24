// Demo 2-2 forward-bottom (slot 5, tactic "GK + 2-2"): the bottom forward of
// the attacking pair. Makes runs behind the defence in possession, forms the
// high first pressing line when defending, presses when closest, and attacks
// the bottom half of the box.
//
// Ego frame (script-ia-api.md v3.0): own goal at x=0, opponent goal at
// x=100, always attacking left to right.
var held = 0;
var deepSince = 0;

function update(game) {
  const { me, ball, teammates, opponents } = game;
  held = ball.owner === me ? held + 1 : 0;

  if (ball.owner === me) {
    onBall(me, teammates, opponents, 100, held);
    return;
  }

  const mineHasIt = ball.owner !== null && ball.owner.isTeammate;
  if (mineHasIt) {
    // Attack: post on the seam past the marking line, a firm pass
    // over the top finds the run.
    me.moveToward(clamp(ball.position.x + 20, 68, 88), 28);
    return;
  }
  if (ball.owner !== null) {
    const inOwnHalf = ball.position.x < 50;
    // Read the settled build in our half: once it lingers past the press
    // line, drop onto the seam lane in front of the box and seal the deep
    // post — cover beats pressure.
    const ballThreat = ball.position.x < 38;
    deepSince = ballThreat ? deepSince + 1 : 0;
    if (inOwnHalf && deepSince >= 10) {
      me.moveToward(14, 28);
      return;
    }
    // Press: chase as the closest player, or as soon as the ball enters the
    // forward line's pressing radius.
    if (isClosestToBall(game) || distance(me.position, ball.position) < 20) {
      chase(me, ball);
      return;
    }
    if (inOwnHalf) {
      // Collapse between the ball and the own goal: a compact box line.
      me.moveToward(
        clamp(ball.position.x - 12, 22, 38),
        clamp(ball.position.y, 26, 45),
      );
      return;
    }
    // Screen the band otherwise.
    me.moveToward(38, clamp(ball.position.y, 26, 45));
    return;
  }
  if (isClosestToBall(game)) {
    chase(me, ball);
    return;
  }
  me.moveToward(50, 35);
}

function onBall(me, teammates, opponents, attackX, held) {
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
    const outlet = bestPass(me, teammates, opponents, false);
    if (outlet) {
      me.shoot(
        outlet.position.x,
        outlet.position.y,
        passPower(distance(me.position, outlet.position)),
      );
      return;
    }
    me.shoot(62, me.position.y >= 25 ? 40 : 10, 0.95);
    return;
  }

  // In space: carry the ball forward; release it only to a teammate who is
  // clearly better placed (well ahead, open, lane clear), after the shield.
  const target = held >= 2 ? bestPass(me, teammates, opponents, true) : null;
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
function bestPass(me, teammates, opponents, strict) {
  let best = null;
  let bestScore = -Infinity;
  for (const mate of teammates) {
    const d = distance(me.position, mate.position);
    if (d < 6 || d > 46) continue;
    const openness = nearestOpponentDistance(mate.position, opponents);
    if (openness < 5) continue;
    if (laneBlocked(me.position, mate.position, opponents, 4)) continue;
    const progress = mate.position.x - me.position.x;
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

// The closest player of my team to the ball (ties resolved by the lower
// slot) — the engine no longer computes it, two lines of math do.
function isClosestToBall(game) {
  const ball = game.ball.position;
  let best = game.me;
  let bestD = distance(best.position, ball);
  for (const p of [game.me, ...game.teammates]) {
    const d = distance(p.position, ball);
    if (d < bestD || (d === bestD && p.slot < best.slot)) {
      best = p;
      bestD = d;
    }
  }
  return best === game.me;
}

