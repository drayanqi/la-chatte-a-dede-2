// IA d'équipe B : variantes créatives basées sur la spécification Futsal AI v1.0
function onTick(gameState, dt) {
  const api = createPlayerAPI(gameState, gameState.me);
  const me = api.getMe();

  const ctx = {
    api,
    me,
    mates: api.getTeammates(),
    foes: api.getOpponents(),
    field: api.getFieldSize(),
    center: api.getCenter(),
    ball: api.getBallPosition(),
    attackDir: api.getTeam() === 0 || api.getTeam() === 'blue' ? 1 : -1,
    ballTouched: Boolean(gameState?.ball?.lastTouchPlayerId || gameState?.ballControl?.playerId),
  };

  if (!ctx.ballTouched) {
    return kickoffB(ctx).build();
  }

  if (me.number === 1) return keeperB(ctx).build();
  if (api.hasBall()) return carrierB(ctx).build();
  return offBallB(ctx).build();
}

function kickoffB(ctx) {
  const { api, me, mates, field, center, ball, attackDir } = ctx;
  const halfLimit = field.width / 2;
  const topNumber = Math.max(me.number, ...mates.map((p) => p.number));

  const clampHalf = (x) => (attackDir === 1 ? Math.min(x, halfLimit) : Math.max(x, halfLimit));

  if (me.number === topNumber) {
    const offset = attackDir * -4;
    const spot = { x: clampHalf(ball.x + offset), y: ball.y + (me.y > center.y ? -4 : 4) };
    return api.goTo(spot).sprintIfFar(10);
  }

  // Structure en triangle légèrement asymétrique
  const vertical = me.number === 2 ? -42 : 48;
  const depth = attackDir === 1 ? center.x - field.width * 0.12 : center.x + field.width * 0.12;
  const anchor = { x: clampHalf(depth), y: center.y + vertical };
  return api.goTo(anchor).sprintIfFar(18);
}

function keeperB(ctx) {
  const { api, ball, attackDir, foes } = ctx;
  const ownGoal = api.getOwnGoalPosition();
  const dist = Math.hypot(ball.x - ownGoal.x, ball.y - ownGoal.y);
  const zone = 64;
  const anchor = Math.min(zone, Math.max(12, dist * 0.45));

  const dirX = ball.x - ownGoal.x;
  const dirY = ball.y - ownGoal.y;
  const norm = Math.hypot(dirX, dirY) || 1;

  let target = {
    x: ownGoal.x + (dirX / norm) * anchor,
    y: ownGoal.y + (dirY / norm) * anchor,
  };

  if (attackDir === 1) {
    target.x = Math.min(target.x, ownGoal.x + zone);
    target.x = Math.max(target.x, ownGoal.x + 5);
  } else {
    target.x = Math.max(target.x, ownGoal.x - zone);
    target.x = Math.min(target.x, ownGoal.x - 5);
  }
  target.y = Math.min(Math.max(target.y, ownGoal.y - 68), ownGoal.y + 68);

  let builder = api.goTo(target).sprintIfFar(34);

  if (api.hasBall()) {
    const outlet = selectHybridOutlet(ctx);
    if (outlet) {
      builder = builder.passTo(outlet, 0.82);
    } else {
      const angle = attackDir === 1 ? -0.3 : 0.3;
      const dir = { x: Math.cos(angle) * attackDir, y: Math.sin(angle) };
      builder = builder.kick(0.96, dir);
    }
  } else if (api.isBallClose(15)) {
    builder = builder.clearBall(0.9);
  } else {
    const shooter = foes.find((f) => f && f.hasBall);
    if (shooter && Math.abs(shooter.y - ownGoal.y) < 30) builder = builder.sprint(true);
  }

  return builder;
}

function carrierB(ctx) {
  const { api, me, foes, attackDir } = ctx;
  const pressure = detectPressure(me, foes, attackDir);
  const progressiveTarget = { x: me.x + attackDir * 24, y: me.y + (pressure ? pressure.side * 8 : 0) };
  let builder = api.goTo(progressiveTarget).sprint(true);

  if (pressure) {
    const fastPass = selectHybridOutlet(ctx, true);
    if (fastPass) return builder.passTo(fastPass, 0.78);

    // Crochet agressif si aucune passe franche
    const dodge = { x: attackDir * 0.15, y: -pressure.side };
    return builder.kick(0.32, dodge);
  }

  const goalClose = api.distanceToOpponentGoal() < 88;
  if (goalClose && lineClear(ctx, api.getOpponentGoalPosition(), foes, 11)) {
    return builder.shoot(0.92);
  }

  const combo = selectHybridOutlet(ctx, false);
  if (combo) return builder.passTo(combo, 0.7);

  return builder;
}

function offBallB(ctx) {
  const { api, me, ball, foes, field, attackDir, center } = ctx;
  const ownGoal = api.getOwnGoalPosition();

  const marker = foes.reduce(
    (best, opp) => {
      const d = Math.hypot((opp.x ?? 0) - me.x, (opp.y ?? 0) - me.y);
      return d < best.dist ? { opp, dist: d } : best;
    },
    { opp: null, dist: Infinity }
  );

  const away = marker.opp ? normalize(me.x - marker.opp.x, me.y - marker.opp.y) : { x: 0, y: 0 };

  const stagingDepth = attackDir === 1 ? field.width * 0.55 : field.width * 0.45;
  const attackDepth = attackDir === 1 ? field.width * 0.75 : field.width * 0.25;
  const ballInOwnHalf = attackDir === 1 ? ball.x <= field.width / 2 : ball.x >= field.width / 2;
  const desiredDepth = ballInOwnHalf ? stagingDepth : attackDepth;

  let targetX = ownGoal.x + attackDir * desiredDepth;
  const lateral = me.number === 2 ? -1 : 1;
  let target = { x: targetX, y: center.y + lateral * 44 + away.y * 20 };

  // Repli rapide si perte de balle : ramener le bloc devant le ballon
  const losingShape = attackDir === 1 ? ball.x < center.x : ball.x > center.x;
  if (losingShape) {
    target = {
      x: ownGoal.x + attackDir * field.width * 0.18,
      y: center.y + lateral * 36,
    };
  }

  return api.goTo(target).sprintIfFar(24);
}

function selectHybridOutlet(ctx, forwardFirst = false) {
  const { api, mates, foes, attackDir } = ctx;
  let best = null;
  let bestScore = -Infinity;

  mates.forEach((mate) => {
    if (!lineClear(ctx, mate, foes, 13)) return;
    const depth = (mate.x || 0) * attackDir;
    const space = freeSpace(mate, foes);
    const bias = forwardFirst ? 1.25 : 0.95;
    const score = space + depth * bias;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  });

  return best;
}

function lineClear(ctx, target, foes, threshold = 12) {
  const start = ctx.api.getBallPosition();
  return foes.every((opp) => {
    const proj = projectOnSegment(opp, start, target);
    return Math.hypot(opp.x - proj.x, opp.y - proj.y) > threshold;
  });
}

function detectPressure(me, foes, attackDir) {
  const forward = { x: attackDir, y: 0 };
  for (const opp of foes) {
    const delta = { x: opp.x - me.x, y: opp.y - me.y };
    const dist = Math.hypot(delta.x, delta.y);
    if (dist > 38) continue;
    const cos = dot(forward, delta) / ((Math.hypot(forward.x, forward.y) || 1) * (dist || 1));
    const angle = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
    if (angle <= 60) return { side: Math.sign(delta.y) || 1 };
  }
  return null;
}

function projectOnSegment(point, start, end) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, c1 / c2));
  return { x: start.x + vx * t, y: start.y + vy * t };
}

function freeSpace(player, foes) {
  let min = Infinity;
  foes.forEach((opp) => {
    const d = Math.hypot((opp.x ?? 0) - player.x, (opp.y ?? 0) - player.y);
    if (d < min) min = d;
  });
  return min;
}

function normalize(x, y) {
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}

function dot(a, b) {
  return (a.x || 0) * (b.x || 0) + (a.y || 0) * (b.y || 0);
}

module.exports = { onTick };
