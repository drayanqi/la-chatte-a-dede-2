/**
 * Match Factory - Creates test matches with auto-cleanup
 *
 * Usage:
 *   const match = await matchFactory.createPractice({ token, tacticId });
 *   // ... test code ...
 *
 * Matches are created through the real POST /api/matches endpoint (story
 * 3.5): the request is synchronous — the returned match is already completed
 * (or failed). There is no DELETE /matches endpoint, so matches are not
 * cleaned up.
 */
import { APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

export type Match = {
  id: string;
  mode: 'practice' | 'ranked';
  status: 'pending' | 'completed' | 'failed';
  scoreChallenger: number;
  scoreOpponent: number;
  result: 'challenger_win' | 'opponent_win' | 'draw' | null;
  durationFrames: number;
  createdAt: string;
};

export type Tactic = {
  id: string;
  name: string;
  isSystem: boolean;
  players: TacticPlayer[];
};

export type TacticPlayer = {
  playerSlot: 1 | 2 | 3 | 4 | 5;
  positionX: number;
  positionY: number;
  scriptId: string | null;
};

export class MatchFactory {
  private createdTactics: { id: string; token: string }[] = [];
  private apiContext: APIRequestContext;

  constructor(apiContext: APIRequestContext) {
    this.apiContext = apiContext;
  }

  /**
   * Create a tactic configuration
   */
  async createTactic(params: {
    token: string;
    scriptIds: string[];
    name?: string;
  }): Promise<Tactic> {
    const { token, scriptIds, name } = params;

    // Kickoff-legal 1-2-2 fixture formation (GK, 2 DEF, 2 ATK); positions are
    // kickoff positions in home's left half (x 0-50, home attacks toward x=100).
    // Deliberately distinct from the store's DEFAULT_FORMATION — this is test data.
    const payload = {
      name: name || faker.word.adjective() + 'Formation',
      players: [
        { player_slot: 1, position_x: 8, position_y: 45, script_id: scriptIds[0] ?? null },    // GK
        { player_slot: 2, position_x: 25, position_y: 30, script_id: scriptIds[1] ?? null },   // DEF1
        { player_slot: 3, position_x: 25, position_y: 15, script_id: scriptIds[2] ?? null },   // DEF2
        { player_slot: 4, position_x: 30, position_y: 30, script_id: scriptIds[3] ?? null },   // ATK1
        { player_slot: 5, position_x: 30, position_y: 15, script_id: scriptIds[4] ?? null },   // ATK2
      ],
    };

    const response = await this.apiContext.post('tactics', {
      data: payload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create tactic: ${response.status()}`);
    }

    const created = (await response.json()) as Tactic;
    this.createdTactics.push({ id: created.id, token });

    return created;
  }

  /**
   * Create a practice match against the Easy Bot. The endpoint is
   * synchronous (story 3.5 AC #3): the response already carries the final
   * scores and status.
   */
  async createPractice(params: {
    token: string;
    tacticId: string;
  }): Promise<Match> {
    const { token, tacticId } = params;

    const response = await this.apiContext.post('matches', {
      data: {
        mode: 'practice',
        tactic_id: tacticId,
        bot: 'easy',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 60000, // full simulation can take a few seconds
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Failed to create match: ${response.status()} - ${body}`);
    }

    return (await response.json()) as Match;
  }

  /**
   * Fetch a match until it is completed. Story 3.5 matches are synchronous —
   * the first GET already returns the final state; the loop only guards
   * against future async flows.
   */
  async waitForCompletion(matchId: string, token: string, timeoutMs = 30000): Promise<Match> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await this.apiContext.get(`matches/${matchId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok()) {
        throw new Error(`Failed to fetch match: ${response.status()}`);
      }

      const match = (await response.json()) as Match;

      if (match.status === 'completed') {
        return match;
      }

      // Wait 500ms before polling again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Match ${matchId} did not complete within ${timeoutMs}ms`);
  }

  /**
   * Cleanup created tactics (matches have no delete endpoint)
   */
  async cleanup(): Promise<void> {
    // Cleanup tactics (authenticated: the routes are owner-scoped)
    for (const { id, token } of this.createdTactics) {
      try {
        const response = await this.apiContext.delete(`tactics/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok()) {
          console.warn(`Failed to cleanup tactic ${id}: ${response.status()}`);
        }
      } catch (error) {
        console.warn(`Failed to cleanup tactic ${id}:`, error);
      }
    }
    this.createdTactics = [];
  }
}
