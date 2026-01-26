/**
 * User Factory - Creates test users with auto-cleanup
 *
 * Usage:
 *   const user = await userFactory.create({ email: 'test@example.com' });
 *   // ... test code ...
 *   // Cleanup happens automatically after test
 */
import { APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

export type User = {
  id: string;
  email: string;
  name: string;
  password: string;
  token?: string;
  rating?: number;
};

export class UserFactory {
  private createdUserIds: string[] = [];
  private apiContext: APIRequestContext;

  constructor(apiContext: APIRequestContext) {
    this.apiContext = apiContext;
  }

  /**
   * Create a new test user
   */
  async create(overrides: Partial<User> = {}): Promise<User> {
    const password = overrides.password || faker.internet.password({ length: 12, memorable: true });
    const userData = {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      password,
      password_confirmation: password,
      ...overrides,
    };

    const response = await this.apiContext.post('register', {
      data: userData,
    });

    if (!response.ok()) {
      const errorBody = await response.text();
      throw new Error(`Failed to create user: ${response.status()} - ${errorBody}`);
    }

    const created = await response.json();
    this.createdUserIds.push(created.user.id);

    return {
      ...userData,
      id: created.user.id,
      token: created.token,
      rating: created.user.points || 0,
    };
  }

  /**
   * Create a user and return auth token
   */
  async createAuthenticated(overrides: Partial<User> = {}): Promise<User> {
    const user = await this.create(overrides);

    // Login to get fresh token
    const loginResponse = await this.apiContext.post('login', {
      data: {
        email: user.email,
        password: user.password,
      },
    });

    if (!loginResponse.ok()) {
      throw new Error(`Failed to login user: ${loginResponse.status()}`);
    }

    const loginData = await loginResponse.json();
    return {
      ...user,
      token: loginData.token,
    };
  }

  /**
   * Cleanup all created users
   */
  async cleanup(): Promise<void> {
    for (const userId of this.createdUserIds) {
      try {
        await this.apiContext.delete(`users/${userId}`);
      } catch (error) {
        console.warn(`Failed to cleanup user ${userId}:`, error);
      }
    }
    this.createdUserIds = [];
  }
}
