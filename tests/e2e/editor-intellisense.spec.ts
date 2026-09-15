/**
 * Editor IntelliSense E2E Tests (typed game API)
 *
 * The script editor's completions, hover docs and signature help come from
 * Monaco's TypeScript worker, fed the game API as ambient declarations
 * (gameApiDts.ts, generated from gameApiTypes.ts) and the stored
 * `@param {Game} game` JSDoc line (gameScript.ts).
 *
 * Covered contract: EVERY typed API path completes — including deep chains
 * (game.ball.position., field.zones.homeBox.), destructuring and local
 * aliases — not just one hot spot.
 *
 * @see gameApiTypes.ts (canonical contract)
 * @see script-ia-api.md v2.0
 */
import { test, expect } from '../support/fixtures';
import {
  TYPED_SCAFFOLD,
  CHASE_SCAFFOLD,
  openWorkspaceScript,
  typeInsideUpdate,
  typeAtEndOfLine,
  suggestionLabels,
} from '../support/helpers/editor';

test.describe('Editor IntelliSense - typed game API', () => {
  test('completes deep chain game.ball.position. with x and y @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DeepBallTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);
    await typeInsideUpdate(page, 'game.ball.position.');

    const labels = await suggestionLabels(page);
    expect(labels.some((label) => label.startsWith('x'))).toBe(true);
    expect(labels.some((label) => label.startsWith('y'))).toBe(true);
  });

  test('completes deep chain field.zones.homeBox. with the zone corners @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DeepFieldTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);
    await typeInsideUpdate(page, 'game.field.zones.homeBox.');

    const labels = await suggestionLabels(page);
    const joined = labels.join(' ');
    expect(joined).toMatch(/x1/);
    expect(joined).toMatch(/y2/);
  });

  test('completes ball.velocity. with vx and vy @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DeepVelocityTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);
    await typeInsideUpdate(page, 'game.ball.velocity.');

    const labels = await suggestionLabels(page);
    const joined = labels.join(' ');
    expect(joined).toMatch(/vx/);
    expect(joined).toMatch(/vy/);
  });

  test('types flow through destructuring (const { ball } = game) @P1', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'DestructureTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);
    // Replace the body line with a destructured local, then complete on it.
    await typeAtEndOfLine(page, 'game.me.stop', ' \n  const { ball } = game;\n  ball.');

    const labels = await suggestionLabels(page);
    const joined = labels.join(' ');
    expect(joined).toMatch(/position|velocity|owner/);
  });

  test('completes the me.team property on the typed API @P2', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'EnumTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);
    await typeInsideUpdate(page, 'game.me.te');

    const labels = await suggestionLabels(page);
    expect(labels.some((label) => label.startsWith('team'))).toBe(true);
  });

  test('shows JSDoc documentation on hover over moveToward @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'HoverDocTest.js',
      code: CHASE_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);

    // Hover the moveToward token in the body line. Token spans carry a
    // numbered mtk class (mtk1, mtk9, ...), so match on the prefix.
    const token = page
      .locator('.monaco-editor .view-line span[class*="mtk"]')
      .filter({ hasText: 'moveToward' })
      .first();
    await token.hover();

    // The TypeScript worker renders the JSDoc from gameApiTypes.ts. Two
    // hover widgets exist (editor + glyph margin): target the editor one.
    const hover = page.locator('.monaco-hover').first();
    await expect(hover).toBeVisible({ timeout: 15000 });
    await expect(hover).toContainText(/WITHOUT the ball|Move the player toward/);
  });

  test('shows parameter hints when typing me.shoot( @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'SignatureTest.js',
      code: TYPED_SCAFFOLD,
    });

    await openWorkspaceScript(page, user.token, script.id);
    await typeInsideUpdate(page, 'game.me.shoot(');

    // Signature help opens on the opening parenthesis, with the typed
    // parameter list straight from the contract (x, y, power 0.1-1.0).
    const hints = page.locator('.parameter-hints-widget');
    await expect(hints).toBeVisible({ timeout: 15000 });
    await expect(hints).toContainText(/shoot\(x: number, y: number, power: number\)/);
    await expect(hints).toContainText(/power/);
  });
});
