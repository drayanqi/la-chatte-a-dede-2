// Aggressive attacking AI focused on quick shots toward the opponent's goal
function onTick(gameState, dt) {
  const { me, ball, field, players } = gameState;

  // Move aggressively toward the ball while staying slightly ahead in the attack direction
  const attackDir = me.team === 0 ? 1 : -1;
  const targetX = ball.x + attackDir * 12;
  const targetY = ball.y;

  const dx = targetX - me.x;
  const dy = targetY - me.y;
  const dist = Math.hypot(dx, dy) || 1;
  const move = { x: dx / dist, y: dy / dist };

  // Sprint when far from the ball or when chasing a loose ball
  const sprint = dist > 25 && me.stamina > 0.3;

  // Shoot hard toward the far post when close enough
  let kick = null;
  if (Math.hypot(ball.x - me.x, ball.y - me.y) < 20) {
    const goalX = me.team === 0 ? field.width : 0;
    const goalY = field.height / 2 + (ball.y > field.height / 2 ? -8 : 8); // bias toward corners
    const gx = goalX - ball.x;
    const gy = goalY - ball.y;
    const gNorm = Math.hypot(gx, gy) || 1;
    kick = { power: 1.0, dirX: gx / gNorm, dirY: gy / gNorm };
  }

  return { move, sprint, kick };
}

module.exports = { onTick };
