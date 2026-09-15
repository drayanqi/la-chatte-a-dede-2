// Easy Bot attacker: hold the kickoff anchor and only chase the ball once it
// is already deep in the attacking third. In possession, dribble at the goal
// and shoot at the near corner of the goal mouth from inside 11 units.
function update(game) {
  const { me, ball } = game;
  const home = me.team === 'home';
  const attackGoalX = home ? 100 : 0;
  const deepAttack = home ? ball.position.x > 65 : ball.position.x < 35;

  if (me.hasBall) {
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
  me.moveToward(home ? 40 : 60, anchorY);
}
