import { Ball } from './Ball.js';
import { Player } from './Player.js';
import { applyDamping, integrateEuler } from './Integrator.js';

export class PhysicsEngine {
  constructor(config, field, pitch) {
    this.config = config;
    this.field = field;
    this.pitch = pitch;
    this.players = [];
    this.ball = new Ball({
      x: field.width / 2,
      y: field.height / 2,
      radius: config.ball.radius,
      mass: config.ball.mass,
    });
    this.ballControl = { playerId: null, cooldownUntil: 0 };
  }

  getPlayerId(player) {
    return `${player.team}-${player.number}`;
  }

  setPlayers(players) {
    this.players = players;
  }

  setBall(ball) {
    this.ball = ball;
  }

  resetBallControl() {
    this.ballControl = { playerId: null, cooldownUntil: 0 };
  }

  step(dt, now, decisions) {
    const subSteps = Math.max(1, Math.min(this.config.physics.maxSubSteps, Math.ceil(dt / this.config.physics.dt)));
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i += 1) {
      this.applyPlayerControls(subDt, decisions);
      this.resolvePlayerBounds();
      this.resolvePlayerCollisions();
      this.updatePossession(now);
      this.handleKicks(now, decisions);
      this.integrateBall(subDt);
      this.resolveBallBounds();
      this.resolveBallPlayerCollisions();
      this.updatePossession(now);
    }
  }

  applyPlayerControls(dt, decisions) {
    const { player } = this.config;
    const damping = Math.pow(0.985, dt * 60);

    for (const p of this.players) {
      const decision = decisions.get(this.getPlayerId(p)) || { move: { x: 0, y: 0 }, sprint: false };
      const accel = player.maxAccel;
      p.vx += decision.move.x * accel * dt;
      p.vy += decision.move.y * accel * dt;

      const maxSpeed = player.maxSpeed * (decision.sprint ? player.sprintMultiplier : 1);
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      if (Math.hypot(decision.move.x, decision.move.y) > 0.01) {
        p.facing = { x: decision.move.x, y: decision.move.y };
      }

      integrateEuler(p, dt);
      applyDamping(p, damping);
    }
  }

  resolvePlayerBounds() {
    const margin = this.pitch.margin;
    const left = margin + this.config.player.radius + 6;
    const right = this.field.width - margin - this.config.player.radius - 6;
    const top = margin + this.config.player.radius + 6;
    const bottom = this.field.height - margin - this.config.player.radius - 6;

    for (const p of this.players) {
      if (p.number === 1) {
        const goalCenter = {
          x: p.team === 'orange' ? this.field.width - margin : margin,
          y: this.field.height / 2,
        };
        const maxForward = Math.max(0, this.pitch.areaRadius - this.config.player.radius);
        const maxLateral = Math.max(0, this.pitch.areaRadius - this.config.player.radius);
        const dir = p.team === 'orange' ? -1 : 1;
        const forwardLimit = goalCenter.x + dir * maxForward;
        const minX = Math.min(goalCenter.x + dir * this.config.player.radius, forwardLimit);
        const maxX = Math.max(goalCenter.x + dir * this.config.player.radius, forwardLimit);

        p.x = Math.min(maxX, Math.max(minX, p.x));
        p.y = Math.min(goalCenter.y + maxLateral, Math.max(goalCenter.y - maxLateral, p.y));
      } else {
        p.x = Math.min(right, Math.max(left, p.x));
        p.y = Math.min(bottom, Math.max(top, p.y));
      }
    }
  }

  resolvePlayerCollisions() {
    const restitution = this.config.physics.playerPlayerRestitution;
    for (let i = 0; i < this.players.length; i += 1) {
      for (let j = i + 1; j < this.players.length; j += 1) {
        const a = this.players[i];
        const b = this.players[j];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const minDist = this.config.player.radius * 2;
        if (dist === 0 || dist >= minDist) continue;

        const overlap = (minDist - dist) / 2;
        const nx = (b.x - a.x) / (dist || 1);
        const ny = (b.y - a.y) / (dist || 1);

        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const relVelX = b.vx - a.vx;
        const relVelY = b.vy - a.vy;
        const velAlongNormal = relVelX * nx + relVelY * ny;
        const impulse = -(1 + restitution) * velAlongNormal / (1 / a.mass + 1 / b.mass);

        const ix = impulse * nx;
        const iy = impulse * ny;
        a.applyImpulse(-ix, -iy);
        b.applyImpulse(ix, iy);
      }
    }
  }

  resolveBallPlayerCollisions() {
    const restitution = this.config.physics.collisionRestitution;
    const ball = this.ball;
    for (const p of this.players) {
      const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
      const minDist = ball.radius + this.config.player.radius;
      if (dist === 0 || dist >= minDist) continue;

      const overlap = minDist - dist;
      const nx = (ball.x - p.x) / (dist || 1);
      const ny = (ball.y - p.y) / (dist || 1);

      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const relVelX = ball.vx - p.vx;
      const relVelY = ball.vy - p.vy;
      const velAlongNormal = relVelX * nx + relVelY * ny;
      if (velAlongNormal > 0) continue;
      const impulse = -(1 + restitution) * velAlongNormal / (1 / ball.mass + 1 / p.mass);
      const ix = impulse * nx;
      const iy = impulse * ny;
      ball.applyImpulse(ix, iy);
    }
  }

  updatePossession(now) {
    const contactRadius = this.config.player.radius + this.config.ball.radius;
    const captureRadius = this.config.kick.controlRadius;
    const ballSpeed = this.ball.speed;

    const touchingPlayers = this.players.filter((p) => Math.hypot(p.x - this.ball.x, p.y - this.ball.y) <= contactRadius);

    const controller = this.players.find((p) => this.getPlayerId(p) === this.ballControl.playerId);
    if (controller) {
      const controllerDist = Math.hypot(controller.x - this.ball.x, controller.y - this.ball.y);
      const releaseRadius = contactRadius + 4;
      if (controllerDist > releaseRadius) {
        this.ballControl.playerId = null;
      }
    }

    if (!this.ballControl.playerId
      && now >= this.ballControl.cooldownUntil
      && ballSpeed < this.config.ball.controlCaptureSpeed) {
      let best = null;
      let bestDist = Math.min(contactRadius, captureRadius);
      for (const p of touchingPlayers) {
        const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      if (best) {
        this.ballControl.playerId = this.getPlayerId(best);
      }
    }

    const holder = this.players.find((p) => this.getPlayerId(p) === this.ballControl.playerId);
    if (holder) {
      const dirX = holder.vx || holder.facing.x || (holder.team === 'blue' ? 1 : -1);
      const dirY = holder.vy || holder.facing.y || 0;
      const norm = Math.hypot(dirX, dirY) || 1;
      const offset = Math.max(contactRadius - 2, 0);
      this.ball.x = holder.x + (dirX / norm) * offset;
      this.ball.y = holder.y + (dirY / norm) * offset;
      this.ball.vx = holder.vx;
      this.ball.vy = holder.vy;
    }
  }

  handleKicks(now, decisions) {
    const holder = this.players.find((p) => this.getPlayerId(p) === this.ballControl.playerId);
    if (!holder) return;

    const decision = decisions.get(this.getPlayerId(holder));
    if (!decision?.kick) return;

    const contactRadius = this.config.player.radius + this.config.ball.radius;
    const dist = Math.hypot(holder.x - this.ball.x, holder.y - this.ball.y);
    if (dist > contactRadius + 1) return;

    const power = this.config.kick.maxPower * decision.kick.power;
    this.ball.vx = decision.kick.dirX * power;
    this.ball.vy = decision.kick.dirY * power;
    this.ballControl = { playerId: null, cooldownUntil: now + this.config.kick.controlTimeoutOnKick };
  }

  integrateBall(dt) {
    const damping = Math.pow(this.config.ball.friction * this.config.ball.rollingResistance, dt * 60);
    integrateEuler(this.ball, dt);
    applyDamping(this.ball, damping);
  }

  resolveBallBounds() {
    const b = this.ball;
    const margin = this.pitch.margin;
    const leftLine = margin;
    const rightLine = this.field.width - margin;
    const topLine = margin;
    const bottomLine = this.field.height - margin;
    const goalTop = this.field.height / 2 - this.pitch.goal.height / 2;
    const goalBottom = goalTop + this.pitch.goal.height;
    const inGoalY = b.y >= goalTop && b.y <= goalBottom;

    const r = b.radius + 6;
    if (!inGoalY) {
      if (b.x < leftLine + r) {
        b.x = leftLine + r;
        b.vx = Math.abs(b.vx) * this.config.physics.collisionRestitution;
      } else if (b.x > rightLine - r) {
        b.x = rightLine - r;
        b.vx = -Math.abs(b.vx) * this.config.physics.collisionRestitution;
      }
    } else {
      const leftBack = leftLine - this.pitch.goal.depth;
      const rightBack = rightLine + this.pitch.goal.depth;
      if (b.x < leftBack + r) {
        b.x = leftBack + r;
        b.vx = Math.abs(b.vx) * this.config.physics.collisionRestitution;
      } else if (b.x > rightBack - r) {
        b.x = rightBack - r;
        b.vx = -Math.abs(b.vx) * this.config.physics.collisionRestitution;
      }
    }

    if (b.y < topLine + r) {
      b.y = topLine + r;
      b.vy = Math.abs(b.vy) * this.config.physics.collisionRestitution;
    } else if (b.y > bottomLine - r) {
      b.y = bottomLine - r;
      b.vy = -Math.abs(b.vy) * this.config.physics.collisionRestitution;
    }

    if (inGoalY) {
      if (b.y < goalTop + r) {
        b.y = goalTop + r;
        b.vy = Math.abs(b.vy) * this.config.physics.collisionRestitution;
      } else if (b.y > goalBottom - r) {
        b.y = goalBottom - r;
        b.vy = -Math.abs(b.vy) * this.config.physics.collisionRestitution;
      }
    }
  }
}

export function createPlayerInstances(formation, team, fieldWidth, fieldHeight, config) {
  return formation.map((pos, i) => new Player({
    team,
    number: i + 1,
    x: pos.x * fieldWidth,
    y: pos.y * fieldHeight,
    radius: config.player.radius,
    mass: config.player.mass,
    stamina: 1,
  }));
}

export function createBallInstance(field, config) {
  return new Ball({
    x: field.width / 2,
    y: field.height / 2,
    radius: config.ball.radius,
    mass: config.ball.mass,
  });
}

export default PhysicsEngine;
