function onTick(gameState, dt) {
  const me = gameState.me;
  const ball = gameState.ball;
  // stay near goal center
  const goalX = me.team === 0 ? 30 : gameState.field.width - 30;
  const target = { x: goalX, y: gameState.field.height/2 };
  let dx = target.x - me.x, dy = target.y - me.y;
  const dist = Math.hypot(dx,dy) || 1;
  const move = { x: dx/dist, y: dy/dist };
  return { move, sprint: false, kick: null };
}
