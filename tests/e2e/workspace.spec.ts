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

// test.describe('AI Workspace', () => {
  // test.describe('Story 2.1 - Create and List AI Files', () => {
  //   test('should create new AI file with default name @P0', async ({
  //     page,
  //     userFactory,
  //   }) => {
  //     // GIVEN: Authenticated user in workspace
  //     const user = await userFactory.createAuthenticated();
  //     // Set token in localStorage (how our app stores auth)
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //
  //     // Wait for scripts to load
  //     await page.waitForSelector('[data-testid="scripts-list"]');
  //
  //     // WHEN: User clicks "+" button to create new file
  //     await page.click('[data-testid="create-script-button"]');
  //
  //     // Wait for creation to complete
  //     await page.waitForFunction(() => {
  //       const btn = document.querySelector('[data-testid="create-script-button"]');
  //       return btn && !btn.hasAttribute('disabled');
  //     });
  //
  //     // THEN: New file appears in list with default name
  //     await expect(page.locator('[data-testid="scripts-list"]')).toContainText('NewAI.js');
  //   });
  //
  //   test('should open created file in editor automatically @P0', async ({
  //     page,
  //     userFactory,
  //   }) => {
  //     // GIVEN: Authenticated user in workspace
  //     const user = await userFactory.createAuthenticated();
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //     await page.waitForSelector('[data-testid="scripts-list"]');
  //
  //     // WHEN: User creates a new file
  //     await page.click('[data-testid="create-script-button"]');
  //
  //     // Wait for creation
  //     await page.waitForFunction(() => {
  //       const btn = document.querySelector('[data-testid="create-script-button"]');
  //       return btn && !btn.hasAttribute('disabled');
  //     });
  //
  //     // THEN: Created file should be active/selected (highlighted in list)
  //     // The active script should have the scriptItemActive style
  //     const activeScript = page.locator('[data-testid^="script-item-"]').filter({
  //       has: page.locator('[data-testid^="script-name-"]:text("NewAI.js")'),
  //     });
  //     await expect(activeScript).toBeVisible();
  //   });
  //
  //   test('should display file in list after creation @P0', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // GIVEN: User with an existing AI file
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'TestAI.js',
  //       code: 'me.moveTo(ball.position);',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //
  //     // THEN: File appears in the scripts list
  //     await expect(page.locator('[data-testid="scripts-list"]')).toContainText('TestAI.js');
  //   });
  //
  //   test('should open file in editor when clicked @P0', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // GIVEN: User with an AI file
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'ClickTest.js',
  //       code: 'console.log("test");',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //
  //     // Wait for scripts to load
  //     await page.waitForSelector('[data-testid="scripts-list"]');
  //
  //     // WHEN: User clicks on the file
  //     await page.click(`[data-testid="script-item-${script.id}"]`);
  //
  //     // THEN: File content appears in the editor placeholder (Monaco not yet integrated)
  //     // For now we just verify the script name appears in the editor header
  //     await expect(page.locator('text=ClickTest.js')).toBeVisible();
  //   });
  //
  //   test('should maintain sort order by last modified @P1', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // GIVEN: User with multiple AI files
  //     const user = await userFactory.createAuthenticated();
  //
  //     // Create files with slight delay so updated_at differs
  //     const script1 = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'OlderAI.js',
  //       code: 'older code',
  //     });
  //
  //     // Wait a moment
  //     await new Promise((r) => setTimeout(r, 100));
  //
  //     const script2 = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'NewerAI.js',
  //       code: 'newer code',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //
  //     // Wait for scripts to load
  //     await page.waitForSelector('[data-testid="scripts-list"]');
  //
  //     // THEN: Newer file should appear first (sorted by last modified DESC)
  //     const scriptNames = await page.locator('[data-testid^="script-name-"]').allTextContents();
  //     expect(scriptNames[0]).toBe('NewerAI.js');
  //     expect(scriptNames[1]).toBe('OlderAI.js');
  //   });
  // });
  //
  // test.describe('File Management - Future Stories', () => {
  //   test.skip('should show confirmation dialog before delete', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // Story 2.8: Delete AI File - not yet implemented
  //     // GIVEN: User with an AI file
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'DeleteMe.js',
  //       code: 'me.kick();',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //
  //     // WHEN: User clicks delete on the file
  //     await page.click('[data-testid="file-list-item"]:has-text("DeleteMe.js") [data-testid="delete-button"]');
  //
  //     // THEN: Confirmation dialog appears
  //     await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
  //     await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText('Delete');
  //   });
  //
  //   test.skip('should remove file from list after confirmed delete', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // Story 2.8: Delete AI File - not yet implemented
  //     // GIVEN: User with an AI file and delete dialog open
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'ToDelete.js',
  //       code: 'me.kick();',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //     await page.click('[data-testid="file-list-item"]:has-text("ToDelete.js") [data-testid="delete-button"]');
  //
  //     // WHEN: User confirms deletion
  //     await page.click('[data-testid="confirm-delete-button"]');
  //
  //     // THEN: File is removed from list
  //     await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('ToDelete.js');
  //   });
  //
  //   test('should show confirmation dialog before delete', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // GIVEN: User with an AI file
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'DeleteMe.js',
  //       code: 'me.kick();',
  //     });
  //
  //     await page.context().addCookies([
  //       { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
  //     ]);
  //     await page.goto('/workspace');
  //
  //     // WHEN: User clicks delete on the file
  //     await page.click('[data-testid="file-list-item"]:has-text("DeleteMe.js") [data-testid="delete-button"]');
  //
  //     // THEN: Confirmation dialog appears
  //     await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
  //     await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText('Delete');
  //   });
  //
  //   test('should remove file from list after confirmed delete', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // GIVEN: User with an AI file and delete dialog open
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'ToDelete.js',
  //       code: 'me.kick();',
  //     });
  //
  //     await page.context().addCookies([
  //       { name: 'auth_token', value: user.token!, domain: 'localhost', path: '/' },
  //     ]);
  //     await page.goto('/workspace');
  //     await page.click('[data-testid="file-list-item"]:has-text("ToDelete.js") [data-testid="delete-button"]');
  //
  //     // WHEN: User confirms deletion
  //     await page.click('[data-testid="confirm-delete-button"]');
  //
  //     // THEN: File is removed from list
  //     await expect(page.locator('[data-testid="file-list"]')).not.toContainText('ToDelete.js');
  //   });
  // });
  //
  // test.describe('Monaco Editor - Story 2.2', () => {
  //   test.skip('should load Monaco editor with file content', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // Story 2.2: Monaco Editor Integration - not yet implemented
  //     // GIVEN: User with an AI file
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'EditorTest.js',
  //       code: 'const x = 42;',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //
  //     // WHEN: User opens the file
  //     await page.click(`[data-testid="script-item-${script.id}"]`);
  //
  //     // THEN: Monaco editor is visible and loaded
  //     await expect(page.locator('.monaco-editor')).toBeVisible();
  //     await expect(page.locator('.monaco-editor .view-lines')).toContainText('const');
  //   });
  //
  //   test.skip('should save file with Cmd+S', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // Story 2.3: Save AI File Changes - not yet implemented
  //     // GIVEN: User editing an AI file
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'SaveTest.js',
  //       code: 'original code',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //     await page.click(`[data-testid="script-item-${script.id}"]`);
  //
  //     // Wait for editor to load
  //     await page.waitForSelector('.monaco-editor');
  //
  //     // WHEN: User types and saves with Cmd+S
  //     await page.keyboard.type('// new comment\n');
  //     await page.keyboard.press('Meta+s');
  //
  //     // THEN: Save indicator appears
  //     await expect(page.locator('[data-testid="save-indicator"]')).toContainText(/saved/i);
  //   });
  // });
  //
  // test.describe('Game API Autocomplete - Story 2.4', () => {
  //   test.skip('should show autocomplete suggestions for "me."', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // Story 2.4: Game API Autocomplete - not yet implemented
  //     // GIVEN: User with an AI file open in editor
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'AutocompleteTest.js',
  //       code: '',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //     await page.click(`[data-testid="script-item-${script.id}"]`);
  //     await page.waitForSelector('.monaco-editor');
  //
  //     // WHEN: User types "me."
  //     await page.keyboard.type('me.');
  //
  //     // Wait for autocomplete popup
  //     await page.waitForSelector('.monaco-list-row', { timeout: 5000 });
  //
  //     // THEN: Autocomplete shows player methods
  //     const suggestions = await page.locator('.monaco-list-row').allTextContents();
  //     expect(suggestions.join('')).toMatch(/moveTo|kick|isClosestToBall/);
  //   });
  // });
  //
  // test.describe('Syntax Error Detection - Story 2.5', () => {
  //   test.skip('should highlight syntax errors in red', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // Story 2.5: Code Error Detection - not yet implemented
  //     // GIVEN: User with an AI file open
  //     const user = await userFactory.createAuthenticated();
  //     const script = await scriptFactory.create({
  //       token: user.token!,
  //       name: 'ErrorTest.js',
  //       code: '',
  //     });
  //
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, user.token);
  //     await page.goto('/workspace');
  //     await page.click(`[data-testid="script-item-${script.id}"]`);
  //     await page.waitForSelector('.monaco-editor');
  //
  //     // WHEN: User types invalid JavaScript
  //     await page.keyboard.type('function broken( {');
  //
  //     // THEN: Error decoration appears (red squiggle or marker)
  //     // Monaco uses .squiggly-error or .monaco-editor-decorations-layer
  //     await expect(page.locator('.squiggly-error, [class*="error"]')).toBeVisible({ timeout: 3000 });
  //   });
  // });
  //
  // test.describe('Security - RBAC', () => {
  //   test('should not allow access to another user scripts @P0', async ({
  //     page,
  //     userFactory,
  //     scriptFactory,
  //   }) => {
  //     // GIVEN: Two users, userA owns a script
  //     const userA = await userFactory.createAuthenticated();
  //     const userB = await userFactory.createAuthenticated();
  //
  //     const scriptA = await scriptFactory.create({
  //       token: userA.token!,
  //       name: 'PrivateScript.js',
  //       code: 'secret code',
  //     });
  //
  //     // WHEN: UserB tries to access the workspace
  //     await page.goto('/');
  //     await page.evaluate((token) => {
  //       localStorage.setItem('auth_token', token);
  //     }, userB.token);
  //     await page.goto('/workspace');
  //
  //     // Wait for scripts list to load
  //     await page.waitForSelector('[data-testid="scripts-list"]');
  //
  //     // THEN: UserB should NOT see UserA's script
  //     await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('PrivateScript.js');
  //   });
  // });
// });
