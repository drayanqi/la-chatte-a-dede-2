/**
 * Match Perspective - my-side view of a match row (story 4.4)
 *
 * A ranked match can sit in MY history on either side: I am the challenger
 * when I started it, the opponent when someone challenged me. The result
 * banner (RankedView) is always challenger-perspective; the history rows
 * are not. Pure functions, no store, no React (timeFormat.ts precedent).
 * PROPRIÉTAIRE: Dev Team
 */

import type { MatchResult } from '@/types';

export type MatchPerspectiveOutcome = 'win' | 'loss' | 'draw';

export interface MatchPerspective {
  /** I started the match (false when the challenger user was deleted) */
  amChallenger: boolean;
  /** Final score, my side first */
  myScore: number;
  theirScore: number;
  /** The signed elo delta MY tactic pocketed (null while pending/failed) */
  myPoints: number | null;
  /** The result from where I stand */
  outcome: MatchPerspectiveOutcome;
  /** The user on the other side (null when their account was deleted) */
  opponentLabel: string | null;
  /** The tactic I fielded (null when it was deleted since) */
  myTacticLabel: string | null;
}

/**
 * A match row seen from MY side. Usernames are DB-unique, so comparing
 * against `challengerName` decides the side; a null challengerName (deleted
 * user) means I am necessarily the opponent.
 */
export function matchPerspective(
  match: MatchResult,
  myUsername: string | null | undefined
): MatchPerspective {
  const amChallenger = match.challengerName !== null && match.challengerName === myUsername;

  const myScore = amChallenger ? match.scoreChallenger : match.scoreOpponent;
  const theirScore = amChallenger ? match.scoreOpponent : match.scoreChallenger;
  const myPoints = (amChallenger ? match.pointsChallenger : match.pointsOpponent) ?? null;

  const outcome: MatchPerspectiveOutcome =
    match.result === 'draw' ? 'draw' : (match.result === 'challenger_win') === amChallenger ? 'win' : 'loss';

  const opponentLabel = (amChallenger ? match.opponentName : match.challengerName) ?? null;
  const myTacticLabel =
    (amChallenger ? match.challengerTacticName : match.opponentTacticName) ?? null;

  return { amChallenger, myScore, theirScore, myPoints, outcome, opponentLabel, myTacticLabel };
}
