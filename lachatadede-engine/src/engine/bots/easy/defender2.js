// Easy Bot defender (high side): hold a fixed post at (depthX, 34) instead of
// tracking the ball, so the high flank stays open for opponent breakaways.
// In possession, always clear long to the far flank.
//
// Ego frame (script-ia-api.md v3.0): own goal at x=0, opponent goal at
// x=100, always attacking left to right.
function update(game) {
  const { me, ball } = game;
  const depthX = 20;
  const postY = 30;

  if (ball.owner === me) {
    // Long clear to the far flank (the accepted v1.7 balance baseline).
    me.shoot(32, 18, 0.9);
    return;
  }

  me.moveToward(depthX, postY);
}
