// IA défensive compacte pour 3 joueurs : 1 gardien + 2 joueurs de champ
function onTick(gameState, dt) {
  const api = createPlayerAPI(gameState, gameState.me);
  const role = api.getMe().number;

  if (role === 1) return guardBox(api);
  return holdLine(api, role === 2 ? -1 : 1);
}

function guardBox(api) {
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

function holdLine(api, verticalSign) {
  const field = api.getFieldSize();
  const center = api.getCenter();
  const attackDir = api.getTeam() === 0 || api.getTeam() === 'blue' ? 1 : -1;
  const ball = api.getBallPosition();
  const anchor = {
    x: center.x + attackDir * -field.width * 0.08,
    y: center.y + verticalSign * 38,
  };

  const danger = attackDir === 1 ? ball.x < center.x : ball.x > center.x;
  const target = danger ? ball : anchor;

  let builder = api.goTo(target).sprintIfFar(danger ? 30 : 24);
  if (api.isBallClose(19)) {
    builder = builder.clearBall(0.85);
  }

  return builder.build();
}

module.exports = { onTick };
