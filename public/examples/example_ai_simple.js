function onTick(gameState, dt) {
  const me = gameState.me;
  const ball = gameState.ball;
  let dx = ball.x - me.x, dy = ball.y - me.y;
  const dist = Math.hypot(dx,dy) || 1;
  const move = { x: dx/dist, y: dy/dist };
  let kick = null;
  if (dist < 22) {
    const goalX = me.team === 0 ? gameState.field.width : 0;
    const gdx = goalX - ball.x;
    const gdy = (gameState.field.height/2) - ball.y;
    const gnorm = Math.hypot(gdx,gdy) || 1;
    kick = { power: 0.9, dirX: gdx/gnorm, dirY: gdy/gnorm };
  }
  return { move, sprint: false, kick };
}
