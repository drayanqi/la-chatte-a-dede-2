// Game constants - copied EXACTLY from game-rules.md (authoritative, validated by Pelo 2026-01-19).
// Any change to these values must happen in game-rules.md first.

// Duration
export const MATCH_DURATION_SECONDS = 180; // 3 minutes
export const TICKS_PER_SECOND = 60;
export const TOTAL_TICKS = 10800; // 180 * 60

// Field
export const FIELD_WIDTH = 100;
export const FIELD_HEIGHT = 50;

// Goals
export const GOAL_Y_MIN = 15;
export const GOAL_Y_MAX = 35;
export const GOAL_WIDTH = 20; // 35 - 15

// Center circle (kickoff)
export const CENTER_X = 50;
export const CENTER_Y = 25;
export const CENTER_CIRCLE_RADIUS = 10;

// Players
export const PLAYER_SPEED = 1.0;
export const PLAYERS_PER_TEAM = 5;

// Ball
export const MAX_BALL_SPEED = 5.0;
export const BALL_FRICTION = 0.95;
export const MIN_BALL_SPEED = 0.1;
export const COLLISION_RADIUS = 2.0;

// Ranking points
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = -1;
