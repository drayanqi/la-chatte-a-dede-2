import { DEFAULT_CONFIG } from '../src/config.js';
console.log('Futsal AI MVP booting... Config:', DEFAULT_CONFIG);
// Simple placeholder rendering loop to show canvas is served correctly.
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const w = canvas.width, h = canvas.height;
let t = 0;
function draw() {
  ctx.clearRect(0,0,w,h);
  // draw center line
  ctx.fillStyle = '#ffffff22';
  ctx.fillRect(w/2 - 2, 0, 4, h);
  // draw simple moving ball
  const bx = w/2 + Math.cos(t/60)*200;
  const by = h/2 + Math.sin(t/40)*100;
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(bx, by, 8, 0, Math.PI*2);
  ctx.fill();
  // draw players as circles
  for (let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.fillStyle = i<3 ? '#0077ff' : '#ff8800';
    ctx.arc(100 + i*120, 100 + (i%2)*200, 14, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillText((i+1).toString(), 100 + i*120 - 4, 100 + (i%2)*200 + 4);
  }
  t++;
  requestAnimationFrame(draw);
}
draw();
