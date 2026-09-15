/**
 * StarterAI - Your first AI script!
 *
 * Every tick the engine calls your update(game) function with:
 *   game.me         - your player (position, hasBall, team, slot, actions...)
 *   game.ball       - the ball (position, velocity, owner)
 *   game.teammates  - your 4 teammates (read-only)
 *   game.opponents  - the 5 opponents (read-only)
 *   game.field      - field dimensions, goals and zones
 *
 * This starter attacks: chase the ball, dribble toward the goal, and
 * shoot when close. Modify it to build your own strategy!
 *
 * Remember: only the FIRST action per tick applies.
 */
function update(game) {
  const { me, ball } = game;
  const goalX = me.team === 'home' ? 100 : 0;

  if (me.hasBall) {
    const distToGoal = Math.abs(me.position.x - goalX);

    if (distToGoal < 30) {
      me.shoot(goalX, 25, 1.0);
    } else {
      me.dribble(goalX, 25);
    }
  } else {
    me.moveToward(ball.position.x, ball.position.y);
  }
}
