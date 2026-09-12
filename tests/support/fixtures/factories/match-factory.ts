/**
 * Match Factory - Creates test matches with auto-cleanup
 *
 * Usage:
 *   const match = await matchFactory.createPractice({ userId, tacticId });
 *   // ... test code ...
 *   // Cleanup happens automatically after test
 */
import { APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

export type Match = {
  id: string;
  type: 'practice' | 'ranked';
  status: 'pending' | 'simulating' | 'completed';
  challengerId: string;
  opponentId?: string;
  scoreChallenCger: number;
  scoreOpponent: number;
  seed: number;
  createdAt: string;
  completedAt?: string;
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
  private createdMatchIds: string[] = [];
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

    // Default formation: 1-2-2 (GK, 2 DEF, 2 ATK); positions follow the
    // API bounds (x 0-100, y 0-50, home attacks toward x=100)
    const payload = {
      name: name || faker.word.adjective() + 'Formation',
      players: [
        { player_slot: 1, position_x: 8, position_y: 45, script_id: scriptIds[0] ?? null },    // GK
        { player_slot: 2, position_x: 25, position_y: 30, script_id: scriptIds[1] ?? null },   // DEF1
        { player_slot: 3, position_x: 25, position_y: 15, script_id: scriptIds[2] ?? null },   // DEF2
        { player_slot: 4, position_x: 70, position_y: 30, script_id: scriptIds[3] ?? null },   // ATK1
        { player_slot: 5, position_x: 70, position_y: 15, script_id: scriptIds[4] ?? null },   // ATK2
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
   * Create a practice match
   */
  async createPractice(params: {
    token: string;
    tacticId: string;
  }): Promise<Match> {
    const { token, tacticId } = params;

    const response = await this.apiContext.post('matches', {
      data: {
        type: 'practice',
        tacticId,
        seed: faker.number.int({ min: 1, max: 999999 }),
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create match: ${response.status()}`);
    }

    const created = await response.json();
    this.createdMatchIds.push(created.id);

    return created;
  }

  /**
   * Wait for match to complete simulation
   */
  async waitForCompletion(matchId: string, token: string, timeoutMs = 10000): Promise<Match> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const response = await this.apiContext.get(`matches/${matchId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const match = await response.json();

      if (match.status === 'completed') {
        return match;
      }

      // Wait 500ms before polling again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Match ${matchId} did not complete within ${timeoutMs}ms`);
  }

  /**
   * Cleanup all created matches and tactics
   */
  async cleanup(): Promise<void> {
    // Cleanup matches
    for (const matchId of this.createdMatchIds) {
      try {
        await this.apiContext.delete(`matches/${matchId}`);
      } catch (error) {
        console.warn(`Failed to cleanup match ${matchId}:`, error);
      }
    }
    this.createdMatchIds = [];

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
