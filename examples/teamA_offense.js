// IA offensive simplifiée pour une équipe de 3 joueurs (1 gardien, joueur1, joueur2)
function onTick(gameState, dt) {
  const api = createPlayerAPI(gameState, gameState.me);
  const roleNumber = api.getMe().number;

  if (roleNumber === 1) return playGoalkeeper(api);
  return playFieldPlayer(api, roleNumber === 2 ? -1 : 1);
}

function playGoalkeeper(api) {
  const ball = api.getBallPosition();
  const ownGoal = api.getOwnGoalPosition();
  const isBlue = api.getTeam() === 0 || api.getTeam() === 'blue';
  const anchorX = ownGoal.x + (isBlue ? 56 : -56);
  const target = { x: anchorX, y: Math.min(Math.max(ball.y, ownGoal.y - 70), ownGoal.y + 70) };
  let builder = api.goTo(target).sprintIfFar(36);

  if (api.isBallClose(18)) {
    builder = builder.clearBall(0.9);
  }

  return builder.build();
}

function playFieldPlayer(api, verticalSign) {
  const ball = api.getBallPosition();
  const attackDir = api.getTeam() === 0 || api.getTeam() === 'blue' ? 1 : -1;
  const supportTarget = {
    x: ball.x + attackDir * 30,
    y: ball.y + verticalSign * 40,
  };

  let builder = api.goTo(supportTarget).sprintIfFar(26);
  if (api.isBallClose(20)) {
    const mate = api.getClosestTeammate();
    if (mate && mate.distance < 140) {
      builder = builder.passTo(mate.player, 0.8);
    } else {
      builder = builder.shoot(1.0);
    }
  }

  return builder.build();
}

module.exports = { onTick };
