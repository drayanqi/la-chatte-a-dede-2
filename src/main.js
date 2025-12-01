import { DEFAULT_CONFIG } from './config.js';
import { createPlayerAPI } from './ai/PlayerAPI.js';
import PhysicsEngine, { createBallInstance, createPlayerInstances } from './sim/PhysicsEngine.js';

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

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function mixColor(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const R = Math.round((t - r) * p) + r;
  const G = Math.round((t - g) * p) + g;
  const B = Math.round((t - b) * p) + b;
  return `rgb(${R}, ${G}, ${B})`;
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

if (typeof window !== 'undefined') {
  window.PlayerAPI = { createPlayerAPI };
  window.createPlayerAPI = createPlayerAPI;
}

const PITCH = {
  margin: 28,
  lineWidth: 4,
  areaRadius: 110,
  penaltySpotOffset: 86,
  secondarySpotOffset: 150,
  cornerArcRadius: 12,
  goal: { height: 170, depth: 28 },
};

const GOAL_FX_DURATION = 2200;

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
    { x: 0.35, y: 0.34 },
    { x: 0.35, y: 0.66 },
  ],
  orange: [
    { x: 0.89, y: 0.50 },
    { x: 0.65, y: 0.34 },
    { x: 0.65, y: 0.66 },
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
  defaultAIs: { blue: null, orange: null },
  physics: new PhysicsEngine(DEFAULT_CONFIG, field, PITCH),
  players: [],
  ball: null,
  ballControl: null,
  currentDecisions: new Map(),
  score: { blue: 0, orange: 0 },
  half: 1,
  timeRemaining: HALF_DURATION,
  pendingKickoff: null,
  kickoffTeam: 'blue',
  visuals: {
    possession: { playerId: null, since: performance.now() },
    shots: new Map(),
    lastShotTime: 0,
    goalCelebration: null,
  },
};

state.ball = state.physics.ball;
state.ballControl = state.physics.ballControl;

function createPlayers() {
  state.players = [
    ...createPlayerInstances(FORMATIONS.blue, 'blue', field.width, field.height, DEFAULT_CONFIG),
    ...createPlayerInstances(FORMATIONS.orange, 'orange', field.width, field.height, DEFAULT_CONFIG),
  ];
  state.physics.setPlayers(state.players);
}

function resetForKickoff(team) {
  createPlayers();
  state.ball = createBallInstance(field, DEFAULT_CONFIG);
  state.physics.setBall(state.ball);
  state.physics.resetBallControl();
  state.ballControl = state.physics.ballControl;
  state.currentDecisions = new Map();
  state.kickoffTeam = team;
  state.pendingKickoff = performance.now() + DEFAULT_CONFIG.game.postGoalPause * 1000;
}

function updateStatus(text) {
  ui.statusText.textContent = text;
}

function updateButtonState() {
  const blueReady = Boolean(state.aiBlue || state.defaultAIs.blue);
  const orangeReady = Boolean(state.aiOrange || state.defaultAIs.orange);
  const ready = blueReady && orangeReady;
  ui.startButton.disabled = !ready;
  if (!state.started) {
    if (ready) {
      updateStatus('Prêt à lancer la partie !');
    } else {
      updateStatus('Chargement des scripts IA...');
    }
  }
}

function compileAIScript(source, fallback = null) {
  try {
    const module = { exports: {} };
    const factory = new Function('module', 'exports', 'createPlayerAPI', `${source}; return module.exports.onTick || onTick;`);
    const onTick = factory(module, module.exports, createPlayerAPI);
    return typeof onTick === 'function' ? onTick : fallback;
  } catch (err) {
    console.error('Erreur de compilation IA', err);
    return fallback;
  }
}

function parseFileAI(file, fallback) {
  return new Promise((resolve) => {
    if (!file) return resolve(fallback);
    const reader = new FileReader();
    reader.onload = () => resolve(compileAIScript(reader.result, fallback));
    reader.onerror = () => resolve(fallback);
    reader.readAsText(file);
  });
}

async function loadAIFromUrl(url) {
  try {
    const res = await fetch(url);
    const source = await res.text();
    return compileAIScript(source, null);
  } catch (err) {
    console.error('Impossible de charger le script IA par défaut', err);
    return null;
  }
}

function handleFile(teamKey, file) {
  if (teamKey === 'teamAFile') {
    state.aiBlue = null;
  } else {
    state.aiOrange = null;
  }

  const target = teamKey === 'teamAFile' ? ui.teamAFile : ui.teamBFile;
  target.textContent = file ? file.name : 'Aucun fichier';

  const fallback = teamKey === 'teamAFile' ? state.defaultAIs.blue : state.defaultAIs.orange;

  parseFileAI(file, fallback)
    .then((ai) => {
      if (teamKey === 'teamAFile') state.aiBlue = ai; else state.aiOrange = ai;
      updateStatus('IA chargée, prête à jouer.');
      updateButtonState();
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

async function loadDefaultAIs() {
  const defaults = [
    { team: 'blue', url: './examples/teamA_offense.js' },
    { team: 'orange', url: './examples/teamB_defense.js' },
  ];

  const results = await Promise.all(defaults.map(async ({ team, url }) => ({ team, ai: await loadAIFromUrl(url) })));

  for (const { team, ai } of results) {
    state.defaultAIs[team] = ai;
  }

  updateButtonState();
  if (!state.started) {
    const missing = results.filter(({ ai }) => !ai).map(({ team }) => team).join(', ');
    if (missing) {
      updateStatus(`Échec du chargement IA par défaut (${missing}). Ajoutez vos scripts manuellement.`);
    } else {
      updateStatus('Scripts exemples chargés, prêts à jouer ou à remplacer.');
    }
  }
}

function getPlayerId(player) {
  return `${player.team}-${player.number}`;
}

function findPlayerById(id) {
  return state.players.find((p) => getPlayerId(p) === id);
}

function getAIForPlayer(player) {
  if (player.team === 'blue') return state.aiBlue || state.defaultAIs.blue;
  return state.aiOrange || state.defaultAIs.orange;
}

function sanitizeDecision(decision) {
  const safeMove = (() => {
    const x = Number.isFinite(decision?.move?.x) ? decision.move.x : 0;
    const y = Number.isFinite(decision?.move?.y) ? decision.move.y : 0;
    const norm = Math.hypot(x, y);
    if (norm > 1) return { x: x / norm, y: y / norm };
    return { x, y };
  })();

  const safeKick = (() => {
    if (!decision?.kick) return null;
    const power = Number.isFinite(decision.kick.power) ? Math.max(0, Math.min(1, decision.kick.power)) : 0;
    const dirX = Number.isFinite(decision.kick.dirX) ? decision.kick.dirX : 0;
    const dirY = Number.isFinite(decision.kick.dirY) ? decision.kick.dirY : 0;
    const norm = Math.hypot(dirX, dirY) || 1;
    return { power, dirX: dirX / norm, dirY: dirY / norm };
  })();

  return {
    move: safeMove,
    sprint: Boolean(decision?.sprint),
    kick: safeKick,
  };
}

function playerHasBall(player) {
  return state.ballControl.playerId === getPlayerId(player);
}

function checkGoal(inGoalY) {
  const leftLine = PITCH.margin;
  const rightLine = field.width - PITCH.margin;
  const scoredLeft = inGoalY && state.ball.x <= leftLine - state.ball.radius;
  const scoredRight = inGoalY && state.ball.x >= rightLine + state.ball.radius;

  if (scoredLeft) {
    state.score.orange += 1;
    updateStatus('But ! Engagement équipe orange.');
    startGoalCelebration('orange');
    resetForKickoff('orange');
    return true;
  }
  if (scoredRight) {
    state.score.blue += 1;
    updateStatus('But ! Engagement équipe bleue.');
    startGoalCelebration('blue');
    resetForKickoff('blue');
    return true;
  }
  return false;
}

function checkGoalFromBall() {
  const goalTop = field.height / 2 - PITCH.goal.height / 2;
  const goalBottom = goalTop + PITCH.goal.height;
  const inGoalY = state.ball.y >= goalTop && state.ball.y <= goalBottom;
  return checkGoal(inGoalY);
}

function createConfettiPieces(primary, accent) {
  const pieces = [];
  const originX = field.width / 2;
  const originY = field.height / 2;

  for (let i = 0; i < 110; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 260 + Math.random() * 280;
    const radialLift = -60 + Math.random() * 120;
    pieces.push({
      x: originX + (Math.random() - 0.5) * 140,
      y: originY + (Math.random() - 0.5) * 140,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + radialLift,
      size: 6 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 9,
      color: Math.random() > 0.4 ? primary : accent,
      wobble: Math.random() * 2.2,
    });
  }
  return pieces;
}

function startGoalCelebration(team) {
  const primary = team === 'blue' ? COLORS.blue : COLORS.orange;
  const accent = mixColor(primary, 0.35);
  state.visuals.goalCelebration = {
    team,
    start: performance.now(),
    confetti: createConfettiPieces(primary, accent),
  };
}

function updateGoalCelebration(now, dt) {
  const celebration = state.visuals.goalCelebration;
  if (!celebration) return;
  const elapsed = now - celebration.start;
  if (elapsed > GOAL_FX_DURATION) {
    state.visuals.goalCelebration = null;
    return;
  }

  const gravity = 420;
  const drag = 0.985;
  celebration.confetti.forEach((piece) => {
    piece.vy += gravity * dt;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.rotation += piece.rotationSpeed * dt;
    piece.vx *= drag;
    piece.vy *= drag;
  });
}

function processAI(dt) {
  state.aiAccumulator += dt;
  const aiInterval = 1 / DEFAULT_CONFIG.physics.aiTickHz;
  while (state.aiAccumulator >= aiInterval) {
    const nextDecisions = new Map(state.currentDecisions);
    for (const player of state.players) {
      const ai = getAIForPlayer(player);
      if (!ai) {
        nextDecisions.set(getPlayerId(player), sanitizeDecision({}));
        continue;
      }
      const decision = ai({
        me: player,
        ball: { ...state.ball },
        field: { ...field },
        players: state.players,
        ballControl: { ...state.ballControl },
      }, aiInterval);
      if (!decision) continue;
      nextDecisions.set(getPlayerId(player), sanitizeDecision(decision));
    }
    state.currentDecisions = nextDecisions;
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

function updatePossessionVisual(now) {
  if (state.visuals.possession.playerId !== state.ballControl.playerId) {
    state.visuals.possession = { playerId: state.ballControl.playerId, since: now };
  }
}

function startShotFx(playerId, start) {
  state.visuals.shots.set(playerId, { start, duration: 820 });
  state.visuals.lastShotTime = start;
}

function trackShots(now) {
  if (state.physics.consumeLastKick) {
    let kick = state.physics.consumeLastKick();
    while (kick) {
      startShotFx(kick.playerId, kick.time || now);
      kick = state.physics.consumeLastKick();
    }
  }

  for (const [playerId, decision] of state.currentDecisions.entries()) {
    if (!decision?.kick) continue;
    const shot = state.visuals.shots.get(playerId);
    if (shot && now - shot.start < 120) continue;

    const player = findPlayerById(playerId);
    if (!player) continue;
    const dist = Math.hypot(player.x - state.ball.x, player.y - state.ball.y);
    const contactRadius = DEFAULT_CONFIG.player.radius + DEFAULT_CONFIG.ball.radius + 2;
    if (dist <= contactRadius * 1.1) {
      startShotFx(playerId, now);
    }
  }
}

function cleanupShotTrails(now) {
  for (const [playerId, shot] of state.visuals.shots.entries()) {
    if (now - shot.start > shot.duration) {
      state.visuals.shots.delete(playerId);
    }
  }
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

function drawBall(now) {
  const holder = findPlayerById(state.ballControl.playerId);
  const holderColor = holder ? (holder.team === 'blue' ? COLORS.blue : COLORS.orange) : COLORS.lines;
  const shotIntensity = Math.max(0, 1 - (now - state.visuals.lastShotTime) / 520);

  ctx.save();
  if (shotIntensity > 0.05) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * shotIntensity})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(state.ball.x - state.ball.vx * 0.04, state.ball.y - state.ball.vy * 0.04);
    ctx.lineTo(state.ball.x, state.ball.y);
    ctx.stroke();
  }

  if (holder) {
    const pulse = 1 + 0.08 * Math.sin((now - state.visuals.possession.since) / 110);
    const ringRadius = state.ball.radius * 2.1 * pulse;
    const gradient = ctx.createRadialGradient(state.ball.x, state.ball.y, state.ball.radius, state.ball.x, state.ball.y, ringRadius);
    gradient.addColorStop(0, rgba(holderColor, 0.22));
    gradient.addColorStop(1, rgba(holderColor, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, ringRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.fillStyle = COLORS.ball;
  ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPlayers(now) {
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const player of state.players) {
    const color = player.team === 'blue' ? COLORS.blue : COLORS.orange;
    const darker = mixColor(color, -0.35);
    const lighter = mixColor(color, 0.35);
    const id = getPlayerId(player);
    const hasBall = playerHasBall(player);
    const shotFx = state.visuals.shots.get(id);
    const shotFlashActive = shotFx && now - shotFx.start <= 200;
    const radius = DEFAULT_CONFIG.player.radius;

    if (shotFx && now - shotFx.start > shotFx.duration) {
      state.visuals.shots.delete(id);
    }

    ctx.save();
    ctx.shadowColor = rgba(color, hasBall ? 0.6 : 0.35);
    ctx.shadowBlur = hasBall ? 22 : 12;
    ctx.shadowOffsetY = 6;

    if (hasBall) {
      const pulse = 1 + 0.12 * Math.sin((now - state.visuals.possession.since) / 120);
      ctx.strokeStyle = rgba(lighter, 0.65);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius * 1.32 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (shotFx) {
      const progress = Math.min(1, (now - shotFx.start) / shotFx.duration);
      const power = 1 - progress;
      ctx.strokeStyle = rgba(lighter, 0.6 * power);
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6 + progress * 2;
        const len = radius * (1.8 + power * 0.8);
        ctx.beginPath();
        ctx.moveTo(player.x + Math.cos(angle) * (radius * 0.75), player.y + Math.sin(angle) * (radius * 0.75));
        ctx.lineTo(player.x + Math.cos(angle) * len, player.y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }

    if (shotFlashActive) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 6;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(player.x, player.y, radius * 1.32, 0, Math.PI * 2);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(player.x - radius, player.y - radius, player.x + radius, player.y + radius);
    gradient.addColorStop(0, darker);
    gradient.addColorStop(0.45, color);
    gradient.addColorStop(1, lighter);

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba('#0b0b0f', 0.5);
    ctx.stroke();

    const badgeRadius = 12;
    ctx.fillStyle = 'rgba(5, 8, 12, 0.75)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, badgeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f6f8ff';
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillText(player.number.toString(), player.x, player.y + 1);

    ctx.restore();
  }
}

function drawRoundedRect(x, y, width, height, radius = 12) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawOverlay(now) {
  const timer = formatTimer();
  const panelWidth = 380;
  const panelHeight = 86;
  const x = field.width / 2 - panelWidth / 2;
  const y = 14;

  const gradient = ctx.createLinearGradient(x, y, x, y + panelHeight);
  gradient.addColorStop(0, '#0e1624ee');
  gradient.addColorStop(1, '#111a2cee');

  ctx.save();
  ctx.shadowColor = '#0c0f17aa';
  ctx.shadowBlur = 14;
  drawRoundedRect(x, y, panelWidth, panelHeight, 16);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#223250';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8ecff';

  ctx.font = '12px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Mi-temps ${state.half}/2`, field.width / 2, y + 20);

  const shimmer = 0.35 + 0.65 * Math.abs(Math.sin(now / 600));
  const scoreGradient = ctx.createLinearGradient(x, y, x + panelWidth, y + panelHeight);
  scoreGradient.addColorStop(0, rgba(COLORS.blue, 0.28 + shimmer * 0.08));
  scoreGradient.addColorStop(0.5, '#e8ecff');
  scoreGradient.addColorStop(1, rgba(COLORS.orange, 0.28 + shimmer * 0.08));
  ctx.font = '28px "Inter", sans-serif';
  ctx.fillStyle = scoreGradient;
  ctx.fillText(`${state.score.blue}  •  ${state.score.orange}`, field.width / 2, y + 44);

  ctx.font = '16px "Inter", sans-serif';
  ctx.fillText(`Temps ${timer}`, field.width / 2, y + 66);

  const badgeRadius = 12;
  ctx.fillStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(x + 22, y + 22, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8ecff';
  ctx.font = '12px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Bleus', x + 38, y + 22);

  ctx.fillStyle = COLORS.orange;
  ctx.beginPath();
  ctx.arc(x + panelWidth - 22, y + 22, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8ecff';
  ctx.textAlign = 'right';
  ctx.fillText('Oranges', x + panelWidth - 38, y + 22);
  ctx.restore();
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

function drawGoalCelebration(now) {
  const celebration = state.visuals.goalCelebration;
  if (!celebration) return;

  const elapsed = now - celebration.start;
  const fade = Math.max(0, 1 - (elapsed / GOAL_FX_DURATION) ** 1.3);
  const teamColor = celebration.team === 'blue' ? COLORS.blue : COLORS.orange;

  ctx.save();
  celebration.confetti.forEach((piece) => {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation + Math.sin(elapsed / 200) * piece.wobble * 0.1);
    ctx.fillStyle = rgba(piece.color, 0.9 * fade);
    ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
    ctx.restore();
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = rgba(teamColor, 0.9);
  ctx.shadowBlur = 22;
  ctx.fillStyle = rgba('#0b0b0f', 0.55 * fade);
  drawRoundedRect(field.width / 2 - 220, field.height / 2 - 90, 440, 180, 26);
  ctx.fill();

  ctx.fillStyle = rgba(teamColor, 0.95 * fade);
  ctx.font = '700 42px "Inter", sans-serif';
  const title = celebration.team === 'blue' ? 'But des Bleus !' : 'But des Oranges !';
  ctx.fillText(title, field.width / 2, field.height / 2 - 18);

  ctx.fillStyle = `rgba(255, 255, 255, ${0.94 * fade})`;
  ctx.font = '800 64px "Inter", sans-serif';
  ctx.fillText(`${state.score.blue} - ${state.score.orange}`, field.width / 2, field.height / 2 + 28);
  ctx.restore();
}

function maybeStartKickoff(now) {
  if (state.pendingKickoff && now >= state.pendingKickoff) {
    state.pendingKickoff = null;
    const kickerIndex = state.kickoffTeam === 'blue' ? 0 : 3;
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

  updateGoalCelebration(now, dt);
  cleanupShotTrails(now);

  if (state.started && !state.paused) {
    maybeStartKickoff(now);

    if (state.pendingKickoff) {
      for (const player of state.players) {
        player.vx = 0;
        player.vy = 0;
      }
      state.ball.vx = 0;
      state.ball.vy = 0;
    } else {
      processAI(dt);
      state.physics.step(dt, now, state.currentDecisions);
      state.ball = state.physics.ball;
      state.ballControl = state.physics.ballControl;
      trackShots(now);
      updatePossessionVisual(now);
      if (!checkGoalFromBall()) {
        updateTimer(dt);
        state.tick += 1;
      }
    }
  }

  drawField();
  if (state.started) {
    drawBall(now);
    drawPlayers(now);
    drawOverlay(now);
    drawGoalCelebration(now);
  } else {
    drawWaitingOverlay();
  }

  requestAnimationFrame(update);
}

createPlayers();
initUI();
loadDefaultAIs();
update();
