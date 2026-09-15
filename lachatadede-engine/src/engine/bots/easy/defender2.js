// Easy Bot defender (high side): hold a fixed post at (depthX, 34) instead of
// tracking the ball, so the high flank stays open for opponent breakaways.
// In possession, always clear long to the far flank.
function update(game) {
  const { me, ball } = game;
  const home = me.team === 'home';
  const depthX = home ? 20 : 80;
  const postY = 30;

  if (me.hasBall) {
    me.shoot(68, 18, 0.9);
    return;
  }

  me.moveToward(depthX, postY);
}
