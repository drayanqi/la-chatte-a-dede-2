// Easy Bot defender (low side): hold a fixed depth between the ball and the
// own goal, track the ball inside the slot's assigned band, chase the ball
// when closest in the own half. In possession, clear short to the
// crowd's edge so the loose ball is contested rather than running a
// breakaway.
//
// Ego frame (script-ia-api.md v3.0): own goal at x=0, opponent goal at
// x=100, always attacking left to right.
function update(game) {
  const { me, ball } = game;
  const depthX = 20;
  const ownHalf = ball.position.x < 50;

  if (ball.owner === me) {
    // Short clear to the crowd's edge (the accepted v1.7 balance baseline).
    me.shoot(32, 32, 0.9);
    return;
  }

  if (ownHalf && isClosestToBall(game)) {
    me.moveToward(ball.position.x, ball.position.y);
    return;
  }

  const bandMin = me.slot === 3 ? 25 : 5;
  const bandMax = me.slot === 2 ? 25 : 45;
  const targetY = Math.max(bandMin, Math.min(bandMax, ball.position.y));
  me.moveToward(depthX, targetY);
}

// The closest player of my team to the ball (ties resolved by the lower
// slot) — the engine no longer computes it, two lines of math do.
function isClosestToBall(game) {
  const ball = game.ball.position;
  let best = game.me;
  let bestD = distance(best.position, ball);
  for (const p of [game.me, ...game.teammates]) {
    const d = distance(p.position, ball);
    if (d < bestD || (d === bestD && p.slot < best.slot)) {
      best = p;
      bestD = d;
    }
  }
  return best === game.me;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
