/**
 * ReplayLogs - log extraction and windowing for the debug panel (story 3.10).
 *
 * The engine attaches structured `logs` to every replay frame (story 3.4
 * variance): `{team, slot, level, type, message}`. A full match holds up to
 * 10800 frames, so the flat extraction is computed ONCE per replay load
 * (memoized in matchStore) and the display windows around the playhead —
 * a flat "render everything" list would die at 10800 entries, windowing is
 * the required design, not an optimization.
 *
 * Entries are returned in frame order, which is ascending tick order: the
 * windowing binary search relies on it.
 */
import type { MatchFrame, MatchFrameLog, MatchTeam } from '@/types';

/** One flattened replay log entry: frame log + the tick it was emitted on */
export interface ReplayLogEntry {
  /** Stable position in the full extracted log set (React key, testids) */
  index: number;
  /** Frame index (tick) the log was emitted on */
  tick: number;
  team: MatchTeam;
  slot: number;
  level: MatchFrameLog['level'];
  type: string;
  message: string;
}

/** Message color per log level (UX spec: normal, --warning, --error) */
export const LOG_LEVEL_COLORS: Record<ReplayLogEntry['level'], string> = {
  log: '#cccccc',
  warn: '#dcdcaa',
  error: '#f14c4c',
};

/** Chip color per team, matching the pitch (challenger orange / opponent blue) */
export const LOG_TEAM_COLORS: Record<MatchTeam, string> = {
  challenger: '#ff6b1a',
  opponent: '#1a8cff',
};

/**
 * Flattens every frame's `logs` into one indexed array. Pure: never mutates
 * the frames. A frame without the engine's `logs` field (older replays) is
 * skipped, never a crash; a malformed log entry inside a frame is skipped
 * the same way. Frames are sorted by `index` so the ascending-tick order
 * the windowing binary search relies on is established here, not trusted
 * from the payload.
 */
export function extractLogs(frames: MatchFrame[]): ReplayLogEntry[] {
  const entries: ReplayLogEntry[] = [];
  const ordered = [...frames].sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));
  for (const frame of ordered) {
    const frameLogs = Array.isArray(frame?.logs) ? frame.logs : [];
    for (const log of frameLogs) {
      if (!log || typeof log !== 'object') continue;
      entries.push({
        index: entries.length,
        tick: frame.index,
        team: log.team,
        slot: log.slot,
        level: log.level,
        type: log.type,
        message: log.message,
      });
    }
  }
  return entries;
}

/**
 * Returns the entries within ±windowTicks around `tick` (inclusive edges).
 * Pure. Assumes entries sorted by ascending tick (extractLogs guarantee);
 * binary-searches the window start instead of scanning the full set.
 */
export function logsAroundTick(
  logs: ReplayLogEntry[],
  tick: number,
  windowTicks = 60
): ReplayLogEntry[] {
  // A non-finite playhead would defeat both binary-search comparisons and
  // silently un-window the whole set
  if (!Number.isFinite(tick)) return [];
  const lower = tick - windowTicks;
  const upper = tick + windowTicks;

  let lo = 0;
  let hi = logs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const entry = logs[mid];
    if (entry && entry.tick < lower) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  let end = lo;
  while (end < logs.length) {
    const entry = logs[end];
    if (!entry || entry.tick > upper) break;
    end++;
  }

  return logs.slice(lo, end);
}
