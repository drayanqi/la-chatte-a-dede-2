// Easy Bot attacker: hold the kickoff anchor and only chase the ball once it
// is already deep in the attacking third. In possession, dribble at the goal
// and shoot at the near corner of the goal mouth from inside 11 units.
//
// Ego frame (script-ia-api.md v3.0): own goal at x=0, opponent goal at
// x=100, always attacking left to right.
function update(game) {
  const { me, ball } = game;
  const attackGoalX = 100;
  const deepAttack = ball.position.x > 65;

  if (ball.owner === me) {
    const distanceToGoal = Math.abs(me.position.x - attackGoalX);
    if (distanceToGoal < 11) {
      me.shoot(attackGoalX, ball.position.y <= 25 ? 16 : 34, 0.45);
    } else {
      me.dribble(attackGoalX, 25);
    }
    return;
  }

  if (deepAttack) {
    me.moveToward(ball.position.x, ball.position.y);
    return;
  }

  // Hold the kickoff anchor otherwise (slot 4 top line, slot 5 bottom line).
  const anchorY = me.slot === 5 ? 35 : 15;
  me.moveToward(40, anchorY);
}
