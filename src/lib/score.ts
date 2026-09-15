/**
 * Score - pure score derivation from match frames (story 3.7)
 *
 * The on-screen score is replayed from the goal events of the loaded frames
 * up to the current tick. No engine, no store — a pure function.
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import type { MatchFrame } from '@/types';

export interface Score {
  challenger: number;
  opponent: number;
}

/**
 * Count the goals scored at or before currentTick — a frame POSITION in the
 * array, inclusive. Keyed on array position (the same notion of "current
 * frame" as playback and celebration) so a data `index` that drifts from its
 * position can never desync the score from what is on screen.
 */
export function computeScore(frames: MatchFrame[], currentTick: number): Score {
  const score: Score = { challenger: 0, opponent: 0 };

  frames.forEach((frame, position) => {
    if (position > currentTick) return;

    for (const event of frame.events) {
      if (event.type !== 'goal') continue;
      if (event.team === 'challenger') {
        score.challenger++;
      } else {
        score.opponent++;
      }
    }
  });

  return score;
}
