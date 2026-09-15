/**
 * MatchFrames - normalization of engine replay frames for the canvas.
 *
 * The engine records positions in field units: x is already a percent
 * (0-100) but y spans FIELD_HEIGHT = 50. The canvas renders percent
 * coordinates (0-100), so y must be scaled by 100/50 = 2 exactly once at
 * load. Same underlying API convention as tacticBridge's API_Y_SCALE
 * (tactic y is stored 0-50).
 */
import type { MatchFrame } from '@/types';

const ENGINE_FIELD_HEIGHT = 50;
const Y_TO_PERCENT = 100 / ENGINE_FIELD_HEIGHT;

/**
 * Returns frames with player and ball y converted from engine field units
 * (0-50) to percent of the pitch (0-100). Pure: input frames are not mutated.
 */
export function normalizeMatchFrames(frames: MatchFrame[]): MatchFrame[] {
  return frames.map((frame) => ({
    ...frame,
    ball: { ...frame.ball, y: frame.ball.y * Y_TO_PERCENT },
    players: frame.players.map((player) => ({ ...player, y: player.y * Y_TO_PERCENT })),
  }));
}
