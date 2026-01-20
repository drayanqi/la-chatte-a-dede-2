/**
 * AI Workspace E2E Tests
 *
 * Tests the AI development workspace:
 * - File management (create, list, rename, duplicate, delete)
 * - Monaco editor integration
 * - Save functionality
 * - Game API autocomplete
 * - Syntax error detection
 *
 * @see Epic 2: AI Development Workspace
 * @see FR4-FR14 in PRD
 */
import { test, expect } from '../support/fixtures';

test.describe('AI Workspace', () => {
  test.describe('File Management', () => {
    test('should create new AI file with default name', async ({
      page,
      userFactory,
    }) => {
      // GIVEN: Authenticated user in workspace
      const user = await userFactory.createAuthenticated();
      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');

      // WHEN: User clicks "New AI File"
      await page.click('[data-testid="new-file-button"]');

      // THEN: New file appears in list with default name
      await expect(page.locator('[data-testid="file-list-item"]').last()).toContainText('NewAI.js');
    });

    test('should display created file in file list', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an existing AI file
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'TestAI.js',
        code: 'me.moveTo(ball.position);',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');

      // THEN: File appears in the file list
      await expect(page.locator('[data-testid="file-list"]')).toContainText('TestAI.js');
    });

    test('should open file in editor when clicked', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an AI file
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'ClickTest.js',
        code: 'console.log("test");',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');

      // WHEN: User clicks on the file
      await page.click('[data-testid="file-list-item"]:has-text("ClickTest.js")');

      // THEN: File content appears in Monaco editor
      await expect(page.locator('.monaco-editor')).toBeVisible();
      // Monaco editor should contain the file content
      const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
      expect(editorContent).toContain('console.log');
    });

    test('should show confirmation dialog before delete', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an AI file
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'DeleteMe.js',
        code: 'me.kick();',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');

      // WHEN: User clicks delete on the file
      await page.click('[data-testid="file-list-item"]:has-text("DeleteMe.js") [data-testid="delete-button"]');

      // THEN: Confirmation dialog appears
      await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText('Delete');
    });

    test('should remove file from list after confirmed delete', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an AI file and delete dialog open
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'ToDelete.js',
        code: 'me.kick();',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');
      await page.click('[data-testid="file-list-item"]:has-text("ToDelete.js") [data-testid="delete-button"]');

      // WHEN: User confirms deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // THEN: File is removed from list
      await expect(page.locator('[data-testid="file-list"]')).not.toContainText('ToDelete.js');
    });
  });

  test.describe('Monaco Editor', () => {
    test('should load Monaco editor with file content', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an AI file
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'EditorTest.js',
        code: 'const x = 42;',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');

      // WHEN: User opens the file
      await page.click('[data-testid="file-list-item"]:has-text("EditorTest.js")');

      // THEN: Monaco editor is visible and loaded
      await expect(page.locator('.monaco-editor')).toBeVisible();
      await expect(page.locator('.monaco-editor .view-lines')).toContainText('const');
    });

    test('should save file with Cmd+S', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User editing an AI file
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'SaveTest.js',
        code: 'original code',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');
      await page.click('[data-testid="file-list-item"]:has-text("SaveTest.js")');

      // Wait for editor to load
      await page.waitForSelector('.monaco-editor');

      // WHEN: User types and saves with Cmd+S
      await page.keyboard.type('// new comment\n');
      await page.keyboard.press('Meta+s');

      // THEN: Save indicator appears
      await expect(page.locator('[data-testid="save-indicator"]')).toContainText(/saved/i);
    });
  });

  test.describe('Game API Autocomplete', () => {
    test('should show autocomplete suggestions for "me."', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an AI file open in editor
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'AutocompleteTest.js',
        code: '',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');
      await page.click('[data-testid="file-list-item"]:has-text("AutocompleteTest.js")');
      await page.waitForSelector('.monaco-editor');

      // WHEN: User types "me."
      await page.keyboard.type('me.');

      // Wait for autocomplete popup
      await page.waitForSelector('.monaco-list-row', { timeout: 5000 });

      // THEN: Autocomplete shows player methods
      const suggestions = await page.locator('.monaco-list-row').allTextContents();
      expect(suggestions.join('')).toMatch(/moveTo|kick|isClosestToBall/);
    });
  });

  test.describe('Syntax Error Detection', () => {
    test('should highlight syntax errors in red', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: User with an AI file open
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.create({
        token: user.token!,
        name: 'ErrorTest.js',
        code: '',
      });

      await page.context().addCookies([
        { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');
      await page.click('[data-testid="file-list-item"]:has-text("ErrorTest.js")');
      await page.waitForSelector('.monaco-editor');

      // WHEN: User types invalid JavaScript
      await page.keyboard.type('function broken( {');

      // THEN: Error decoration appears (red squiggle or marker)
      // Monaco uses .squiggly-error or .monaco-editor-decorations-layer
      await expect(page.locator('.squiggly-error, [class*="error"]')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Security - RBAC', () => {
    test('should not allow access to another user scripts', async ({
      page,
      userFactory,
      scriptFactory,
    }) => {
      // GIVEN: Two users, userA owns a script
      const userA = await userFactory.createAuthenticated();
      const userB = await userFactory.createAuthenticated();

      const scriptA = await scriptFactory.create({
        token: userA.token!,
        name: 'PrivateScript.js',
        code: 'secret code',
      });

      // WHEN: UserB tries to access UserA's workspace
      await page.context().addCookies([
        { name: 'auth_token', value: userB.token!, domain: 'localhost', path: '/' },
      ]);
      await page.goto('/workspace');

      // THEN: UserB should NOT see UserA's script
      await expect(page.locator('[data-testid="file-list"]')).not.toContainText('PrivateScript.js');
    });
  });
});
