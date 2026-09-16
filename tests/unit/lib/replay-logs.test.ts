/**
 * Replay Logs Unit Tests
 *
 * Tests the log extraction + windowing helpers backing the debug panel
 * (story 3.10):
 * - extractLogs flattens per-frame logs into a stable indexed array
 * - logsAroundTick slices the ±windowTicks entries around a tick
 *
 * @see Story 3.10: Debug Panel — Log Display
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import {
  extractLogs,
  logsAroundTick,
  filterLogsByPlayer,
  type ReplayLogEntry,
} from '@/lib/replayLogs';
import type { MatchFrame, MatchFrameLog } from '@/types';

const log = (overrides: Partial<MatchFrameLog> = {}): MatchFrameLog => ({
  team: 'challenger',
  slot: 1,
  level: 'log',
  type: 'CONSOLE',
  message: 'hello',
  ...overrides,
});

const frame = (index: number, logs: MatchFrameLog[]): MatchFrame => ({
  index,
  ball: { x: 50, y: 50 },
  players: [],
  events: [],
  logs,
});

describe('extractLogs', () => {
  it('flattens logs from multiple frames into one indexed array', () => {
    // GIVEN: Frames at ticks 0, 7 and 12 each carrying one log
    const frames = [
      frame(0, [log({ message: 'start' })]),
      frame(7, [log({ slot: 3, message: 'mid' })]),
      frame(12, [log({ team: 'opponent', message: 'end' })]),
    ];

    // WHEN: Extracting the logs
    const logs = extractLogs(frames);

    // THEN: One entry per log, tick taken from the owning frame
    expect(logs).toHaveLength(3);
    expect(logs[0]).toMatchObject({ index: 0, tick: 0, message: 'start' });
    expect(logs[1]).toMatchObject({ index: 1, tick: 7, slot: 3, message: 'mid' });
    expect(logs[2]).toMatchObject({ index: 2, tick: 12, team: 'opponent', message: 'end' });
  });

  it('preserves the full log payload: level, type, team and slot', () => {
    // GIVEN: A frame with warn and error entries (3.4 warnings taxonomy)
    const frames = [
      frame(42, [
        log({ level: 'warn', type: 'MULTIPLE_ACTIONS', message: 'only the first action per tick is applied' }),
        log({ level: 'error', type: 'SCRIPT_ERROR', message: 'boom', slot: 2 }),
      ]),
    ];

    // WHEN: Extracting the logs
    const logs = extractLogs(frames);

    // THEN: Levels and types survive untouched
    expect(logs[0]).toMatchObject({
      tick: 42,
      level: 'warn',
      type: 'MULTIPLE_ACTIONS',
      message: 'only the first action per tick is applied',
    });
    expect(logs[1]).toMatchObject({
      tick: 42,
      level: 'error',
      type: 'SCRIPT_ERROR',
      slot: 2,
    });
  });

  it('handles multi-player logs within one frame in order', () => {
    // GIVEN: Two challenger players and one opponent logging on the same tick
    const frames = [
      frame(5, [
        log({ slot: 1, message: 'a' }),
        log({ slot: 2, message: 'b' }),
        log({ team: 'opponent', slot: 5, message: 'c' }),
      ]),
    ];

    // WHEN: Extracting the logs
    const logs = extractLogs(frames);

    // THEN: Frame order is preserved (a, b, c)
    expect(logs.map((entry) => entry.message)).toEqual(['a', 'b', 'c']);
  });

  it('skips frames without logs and tolerates a missing logs field', () => {
    // GIVEN: Frames from an engine build without the logs field (pre-3.4)
    const noLogsField = { index: 1, ball: { x: 0, y: 0 }, players: [], events: [] };
    const frames = [frame(0, []), noLogsField as unknown as MatchFrame, frame(2, [log()])];

    // WHEN: Extracting the logs
    const logs = extractLogs(frames);

    // THEN: No crash, only the real log is kept
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ tick: 2 });
  });

  it('sorts out-of-order frames into ascending tick order', () => {
    // GIVEN: A payload whose frames are not ascending by index — the binary
    // search in logsAroundTick relies on the ordering extractLogs establishes
    const frames = [frame(90, [log({ message: 'late' })]), frame(2, [log({ message: 'early' })])];

    // WHEN: Extracting the logs
    const logs = extractLogs(frames);

    // THEN: Entries come back in ascending tick order regardless of payload order
    expect(logs.map((entry) => entry.tick)).toEqual([2, 90]);
    expect(logs.map((entry) => entry.message)).toEqual(['early', 'late']);
  });

  it('skips a malformed log entry inside a frame instead of throwing', () => {
    // GIVEN: A frame whose logs array carries a null entry among valid ones
    const frames = [frame(3, [null as unknown as MatchFrameLog, log({ message: 'ok' })])];

    // WHEN: Extracting the logs
    const logs = extractLogs(frames);

    // THEN: The malformed entry is skipped, the valid one survives
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ tick: 3, message: 'ok' });
  });

  it('returns an empty array for empty frames', () => {
    expect(extractLogs([])).toEqual([]);
  });
});

describe('logsAroundTick', () => {
  const range = (from: number, to: number, step = 1): ReplayLogEntry[] => {
    const logs: ReplayLogEntry[] = [];
    for (let tick = from; tick <= to; tick += step) {
      logs.push({
        index: logs.length,
        tick,
        team: 'challenger',
        slot: 1,
        level: 'log',
        type: 'CONSOLE',
        message: `t${tick}`,
      });
    }
    return logs;
  };

  it('returns the entries within the ±60-tick default window', () => {
    // GIVEN: One log per tick from 0 to 1000
    const logs = range(0, 1000);

    // WHEN: Windowing around tick 500
    const windowed = logsAroundTick(logs, 500);

    // THEN: Exactly the inclusive ±60 range is returned
    expect(windowed).toHaveLength(121);
    expect(windowed[0].tick).toBe(440);
    expect(windowed[windowed.length - 1].tick).toBe(560);
  });

  it('includes entries exactly at the window edges', () => {
    // GIVEN: Sparse logs at the exact edges and just outside
    const logs: ReplayLogEntry[] = [
      { index: 0, tick: 439, team: 'challenger', slot: 1, level: 'log', type: 'CONSOLE', message: 'out-low' },
      { index: 1, tick: 440, team: 'challenger', slot: 1, level: 'log', type: 'CONSOLE', message: 'edge-low' },
      { index: 2, tick: 560, team: 'challenger', slot: 1, level: 'log', type: 'CONSOLE', message: 'edge-high' },
      { index: 3, tick: 561, team: 'challenger', slot: 1, level: 'log', type: 'CONSOLE', message: 'out-high' },
    ];

    // WHEN: Windowing around tick 500
    const windowed = logsAroundTick(logs, 500);

    // THEN: Edges are inclusive, outside entries excluded
    expect(windowed.map((entry) => entry.message)).toEqual(['edge-low', 'edge-high']);
  });

  it('clamps to the available range when the tick is near tick 0', () => {
    // GIVEN: Logs from tick 0
    const logs = range(0, 200);

    // WHEN: Windowing around tick 10
    const windowed = logsAroundTick(logs, 10);

    // THEN: Nothing before 0 exists, everything up to +60 is returned
    expect(windowed[0].tick).toBe(0);
    expect(windowed[windowed.length - 1].tick).toBe(70);
  });

  it('clamps to the available range when the window extends past the last log', () => {
    // GIVEN: Logs ending at tick 100
    const logs = range(0, 100);

    // WHEN: Windowing around tick 130 (only the tail falls inside ±60)
    const windowed = logsAroundTick(logs, 130);

    // THEN: The tail of the log set is returned, clamped at its end
    expect(windowed[0].tick).toBe(70);
    expect(windowed[windowed.length - 1].tick).toBe(100);
  });

  it('returns an empty array when every log is before the window', () => {
    // GIVEN: Logs ending at tick 100
    const logs = range(0, 100);

    // WHEN: Windowing around a tick far past the last log
    const windowed = logsAroundTick(logs, 5000);

    // THEN: Nothing falls inside the window
    expect(windowed).toEqual([]);
  });

  it('returns an empty array when every log is after the window', () => {
    // GIVEN: Logs starting at tick 1000
    const logs = range(1000, 1010);

    // WHEN: Windowing around tick 0
    const windowed = logsAroundTick(logs, 0);

    // THEN: Nothing falls inside the window
    expect(windowed).toEqual([]);
  });

  it('returns an empty array for a non-finite tick instead of un-windowing', () => {
    // GIVEN: One log per tick from 0 to 1000
    const logs = range(0, 1000);

    // WHEN: Windowing around a NaN playhead (corrupt frame state)
    // THEN: Nothing renders — never the full 10K-entry set
    expect(logsAroundTick(logs, Number.NaN)).toEqual([]);
    expect(logsAroundTick(logs, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('returns an empty array for an empty log set', () => {
    expect(logsAroundTick([], 42)).toEqual([]);
  });

  it('returns an empty array when no logs fall inside the window', () => {
    // GIVEN: Logs clustered at ticks 0-10 and 1000-1010
    const logs = [...range(0, 10), ...range(1000, 1010)];

    // WHEN: Windowing around tick 500
    const windowed = logsAroundTick(logs, 500);

    // THEN: The quiet zone yields nothing
    expect(windowed).toEqual([]);
  });

  it('honours a custom window size', () => {
    // GIVEN: One log per tick from 0 to 1000
    const logs = range(0, 1000);

    // WHEN: Windowing around tick 500 with a 10-tick window
    const windowed = logsAroundTick(logs, 500, 10);

    // THEN: The custom window is applied
    expect(windowed).toHaveLength(21);
    expect(windowed[0].tick).toBe(490);
    expect(windowed[windowed.length - 1].tick).toBe(510);
  });
});

describe('filterLogsByPlayer (story 3.11)', () => {
  // GIVEN: A mixed log set — challenger P2, opponent P2 (same slot, other
  // team), the SYS sentinel (slot 0) and challenger P5
  const logs: ReplayLogEntry[] = [
    { index: 0, tick: 0, team: 'challenger', slot: 2, level: 'log', type: 'CONSOLE', message: 'p2-a' },
    { index: 1, tick: 1, team: 'opponent', slot: 2, level: 'log', type: 'CONSOLE', message: 'opp-p2' },
    { index: 2, tick: 2, team: 'challenger', slot: 0, level: 'warn', type: 'LOG_CAP', message: 'sys' },
    { index: 3, tick: 3, team: 'challenger', slot: 2, level: 'log', type: 'CONSOLE', message: 'p2-b' },
    { index: 4, tick: 4, team: 'challenger', slot: 5, level: 'log', type: 'CONSOLE', message: 'p5' },
  ];

  it('keeps only the entries of the selected player', () => {
    // WHEN: Filtering to challenger P2
    // THEN: Only that player's entries survive, in order
    const filtered = filterLogsByPlayer(logs, 'challenger-2');
    expect(filtered.map((entry) => entry.message)).toEqual(['p2-a', 'p2-b']);
  });

  it('matches on the {team, slot} composite, never the slot alone', () => {
    // WHEN: Filtering challenger P2
    // THEN: The opponent's P2 (same slot number) is excluded
    const filtered = filterLogsByPlayer(logs, 'challenger-2');
    expect(filtered.every((entry) => entry.team === 'challenger')).toBe(true);

    // ...and the opponent key keeps only the opponent's entries
    expect(filterLogsByPlayer(logs, 'opponent-2').map((entry) => entry.message)).toEqual([
      'opp-p2',
    ]);
  });

  it('excludes SYS entries (slot 0) for any player filter', () => {
    // WHEN: Filtering any player
    // THEN: Engine system warnings never leak into a player stream
    const filtered = filterLogsByPlayer(logs, 'challenger-2');
    expect(filtered.every((entry) => entry.slot !== 0)).toBe(true);
  });

  it('returns every entry unchanged when no filter is set', () => {
    // WHEN: Filtering with null (Show All / no selection)
    // THEN: The full set is returned as-is
    expect(filterLogsByPlayer(logs, null)).toEqual(logs);
  });

  it('returns an empty array when the player never logged', () => {
    // WHEN: Filtering to a player absent from the set
    // THEN: Nothing matches (drives the panel's filtered empty state)
    expect(filterLogsByPlayer(logs, 'challenger-4')).toEqual([]);
  });

  it('composes with the windowing: filter first, then window', () => {
    // GIVEN: P2 logs every 60 ticks, P5 logs on the odd tens
    const mixed: ReplayLogEntry[] = [];
    for (let tick = 0; tick <= 300; tick++) {
      if (tick % 60 === 0) {
        mixed.push({ index: mixed.length, tick, team: 'challenger', slot: 2, level: 'log', type: 'CONSOLE', message: `p2@${tick}` });
      }
      if (tick % 10 === 5) {
        mixed.push({ index: mixed.length, tick, team: 'challenger', slot: 5, level: 'log', type: 'CONSOLE', message: `p5@${tick}` });
      }
    }

    // WHEN: Filtering to P2 first, then windowing ±60 around tick 130
    const windowed = logsAroundTick(filterLogsByPlayer(mixed, 'challenger-2'), 130);

    // THEN: Only P2's entries inside the window show up (a quiet player in
    // a busy window would render nothing misleadingly the other way around)
    expect(windowed.map((entry) => entry.message)).toEqual(['p2@120', 'p2@180']);
  });
});
