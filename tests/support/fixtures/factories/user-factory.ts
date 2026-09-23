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
  private createdUsers: { id: string; token?: string }[] = [];
  private apiContext: APIRequestContext;

  constructor(apiContext: APIRequestContext) {
    this.apiContext = apiContext;
  }

  /**
   * Create a new test user
   */
  async create(overrides: Partial<User> = {}): Promise<User> {
    const password = overrides.password || faker.internet.password({ length: 12, memorable: true });
    // Unique suffix: fixed names in overrides must survive worker-crash
    // reruns (orphaned users from an aborted attempt would 422 otherwise),
    // and faker's finite name pool can collide within a single test.
    const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    // Only `name` keeps the suffix (rerun safety); every other override
    // (notably a fixed email) wins over the generated defaults.
    const { name: nameOverride, ...rest } = overrides;
    const userData = {
      email: faker.internet.email(),
      name: `${nameOverride ?? faker.person.fullName()}-${uniqueSuffix}`,
      password,
      password_confirmation: password,
      ...rest,
    };

    const response = await this.apiContext.post('register', {
      data: userData,
    });

    if (!response.ok()) {
      const errorBody = await response.text();
      throw new Error(`Failed to create user: ${response.status()} - ${errorBody}`);
    }

    const created = await response.json();
    this.createdUsers.push({ id: created.user.id, token: created.token });

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
   * Cleanup all created users. DELETE /users/{id} sits behind auth:sanctum
   * (and in non-local envs only the owner may delete), so each delete
   * carries the user's own registration token. A silent 401 here used to
   * orphan every created user and poison fixed-name tests on reruns.
   */
  async cleanup(): Promise<void> {
    for (const { id, token } of this.createdUsers) {
      try {
        await this.apiContext.delete(`users/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (error) {
        console.warn(`Failed to cleanup user ${id}:`, error);
      }
    }
    this.createdUsers = [];
  }
}
