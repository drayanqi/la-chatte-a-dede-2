/**
 * Script Factory - Creates test AI scripts with auto-cleanup
 *
 * Usage:
 *   const script = await scriptFactory.create({ name: 'AttackerAI' });
 *   // ... test code ...
 *   // Cleanup happens automatically after test
 */
import { APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

export type Script = {
  id: string;
  userId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

// Default starter AI code (canonical script-ia-api.md v2.0 API)
const STARTER_AI_CODE = `function update(game) {
  const { me, ball } = game;
  const goalX = me.team === 'home' ? 100 : 0;

  if (me.hasBall) {
    me.dribble(goalX, 25);
  } else {
    me.moveToward(ball.position.x, ball.position.y);
  }
}`;

// Goalkeeper AI code
const GOALKEEPER_AI_CODE = `function update(game) {
  const { me, ball } = game;
  const goalX = me.team === 'home' ? 5 : 95;

  if (me.hasBall) {
    if (game.teammates.length > 0) {
      me.shoot(game.teammates[0].position.x, game.teammates[0].position.y, 0.8);
    } else {
      me.stop();
    }
  } else {
    const targetY = Math.max(15, Math.min(35, ball.position.y));
    me.moveToward(goalX, targetY);
  }
}`;

export class ScriptFactory {
  private createdScriptIds: string[] = [];
  private apiContext: APIRequestContext;

  constructor(apiContext: APIRequestContext) {
    this.apiContext = apiContext;
  }

  /**
   * Create a new AI script
   */
  async create(overrides: Partial<Script> & { token?: string } = {}): Promise<Script> {
    const { token, ...scriptData } = overrides;

    const data = {
      name: faker.word.adjective() + 'AI',
      code: STARTER_AI_CODE,
      ...scriptData,
    };

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await this.apiContext.post('scripts', {
      data,
      headers,
    });

    if (!response.ok()) {
      throw new Error(`Failed to create script: ${response.status()}`);
    }

    const created = await response.json();
    this.createdScriptIds.push(created.id);

    return created;
  }

  /**
   * Create a starter AI script
   */
  async createStarter(token: string, name = 'StarterAI'): Promise<Script> {
    return this.create({
      name,
      code: STARTER_AI_CODE,
      token,
    });
  }

  /**
   * Create a goalkeeper AI script
   */
  async createGoalkeeper(token: string, name = 'GoalkeeperAI'): Promise<Script> {
    return this.create({
      name,
      code: GOALKEEPER_AI_CODE,
      token,
    });
  }

  /**
   * Cleanup all created scripts
   */
  async cleanup(): Promise<void> {
    for (const scriptId of this.createdScriptIds) {
      try {
        await this.apiContext.delete(`scripts/${scriptId}`);
      } catch (error) {
        console.warn(`Failed to cleanup script ${scriptId}:`, error);
      }
    }
    this.createdScriptIds = [];
  }
}
