/**
 * Time Format Unit Tests (story 3.9, Task 4)
 *
 * Tick <-> mm:ss mapping for the timeline scrubber. The engine runs at
 * 60 fps (game-rules.md), so 60 ticks = 1 second — the epics.md 30-tick
 * example encoded a stale 30fps assumption.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import { formatTime } from '@/lib/timeFormat';

describe('formatTime', () => {
  it('should format tick 0 as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('should format tick 2520 (42 seconds) as 00:42', () => {
    expect(formatTime(2520)).toBe('00:42');
  });

  it('should format tick 10800 (full 3-minute match) as 03:00', () => {
    expect(formatTime(10800)).toBe('03:00');
  });

  it('should floor partial seconds (59 ticks is still 00:00)', () => {
    expect(formatTime(59)).toBe('00:00');
    expect(formatTime(60)).toBe('00:01');
  });

  it('should floor a tick that lands mid-second (10859 is still 03:00)', () => {
    expect(formatTime(10859)).toBe('03:00');
    expect(formatTime(10860)).toBe('03:01');
  });

  it('should pad both minutes and seconds to two digits', () => {
    expect(formatTime(7560)).toBe('02:06');
    expect(formatTime(7260)).toBe('02:01');
  });

  it('should clamp negative ticks to 00:00', () => {
    expect(formatTime(-60)).toBe('00:00');
  });

  it('should format ticks beyond the match length without crashing', () => {
    // The scrubber clamps seeks, but formatTime itself stays total-agnostic
    expect(formatTime(12000)).toBe('03:20');
  });
});
