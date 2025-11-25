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
  const field = api.getFieldSize();
  const isBlue = api.getTeam() === 0 || api.getTeam() === 'blue';
  const guardX = ownGoal.x + (isBlue ? 60 : -60);
  const clampY = Math.min(Math.max(ball.y, ownGoal.y - 80), ownGoal.y + 80);
  let builder = api.goTo({ x: guardX, y: clampY }).sprintIfFar(42);

  if (api.isBallClose(18)) {
    const mate = api.getClosestTeammate();
    if (mate) {
      builder = builder.passTo(mate.player, 0.85);
    } else {
      builder = builder.clearBall(0.9);
    }
  }

  if (ball.x < field.width * 0.4) {
    builder = builder.sprint(true);
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
