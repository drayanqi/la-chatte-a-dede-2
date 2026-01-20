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

// Default starter AI code
const STARTER_AI_CODE = `// This runs every tick for your player
if (me.isClosestToBall()) {
  me.moveTo(ball.position);
  if (me.distanceTo(ball.position) < 10) {
    me.kick(goal.enemy);
  }
} else {
  me.moveTo(goal.own);
}`;

// Goalkeeper AI code
const GOALKEEPER_AI_CODE = `// Goalkeeper stays near goal
const goalCenter = goal.own;
const ballX = ball.position.x;

if (ballX < 200 && me.isClosestToBall()) {
  me.moveTo(ball.position);
  if (me.distanceTo(ball.position) < 10) {
    me.kick({ x: 500, y: 300 }); // Clear to midfield
  }
} else {
  me.moveTo({ x: goalCenter.x + 30, y: ball.position.y });
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

    const response = await this.apiContext.post('/scripts', {
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
        await this.apiContext.delete(`/scripts/${scriptId}`);
      } catch (error) {
        console.warn(`Failed to cleanup script ${scriptId}:`, error);
      }
    }
    this.createdScriptIds = [];
  }
}
