/**
 * MatchEvents - typed frame-event extraction for the replay drawer (story 7.9).
 *
 * The engine attaches per-frame events (goal, shot, turnover) to every
 * replay frame. The drawer renders them as frame-linked rows: this lib
 * flattens one event type out of the frames with the same array-position
 * tick semantics as computeScore/extractGoalTicks (a data `index` that
 * drifts from its position can never misplace a row). Pure functions,
 * computed once per replay load; malformed events are skipped, never a
 * crash (same tolerance as extractLogs).
 */

import type { MatchFrame, MatchFrameEvent } from '@/types';

/** One flattened event: its payload + the array position it happened on */
export interface MatchEventEntry<T extends MatchFrameEvent = MatchFrameEvent> {
  tick: number;
  event: T;
}

/**
 * Extracts every event of the given type, keyed on array position — the
 * same notion of tick as playback and seek. Pure.
 */
export function extractFrameEvents<T extends MatchFrameEvent['type']>(
  frames: MatchFrame[],
  type: T
): MatchEventEntry<Extract<MatchFrameEvent, { type: T }>>[] {
  const entries: MatchEventEntry<Extract<MatchFrameEvent, { type: T }>>[] = [];

  frames.forEach((frame, position) => {
    for (const event of frame.events) {
      if (!event || event.type !== type) continue;
      entries.push({ tick: position, event: event as Extract<MatchFrameEvent, { type: T }> });
    }
  });

  return entries;
}
