import { DEFAULT_CONFIG } from './config.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const COLORS = {
  blue: '#2b8bff',
  orange: '#ff8c2b',
  pitch: '#0da3cb',
  border: '#f45b5b',
  lines: '#e6f6ff',
  shadow: '#0e2230aa',
  ball: '#fff',
};

const PITCH = {
  margin: 28,
  lineWidth: 4,
  areaRadius: 110,
  penaltySpotOffset: 86,
  secondarySpotOffset: 150,
  cornerArcRadius: 12,
  goal: { height: 170, depth: 28 },
};

const ui = {
  teamAInput: document.getElementById('teamAInput'),
  teamBInput: document.getElementById('teamBInput'),
  teamAFile: document.getElementById('teamAFile'),
  teamBFile: document.getElementById('teamBFile'),
  startButton: document.getElementById('startButton'),
  statusText: document.getElementById('statusText'),
};

const field = {
  width: canvas.width,
  height: canvas.height,
};

const FORMATIONS = {
  blue: [
    { x: 0.11, y: 0.50 },
    { x: 0.30, y: 0.32 },
    { x: 0.30, y: 0.68 },
    { x: 0.56, y: 0.38 },
    { x: 0.56, y: 0.62 },
  ],
  orange: [
    { x: 0.89, y: 0.50 },
    { x: 0.70, y: 0.32 },
    { x: 0.70, y: 0.68 },
    { x: 0.44, y: 0.38 },
    { x: 0.44, y: 0.62 },
  ],
};

const HALF_DURATION = 180; // seconds

const state = {
  tick: 0,
  started: false,
  paused: false,
  lastUpdate: performance.now(),
  aiAccumulator: 0,
  aiBlue: null,
  aiOrange: null,
  players: [],
  ball: createBall(),
  ballControl: { playerId: null, cooldownUntil: 0 },
  score: { blue: 0, orange: 0 },
  half: 1,
  timeRemaining: HALF_DURATION,
  pendingKickoff: null,
  kickoffTeam: 'blue',
};

function createBall() {
  return {
    x: field.width / 2,
    y: field.height / 2,
    vx: 0,
    vy: 0,
    radius: DEFAULT_CONFIG.ball.radius,
  };
}

function createPlayers() {
  const toPlayer = (team, idx, pos) => ({
    team,
    number: idx + 1,
    x: pos.x * field.width,
    y: pos.y * field.height,
    vx: 0,
    vy: 0,
    stamina: 1,
  });

  state.players = [
    ...FORMATIONS.blue.map((pos, i) => toPlayer('blue', i, pos)),
    ...FORMATIONS.orange.map((pos, i) => toPlayer('orange', i, pos)),
  ];
}

function resetForKickoff(team) {
  createPlayers();
  Object.assign(state.ball, createBall());
  state.ballControl = { playerId: null, cooldownUntil: 0 };
  state.kickoffTeam = team;
  state.pendingKickoff = performance.now() + DEFAULT_CONFIG.game.postGoalPause * 1000;
}

function updateStatus(text) {
  ui.statusText.textContent = text;
}

function updateButtonState() {
  const ready = true; // allow using bundled AIs even without uploads
  ui.startButton.disabled = !ready;
  if (!state.started) {
    updateStatus('Prêt à lancer la partie !');
  }
}

function parseFileAI(file, fallback) {
  return new Promise((resolve) => {
    if (!file) return resolve(fallback);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const module = { exports: {} };
        const factory = new Function('module', 'exports', `${reader.result}; return module.exports.onTick || onTick;`);
        const onTick = factory(module, module.exports);
        resolve(typeof onTick === 'function' ? onTick : fallback);
      } catch (err) {
        console.error('Erreur de chargement IA', err);
        resolve(fallback);
      }
    };
    reader.onerror = () => resolve(fallback);
    reader.readAsText(file);
  });
}

function handleFile(teamKey, file) {
  if (teamKey === 'teamAFile') {
    state.aiBlue = null;
  } else {
    state.aiOrange = null;
  }

  const target = teamKey === 'teamAFile' ? ui.teamAFile : ui.teamBFile;
  target.textContent = file ? file.name : 'Aucun fichier';

  const fallback = teamKey === 'teamAFile' ? defaultAggressiveAI : defaultDefensiveAI;

  parseFileAI(file, fallback)
    .then((ai) => {
      if (teamKey === 'teamAFile') state.aiBlue = ai; else state.aiOrange = ai;
      updateStatus('IA chargée, prête à jouer.');
    });

  updateButtonState();
}

function initUI() {
  ui.teamAInput.addEventListener('change', (e) => handleFile('teamAFile', e.target.files[0]));
  ui.teamBInput.addEventListener('change', (e) => handleFile('teamBFile', e.target.files[0]));
  ui.startButton.addEventListener('click', () => {
    if (ui.startButton.disabled) return;
    state.started = true;
    resetForKickoff('blue');
    updateStatus('Match en cours — les scripts sont chargés.');
  });
  updateButtonState();
}

  function defaultAggressiveAI(gameState) {
    const { me, ball, field, players } = gameState;
    const attackDir = me.team === 'blue' ? 1 : -1;
    const goal = { x: attackDir === 1 ? field.width - 12 : 12, y: field.height / 2 };
    const distToBall = Math.hypot(ball.x - me.x, ball.y - me.y);
    const closeToBall = distToBall < DEFAULT_CONFIG.kick.controlRadius * 1.1;
    const distToGoal = Math.hypot(goal.x - me.x, goal.y - me.y);

    const teammates = players.filter((p) => p.team === me.team && p.number !== me.number);
    const opponents = players.filter((p) => p.team !== me.team);
    const bestPass = pickPassTarget(me, teammates, opponents, attackDir);

    const moveTarget = closeToBall && bestPass
      ? { x: bestPass.x, y: bestPass.y }
      : { x: ball.x + attackDir * 10, y: ball.y };

    let kick = null;
    if (distToBall < DEFAULT_CONFIG.kick.kickRange) {
      const alignedWithGoal = Math.abs(ball.y - goal.y) < 120;
      if (distToGoal < 220 && alignedWithGoal) {
        kick = aimKick(ball, goal, 0.92);
      } else if (bestPass) {
        const lead = attackDir * 16;
        const target = { x: bestPass.x + lead, y: bestPass.y };
        kick = aimKick(ball, target, 0.65);
      } else {
        const pushTarget = { x: ball.x + attackDir * 60, y: ball.y };
        kick = aimKick(ball, pushTarget, 0.45);
      }
    }

    const dx = moveTarget.x - me.x;
    const dy = moveTarget.y - me.y;
    const dist = Math.hypot(dx, dy) || 1;
    return { move: { x: dx / dist, y: dy / dist }, sprint: dist > 110, kick };
  }

  function defaultDefensiveAI(gameState) {
    const { me, ball, field, players } = gameState;
    const defendX = me.team === 'blue' ? field.width * 0.28 : field.width * 0.72;
    const defendY = field.height / 2 + (me.number % 2 === 0 ? -70 : 70);
    const attackDir = me.team === 'blue' ? 1 : -1;
    const goal = { x: attackDir === 1 ? field.width - 12 : 12, y: field.height / 2 };

    const distToBall = Math.hypot(ball.x - me.x, ball.y - me.y);
    const stayHome = Math.abs(ball.x - defendX) > 120;
    const moveTarget = stayHome
      ? { x: defendX, y: defendY }
      : { x: ball.x * 0.25 + defendX * 0.75, y: ball.y * 0.3 + defendY * 0.7 };

    const teammates = players.filter((p) => p.team === me.team && p.number !== me.number);
    const opponents = players.filter((p) => p.team !== me.team);
    const bestPass = pickPassTarget(me, teammates, opponents, attackDir);

    let kick = null;
    if (distToBall < DEFAULT_CONFIG.kick.kickRange) {
      const distToGoal = Math.hypot(goal.x - me.x, goal.y - me.y);
      if (distToGoal < 250 && Math.abs(me.y - goal.y) < 140) {
        kick = aimKick(ball, goal, 0.85);
      } else if (bestPass) {
        const target = { x: bestPass.x + attackDir * 12, y: bestPass.y };
        kick = aimKick(ball, target, 0.6);
      } else {
        const clearance = { x: ball.x + attackDir * 90, y: field.height / 2 };
        kick = aimKick(ball, clearance, 0.5);
      }
    }

    const dx = moveTarget.x - me.x;
    const dy = moveTarget.y - me.y;
    const dist = Math.hypot(dx, dy) || 1;
    return { move: { x: dx / dist, y: dy / dist }, sprint: dist > 120, kick };
  }

  function buildDecision(me, ball, targetX, targetY, isLeftSide) {
    const dx = targetX - me.x;
    const dy = targetY - me.y;
    const dist = Math.hypot(dx, dy) || 1;
    const move = { x: dx / dist, y: dy / dist };
    const sprint = dist > 90;

    let kick = null;
    const distToBall = Math.hypot(ball.x - me.x, ball.y - me.y);
    if (distToBall < DEFAULT_CONFIG.kick.kickRange) {
      const goalX = isLeftSide ? field.width - 8 : 8;
      const goalY = field.height / 2;
      const gx = goalX - ball.x;
      const gy = goalY - ball.y;
      const gNorm = Math.hypot(gx, gy) || 1;
      kick = { power: 0.85, dirX: gx / gNorm, dirY: gy / gNorm };
    }

    return { move, sprint, kick };
  }

function aimKick(from, target, power) {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const norm = Math.hypot(dx, dy) || 1;
  return { power, dirX: dx / norm, dirY: dy / norm };
}

function pickPassTarget(me, teammates, opponents, attackDir) {
  let best = null;
  let bestScore = -Infinity;
  const maxDist = 260;

  for (const mate of teammates) {
    const dx = mate.x - me.x;
    const dy = mate.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist || attackDir * dx < -24) continue;

    const nearestOpponent = opponents.reduce((min, opp) => Math.min(min, Math.hypot(opp.x - mate.x, opp.y - mate.y)), Infinity);
    const progression = attackDir * dx;
    const spacingScore = Math.min(nearestOpponent, 180) * 0.6;
    const verticalBalance = Math.max(0, 80 - Math.abs(dy)) * 0.2;
    const score = progression * 0.8 + spacingScore + verticalBalance;

    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }

  return best;
}

function getPlayerId(player) {
  return `${player.team}-${player.number}`;
}

  function getAIForPlayer(player) {
    if (player.team === 'blue') return state.aiBlue || defaultAggressiveAI;
    return state.aiOrange || defaultDefensiveAI;
  }

function applyDecision(player, decision, dt) {
  const maxSpeed = DEFAULT_CONFIG.player.maxSpeed * (decision.sprint ? DEFAULT_CONFIG.player.sprintMultiplier : 1);
  const accel = DEFAULT_CONFIG.player.maxAccel;
  player.vx += decision.move.x * accel * dt;
  player.vy += decision.move.y * accel * dt;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = (player.vx / speed) * maxSpeed;
    player.vy = (player.vy / speed) * maxSpeed;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  clampToField(player);

  if (decision.kick && Math.hypot(player.x - state.ball.x, player.y - state.ball.y) < DEFAULT_CONFIG.kick.kickRange) {
    const power = DEFAULT_CONFIG.kick.maxPower * decision.kick.power;
    state.ball.vx = decision.kick.dirX * power;
    state.ball.vy = decision.kick.dirY * power;
    state.ballControl = { playerId: null, cooldownUntil: performance.now() + DEFAULT_CONFIG.kick.controlTimeoutOnKick };
  }
}

function clampToField(player) {
  const r = DEFAULT_CONFIG.player.radius + 6;
  const left = PITCH.margin + r;
  const right = field.width - PITCH.margin - r;
  const top = PITCH.margin + r;
  const bottom = field.height - PITCH.margin - r;

  player.x = Math.min(right, Math.max(left, player.x));
  player.y = Math.min(bottom, Math.max(top, player.y));
}

function updateBallControl(now) {
  const controlRadius = DEFAULT_CONFIG.kick.controlRadius;
  const currentController = state.players.find((p) => getPlayerId(p) === state.ballControl.playerId);

  if (currentController) {
    const dist = Math.hypot(currentController.x - state.ball.x, currentController.y - state.ball.y);
    if (dist > controlRadius * 1.4) {
      state.ballControl.playerId = null;
    }
  }

  if (!state.ballControl.playerId && now >= state.ballControl.cooldownUntil) {
    let bestPlayer = null;
    let bestDist = controlRadius;
    for (const player of state.players) {
      const dist = Math.hypot(player.x - state.ball.x, player.y - state.ball.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlayer = player;
      }
    }
    if (bestPlayer) {
      state.ballControl.playerId = getPlayerId(bestPlayer);
    }
  }

  const controller = state.players.find((p) => getPlayerId(p) === state.ballControl.playerId);
  if (controller) {
    const offsetDirX = controller.vx || (controller.team === 'blue' ? 1 : -1);
    const offsetDirY = controller.vy || 0;
    const norm = Math.hypot(offsetDirX, offsetDirY) || 1;
    const offset = DEFAULT_CONFIG.player.radius + state.ball.radius + 2;

    state.ball.x = controller.x + (offsetDirX / norm) * offset;
    state.ball.y = controller.y + (offsetDirY / norm) * offset;
    state.ball.vx = controller.vx;
    state.ball.vy = controller.vy;
  }
}

function updateBall(dt) {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  b.vx *= DEFAULT_CONFIG.ball.friction;
  b.vy *= DEFAULT_CONFIG.ball.rollingResistance;

  const margin = PITCH.margin;
  const leftLine = margin;
  const rightLine = field.width - margin;
  const topLine = margin;
  const bottomLine = field.height - margin;
  const goalTop = field.height / 2 - PITCH.goal.height / 2;
  const goalBottom = goalTop + PITCH.goal.height;
  const inGoalY = b.y >= goalTop && b.y <= goalBottom;

  if (checkGoal(inGoalY)) return;

  const r = b.radius + 6;
  let bounced = false;

  if (!inGoalY) {
    if (b.x < leftLine + r) {
      b.x = leftLine + r;
      b.vx = Math.abs(b.vx) * DEFAULT_CONFIG.physics.collisionRestitution;
      bounced = true;
    } else if (b.x > rightLine - r) {
      b.x = rightLine - r;
      b.vx = -Math.abs(b.vx) * DEFAULT_CONFIG.physics.collisionRestitution;
      bounced = true;
    }
  } else {
    const leftBack = leftLine - PITCH.goal.depth;
    const rightBack = rightLine + PITCH.goal.depth;
    if (b.x < leftBack + r) {
      b.x = leftBack + r;
      b.vx = Math.abs(b.vx) * DEFAULT_CONFIG.physics.collisionRestitution;
      bounced = true;
    } else if (b.x > rightBack - r) {
      b.x = rightBack - r;
      b.vx = -Math.abs(b.vx) * DEFAULT_CONFIG.physics.collisionRestitution;
      bounced = true;
    }
  }

  if (b.y < topLine + r) {
    b.y = topLine + r;
    b.vy = Math.abs(b.vy) * DEFAULT_CONFIG.physics.collisionRestitution;
    bounced = true;
  } else if (b.y > bottomLine - r) {
    b.y = bottomLine - r;
    b.vy = -Math.abs(b.vy) * DEFAULT_CONFIG.physics.collisionRestitution;
    bounced = true;
  }

  if (inGoalY) {
    if (b.y < goalTop + r) {
      b.y = goalTop + r;
      b.vy = Math.abs(b.vy) * DEFAULT_CONFIG.physics.collisionRestitution;
      bounced = true;
    } else if (b.y > goalBottom - r) {
      b.y = goalBottom - r;
      b.vy = -Math.abs(b.vy) * DEFAULT_CONFIG.physics.collisionRestitution;
      bounced = true;
    }
  }
}

function checkGoal(inGoalY) {
  const leftLine = PITCH.margin;
  const rightLine = field.width - PITCH.margin;
  const scoredLeft = inGoalY && state.ball.x <= leftLine - state.ball.radius;
  const scoredRight = inGoalY && state.ball.x >= rightLine + state.ball.radius;

  if (scoredLeft) {
    state.score.orange += 1;
    updateStatus('But ! Engagement équipe orange.');
    resetForKickoff('orange');
    return true;
  }
  if (scoredRight) {
    state.score.blue += 1;
    updateStatus('But ! Engagement équipe bleue.');
    resetForKickoff('blue');
    return true;
  }
  return false;
}

function processAI(dt) {
  state.aiAccumulator += dt;
  const aiInterval = 1 / DEFAULT_CONFIG.physics.aiTickHz;
  while (state.aiAccumulator >= aiInterval) {
    for (const player of state.players) {
      const ai = getAIForPlayer(player);
      const decision = ai({
        me: player,
        ball: { ...state.ball },
        field: { ...field },
        players: state.players,
        ballControl: { ...state.ballControl },
      }, aiInterval);
      if (!decision || !decision.move) continue;
      applyDecision(player, decision, aiInterval);
    }
    state.aiAccumulator -= aiInterval;
  }
}

function updateTimer(dt) {
  if (state.paused) return;
  state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  if (state.timeRemaining === 0) {
    if (state.half === 1) {
      state.half = 2;
      state.timeRemaining = HALF_DURATION;
      resetForKickoff('orange');
      updateStatus('Début de la 2ème mi-temps.');
    } else {
      state.paused = true;
      updateStatus('Match terminé');
    }
  }
}

function formatTimer() {
  const total = Math.ceil(state.timeRemaining);
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function drawField() {
  ctx.clearRect(0, 0, field.width, field.height);
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(0, 0, field.width, field.height);

  ctx.fillStyle = COLORS.pitch;
  ctx.fillRect(6, 6, field.width - 12, field.height - 12);

  const m = PITCH.margin;
  const w = field.width;
  const h = field.height;

  ctx.strokeStyle = COLORS.lines;
  ctx.lineWidth = PITCH.lineWidth;
  ctx.lineCap = 'round';

  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  ctx.beginPath();
  ctx.moveTo(w / 2, m);
  ctx.lineTo(w / 2, h - m);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(m, h / 2, PITCH.areaRadius, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w - m, h / 2, PITCH.areaRadius, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  const drawSpot = (x, y, radius = 4) => {
    ctx.beginPath();
    ctx.fillStyle = COLORS.lines;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  drawSpot(w / 2, h / 2, 3);
  drawSpot(m + PITCH.penaltySpotOffset, h / 2);
  drawSpot(m + PITCH.secondarySpotOffset, h / 2, 3);
  drawSpot(w - PITCH.penaltySpotOffset - m, h / 2);
  drawSpot(w - PITCH.secondarySpotOffset - m, h / 2, 3);

  const r = PITCH.cornerArcRadius;
  const corners = [
    { x: m, y: m, start: 0, end: Math.PI / 2 },
    { x: w - m, y: m, start: Math.PI / 2, end: Math.PI },
    { x: m, y: h - m, start: -Math.PI / 2, end: 0 },
    { x: w - m, y: h - m, start: Math.PI, end: Math.PI * 1.5 },
  ];
  corners.forEach((corner) => {
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, r, corner.start, corner.end);
    ctx.stroke();
  });

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i += 1) {
    const stripeWidth = (w - 2 * m) / 6;
    ctx.fillRect(m + i * stripeWidth, m, stripeWidth * 0.35, h - 2 * m);
  }
  ctx.restore();

  drawGoals();
}

function drawGoals() {
  const goalHeight = PITCH.goal.height;
  const goalDepth = PITCH.goal.depth;
  const y = field.height / 2 - goalHeight / 2;
  const post = 6;

  ctx.save();
  ctx.shadowColor = COLORS.shadow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#f8fbff';
  ctx.strokeStyle = COLORS.lines;
  ctx.lineWidth = 2;

  ctx.fillRect(PITCH.margin - goalDepth, y + 6, goalDepth, goalHeight - 12);
  ctx.strokeRect(PITCH.margin - goalDepth, y + 6, goalDepth, goalHeight - 12);
  ctx.fillRect(field.width - PITCH.margin, y + 6, goalDepth, goalHeight - 12);
  ctx.strokeRect(field.width - PITCH.margin, y + 6, goalDepth, goalHeight - 12);

  ctx.fillRect(PITCH.margin - post / 2, y, post, goalHeight);
  ctx.fillRect(field.width - PITCH.margin - post / 2, y, post, goalHeight);
  ctx.restore();
}

function drawBall() {
  ctx.beginPath();
  ctx.fillStyle = COLORS.ball;
  ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPlayers() {
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const player of state.players) {
    const color = player.team === 'blue' ? COLORS.blue : COLORS.orange;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(player.x, player.y, DEFAULT_CONFIG.player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0b0b0f';
    ctx.fillText(player.number.toString(), player.x, player.y + 1);
  }
}

function drawOverlay() {
  const timer = formatTimer();
  ctx.fillStyle = '#0f1115aa';
  ctx.fillRect(14, 14, 180, 64);
  ctx.fillRect(field.width - 194, 14, 180, 64);

  ctx.fillStyle = '#e8ecff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${state.score.blue} - ${state.score.orange}`, 26, 42);
  ctx.fillText(`Mi-temps: ${state.half}/2`, 26, 64);

  ctx.textAlign = 'right';
  ctx.fillText(`Temps: ${timer}`, field.width - 26, 42);
  ctx.fillText(`Engagement: ${state.kickoffTeam === 'blue' ? 'Bleus' : 'Oranges'}`, field.width - 26, 64);
}

function drawWaitingOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, field.width, field.height);
  ctx.fillStyle = '#e8ecff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ajoutez les scripts des deux équipes puis cliquez sur Start game', field.width / 2, field.height / 2);
}

function maybeStartKickoff(now) {
  if (state.pendingKickoff && now >= state.pendingKickoff) {
    state.pendingKickoff = null;
    const kickerIndex = state.kickoffTeam === 'blue' ? 0 : 5;
    const kicker = state.players[kickerIndex];
    kicker.x = field.width / 2 + (state.kickoffTeam === 'blue' ? -DEFAULT_CONFIG.player.radius : DEFAULT_CONFIG.player.radius);
    kicker.y = field.height / 2;
    state.ball.x = field.width / 2;
    state.ball.y = field.height / 2;
    state.ball.vx = state.kickoffTeam === 'blue' ? 80 : -80;
    state.ball.vy = 0;
  }
}

function update() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - state.lastUpdate) / 1000);
  state.lastUpdate = now;

  if (state.started && !state.paused) {
    maybeStartKickoff(now);
    processAI(dt);
    updateBallControl(now);
    updateBall(dt);
    updateTimer(dt);
    state.tick += 1;
  }

  drawField();
  if (state.started) {
    drawBall();
    drawPlayers();
    drawOverlay();
  } else {
    drawWaitingOverlay();
  }

  requestAnimationFrame(update);
}

createPlayers();
initUI();
update();
