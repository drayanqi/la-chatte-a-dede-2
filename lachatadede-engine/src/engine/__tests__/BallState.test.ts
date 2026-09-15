import { describe, expect, it } from 'vitest';
import { BallState } from '../BallState.js';
import { MAX_BALL_SPEED } from '../constants.js';

describe('BallState - friction (game-rules.md)', () => {
  it('applies friction 0.95 per tick: 5.0 -> 4.75 -> 4.5125 -> ...', () => {
    const ball = new BallState(50, 25);
    ball.vx = 5.0;
    ball.vy = 0;
    const speeds: number[] = [];
    for (let i = 0; i < 5; i++) {
      ball.step();
      speeds.push(Math.hypot(ball.vx, ball.vy));
    }
    expect(speeds[0]).toBeCloseTo(4.75, 12);
    expect(speeds[1]).toBeCloseTo(4.5125, 12);
    expect(speeds[2]).toBeCloseTo(4.75 * 0.95 * 0.95, 12);
  });

  it('stops the ball when speed drops below MIN_BALL_SPEED (0.1)', () => {
    const ball = new BallState(50, 25);
    ball.vx = 0.15;
    ball.vy = 0;
    let lastSpeed = 0;
    for (let i = 0; i < 100; i++) {
      ball.step();
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed === 0) break;
      lastSpeed = speed;
    }
    expect(Math.hypot(ball.vx, ball.vy)).toBe(0);
    expect(lastSpeed).toBeGreaterThanOrEqual(0.1);
  });
});

describe('BallState - edge rebounds (game-rules.md)', () => {
  it('side edge y=0: position clamped to 0.1 inside, vy reflected', () => {
    const ball = new BallState(50, 1.5);
    ball.vx = 3;
    ball.vy = -2;
    ball.step();
    expect(ball.y).toBe(0.1);
    expect(ball.x).toBe(53);
    expect(ball.vy).toBeCloseTo(1.9, 12); // reflected, then friction applied
    expect(ball.vx).toBeCloseTo(2.85, 12); // friction, sign preserved
  });

  it('side edge y=50: position clamped to 49.9 inside, vy reflected', () => {
    const ball = new BallState(50, 49);
    ball.vx = 0;
    ball.vy = 2;
    ball.step();
    expect(ball.y).toBe(49.9);
    expect(ball.vy).toBeLessThan(0);
  });

  it('goal line x=100 outside goal mouth: position clamped to 99.9 inside, vx reflected', () => {
    const ball = new BallState(99.5, 10);
    ball.vx = 1;
    ball.vy = 1;
    ball.step();
    expect(ball.x).toBe(99.9);
    expect(ball.y).toBe(11);
    expect(ball.vx).toBeCloseTo(-0.95, 12);
    expect(ball.vy).toBeCloseTo(0.95, 12);
  });

  it('goal line x=0 outside goal mouth: position clamped to 0.1 inside, vx reflected', () => {
    const ball = new BallState(0.5, 10);
    ball.vx = -1;
    ball.vy = 0;
    ball.step();
    expect(ball.x).toBe(0.1);
    expect(ball.vx).toBeGreaterThan(0);
  });

  it('ball entering the goal mouth (y in [15,35]) is NOT rebounded at the x boundary', () => {
    const ball = new BallState(99.5, 20);
    ball.vx = 1;
    ball.vy = 0;
    ball.step();
    expect(ball.x).toBeGreaterThan(100); // crosses freely; Simulation detects the goal
    expect(ball.y).toBe(20);
  });
});

describe('BallState - possession and velocity API', () => {
  it('giveTo sets owner and lastTouch', () => {
    const ball = new BallState(50, 25);
    ball.giveTo({ slot: 3, team: 'challenger' });
    expect(ball.owner).toEqual({ slot: 3, team: 'challenger' });
    expect(ball.lastTouch).toEqual({ slot: 3, team: 'challenger' });
  });

  it('release clears the owner and zeroes velocity', () => {
    const ball = new BallState(50, 25);
    ball.giveTo({ slot: 3, team: 'challenger' });
    ball.vx = 2;
    ball.vy = 1;
    ball.release();
    expect(ball.owner).toBeNull();
    expect(ball.vx).toBe(0);
    expect(ball.vy).toBe(0);
    expect(ball.lastTouch).toEqual({ slot: 3, team: 'challenger' }); // touch memory kept
    expect(ball.releasedBy).toEqual({ slot: 3, team: 'challenger' }); // same-tick pickup exemption
  });

  it('giveTo clears the release exemption', () => {
    const ball = new BallState(50, 25);
    ball.giveTo({ slot: 3, team: 'challenger' });
    ball.release();
    expect(ball.releasedBy).not.toBeNull();
    ball.giveTo({ slot: 4, team: 'opponent' });
    expect(ball.releasedBy).toBeNull();
  });

  it('shoot releases the ball toward the target at MAX_BALL_SPEED', () => {
    const ball = new BallState(50, 25);
    ball.giveTo({ slot: 2, team: 'challenger' });
    ball.shoot(100, 25);
    expect(ball.owner).toBeNull();
    expect(ball.vx).toBeCloseTo(MAX_BALL_SPEED, 12);
    expect(ball.vy).toBeCloseTo(0, 12);
  });

  it('shoot toward a diagonal target yields a normalized velocity of exactly MAX_BALL_SPEED', () => {
    const ball = new BallState(50, 25);
    ball.shoot(53, 29); // distance 5 -> direction (3/5, 4/5)
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(MAX_BALL_SPEED, 12);
    expect(ball.vx).toBeCloseTo(MAX_BALL_SPEED * 0.6, 12);
    expect(ball.vy).toBeCloseTo(MAX_BALL_SPEED * 0.8, 12);
  });

  it('shoot normalizes direction when the target is farther than max range', () => {
    const ball = new BallState(50, 25);
    ball.shoot(110, 25);
    expect(ball.vx).toBeCloseTo(MAX_BALL_SPEED, 12);
    expect(ball.vy).toBeCloseTo(0, 12);
  });

  it('shoot at own position falls back to +x direction deterministically', () => {
    const ball = new BallState(50, 25);
    ball.shoot(50, 25);
    expect(ball.vx).toBe(MAX_BALL_SPEED);
    expect(ball.vy).toBe(0);
  });

  it('owned ball does not integrate on step (Simulation syncs dribbles)', () => {
    const ball = new BallState(50, 25);
    ball.giveTo({ slot: 1, team: 'challenger' });
    ball.step();
    expect(ball.x).toBe(50);
    expect(ball.y).toBe(25);
  });
});
