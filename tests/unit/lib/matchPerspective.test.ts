/**
 * Match Perspective Unit Tests (story 4.4, Task 6)
 *
 * A ranked match sits in MY history on either side: challenger when I
 * started it, opponent when someone challenged me offline. The perspective
 * helper flips scores/points/labels to where I stand.
 *
 * @see Story 4.4: Match History & Results (AC #1 — perspective math)
 * @priority P0
 */
import { describe, it, expect } from 'vitest';
import { matchPerspective } from '@/lib/matchPerspective';
import type { MatchResult } from '@/types';

const makeMatch = (overrides: Partial<MatchResult> = {}): MatchResult => ({
  id: 'match-1',
  mode: 'ranked',
  status: 'completed',
  scoreChallenger: 2,
  scoreOpponent: 1,
  result: 'challenger_win',
  pointsChallenger: 25,
  pointsOpponent: -25,
  challengerName: 'me',
  opponentName: 'rival',
  challengerTacticName: 'My Fighter',
  opponentTacticName: 'Their Fighter',
  durationFrames: 10800,
  createdAt: '2026-09-20T00:00:00.000Z',
  ...overrides,
});

describe('matchPerspective', () => {
  it('should flip nothing when I am the winning challenger', () => {
    const p = matchPerspective(makeMatch(), 'me');

    expect(p.amChallenger).toBe(true);
    expect(p.myScore).toBe(2);
    expect(p.theirScore).toBe(1);
    expect(p.myPoints).toBe(25);
    expect(p.outcome).toBe('win');
    expect(p.opponentLabel).toBe('rival');
    expect(p.myTacticLabel).toBe('My Fighter');
  });

  it('should flip scores and points when I am the losing opponent', () => {
    // Same row, seen by the offline opponent who lost 1 — 2
    const p = matchPerspective(makeMatch(), 'rival');

    expect(p.amChallenger).toBe(false);
    expect(p.myScore).toBe(1);
    expect(p.theirScore).toBe(2);
    expect(p.myPoints).toBe(-25);
    expect(p.outcome).toBe('loss');
    expect(p.opponentLabel).toBe('me');
    expect(p.myTacticLabel).toBe('Their Fighter');
  });

  it('should see a draw from both sides', () => {
    const match = makeMatch({
      scoreChallenger: 1,
      scoreOpponent: 1,
      result: 'draw',
      pointsChallenger: -7,
      pointsOpponent: 7,
    });

    const asChallenger = matchPerspective(match, 'me');
    expect(asChallenger.outcome).toBe('draw');
    expect(asChallenger.myScore).toBe(1);
    expect(asChallenger.myPoints).toBe(-7);

    const asOpponent = matchPerspective(match, 'rival');
    expect(asOpponent.outcome).toBe('draw');
    expect(asOpponent.myScore).toBe(1);
    expect(asOpponent.myPoints).toBe(7);
  });

  it('should put me on the opponent side when the challenger user was deleted', () => {
    // challengerName: null — the starter account is gone, I necessarily sat
    // on the other side
    const p = matchPerspective(makeMatch({ challengerName: null }), 'rival');

    expect(p.amChallenger).toBe(false);
    expect(p.myScore).toBe(1);
    expect(p.theirScore).toBe(2);
    expect(p.outcome).toBe('loss');
    expect(p.opponentLabel).toBeNull();
    expect(p.myTacticLabel).toBe('Their Fighter');
  });

  it('should expose the deleted opponent as a null label', () => {
    const p = matchPerspective(makeMatch({ opponentName: null }), 'me');

    expect(p.amChallenger).toBe(true);
    expect(p.opponentLabel).toBeNull();
    expect(p.outcome).toBe('win');
  });

  it('should treat null elo as no points (practice rows carry none)', () => {
    const p = matchPerspective(
      makeMatch({ pointsChallenger: null, pointsOpponent: null }),
      'me'
    );

    expect(p.myPoints).toBeNull();
  });

  it('should hold the sign math on upsets (negative challenger delta)', () => {
    const p = matchPerspective(
      makeMatch({
        result: 'opponent_win',
        pointsChallenger: -38,
        pointsOpponent: 38,
      }),
      'me'
    );

    expect(p.outcome).toBe('loss');
    expect(p.myPoints).toBe(-38);
  });

  it('should not match a similar-but-different username', () => {
    const p = matchPerspective(makeMatch(), 'mex');

    expect(p.amChallenger).toBe(false);
    expect(p.outcome).toBe('loss');
  });
});
