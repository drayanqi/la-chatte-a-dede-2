// Easy Bot goalkeeper: hold the goal line and shade a third of the way from
// the goal centre toward the ball, which tracks the projected crossing point
// of the centre-aimed shots opponents take from deep. Clear short toward
// midfield in possession, contesting the loose ball around midfield.
function update(game) {
  const { me, ball } = game;
  const ownGoalX = me.team === 'home' ? 5 : 95;

  if (me.hasBall) {
    me.shoot(68, 26, 0.9);
    return;
  }

  const targetY = Math.max(15, Math.min(35, 25 + (ball.position.y - 25) * 0.4));
  me.moveToward(ownGoalX, targetY);
}
