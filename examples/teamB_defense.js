// Balanced defensive AI that protects its own goal and counters quickly
function onTick(gameState, dt) {
  const { me, ball, field, players } = gameState;

  // Determine defensive home position near our half
  const defendX = me.team === 0 ? field.width * 0.35 : field.width * 0.65;
  const defendY = field.height / 2 + (me.number - 3) * 8; // spread players vertically

  // Prioritize ball if it is close to our goal, otherwise hold shape
  const dangerZone = me.team === 0 ? ball.x < field.width * 0.45 : ball.x > field.width * 0.55;
  const targetX = dangerZone ? ball.x : defendX;
  const targetY = dangerZone ? ball.y : defendY;

  const dx = targetX - me.x;
  const dy = targetY - me.y;
  const dist = Math.hypot(dx, dy) || 1;
  const move = { x: dx / dist, y: dy / dist };

  // Sprint only when recovering or countering from deep
  const sprint = dangerZone && dist > 18 && me.stamina > 0.2;

  // Clear the ball toward a teammate lane or counter with a through pass
  let kick = null;
  if (Math.hypot(ball.x - me.x, ball.y - me.y) < 18) {
    const forwardX = me.team === 0 ? field.width : 0;
    const verticalBias = (me.number % 2 === 0 ? -1 : 1) * 10;
    const targetYPass = field.height / 2 + verticalBias;
    const kx = forwardX - ball.x;
    const ky = targetYPass - ball.y;
    const kNorm = Math.hypot(kx, ky) || 1;
    kick = { power: 0.85, dirX: kx / kNorm, dirY: ky / kNorm };
  }

  return { move, sprint, kick };
}

module.exports = { onTick };
