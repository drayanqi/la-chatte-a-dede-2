/**
 * Editor E2E helpers.
 * OWNER: Dev Team
 *
 * Shared scaffolding for script-editor IntelliSense tests. The editor's
 * completions come from Monaco's TypeScript worker, driven by the stored
 * `@param {Game} game` JSDoc line: tests therefore create scripts that
 * already carry the typed scaffold and interact inside `update(game)`.
 */
import type { Page } from '@playwright/test';

/**
 * A typed script scaffold (exactly what the editor template produces).
 * Creating it through the script factory also live-verifies that the game
 * engine validator accepts JSDoc-prefixed scripts.
 *
 * The body line is kept short: the scripts panel is narrow and Monaco wraps
 * long lines, which would split the signature across visual rows and break
 * line-based cursor placement in tests.
 */
export const TYPED_SCAFFOLD = `/** @param {Game} game - Game state. */
function update(game) {
  game.me.stop();
}`;

/** Scaffold with a moveToward call site, for hover-on-token tests. */
export const CHASE_SCAFFOLD = `/** @param {Game} game - Game state. */
function update(game) {
  game.me.moveToward(game.ball.position.x, game.ball.position.y);
}`;

/** Navigate to the workspace and open the given script in the editor. */
export async function openWorkspaceScript(
  page: Page,
  token: string | undefined,
  scriptId: string,
): Promise<void> {
  await page.goto('/');
  await page.evaluate((authToken) => {
    localStorage.setItem('auth_token', authToken);
  }, token);
  await page.goto('/workspace');
  await page.waitForSelector('[data-testid="scripts-list"]');
  await page.click(`[data-testid="script-item-${scriptId}"]`);
  await page.waitForSelector('.monaco-editor');
  // Monaco wires its providers lazily on the first javascript model: wait
  // until the language service is live, or typed text triggers no widget.
  await page.evaluate(async () => {
    const setup = (await import('/src/lib/monacoSetup.ts')) as {
      javascriptModeReady: Promise<void>;
    };
    await setup.javascriptModeReady;
  });
}

/**
 * Place the cursor at the end of the update body line and type. The typed
 * text lands inside update(game), where the parameter is typed.
 */
export async function typeInsideUpdate(page: Page, text: string): Promise<void> {
  await typeAtEndOfLine(page, 'game.me.stop', text);
}

/** Place the cursor at the end of a visual line matching `text` and type. */
export async function typeAtEndOfLine(page: Page, lineText: string, text: string): Promise<void> {
  const line = page.locator('.monaco-editor .view-line').filter({ hasText: lineText });
  await line.first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

/**
 * Wait for the suggest widget and return the trimmed label of each row.
 *
 * `retrigger` is the character that completes the just-typed trigger (the
 * last character typed by the caller): if Monaco dropped the first
 * completion request while its worker warmed up, we erase and retype it.
 * Pass null for manually triggered suggestions (e.g. Ctrl+Space), where
 * retyping would close the widget instead of reopening it.
 */
export async function suggestionLabels(
  page: Page,
  retrigger: string | null = '.',
): Promise<string[]> {
  const rows = page.locator('.suggest-widget .monaco-list-row');
  try {
    await rows.first().waitFor({ state: 'visible', timeout: 4000 });
  } catch {
    if (retrigger === null) {
      await page.keyboard.press('ControlOrMeta+Space');
    } else {
      await page.keyboard.press('Backspace');
      await page.keyboard.type(retrigger);
    }
    await rows.first().waitFor({ state: 'visible', timeout: 10000 });
  }
  const texts = await rows.allTextContents();
  return texts.map((label) => label.trim());
}
