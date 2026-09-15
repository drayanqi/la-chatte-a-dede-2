// Easy Bot defender (low side): hold a fixed depth between the ball and the
// own goal, track the ball inside the slot's assigned band, chase the ball
// when closest in the own half. In possession, clear short to the
// crowd's edge so the loose ball is contested rather than running a
// breakaway.
function update(game) {
  const { me, ball } = game;
  const home = me.team === 'home';
  const ownGoalX = home ? 0 : 100;
  const depthX = home ? 20 : 80;
  const ownHalf = home ? ball.position.x < 50 : ball.position.x > 50;

  if (me.hasBall) {
    me.shoot(68, 32, 0.9);
    return;
  }

  if (ownHalf && me.isClosestToBall()) {
    me.moveToward(ball.position.x, ball.position.y);
    return;
  }

  const bandMin = me.slot === 3 ? 25 : 5;
  const bandMax = me.slot === 2 ? 25 : 45;
  const targetY = Math.max(bandMin, Math.min(bandMax, ball.position.y));
  me.moveToward(depthX, targetY);
}
