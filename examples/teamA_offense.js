// IA d'équipe A respectant strictement la spécification officielle Futsal AI v1.0
function onTick(gameState, dt) {
  const api = createPlayerAPI(gameState, gameState.me);
  const me = api.getMe();

  const context = {
    api,
    me,
    teammates: api.getTeammates(),
    opponents: api.getOpponents(),
    field: api.getFieldSize(),
    center: api.getCenter(),
    ball: api.getBallPosition(),
    attackDir: api.getTeam() === 0 || api.getTeam() === 'blue' ? 1 : -1,
    ballTouched: Boolean(gameState?.ball?.lastTouchPlayerId || gameState?.ballControl?.playerId),
  };

  if (!context.ballTouched) {
    return handleKickoffA(context).build();
  }

  if (me.number === 1) return playKeeperA(context).build();
  if (api.hasBall()) return playCarrierA(context).build();
  return playOffBallA(context).build();
}

function handleKickoffA(ctx) {
  const { api, me, teammates, field, center, ball, attackDir } = ctx;
  const maxNumber = Math.max(me.number, ...teammates.map((p) => p.number));
  const halfLimit = field.width / 2;

  // Respecte la contrainte de moitié de terrain
  const clampToHalf = (x) => {
    if (attackDir === 1) return Math.min(x, halfLimit);
    return Math.max(x, halfLimit);
  };

  if (me.number === maxNumber) {
    const anchor = { x: clampToHalf(ball.x - attackDir * 3), y: ball.y };
    return api.goTo(anchor).sprintIfFar(12);
  }

  // Positionnement équilibré en 1-2 structure (mid-block par défaut)
  const laneYOffset = me.number === 2 ? -36 : 36;
  const depth = attackDir === 1 ? center.x - field.width * 0.15 : center.x + field.width * 0.15;
  const spot = { x: clampToHalf(depth), y: center.y + laneYOffset };
  return api.goTo(spot).sprintIfFar(20);
}

function playKeeperA(ctx) {
  const { api, me, ball, attackDir } = ctx;
  const ownGoal = api.getOwnGoalPosition();
  const distanceToBall = Math.hypot(ball.x - ownGoal.x, ball.y - ownGoal.y);
  const keeperZone = 70;
  const baseOffset = 14;

  const dirX = ball.x - ownGoal.x;
  const dirY = ball.y - ownGoal.y;
  const norm = Math.hypot(dirX, dirY) || 1;
  const progress = Math.min(keeperZone, Math.max(baseOffset, distanceToBall * 0.4));

  let target = {
    x: ownGoal.x + (dirX / norm) * progress,
    y: ownGoal.y + (dirY / norm) * progress,
  };

  // Reste sur l'axe but-ballon et à l'intérieur de la zone gardien
  if (attackDir === 1) {
    target.x = Math.min(target.x, ownGoal.x + keeperZone);
    target.x = Math.max(target.x, ownGoal.x + 6);
  } else {
    target.x = Math.max(target.x, ownGoal.x - keeperZone);
    target.x = Math.min(target.x, ownGoal.x - 6);
  }
  target.y = Math.min(Math.max(target.y, ownGoal.y - 72), ownGoal.y + 72);

  let builder = api.goTo(target).sprintIfFar(38);

  if (api.hasBall()) {
    builder = distributeFromKeeperA(ctx, builder);
  } else if (api.isBallClose(16)) {
    builder = builder.clearBall(0.95);
  }

  return builder;
}

function distributeFromKeeperA(ctx, builder) {
  const { api, teammates, opponents, attackDir } = ctx;

  const isPassLaneSafe = (mate) => {
    const start = api.getBallPosition();
    const end = { x: mate.x, y: mate.y };
    const threshold = 18;

    return opponents.every((opp) => {
      const proj = projectionPointToSegment(opp, start, end);
      const dist = Math.hypot(opp.x - proj.x, opp.y - proj.y);
      return dist > threshold;
    });
  };

  const candidates = teammates
    .map((p) => {
      const space = freeSpaceAround(p, opponents);
      return { player: p, score: p.x * attackDir + space, safe: isPassLaneSafe(p) };
    })
    .filter((c) => c.safe)
    .sort((a, b) => b.score - a.score);

  if (candidates.length) {
    return builder.passTo(candidates[0].player, 0.8);
  }

  // Aucun relais sûr : dégagement long sur les ailes
  const angle = attackDir === 1 ? 0.22 : -0.22;
  const dir = { x: Math.cos(angle) * attackDir, y: Math.sin(angle) };
  return builder.kick(0.98, dir);
}

function playCarrierA(ctx) {
  const { api, me, opponents, attackDir } = ctx;
  const opponentGoal = api.getOpponentGoalPosition();
  const underPressure = detectPressure(me, opponents, attackDir);

  let builder = api.goTo({ x: me.x + attackDir * 26, y: me.y }).sprint(true);

  if (underPressure) {
    const pass = findSafePass(ctx, true);
    if (pass) return builder.passTo(pass, 0.78);

    const evadeDir = { x: attackDir * 0.2, y: underPressure.side }; // léger crochet
    return builder.kick(0.25, evadeDir);
  }

  const closeToGoal = api.distanceToOpponentGoal() < 95;
  const clearLane = isShootingLaneClear(api, opponents, opponentGoal);
  if (closeToGoal && clearLane) {
    return builder.shoot(0.95);
  }

  const supportPass = findSafePass(ctx, false);
  if (supportPass) return builder.passTo(supportPass, 0.72);

  return builder;
}

function playOffBallA(ctx) {
  const { api, me, ball, opponents, field, attackDir } = ctx;
  const closestDefender = opponents.reduce(
    (best, opp) => {
      const dist = Math.hypot((opp.x ?? 0) - me.x, (opp.y ?? 0) - me.y);
      return dist < best.dist ? { player: opp, dist } : best;
    },
    { player: null, dist: Infinity }
  );

  // Se démarquer : écarte-toi du défenseur le plus proche
  const away = closestDefender.player
    ? normalizeVector(me.x - closestDefender.player.x, me.y - closestDefender.player.y)
    : { x: attackDir * 0.5, y: 0 };

  const advance = attackDir * 28;
  let target = {
    x: me.x + advance,
    y: me.y + away.y * 30,
  };

  // Limite de profondeur dynamique
  const ballInOwnHalf = attackDir === 1 ? ball.x <= field.width / 2 : ball.x >= field.width / 2;
  const maxDepth = ballInOwnHalf ? field.width * 0.6 : field.width * 0.78;
  const ownGoalX = api.getOwnGoalPosition().x;
  const projectedDepth = Math.abs(target.x - ownGoalX);
  const allowedDepth = Math.min(projectedDepth, maxDepth);
  target.x = ownGoalX + Math.sign(attackDir) * allowedDepth;

  // Repli rapide si perte de balle (ballon dans notre moitié)
  if (!api.hasBall() && (attackDir === 1 ? ball.x < api.getCenter().x : ball.x > api.getCenter().x)) {
    target = { x: ownGoalX + attackDir * field.width * 0.2, y: api.getCenter().y + away.y * 40 };
  }

  return api.goTo(target).sprintIfFar(22);
}

function detectPressure(me, opponents, attackDir) {
  const forward = { x: attackDir, y: 0 };
  let pressured = null;

  for (const opp of opponents) {
    const toOpp = { x: opp.x - me.x, y: opp.y - me.y };
    const dist = Math.hypot(toOpp.x, toOpp.y);
    if (dist > 40) continue;

    const angleCos = dot(forward, toOpp) / ((Math.hypot(forward.x, forward.y) || 1) * dist || 1);
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, angleCos))) * (180 / Math.PI);
    if (angleDeg <= 60) {
      pressured = { side: Math.sign(toOpp.y) || 1 };
      break;
    }
  }

  return pressured;
}

function findSafePass(ctx, forwardBias) {
  const { api, teammates, opponents, attackDir } = ctx;

  let candidate = null;
  let bestScore = -Infinity;

  for (const mate of teammates) {
    const laneClear = isPassLaneClear(api.getBallPosition(), mate, opponents);
    if (!laneClear) continue;
    const spacing = freeSpaceAround(mate, opponents);
    const depth = (mate.x || 0) * attackDir;
    const score = spacing + depth * (forwardBias ? 1.2 : 0.8);
    if (score > bestScore) {
      bestScore = score;
      candidate = mate;
    }
  }

  return candidate;
}

function isPassLaneClear(start, end, opponents) {
  const threshold = 12;
  return opponents.every((opp) => {
    const proj = projectionPointToSegment(opp, start, end);
    return Math.hypot(opp.x - proj.x, opp.y - proj.y) > threshold;
  });
}

function isShootingLaneClear(api, opponents, goal) {
  const start = api.getBallPosition();
  const threshold = 10;
  return opponents.every((opp) => {
    const proj = projectionPointToSegment(opp, start, goal);
    return Math.hypot(opp.x - proj.x, opp.y - proj.y) > threshold;
  });
}

function projectionPointToSegment(point, start, end) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, c1 / c2));
  return { x: start.x + t * vx, y: start.y + t * vy };
}

function freeSpaceAround(player, opponents) {
  let closest = Infinity;
  for (const opp of opponents) {
    const dist = Math.hypot((opp.x ?? 0) - player.x, (opp.y ?? 0) - player.y);
    if (dist < closest) closest = dist;
  }
  return closest;
}

function normalizeVector(x, y) {
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}

function dot(a, b) {
  return (a.x || 0) * (b.x || 0) + (a.y || 0) * (b.y || 0);
}

module.exports = { onTick };
