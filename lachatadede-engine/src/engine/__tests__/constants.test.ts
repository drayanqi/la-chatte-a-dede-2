import { describe, expect, it } from 'vitest';
import {
  BALL_FRICTION,
  CARRIER_SPEED_MULTIPLIER,
  CENTER_X,
  CENTER_Y,
  COLLISION_RADIUS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  GOAL_WIDTH,
  MATCH_DURATION_SECONDS,
  MATCH_TIME_BUDGET_MS,
  MAX_BALL_SPEED,
  MEMORY_LIMIT_MB,
  MIN_BALL_SPEED,
  PLAYERS_PER_TEAM,
  PLAYER_SPEED,
  POINTS_DRAW,
  POINTS_LOSS,
  POINTS_WIN,
  POSSESSION_LOCKOUT_TICKS,
  TICK_TIMEOUT_MS,
  TICKS_PER_SECOND,
  TOTAL_TICKS,
} from '../constants.js';

/**
 * Exact values copied from game-rules.md (authoritative, validated by Pelo,
 * v1.7 2026-09-22). Any change to these numbers must be reflected in
 * game-rules.md first.
 */
describe('game constants', () => {
  it('match duration and ticks (60 fps, 3 minutes = 10800 ticks)', () => {
    expect(MATCH_DURATION_SECONDS).toBe(180);
    expect(TICKS_PER_SECOND).toBe(60);
    expect(TOTAL_TICKS).toBe(10800);
    expect(TOTAL_TICKS).toBe(MATCH_DURATION_SECONDS * TICKS_PER_SECOND);
  });

  it('field and goals', () => {
    expect(FIELD_WIDTH).toBe(100);
    expect(FIELD_HEIGHT).toBe(50);
    expect(GOAL_Y_MIN).toBe(15);
    expect(GOAL_Y_MAX).toBe(35);
    expect(GOAL_WIDTH).toBe(20);
  });

  it('center spot (default ball position)', () => {
    expect(CENTER_X).toBe(50);
    expect(CENTER_Y).toBe(25);
  });

  it('players and ball physics', () => {
    expect(PLAYER_SPEED).toBe((1 / 1.8 / 1.1) * 0.7);
    expect(CARRIER_SPEED_MULTIPLIER).toBe(0.8);
    expect(PLAYERS_PER_TEAM).toBe(5);
    expect(MAX_BALL_SPEED).toBe((5 / 1.75) * 0.8 * 1.1 * 0.7);
    expect(BALL_FRICTION).toBe(1 - 0.05 / 1.2);
    expect(MIN_BALL_SPEED).toBe(0.07);
    expect(COLLISION_RADIUS).toBe(2.0);
    expect(POSSESSION_LOCKOUT_TICKS).toBe(180);
    expect(POSSESSION_LOCKOUT_TICKS).toBe(3 * 60);
  });

  it('ranking points', () => {
    expect(POINTS_WIN).toBe(3);
    expect(POINTS_DRAW).toBe(1);
    expect(POINTS_LOSS).toBe(-1);
  });

  it('sandboxing limits (script-ia-api.md + backend-architecture.md)', () => {
    expect(TICK_TIMEOUT_MS).toBe(10);
    expect(MEMORY_LIMIT_MB).toBe(8);
    expect(MATCH_TIME_BUDGET_MS).toBe(30_000);
  });
});
