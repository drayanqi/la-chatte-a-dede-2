const clampPower = (power) => Math.max(0, Math.min(1, power ?? 0));

const toVector = (point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 });

const normalize = (x, y) => {
  const norm = Math.hypot(x, y);
  if (!norm) return { x: 0, y: 0, norm: 0 };
  return { x: x / norm, y: y / norm, norm };
};

const distance = (a, b) => {
  if (!a || !b) return Infinity;
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
};

const safeExecute = (fn) => {
  try {
    return fn();
  } catch (err) {
    console.error('[PlayerAPI] helper error', err);
    return null;
  }
};

export function createPlayerAPI(gameState, me) {
  const action = {
    move: null,
    sprint: null,
    kick: null,
  };

  let currentTarget = null;

  const getField = () => gameState?.field || { width: 0, height: 0 };
  const teammates = () => (gameState?.players || []).filter((p) => p && p.team === me.team && p !== me);
  const opponents = () => (gameState?.players || []).filter((p) => p && p.team !== me.team);

  const goalPositions = () => {
    const field = getField();
    const centerY = field.height / 2;
    if (field.goalLeft && field.goalRight) {
      const goalCenter = (goal) => ({ x: (goal.x1 + goal.x2) / 2, y: (goal.y1 + goal.y2) / 2 });
      return { own: me.team === 0 || me.team === 'blue' ? goalCenter(field.goalLeft) : goalCenter(field.goalRight), opponent: me.team === 0 || me.team === 'blue' ? goalCenter(field.goalRight) : goalCenter(field.goalLeft) };
    }
    return {
      own: { x: me.team === 0 || me.team === 'blue' ? 0 : field.width, y: centerY },
      opponent: { x: me.team === 0 || me.team === 'blue' ? field.width : 0, y: centerY },
    };
  };

  const getBallOwnerId = () => {
    if (gameState?.ballControl?.playerId) return gameState.ballControl.playerId;
    if (gameState?.ball?.lastTouchPlayerId) return String(gameState.ball.lastTouchPlayerId);
    return null;
  };

  const builder = {
    // --- Positions ---
    getPosition(player = me) {
      return safeExecute(() => toVector(player));
    },

    getBallPosition() {
      return safeExecute(() => toVector(gameState?.ball || { x: 0, y: 0 }));
    },

    getVelocity(player = me) {
      return safeExecute(() => ({ vx: player?.vx ?? 0, vy: player?.vy ?? 0 }));
    },

    getBallVelocity() {
      return safeExecute(() => ({ vx: gameState?.ball?.vx ?? 0, vy: gameState?.ball?.vy ?? 0 }));
    },

    getFieldSize() {
      return safeExecute(() => ({ width: getField().width, height: getField().height }));
    },

    getCenter() {
      return safeExecute(() => ({ x: getField().width / 2, y: getField().height / 2 }));
    },

    // --- Players ---
    getMe() {
      return me;
    },

    getTeam() {
      return me?.team;
    },

    getPlayers() {
      return gameState?.players || [];
    },

    getTeammates() {
      return teammates();
    },

    getOpponents() {
      return opponents();
    },

    getPlayerByNumber(number) {
      return safeExecute(() => teammates().find((p) => p.number === number) || null);
    },

    getClosestTeammate() {
      return safeExecute(() => {
        const mates = teammates();
        if (!mates.length) return null;
        let best = null;
        let bestDist = Infinity;
        for (const player of mates) {
          const d = distance(player, me);
          if (d < bestDist) {
            bestDist = d;
            best = player;
          }
        }
        return best ? { player: best, distance: bestDist } : null;
      });
    },

    getClosestOpponent() {
      return safeExecute(() => {
        const opps = opponents();
        if (!opps.length) return null;
        let best = null;
        let bestDist = Infinity;
        for (const player of opps) {
          const d = distance(player, me);
          if (d < bestDist) {
            bestDist = d;
            best = player;
          }
        }
        return best ? { player: best, distance: bestDist } : null;
      });
    },

    hasBall(player = me) {
      return safeExecute(() => {
        if (!player) return false;
        if (typeof player.hasBall === 'boolean') return player.hasBall;
        const ownerId = getBallOwnerId();
        if (!ownerId) return false;
        const pid = `${player.team}-${player.number}`;
        return ownerId === pid || ownerId.endsWith(pid);
      });
    },

    // --- Ball ---
    distanceToBall() {
      return distance(me, this.getBallPosition());
    },

    directionToBall() {
      return safeExecute(() => {
        const ball = this.getBallPosition();
        const { x, y } = normalize(ball.x - (me?.x ?? 0), ball.y - (me?.y ?? 0));
        return { x, y };
      });
    },

    isBallClose(threshold = 20) {
      return this.distanceToBall() <= threshold;
    },

    // --- Goals ---
    getOpponentGoalPosition() {
      return goalPositions().opponent;
    },

    getOwnGoalPosition() {
      return goalPositions().own;
    },

    distanceToOwnGoal() {
      return distance(me, this.getOwnGoalPosition());
    },

    distanceToOpponentGoal() {
      return distance(me, this.getOpponentGoalPosition());
    },

    isInOwnHalf() {
      const centerX = getField().width / 2;
      return (me?.team === 0 || me?.team === 'blue') ? (me?.x ?? 0) <= centerX : (me?.x ?? 0) >= centerX;
    },

    isInOpponentHalf() {
      const centerX = getField().width / 2;
      return (me?.team === 0 || me?.team === 'blue') ? (me?.x ?? 0) > centerX : (me?.x ?? 0) < centerX;
    },

    // --- Movement builder ---
    goTo(target, speedBias = null) {
      return safeExecute(() => {
        const goal = toVector(target || { x: me?.x ?? 0, y: me?.y ?? 0 });
        const dir = normalize(goal.x - (me?.x ?? 0), goal.y - (me?.y ?? 0));
        action.move = { x: dir.x, y: dir.y };
        currentTarget = goal;
        if (typeof speedBias === 'boolean') action.sprint = speedBias;
        return builder;
      }) || builder;
    },

    goToBall() {
      currentTarget = this.getBallPosition();
      return this.goTo(currentTarget);
    },

    goToOwnGoal() {
      currentTarget = this.getOwnGoalPosition();
      return this.goTo(currentTarget);
    },

    goToOpponentGoal() {
      currentTarget = this.getOpponentGoalPosition();
      return this.goTo(currentTarget);
    },

    follow(player) {
      return safeExecute(() => {
        currentTarget = toVector(player);
        return this.goTo(currentTarget);
      }) || builder;
    },

    stop() {
      action.move = { x: 0, y: 0 };
      currentTarget = null;
      return builder;
    },

    sprint(enabled = true) {
      action.sprint = Boolean(enabled);
      return builder;
    },

    sprintIfFar(distanceThreshold = 28) {
      const target = currentTarget || this.getBallPosition();
      const dist = distance(me, target);
      if (dist > distanceThreshold) action.sprint = true;
      return builder;
    },

    // --- Shooting / Passing ---
    kick(power, direction) {
      return safeExecute(() => {
        const dir = toVector(direction || { x: 1, y: 0 });
        const normalized = normalize(dir.x, dir.y);
        action.kick = {
          power: clampPower(power),
          dirX: normalized.x,
          dirY: normalized.y,
        };
        return builder;
      }) || builder;
    },

    shoot(power = 1) {
      const target = this.getOpponentGoalPosition();
      return this.shootAt(target, power);
    },

    shootAt(target, power = 1) {
      const ball = this.getBallPosition();
      const aim = toVector(target);
      const { x, y } = normalize(aim.x - ball.x, aim.y - ball.y);
      action.kick = { power: clampPower(power), dirX: x, dirY: y };
      return builder;
    },

    kickIfClose(power = 1, distanceThreshold = 22) {
      if (this.distanceToBall() <= distanceThreshold) {
        return this.shoot(power);
      }
      return builder;
    },

    passTo(player, power = 0.7) {
      return safeExecute(() => {
        const target = toVector(player);
        return this.shootAt(target, power);
      }) || builder;
    },

    clearBall(power = 1) {
      const own = this.getOwnGoalPosition();
      const opp = this.getOpponentGoalPosition();
      const away = { x: own.x + (opp.x - own.x), y: own.y + (opp.y - own.y) };
      return this.shootAt(away, power);
    },

    // --- Build ---
    build() {
      const move = action.move || { x: 0, y: 0 };
      const sprint = Boolean(action.sprint);
      const kick = action.kick
        ? (() => {
            const dir = normalize(action.kick.dirX, action.kick.dirY);
            return { power: clampPower(action.kick.power), dirX: dir.x, dirY: dir.y };
          })()
        : null;
      return { move, sprint, kick };
    },
  };

  return builder;
}

export default { createPlayerAPI };
