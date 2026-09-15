// Easy Bot goalkeeper: hold the goal line on the ball owner -> goal centre
// axis, i.e. stand where that segment crosses the keeper's line so the mouth
// stays covered behind the carrier. Shade to the ball itself when it is
// loose or already between the keeper and the goal. Clear short toward
// midfield in possession.
function update(game) {
  const { me, ball } = game;
  const home = me.team === 'home';
  const lineX = home ? 5 : 95;
  const goalCenterX = home ? 0 : 100;

  if (me.hasBall) {
    me.shoot(68, 26, 0.9);
    return;
  }

  // The axis starts at the ball owner (either team) or the ball when free.
  let source = null;
  if (ball.owner !== null) {
    const [ownerTeam, ownerSlot] = ball.owner.split('-');
    const roster = ownerTeam === me.team ? game.teammates : game.opponents;
    const owner = roster.find((player) => player.slot === Number(ownerSlot));
    if (owner) source = owner.position;
  }
  if (source === null) source = ball.position;

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
