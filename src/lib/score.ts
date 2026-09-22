/**
 * Score - pure score derivation from match frames (story 3.7)
 *
 * The on-screen score is replayed from the goal events of the loaded frames
 * up to the current tick. No engine, no store — a pure function.
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import type { MatchFrame, MatchTeam } from '@/types';

export interface Score {
  challenger: number;
  opponent: number;
}

/** One goal position for the timeline scrubber markers (story 3.9) */
export interface GoalTick {
  /** Frame POSITION in the frames array — the same tick notion as playback */
  tick: number;
  /** Scoring team, as written in the frame event */
  team: MatchTeam;
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

/**
 * Extract the goal positions for the timeline markers (story 3.9, Task 3):
 * one entry per goal event, keyed on array position — the same notion of
 * tick as playback and computeScore, so a drifting data `index` can never
 * misplace a marker. Pure function, computed once per replay load.
 */
export function extractGoalTicks(frames: MatchFrame[]): GoalTick[] {
  const ticks: GoalTick[] = [];

  frames.forEach((frame, position) => {
    for (const event of frame.events) {
      if (event.type !== 'goal') continue;
      ticks.push({ tick: position, team: event.team });
    }
  });

  return ticks;
}

/** One scored goal for the replay drawer lists (story 7.7) */
export interface GoalEventEntry extends GoalTick {
  /** Scorer's slot number, as written in the frame event */
  scorerSlot: number;
}

/**
 * Extract every goal with its scorer slot, keyed on array position — the
 * same notion of tick as playback/seek. Pure; a malformed event is skipped,
 * never a crash (same tolerance as extractLogs).
 */
export function extractGoalEvents(frames: MatchFrame[]): GoalEventEntry[] {
  const goals: GoalEventEntry[] = [];

  frames.forEach((frame, position) => {
    for (const event of frame.events) {
      if (!event || event.type !== 'goal') continue;
      goals.push({ tick: position, team: event.team, scorerSlot: event.scorerSlot });
    }
  });

  return goals;
}
