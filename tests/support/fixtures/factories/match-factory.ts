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
  userId: string;
  name: string;
  players: TacticPlayer[];
};

export type TacticPlayer = {
  slot: number;
  scriptId: string;
  x: number;
  y: number;
};

export class MatchFactory {
  private createdMatchIds: string[] = [];
  private createdTacticIds: string[] = [];
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

    // Default formation: 1-2-2 (GK, 2 DEF, 2 ATK)
    const players: TacticPlayer[] = [
      { slot: 1, scriptId: scriptIds[0] || scriptIds[0], x: 50, y: 300 },   // GK
      { slot: 2, scriptId: scriptIds[1] || scriptIds[0], x: 150, y: 200 },  // DEF1
      { slot: 3, scriptId: scriptIds[2] || scriptIds[0], x: 150, y: 400 },  // DEF2
      { slot: 4, scriptId: scriptIds[3] || scriptIds[0], x: 350, y: 200 },  // ATK1
      { slot: 5, scriptId: scriptIds[4] || scriptIds[0], x: 350, y: 400 },  // ATK2
    ];

    const response = await this.apiContext.post('/tactics', {
      data: {
        name: name || faker.word.adjective() + 'Formation',
        players,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to create tactic: ${response.status()}`);
    }

    const created = await response.json();
    this.createdTacticIds.push(created.id);

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

    const response = await this.apiContext.post('/matches', {
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
      const response = await this.apiContext.get(`/matches/${matchId}`, {
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
        await this.apiContext.delete(`/matches/${matchId}`);
      } catch (error) {
        console.warn(`Failed to cleanup match ${matchId}:`, error);
      }
    }
    this.createdMatchIds = [];

    // Cleanup tactics
    for (const tacticId of this.createdTacticIds) {
      try {
        await this.apiContext.delete(`/tactics/${tacticId}`);
      } catch (error) {
        console.warn(`Failed to cleanup tactic ${tacticId}:`, error);
      }
    }
    this.createdTacticIds = [];
  }
}
