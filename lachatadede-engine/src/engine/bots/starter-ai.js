/**
 * StarterAI - Your first AI script!
 *
 * Every tick the engine calls your update(game) function with:
 *   game.me         - your player (position, slot, isTeammate, actions...)
 *   game.ball       - the ball (position, velocity, owner as a Player)
 *   game.teammates  - your 4 teammates (read-only)
 *   game.opponents  - the 5 opponents (read-only)
 *   game.field      - field dimensions, goals and zones
 *
 * You always attack left to right: your goal is at x=0, the opponent's at
 * x=100. The engine mirrors the pitch for you when your team defends the
 * right goal — you never need to know which side you play.
 *
 * This starter attacks: chase the ball, dribble toward the goal, and
 * shoot when close. Modify it to build your own strategy!
 *
 * Remember: only the FIRST action per tick applies.
 */
function update() {
  const { me, ball } = game;
  const goalX = 100;

  if (ball.owner === me) {
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
