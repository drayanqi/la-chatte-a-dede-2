/**
 * Player Color Constant Tests (story 3.7, Task 2/6)
 *
 * The team colors are a UX-spec contract (Rocket League-inspired):
 * home = orange #ff6b1a, away = blue #1a8cff. Exported so the engine,
 * celebrations (team-colored confetti) and tests share one source of truth.
 *
 * @see ux-design-specification.md — Team Colors
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import {
  PLAYER_HOME_COLOR,
  PLAYER_AWAY_COLOR,
} from '@/components/canvas/engine/Player';

describe('Player Team Colors', () => {
  it('should paint the home team orange (#ff6b1a)', () => {
    expect(PLAYER_HOME_COLOR).toBe(0xff6b1a);
  });

  it('should paint the away team blue (#1a8cff)', () => {
    expect(PLAYER_AWAY_COLOR).toBe(0x1a8cff);
  });

  it('should keep home and away visually distinct', () => {
    expect(PLAYER_HOME_COLOR).not.toBe(PLAYER_AWAY_COLOR);
  });
});
