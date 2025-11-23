import { DEFAULT_CONFIG } from './config.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const COLORS = {
  blue: '#2b8bff',
  orange: '#ff8c2b',
  pitch: '#2b7a2b',
  lines: '#d7f0d7aa',
  ball: '#fff',
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
    { x: 0.14, y: 0.50 },
    { x: 0.28, y: 0.32 },
    { x: 0.28, y: 0.70 },
    { x: 0.44, y: 0.36 },
    { x: 0.44, y: 0.64 },
  ],
  orange: [
    { x: 0.86, y: 0.50 },
    { x: 0.72, y: 0.32 },
    { x: 0.72, y: 0.70 },
    { x: 0.56, y: 0.36 },
    { x: 0.56, y: 0.64 },
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

  parseFileAI(file, teamKey === 'teamAFile' ? defaultAggressiveAI : defaultDefensiveAI)
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
  const { me, ball } = gameState;
  const attackDir = me.team === 'blue' ? 1 : -1;
  const targetX = ball.x + attackDir * 12;
  const targetY = ball.y;
  return buildDecision(me, ball, targetX, targetY, me.team === 'blue');
}

function defaultDefensiveAI(gameState) {
  const { me, ball, field } = gameState;
  const defendX = me.team === 'blue' ? field.width * 0.25 : field.width * 0.75;
  const defendY = field.height / 2 + (me.number % 2 === 0 ? -60 : 60);
  const targetX = (ball.x * 0.2) + defendX * 0.8;
  const targetY = (ball.y * 0.2) + defendY * 0.8;
  return buildDecision(me, ball, targetX, targetY, me.team === 'blue');
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
    state.ball.vx = decision.kick.dirX * power * dt;
    state.ball.vy = decision.kick.dirY * power * dt;
  }
}

function clampToField(player) {
  const r = DEFAULT_CONFIG.player.radius + 6;
  player.x = Math.min(field.width - r, Math.max(r, player.x));
  player.y = Math.min(field.height - r, Math.max(r, player.y));
}

function updateBall(dt) {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  b.vx *= DEFAULT_CONFIG.ball.friction;
  b.vy *= DEFAULT_CONFIG.ball.rollingResistance;

  const r = b.radius + 8;
  let bounced = false;
  if (b.x < r) {
    b.x = r;
    b.vx = Math.abs(b.vx) * DEFAULT_CONFIG.physics.collisionRestitution;
    bounced = true;
  } else if (b.x > field.width - r) {
    b.x = field.width - r;
    b.vx = -Math.abs(b.vx) * DEFAULT_CONFIG.physics.collisionRestitution;
    bounced = true;
  }
  if (b.y < r) {
    b.y = r;
    b.vy = Math.abs(b.vy) * DEFAULT_CONFIG.physics.collisionRestitution;
    bounced = true;
  } else if (b.y > field.height - r) {
    b.y = field.height - r;
    b.vy = -Math.abs(b.vy) * DEFAULT_CONFIG.physics.collisionRestitution;
    bounced = true;
  }

  if (!bounced) {
    checkGoal();
  }
}

function checkGoal() {
  const goalHeight = 180;
  const goalTop = field.height / 2 - goalHeight / 2;
  const inGoalY = state.ball.y >= goalTop && state.ball.y <= goalTop + goalHeight;

  if (state.ball.x <= 16 && inGoalY) {
    state.score.orange += 1;
    updateStatus('But ! Engagement équipe orange.');
    resetForKickoff('orange');
  } else if (state.ball.x >= field.width - 16 && inGoalY) {
    state.score.blue += 1;
    updateStatus('But ! Engagement équipe bleue.');
    resetForKickoff('blue');
  }
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
  ctx.fillStyle = COLORS.pitch;
  ctx.fillRect(0, 0, field.width, field.height);

  ctx.strokeStyle = COLORS.lines;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, field.width - 20, field.height - 20);
  ctx.beginPath();
  ctx.moveTo(field.width / 2, 10);
  ctx.lineTo(field.width / 2, field.height - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(field.width / 2, field.height / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  drawGoals();
}

function drawGoals() {
  const goalWidth = 30;
  const goalHeight = 180;
  const y = field.height / 2 - goalHeight / 2;

  ctx.fillStyle = '#e6f2ff';
  ctx.strokeStyle = '#1b1f2a';
  ctx.lineWidth = 2;

  ctx.fillRect(14, y, goalWidth, goalHeight);
  ctx.strokeRect(14, y, goalWidth, goalHeight);

  ctx.fillRect(field.width - goalWidth - 14, y, goalWidth, goalHeight);
  ctx.strokeRect(field.width - goalWidth - 14, y, goalWidth, goalHeight);
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
