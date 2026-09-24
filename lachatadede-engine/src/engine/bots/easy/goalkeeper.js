// Easy Bot goalkeeper: hold the goal line on the ball owner -> goal centre
// axis, i.e. stand where that segment crosses the keeper's line so the mouth
// stays covered behind the carrier. Shade to the ball itself when it is
// loose or already between the keeper and the goal. Clear short toward
// midfield in possession.
//
// Ego frame (script-ia-api.md v3.0): own goal at x=0, opponent goal at
// x=100, always attacking left to right. The same script plays either side —
// the engine mirrors the pitch when this team defends the right goal.
function update(game) {
  const { me, ball } = game;
  const lineX = 5;
  const goalCenterX = 0;

  if (ball.owner === me) {
    // Short clear toward midfield (the accepted v1.7 balance baseline):
    // the ball lands around x=43 in the ego frame, i.e. midfield.
    me.shoot(32, 26, 0.9);
    return;
  }

  // The axis starts at the ball owner (either team) or the ball when free.
  const source = ball.owner === null ? ball.position : ball.owner.position;

  // Intersect the source -> goal centre segment with the keeper's line.
  let targetY = 25;
  const deltaX = goalCenterX - source.x;
  const crossing = deltaX === 0 ? -1 : (lineX - source.x) / deltaX;
  if (crossing > 0) {
    targetY = source.y + crossing * (25 - source.y);
  } else {
    // Source on the goal-centre vertical, or already between the keeper and
    // the goal: fall back to shading toward the ball itself.
    targetY = ball.position.y;
  }
  me.moveToward(lineX, Math.max(15, Math.min(35, targetY)));
}
