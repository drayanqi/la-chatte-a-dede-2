// Role-based attacking AI used for Team A (offense)
function onTick(gameState, dt) {
  const { me, ball, field, players, ballControl } = gameState;
  const isBlue = me.team === 0 || me.team === 'blue';
  const attackDir = isBlue ? 1 : -1;
  const goal = { x: attackDir === 1 ? field.width : 0, y: field.height / 2 };
  const ownGoal = { x: attackDir === 1 ? 0 : field.width, y: field.height / 2 };

  const teammates = players.filter((p) => p.team === me.team && p.number !== me.number);
  const opponents = players.filter((p) => p.team !== me.team);
  const distToBall = hypot(ball.x - me.x, ball.y - me.y);
  const teamHasBall = Boolean(
    ballControl?.playerId
    && (ballControl.playerId.startsWith(String(me.team))
      || ballControl.playerId.includes(isBlue ? 'blue' : 'orange'))
  );

  const roleHandlers = {
    1: playGoalkeeper,
    2: () => playDefender(-field.height * 0.15),
    3: () => playDefender(field.height * 0.15),
    4: () => playAttacker(-field.height * 0.12),
    5: () => playAttacker(field.height * 0.12),
  };

  return (roleHandlers[me.number] || playAttacker)(0);

  function playGoalkeeper() {
    const boxDepth = 90;
    const boxWidth = 180;
    const boxX = attackDir === 1 ? boxDepth : field.width - boxDepth;
    const clampY = clamp(ball.y, ownGoal.y - boxWidth / 2, ownGoal.y + boxWidth / 2);
    const target = { x: boxX, y: clampY };

    let kick = null;
    if (distToBall < 16) {
      const outlet = choosePassTarget({ preferAdvance: true }) || { x: ownGoal.x + attackDir * 180, y: ownGoal.y };
      kick = aimKick(outlet, 0.85);
    }

    return buildDecision(target, distToBall < 50, kick);
  }

  function playDefender(offsetY) {
    const laneX = attackDir === 1 ? field.width * 0.32 : field.width * 0.68;
    const laneY = field.height / 2 + offsetY;
    const defensiveShape = {
      x: clamp(ball.x * 0.4 + laneX * 0.6, laneX - 40, laneX + 70 * attackDir),
      y: clamp(ball.y * 0.3 + laneY * 0.7, laneY - 50, laneY + 50),
    };

    const closing = (attackDir === 1 ? ball.x < field.width * 0.55 : ball.x > field.width * 0.45);
    const target = closing ? defensiveShape : { x: laneX, y: laneY };

    let kick = null;
    if (distToBall < 17) {
      const shotWindow = Math.abs(ball.y - goal.y) < 110 && distanceTo(goal) < 220;
      if (shotWindow) {
        kick = aimKick(goal, 0.9);
      } else {
        const pass = choosePassTarget({ preferAdvance: true }) || forwardBump();
        kick = aimKick(pass, 0.7);
      }
    }

    return buildDecision(target, distToBall < 90, kick);
  }

  function playAttacker(offsetY) {
    const laneX = attackDir === 1 ? field.width * 0.62 : field.width * 0.38;
    const laneY = field.height / 2 + offsetY;
    const supportX = teamHasBall ? ball.x + attackDir * 16 : ball.x - attackDir * 12;
    const target = {
      x: clamp(supportX, laneX - 40, laneX + 80),
      y: clamp(ball.y * 0.35 + laneY * 0.65, laneY - 40, laneY + 40),
    };

    let kick = null;
    if (distToBall < 18) {
      const canShoot = distanceTo(goal) < 180 && Math.abs(ball.y - goal.y) < 90;
      if (canShoot) {
        const farPostY = goal.y + (ball.y < goal.y ? -18 : 18);
        kick = aimKick({ x: goal.x, y: farPostY }, 1.0);
      } else {
        const pass = choosePassTarget({ preferAdvance: true }) || forwardBump();
        kick = aimKick(pass, 0.82);
      }
    }

    const press = !teamHasBall && distToBall > 20;
    return buildDecision(target, press, kick);
  }

  function choosePassTarget({ preferAdvance } = {}) {
    let best = null;
    let bestScore = -Infinity;

    for (const mate of teammates) {
      const dx = mate.x - me.x;
      const dy = mate.y - me.y;
      const aheadScore = (attackDir * dx) * (preferAdvance ? 1.2 : 1.0);
      const spacing = Math.max(0, 120 - Math.abs(dy));
      const pressure = opponents.reduce((min, opp) => Math.min(min, hypot(opp.x - mate.x, opp.y - mate.y)), Infinity);
      const score = aheadScore + spacing + Math.min(pressure, 140) * 0.6;

      if (score > bestScore) {
        bestScore = score;
        best = mate;
      }
    }

    if (!best) return null;
    return { x: best.x + attackDir * 14, y: best.y };
  }

  function forwardBump() {
    return { x: ball.x + attackDir * 60, y: ball.y };
  }

  function aimKick(target, power) {
    const dx = target.x - ball.x;
    const dy = target.y - ball.y;
    const norm = hypot(dx, dy) || 1;
    return { power, dirX: dx / norm, dirY: dy / norm };
  }

  function buildDecision(target, sprintBias, kick) {
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const norm = hypot(dx, dy) || 1;
    const sprint = sprintBias || hypot(dx, dy) > 28;
    return { move: { x: dx / norm, y: dy / norm }, sprint, kick };
  }

  function distanceTo(pt) {
    return hypot(pt.x - me.x, pt.y - me.y);
  }

  function hypot(x, y) {
    return Math.hypot(x, y);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}

module.exports = { onTick };
