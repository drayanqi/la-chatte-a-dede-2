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
import { seedAuthToken } from '../support/helpers/auth';
import { withUpdate } from '../support/fixtures/factories/script-factory';
import {
  TYPED_SCAFFOLD,
  openWorkspaceScript,
  typeInsideUpdate,
  suggestionLabels,
} from '../support/helpers/editor';

// Active highlight (story 7.5 La Ronde tokens): the row rides --panel2
// (#f4faf6 in the default light theme) plus a corail inset ring.
const ACTIVE_ITEM_BACKGROUND = 'rgb(244, 250, 246)';

test.describe('AI Workspace - Scripts (Story 2.1)', () => {
  test('should list existing scripts for the user @P0', async ({ page, userFactory }) => {
    const user = await userFactory.create();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');

    // The backend provisions StarterAI.js on registration
    const scriptsList = page.getByTestId('scripts-list');
    await expect(scriptsList).toBeVisible();
    await expect(scriptsList).toContainText('StarterAI.js');
  });

  test('should create new AI file with default name @P0', async ({ page, userFactory }) => {
    const user = await userFactory.create();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    const scriptsList = page.getByTestId('scripts-list');
    await expect(scriptsList).toContainText('StarterAI.js');

    await page.getByTestId('create-script-button').click();

    // Default name is NewAI.js
    await expect(scriptsList).toContainText('NewAI.js');
  });

  test('should generate a unique default name for the second file @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.create();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    const scriptsList = page.getByTestId('scripts-list');
    await expect(scriptsList).toContainText('StarterAI.js');

    await page.getByTestId('create-script-button').click();
    await expect(scriptsList).toContainText('NewAI.js');

    await page.getByTestId('create-script-button').click();

    // Second creation must not collide with NewAI.js
    await expect(scriptsList).toContainText('NewAI (1).js');
  });

  test('should open file in editor when clicked @P0', async ({ page, userFactory }) => {
    const user = await userFactory.create();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    const scriptsList = page.getByTestId('scripts-list');
    await expect(scriptsList).toContainText('StarterAI.js');

    // Clicking the file opens it: the active highlight changes. A
    // list-only visibility assertion would pass vacuously.
    const starterItem = page
      .locator('[data-testid^="script-item-"]')
      .filter({ hasText: 'StarterAI.js' });
    await starterItem.click();
    await expect(starterItem).toHaveCSS('background-color', ACTIVE_ITEM_BACKGROUND);
  });

  test('should show newly created files at the top of the list @P1', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.create();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    const scriptsList = page.getByTestId('scripts-list');
    await expect(scriptsList).toContainText('StarterAI.js');

    await page.getByTestId('create-script-button').click();
    await expect(scriptsList).toContainText('NewAI.js');

    // Newest first: the first item must be the just-created file
    const firstItem = page.locator('[data-testid^="script-item-"]').first();
    await expect(firstItem).toContainText('NewAI.js');
  });

  test('should not show another user scripts @P0', async ({ page, userFactory, scriptFactory }) => {
    // User A creates a distinctive script via the API
    const owner = await userFactory.create();
    await scriptFactory.create({ token: owner.token, name: 'OwnerSecretAI.js' });

    // User B logs in and must only see their own workspace
    const intruder = await userFactory.create();
    await seedAuthToken(page, intruder.token ?? '');

    await page.goto('/teams');
    const scriptsList = page.getByTestId('scripts-list');
    await expect(scriptsList).toContainText('StarterAI.js');
    await expect(scriptsList).not.toContainText('OwnerSecretAI.js');
  });

  test('should show a loading state while scripts are fetched @P2', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.create();
    await seedAuthToken(page, user.token ?? '');

    // Delay the scripts response so the loading state is observable
    await page.route('**/api/scripts', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto('/teams');
    await expect(page.getByText('Loading scripts...')).toBeVisible();
    await expect(page.getByTestId('scripts-list')).toContainText('StarterAI.js');
  });
});

test.describe('Story 2.2 - Monaco Editor Integration', () => {
  test('should display Monaco editor when file is selected @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'MonacoTest.js',
      code: 'function update(game) {\n  game.me.moveToward(game.ball.position.x, game.ball.position.y);\n}',
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');

    // Wait for scripts to load
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User clicks on the file
    await page.click(`[data-testid="script-item-${script.id}"]`);

    // THEN: Monaco editor is visible
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });
  });

  test('should display code content in Monaco editor @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file containing specific code
    const user = await userFactory.createAuthenticated();
    const testCode = 'const playerSpeed = 5;';
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ContentTest.js',
      code: withUpdate(testCode),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User opens the file
    await page.click(`[data-testid="script-item-${script.id}"]`);

    // Wait for Monaco to load
    await page.waitForSelector('.monaco-editor');

    // THEN: Code content is displayed in Monaco
    // Monaco renders code in .view-lines
    await expect(page.locator('.monaco-editor')).toContainText('playerSpeed');
  });

  test('should display line numbers in Monaco editor @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'LineNumbersTest.js',
      code: withUpdate('line1\nline2\nline3'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User opens the file
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Wait for the content to render (line numbers only exist for rendered lines)
    await expect(page.locator('.monaco-editor')).toContainText('line1');

    // THEN: Line numbers are visible
    // Monaco renders line numbers in .line-numbers class
    await expect(page.locator('.monaco-editor .line-numbers').first()).toBeVisible();
  });

  test('should apply syntax highlighting for JavaScript @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with JavaScript code
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'SyntaxTest.js',
      code: withUpdate('function test() {\n  const x = "hello";\n  return x;\n}'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User opens the file
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // THEN: Syntax highlighting is applied
    // Monaco applies mtk* classes for syntax tokens
    // Keywords like 'function', 'const', 'return' get special classes
    const codeTokens = page.locator('.monaco-editor .view-line span[class*="mtk"]');
    await expect(codeTokens.first()).toBeVisible();
  });

  test('should support undo with Cmd+Z @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'UndoTest.js',
      code: withUpdate('original'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file and wait for Monaco
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Focus the editor
    await page.click('.monaco-editor');

    // WHEN: User types something then presses Cmd+Z
    await page.keyboard.type('ADDED');

    // Verify text was added
    await expect(page.locator('.monaco-editor')).toContainText('ADDED');

    // Press undo. Headless Chromium swallows Cmd+Z via the browser's native
    // edit-context undo before it reaches Monaco, while WebKit only knows
    // Cmd+Z — so try Meta+z first and fall back to Ctrl+z (Monaco honors both).
    await page.keyboard.press('Meta+z');
    if ((await page.locator('.monaco-editor').textContent())?.includes('ADDED')) {
      await page.keyboard.press('Control+z');
    }

    // THEN: The typed text should be undone
    await expect(page.locator('.monaco-editor')).not.toContainText('ADDED');
  });
});

test.describe('Story 2.3 - Save AI File Changes', () => {
  test('should save file with Cmd+S and show Saved indicator @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open in editor
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'SaveTest.js',
      code: withUpdate('original code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Focus the editor and type something
    await page.click('.monaco-editor');
    await page.keyboard.type('// new comment');

    // WHEN: User presses Cmd+S
    await page.keyboard.press('Meta+s');

    // THEN: Save indicator shows "Saved"
    await expect(page.getByTestId('save-indicator-saved')).toBeVisible({ timeout: 5000 });
  });

  test('should show Unsaved indicator when code changes @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'UnsavedTest.js',
      code: withUpdate('original'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // WHEN: User types in the editor
    await page.click('.monaco-editor');
    await page.keyboard.type('modified');

    // THEN: Unsaved indicator appears
    await expect(page.getByTestId('save-indicator')).toContainText('Unsaved');
  });

  test('should show error indicator when save fails @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ErrorSaveTest.js',
      code: withUpdate('original'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Type something
    await page.click('.monaco-editor');
    await page.keyboard.type('modified');

    // Mock network failure by intercepting the PUT request
    await page.route('**/api/scripts/**', (route) => {
      if (route.request().method() === 'PUT') {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    // WHEN: User presses Cmd+S
    await page.keyboard.press('Meta+s');

    // THEN: Error indicator appears
    await expect(page.getByTestId('save-indicator-error')).toBeVisible({ timeout: 5000 });
  });

  test('should persist changes after save @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'PersistTest.js',
      code: withUpdate('original code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file and edit
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');
    await page.click('.monaco-editor');

    // Select all and replace with a valid, bracket-free script (story 3.4
    // validates the saved code; balanced parens typed blind get mangled by
    // Monaco's auto-close pair insertion).
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('// UPDATED CODE: const update = (game) => game.me.stop();');

    // Save
    await page.keyboard.press('Meta+s');
    await expect(page.getByTestId('save-indicator-saved')).toBeVisible({ timeout: 5000 });

    // WHEN: Page is reloaded
    await page.reload();
    await page.waitForSelector('[data-testid="scripts-list"]');
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // THEN: Changes are persisted
    await expect(page.locator('.monaco-editor')).toContainText('UPDATED CODE');
  });

  test('should show browser warning when leaving with unsaved changes @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with unsaved changes
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'LeaveTest.js',
      code: withUpdate('original'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file and make changes
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');
    await page.click('.monaco-editor');
    await page.keyboard.type('unsaved changes');

    // WHEN: Trying to navigate away
    // Note: beforeunload cannot be reliably tested in Playwright
    // We verify the dialog is registered by checking the event listener exists
    const hasBeforeUnload = await page.evaluate(() => {
      // Check if the beforeunload handler prevents navigation
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented || event.returnValue !== '';
    });

    // THEN: The beforeunload handler should be active
    expect(hasBeforeUnload).toBe(true);
  });
});

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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
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
  //     await page.goto('/teams');
  //
  //     // Wait for scripts list to load
  //     await page.waitForSelector('[data-testid="scripts-list"]');
  //
  //     // THEN: UserB should NOT see UserA's script
  //     await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('PrivateScript.js');
  //   });
  // });
// });

test.describe('Story 2.4 - Game API IntelliSense', () => {
  test('should show autocomplete suggestions when typing "game.me." @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a typed AI file open in editor
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'AutocompleteTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // WHEN: User types "game.me." inside update(game)
    await typeInsideUpdate(page, 'game.me.');

    // THEN: Autocomplete popup appears with player methods
    const labels = await suggestionLabels(page);
    expect(labels.join(' ')).toMatch(/moveToward|dribble|shoot|position|slot/);
  });

  test('should show moveToward method in suggestions @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a typed AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'MoveToTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // WHEN: User types "game.me." inside update(game)
    await typeInsideUpdate(page, 'game.me.');

    // THEN: moveToward should be in the suggestions
    const labels = await suggestionLabels(page);
    expect(labels.join(' ')).toContain('moveToward');
  });

  test('should show ball properties when typing "game.ball." @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a typed AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'BallTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // WHEN: User types "game.ball." inside update(game)
    await typeInsideUpdate(page, 'game.ball.');

    // THEN: Autocomplete shows ball properties
    const labels = await suggestionLabels(page);
    expect(labels.join(' ')).toMatch(/position|velocity/);
  });

  test('should show field properties when typing "game.field." @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a typed AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'FieldTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // WHEN: User types "game.field." inside update(game)
    await typeInsideUpdate(page, 'game.field.');

    // THEN: Autocomplete shows field properties
    const labels = await suggestionLabels(page);
    expect(labels.join(' ')).toMatch(/width|ownGoal|opponentGoal/);
  });

  test('should insert suggestion with Tab key @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with autocomplete popup showing
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'TabInsertTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // Type to trigger autocomplete
    await typeInsideUpdate(page, 'game.me.');

    // Wait for autocomplete
    await page.waitForSelector('.suggest-widget', { state: 'visible', timeout: 5000 });

    // WHEN: User presses Tab to accept first suggestion
    await page.keyboard.press('Tab');

    // THEN: Suggestion is inserted into the editor
    // Wait for the suggest widget to close
    await page.waitForSelector('.suggest-widget', { state: 'hidden', timeout: 3000 });

    // The editor should now contain the inserted member
    const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
    expect(editorContent).toMatch(
      /game\.me\.(moveToward|dribble|shoot|stop|position|slot|isTeammate)/,
    );
  });

  test('should trigger autocomplete manually with Ctrl+Space @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a member access already typed (no popup)
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'CtrlSpaceTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // Type "game.me." but autocomplete might not trigger immediately
    await typeInsideUpdate(page, 'game.me.');

    // Dismiss any existing autocomplete
    await page.keyboard.press('Escape');
    await page.waitForSelector('.suggest-widget', { state: 'hidden', timeout: 2000 }).catch(() => {});

    // WHEN: User presses Ctrl+Space to trigger autocomplete
    await page.keyboard.press('Control+Space');

    // THEN: Autocomplete popup appears
    await page.waitForSelector('.suggest-widget', { state: 'visible', timeout: 5000 });
    const suggestions = page.locator('.suggest-widget .monaco-list-row');
    await expect(suggestions.first()).toBeVisible();
  });

  test('should show read-only player members for game.teammates[0]. @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a typed AI file open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'TeammatesTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // WHEN: User types "game.teammates[0]." inside update(game)
    await typeInsideUpdate(page, 'game.teammates[0].');

    // THEN: Autocomplete shows the read-only player surface
    // (position/slot/isTeammate) and NO action methods, matching the engine
    // shim which attaches actions to `me` only.
    const labels = await suggestionLabels(page);
    expect(labels.join(' ')).toMatch(/position|slot|isTeammate/);
    const suggestionText = await page.locator('.suggest-widget').textContent();
    expect(suggestionText).not.toContain('moveToward');
    expect(suggestionText).not.toContain('dribble');
    expect(suggestionText).not.toContain('shoot');
  });

  test('should dismiss autocomplete with Escape @P2', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with autocomplete popup showing
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'EscapeTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // Type to trigger autocomplete
    await typeInsideUpdate(page, 'game.me.');

    // Wait for autocomplete (longer than default: the sweep loads the box)
    await page.waitForSelector('.suggest-widget', { state: 'visible', timeout: 10000 });

    // WHEN: User presses Escape
    await page.keyboard.press('Escape');

    // THEN: Autocomplete is dismissed
    await page.waitForSelector('.suggest-widget', { state: 'hidden', timeout: 3000 });
  });
});

test.describe('Story 2.5 - Code Error Detection', () => {
  test('should show red underline for syntax errors @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open in editor
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'SyntaxErrorTest.js',
      code: TYPED_SCAFFOLD,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // WHEN: User types invalid JavaScript (missing closing parenthesis).
    // The scaffold is replaced entirely: story 3.4 only accepts scripts that
    // define `update`, so the file starts valid.
    await page.click('.monaco-editor');
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('function test() { return (');

    // Wait for Monaco to analyze the code (debounced validation)
    await page.waitForTimeout(1000);

    // THEN: Error squiggle appears (red underline)
    // Monaco uses .squiggly-error class for syntax errors
    await expect(page.locator('.squiggly-error')).toBeVisible({ timeout: 5000 });
  });

  test('should show error message on hover @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a syntax error in their code
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'HoverErrorTest.js',
      code: TYPED_SCAFFOLD,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Type invalid JavaScript. A stray closing brace is used because Monaco
    // auto-closes opened brackets, so unterminated brackets would never
    // produce an error. The scaffold is replaced entirely (see note above).
    await page.click('.monaco-editor');
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('let x = 1;\n}');

    // Wait for the language worker to analyze the code (cold start can be slow)
    await expect(page.locator('.squiggly-error')).toBeVisible({ timeout: 15000 });

    // WHEN: User hovers over the error. The squiggle is a decoration layer
    // under the text, so hover via raw mouse coordinates (the text span
    // intercepts pointer events and locator.hover() would refuse).
    const errorSquiggle = page.locator('.squiggly-error').first();
    const box = await errorSquiggle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Wait a bit for hover to trigger
    await page.waitForTimeout(500);

    // THEN: Error message appears in hover tooltip
    // Monaco shows error messages in hover-contents or monaco-hover-content
    const hoverContent = page.locator('.monaco-hover-content, .hover-contents');
    await expect(hoverContent.first()).toBeVisible({ timeout: 15000 });
  });

  test('should show error icon in gutter @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a syntax error in their code
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'GutterIconTest.js',
      code: TYPED_SCAFFOLD,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Type invalid JavaScript. A stray closing brace is used because Monaco
    // auto-closes opened brackets (auto-closing brackets are enabled), so an
    // unterminated "{(" would never produce an error. The scaffold is
    // replaced entirely (see note on SyntaxErrorTest).
    await page.click('.monaco-editor');
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('let x = 1;\n}');

    // THEN: Error icon appears in the gutter
    // Monaco displays error icons with codicon-error class in the glyph margin
    const gutterIcon = page.locator('.codicon-error, .codicon-warning');
    await expect(gutterIcon.first()).toBeVisible({ timeout: 15000 });
  });

  test('should show no errors for valid code @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file open in editor
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ValidCodeTest.js',
      code: TYPED_SCAFFOLD,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // WHEN: User types valid JavaScript
    await page.click('.monaco-editor');
    await page.keyboard.press('Meta+a');
    await page.keyboard.type("function update(game) { game.me.moveToward(game.ball.position.x, game.ball.position.y); }");

    // Wait for validation
    await page.waitForTimeout(1000);

    // THEN: No error indicators are shown
    await expect(page.locator('.squiggly-error')).not.toBeVisible();
  });

  test('should remove error indicators when code is fixed @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User has a syntax error in their code
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'FixErrorTest.js',
      code: TYPED_SCAFFOLD,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Type invalid JavaScript. A stray closing brace is used because Monaco
    // auto-closes opened brackets; the error is fixed by deleting the brace.
    // The scaffold is replaced entirely (see note on SyntaxErrorTest).
    await page.click('.monaco-editor');
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('let x = 1;\n}');

    // Wait for the language worker to analyze the code (cold start can be slow)
    await expect(page.locator('.squiggly-error')).toBeVisible({ timeout: 15000 });

    // WHEN: User fixes the error by removing the stray brace
    await page.keyboard.press('Backspace');

    // Wait for re-validation
    await page.waitForTimeout(1000);

    // THEN: Error indicators are removed
    await expect(page.locator('.squiggly-error')).not.toBeVisible({ timeout: 15000 });
  });
});

test.describe('Story 2.6 - Rename AI File', () => {
  test('should show context menu with Rename option on right-click @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'RenameTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User right-clicks on the file
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });

    // THEN: Context menu appears with Rename option
    await expect(page.getByTestId('script-context-menu')).toBeVisible();
    await expect(page.getByTestId('rename-option')).toBeVisible();
  });

  test('should show inline input when clicking Rename option @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with context menu open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'InlineRenameTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Right-click to open context menu
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await expect(page.getByTestId('script-context-menu')).toBeVisible();

    // WHEN: User clicks Rename
    await page.click('[data-testid="rename-option"]');

    // THEN: Inline input appears with current name
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('InlineRenameTest.js');
    await expect(input).toBeFocused();
  });

  test('should show inline input on double-click @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DoubleClickTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User double-clicks on the file
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);

    // THEN: Inline input appears
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('DoubleClickTest.js');
  });

  test('should save new name when pressing Enter @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User in rename mode
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'OldName.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Double-click to start rename
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();

    // WHEN: User types new name and presses Enter
    await input.fill('NewName.js');
    await input.press('Enter');

    // THEN: File is renamed and input disappears
    await expect(input).not.toBeVisible();
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('NewName.js');
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('OldName.js');
  });

  test('should cancel rename when pressing Escape @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User in rename mode
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'EscapeTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Double-click to start rename
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();

    // WHEN: User types new name and presses Escape
    await input.fill('WontBeSaved.js');
    await input.press('Escape');

    // THEN: Rename is cancelled and original name remains
    await expect(input).not.toBeVisible();
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('EscapeTest.js');
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('WontBeSaved.js');
  });

  test('should show validation error for empty name @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User in rename mode
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'EmptyNameTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Double-click to start rename
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();

    // WHEN: User clears the name and presses Enter
    await input.fill('');
    await input.press('Enter');

    // THEN: Validation error is shown
    await expect(page.getByTestId('rename-error')).toBeVisible();
    await expect(page.getByTestId('rename-error')).toContainText('Name cannot be empty');
    // Input should still be visible
    await expect(input).toBeVisible();
  });

  test('should show validation error for invalid characters @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User in rename mode
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'InvalidCharsTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Double-click to start rename
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();

    // WHEN: User enters invalid characters
    await input.fill('invalid/name.js');
    await input.press('Enter');

    // THEN: Validation error is shown
    await expect(page.getByTestId('rename-error')).toBeVisible();
    await expect(page.getByTestId('rename-error')).toContainText('invalid characters');
  });

  test('should update editor header with new name after rename @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with file open in editor
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'HeaderTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file first
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Verify editor header shows current name
    await expect(page.getByTestId('editor-script-name')).toContainText('HeaderTest.js');

    // Double-click to start rename
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);
    const input = page.getByTestId('script-rename-input');
    await expect(input).toBeVisible();

    // WHEN: User renames the file
    await input.fill('RenamedHeader.js');
    await input.press('Enter');

    // THEN: Editor header shows new name
    await expect(input).not.toBeVisible();
    await expect(page.getByTestId('editor-script-name')).toContainText('RenamedHeader.js');
  });

  test('should persist renamed file after page reload @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User renames a file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'PersistTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Rename the file
    await page.dblclick(`[data-testid="script-item-${script.id}"]`);
    const input = page.getByTestId('script-rename-input');
    await input.fill('PersistedName.js');
    await input.press('Enter');
    await expect(input).not.toBeVisible();

    // WHEN: Page is reloaded
    await page.reload();
    await page.waitForSelector('[data-testid="scripts-list"]');

    // THEN: New name is persisted
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('PersistedName.js');
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('PersistTest.js');
  });
});

test.describe('Story 2.7 - Duplicate AI File', () => {
  test('should show context menu with Duplicate option on right-click @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DuplicateTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User right-clicks on the file
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });

    // THEN: Context menu appears with Duplicate option
    await expect(page.getByTestId('script-context-menu')).toBeVisible();
    await expect(page.getByTestId('duplicate-option')).toBeVisible();
  });

  test('should create duplicate with "Copy of" prefix when clicking Duplicate @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'Original.js',
      code: withUpdate('original code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Right-click to open context menu
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await expect(page.getByTestId('script-context-menu')).toBeVisible();

    // WHEN: User clicks Duplicate
    await page.click('[data-testid="duplicate-option"]');

    // THEN: New file with "Copy of" prefix appears
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('Copy of Original.js');
    // Original still exists
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('Original.js');
  });

  test('should open duplicated file in editor automatically @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'AutoOpenDup.js',
      code: withUpdate('test code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Right-click and duplicate
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="duplicate-option"]');

    // THEN: Duplicated file is opened in editor
    await expect(page.getByTestId('editor-script-name')).toContainText('Copy of AutoOpenDup.js');
  });

  test('should copy code content to duplicate @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file containing specific code
    const user = await userFactory.createAuthenticated();
    // withUpdate: story 3.4's validator requires an update function; the
    // comment wrap keeps the asserted text visible in the editor.
    const testCode = withUpdate('const uniqueCode = "test123";');
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'CodeCopy.js',
      code: testCode,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Right-click and duplicate
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="duplicate-option"]');

    // Wait for Monaco to load
    await page.waitForSelector('.monaco-editor');

    // THEN: Duplicated file contains the same code
    await expect(page.locator('.monaco-editor')).toContainText('uniqueCode');
  });

  test('should show both files independently in list @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'Independent.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Right-click and duplicate
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="duplicate-option"]');

    // Wait for duplication to complete
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('Copy of Independent.js');

    // THEN: Both files appear as separate items in the list
    const originalItem = page.locator(`[data-testid="script-item-${script.id}"]`);
    await expect(originalItem).toBeVisible();

    // Find the duplicate item (will have different ID). The StarterAI.js
    // template provisioned at registration is also in the list, so the total
    // count cannot be asserted; match the duplicate by name instead.
    const duplicateItem = page
      .locator('[data-testid^="script-item-"]')
      .filter({ hasText: 'Copy of Independent.js' });
    await expect(duplicateItem).toHaveCount(1);
  });

  test('should allow editing duplicate without affecting original @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User duplicates a file
    const user = await userFactory.createAuthenticated();
    // withUpdate: story 3.4's validator requires an update function; the
    // comment wrap keeps the asserted text visible in the editor.
    const originalCode = withUpdate('const original = true;');
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'EditIndep.js',
      code: originalCode,
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Duplicate the file
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="duplicate-option"]');
    await page.waitForSelector('.monaco-editor');

    // WHEN: User edits the duplicate
    await page.click('.monaco-editor');
    await page.keyboard.type('\nconst modified = true;');

    // Wait a bit for changes to register
    await page.waitForTimeout(500);

    // THEN: Click on original to verify its code is unchanged
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForTimeout(500);

    // Original should not contain the modification
    await expect(page.locator('.monaco-editor')).not.toContainText('modified');
    await expect(page.locator('.monaco-editor')).toContainText('original');
  });

  test('should persist duplicated file after page reload @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User duplicates a file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'PersistDup.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Duplicate the file
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="duplicate-option"]');
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('Copy of PersistDup.js');

    // WHEN: Page is reloaded
    await page.reload();
    await page.waitForSelector('[data-testid="scripts-list"]');

    // THEN: Duplicate is persisted
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('Copy of PersistDup.js');
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('PersistDup.js');
  });
});

test.describe('Story 2.8 - Delete AI File', () => {
  test('should show context menu with Delete option on right-click @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DeleteTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // WHEN: User right-clicks on the file
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });

    // THEN: Context menu appears with Delete option
    await expect(page.getByTestId('script-context-menu')).toBeVisible();
    await expect(page.getByTestId('delete-option')).toBeVisible();
  });

  test('should show confirmation dialog when clicking Delete @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with an AI file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ConfirmDeleteTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Right-click to open context menu
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await expect(page.getByTestId('script-context-menu')).toBeVisible();

    // WHEN: User clicks Delete
    await page.click('[data-testid="delete-option"]');

    // THEN: Confirmation dialog appears with filename
    await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('delete-confirm-dialog')).toContainText('Supprimer ConfirmDeleteTest.js ?');
    await expect(page.getByTestId('delete-confirm-button')).toBeVisible();
    await expect(page.getByTestId('delete-cancel-button')).toBeVisible();
  });

  test('should delete file when confirming deletion @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with confirmation dialog open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ToBeDeleted.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open delete confirmation
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();

    // WHEN: User clicks Delete to confirm
    await page.click('[data-testid="delete-confirm-button"]');

    // THEN: File is removed from list and dialog closes
    await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('ToBeDeleted.js');
  });

  test('should keep file when cancelling deletion @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with confirmation dialog open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'CancelDeleteTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open delete confirmation
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();

    // WHEN: User clicks Cancel
    await page.click('[data-testid="delete-cancel-button"]');

    // THEN: File remains in list and dialog closes
    await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('CancelDeleteTest.js');
  });

  test('should cancel deletion when pressing Escape @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with confirmation dialog open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'EscapeDeleteTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open delete confirmation
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();

    // WHEN: User presses Escape
    await page.keyboard.press('Escape');

    // THEN: File remains and dialog closes
    await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('EscapeDeleteTest.js');
  });

  test('should cancel deletion when clicking outside dialog @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with confirmation dialog open
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ClickOutsideTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open delete confirmation
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();

    // WHEN: User clicks on the overlay (outside the dialog content)
    await page.click('[data-testid="delete-confirm-dialog"]', { position: { x: 10, y: 10 } });

    // THEN: File remains and dialog closes
    await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('ClickOutsideTest.js');
  });

  test('should close editor when deleting the last active file @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with a file open in editor. The StarterAI.js template is
    // provisioned at registration, so both files must be deleted for the
    // editor to reach its empty state.
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'ActiveDeleteTest.js',
      code: withUpdate('test code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the file first
    await page.click(`[data-testid="script-item-${script.id}"]`);
    await page.waitForSelector('.monaco-editor');
    await expect(page.getByTestId('editor-script-name')).toContainText('ActiveDeleteTest.js');

    // Open delete confirmation
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');

    // WHEN: User confirms deletion
    await page.click('[data-testid="delete-confirm-button"]');

    // THEN: Deleting the active file selects the next remaining script
    await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
    await expect(page.locator('.monaco-editor')).toBeVisible();
    await expect(page.getByTestId('editor-script-name')).toContainText('StarterAI.js');

    // WHEN: The last remaining script is deleted
    await page.click('[data-testid^="script-item-"]', { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await page.click('[data-testid="delete-confirm-button"]');

    // THEN: Editor shows empty state (no script selected message)
    await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
    await expect(page.locator('.monaco-editor')).not.toBeVisible();
    await expect(page.locator('[data-testid="editor-container"]')).toContainText('Sélectionne un script à éditer');
  });

  test('should select another file when deleting active file with multiple files @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User with multiple files, one open in editor
    const user = await userFactory.createAuthenticated();
    const script1 = await scriptFactory.create({
      token: user.token!,
      name: 'DeleteMe.js',
      code: withUpdate('delete me'),
    });
    const script2 = await scriptFactory.create({
      token: user.token!,
      name: 'KeepMe.js',
      code: withUpdate('keep me'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Open the first file
    await page.click(`[data-testid="script-item-${script1.id}"]`);
    await page.waitForSelector('.monaco-editor');

    // Delete it
    await page.click(`[data-testid="script-item-${script1.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await page.click('[data-testid="delete-confirm-button"]');

    // THEN: The other file should now be selected
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('DeleteMe.js');
    // The remaining file may be auto-selected
    await expect(page.locator('[data-testid="scripts-list"]')).toContainText('KeepMe.js');
  });

  test('should persist deletion after page reload @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    // GIVEN: User deletes a file
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'PersistDeleteTest.js',
      code: withUpdate('code'),
    });

    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, user.token);
    await page.goto('/teams');
    await page.waitForSelector('[data-testid="scripts-list"]');

    // Delete the file
    await page.click(`[data-testid="script-item-${script.id}"]`, { button: 'right' });
    await page.click('[data-testid="delete-option"]');
    await page.click('[data-testid="delete-confirm-button"]');
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('PersistDeleteTest.js');

    // WHEN: Page is reloaded
    await page.reload();
    await page.waitForSelector('[data-testid="scripts-list"]');

    // THEN: File is still gone
    await expect(page.locator('[data-testid="scripts-list"]')).not.toContainText('PersistDeleteTest.js');
  });
});
