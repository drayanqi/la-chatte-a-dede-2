import { DEFAULT_CONFIG } from '../src/config.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const w = canvas.width;
const h = canvas.height;

const teamAColor = '#2b8bff';
const teamBColor = '#ff8c2b';
const playerRadius = 14;

const ui = {
  teamAInput: document.getElementById('teamAInput'),
  teamBInput: document.getElementById('teamBInput'),
  teamAFile: document.getElementById('teamAFile'),
  teamBFile: document.getElementById('teamBFile'),
  startButton: document.getElementById('startButton'),
  statusText: document.getElementById('statusText'),
};

const state = {
  config: DEFAULT_CONFIG,
  teamAFile: null,
  teamBFile: null,
  started: false,
  tick: 0,
};

function updateStatus(text) {
  ui.statusText.textContent = text;
}

function updateButtonState() {
  const ready = Boolean(state.teamAFile && state.teamBFile);
  ui.startButton.disabled = !ready;
  if (!state.started) {
    updateStatus(ready ? 'Prêt à lancer la partie !' : 'En attente des scripts...');
  }
}

function handleFile(teamKey, file) {
  state[teamKey] = file;
  const target = teamKey === 'teamAFile' ? ui.teamAFile : ui.teamBFile;
  target.textContent = file ? file.name : 'Aucun fichier';
  updateButtonState();
}

function initUI() {
  ui.teamAInput.addEventListener('change', (e) => handleFile('teamAFile', e.target.files[0]));
  ui.teamBInput.addEventListener('change', (e) => handleFile('teamBFile', e.target.files[0]));
  ui.startButton.addEventListener('click', () => {
    if (ui.startButton.disabled) return;
    state.started = true;
    updateStatus('Match en cours — les scripts sont chargés.');
  });
  updateButtonState();
}

function drawField() {
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#2b7a2b';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#d7f0d7aa';
  ctx.lineWidth = 4;

  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.beginPath();
  ctx.moveTo(w / 2, 10);
  ctx.lineTo(w / 2, h - 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
  ctx.stroke();

  drawGoals();
}

function drawGoals() {
  const goalWidth = 30;
  const goalHeight = 180;
  const y = h / 2 - goalHeight / 2;

  ctx.fillStyle = '#e6f2ff';
  ctx.strokeStyle = '#1b1f2a';
  ctx.lineWidth = 2;

  ctx.fillRect(14, y, goalWidth, goalHeight);
  ctx.strokeRect(14, y, goalWidth, goalHeight);

  ctx.fillRect(w - goalWidth - 14, y, goalWidth, goalHeight);
  ctx.strokeRect(w - goalWidth - 14, y, goalWidth, goalHeight);
}

function drawBall() {
  const bx = w / 2 + Math.cos(state.tick / 40) * 6;
  const by = h / 2 + Math.sin(state.tick / 30) * 3;
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(bx, by, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPlayers() {
  const homeFormation = [
    { role: 'G', x: 0.07, y: 0.5 },
    { role: 'D', x: 0.24, y: 0.32 },
    { role: 'D', x: 0.30, y: 0.68 },
    { role: 'A', x: 0.56, y: 0.32 },
    { role: 'A', x: 0.66, y: 0.70 },
  ];

  const awayFormation = [
    { role: 'G', x: 0.93, y: 0.5 },
    { role: 'D', x: 0.76, y: 0.32 },
    { role: 'D', x: 0.70, y: 0.68 },
    { role: 'A', x: 0.44, y: 0.32 },
    { role: 'A', x: 0.34, y: 0.70 },
  ];

  drawTeam(homeFormation, teamAColor, 1);
  drawTeam(awayFormation, teamBColor, 1);
}

function drawTeam(formation, color, numberOffset) {
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  formation.forEach((player, idx) => {
    const px = player.x * w;
    const py = player.y * h;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(px, py, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0b0b0f';
    ctx.fillText((idx + numberOffset).toString(), px, py + 1);

    if (player.role === 'G') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - playerRadius - 2, py - playerRadius - 2, playerRadius * 2 + 4, playerRadius * 2 + 4);
    }
  });
}

function drawWaitingOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8ecff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ajoutez les scripts des deux équipes puis cliquez sur Start game', w / 2, h / 2);
}

function loop() {
  drawField();

  if (state.started) {
    drawBall();
    drawPlayers();
    state.tick += 1;
  } else {
    drawWaitingOverlay();
  }

  requestAnimationFrame(loop);
}

initUI();
loop();
