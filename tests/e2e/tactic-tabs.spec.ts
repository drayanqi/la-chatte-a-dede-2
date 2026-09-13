/**
 * Tactic Tabs E2E Tests (story 3.2)
 *
 * Tests the lineup manager: tab bar above the field with "+", rename,
 * auto-save on script assignment, delete with last-tactic guard, and
 * the "Test vs Bot" lineup gating.
 * Also covers the delete-detach regression: deleting a script attached to
 * players must detach it from the field and the cached lineups.
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.2: Tactic Tabs & Auto-Saved Lineups
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';
import { computePitchRect, percentToScreen } from '../../src/components/canvas/engine/fieldGeometry';

test.describe('Tactic Tabs', () => {
  test('should create, rename, switch and delete tactics from the tab bar @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    // Fresh user: a default tactic is auto-created (story 3.2 AC #6)
    const firstTab = page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' });
    await expect(firstTab).toBeVisible();
    await expect(firstTab).toHaveAttribute('aria-current', 'true');

    // Rename the tab (double-click -> input -> Enter)
    await firstTab.dblclick();
    const renameInput = page.getByTestId('tab-rename-input');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Attacking');
    await renameInput.press('Enter');
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Attacking' })).toBeVisible();

    // Second tactic; both tabs exist, second one active
    await page.getByTestId('new-tactic-button').click();
    const secondTab = page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 2' });
    await expect(secondTab).toBeVisible();
    await expect(secondTab).toHaveAttribute('aria-current', 'true');

    // Switch back to the first tab
    await page.getByTestId('tactic-tab').filter({ hasText: 'Attacking' }).click();
    await expect(
      page.getByTestId('tactic-tab').filter({ hasText: 'Attacking' })
    ).toHaveAttribute('aria-current', 'true');

    // Delete the active one: confirm dialog, neighbor promoted
    await page.getByTestId('delete-tactic-button').click();
    await expect(page.getByTestId('delete-tactic-confirm-dialog')).toBeVisible();
    await page.getByTestId('delete-tactic-confirm-button').click();

    await expect(page.getByTestId('tactic-tab')).toHaveCount(1);
    await expect(secondTab).toHaveAttribute('aria-current', 'true');

    // Delete the LAST tactic: a fresh default one is recreated automatically
    await page.getByTestId('delete-tactic-button').click();
    await expect(page.getByTestId('delete-tactic-confirm-dialog')).toBeVisible();
    await page.getByTestId('delete-tactic-confirm-button').click();

    await expect(page.getByTestId('tactic-tab')).toHaveCount(1);
    await expect(
      page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })
    ).toHaveAttribute('aria-current', 'true');
  });

  test('should auto-save a script assignment and restore it after reload @P0', async ({
    page,
    userFactory,
    apiContext,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    // A default tactic is auto-created on mount (story 3.2 AC #6)
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    // The backend provisions StarterAI.js (story 1.4)
    const scriptItem = page.locator('[data-testid^="script-item-"]').filter({ hasText: 'StarterAI.js' });
    await expect(scriptItem).toBeVisible();

    // Drop it onto the GK player (slot 1 at engine percent x=8, y=50)
    const canvas = page.getByTestId('field-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');

    const gk = percentToScreen(computePitchRect(canvasBox.width, canvasBox.height), 8, 50);
    const targetPosition = { x: gk.x, y: gk.y };

    const putTacticPromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await scriptItem.dragTo(canvas, { targetPosition });
    const putResponse = await putTacticPromise;
    expect(putResponse.ok()).toBeTruthy();

    // The auto-saved tactic now references the script
    const tacticId = (await page.evaluate(() =>
      localStorage.getItem('last_active_tactic_id')
    )) as string | null;
    expect(tacticId).toBeTruthy();

    const saved = await apiContext.get(`tactics/${tacticId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(saved.ok()).toBeTruthy();
    const savedBody = (await saved.json()) as {
      players: { playerSlot: number; scriptId: string | null }[];
    };
    const gkSlot = savedBody.players.find((player) => player.playerSlot === 1);
    expect(gkSlot?.scriptId).not.toBeNull();

    // Reload: the tactic is restored with its assignment
    await page.reload();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  test('should auto-save a player drag-move on the canvas @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    // A default tactic is auto-created on mount (story 3.2 AC #6)
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    const canvas = page.getByTestId('field-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');
    const pitchRect = computePitchRect(canvasBox.width, canvasBox.height);

    // Drag the GK (slot 1, default percent 8/50) toward (30, 25) — still in
    // the left half (kickoff invariant: home x <= 50)
    const gk = percentToScreen(pitchRect, 8, 50);
    const target = percentToScreen(pitchRect, 30, 25);

    const putTacticPromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await page.mouse.move(canvasBox.x + gk.x, canvasBox.y + gk.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + target.x, canvasBox.y + target.y, { steps: 10 });
    await page.mouse.up();

    // The move-end auto-saves the full lineup via the tactics API (AC #3)
    const putResponse = await putTacticPromise;
    expect(putResponse.ok()).toBeTruthy();

    const payload = putResponse.request().postDataJSON() as {
      players: { player_slot: number; position_x: number; position_y: number }[];
    };
    const gkSlot = payload.players.find((slot) => slot.player_slot === 1);
    expect(gkSlot).toBeTruthy();
    // Engine percent 30 -> API x ~30 (left-half, not mirrored), y 25 -> ~12.5
    expect(gkSlot?.position_x).toBeGreaterThan(25);
    expect(gkSlot?.position_x).toBeLessThanOrEqual(35);
    expect(gkSlot?.position_y).toBeGreaterThan(10);
    expect(gkSlot?.position_y).toBeLessThanOrEqual(15);
  });

  test('should gate Test vs Bot on a complete 5-slot lineup @P1', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();

    // Fresh default tactic (auto-created): button disabled with helper message
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    await expect(page.getByTestId('test-vs-bot-button')).toBeDisabled();
    await expect(page.getByTestId('lineup-incomplete-message')).toContainText(
      'Assign AIs to all 5 positions'
    );

    // Assign the same script to all 5 slots (engine y = API y * 2)
    const scriptItem = page.locator('[data-testid^="script-item-"]').filter({ hasText: 'StarterAI.js' });
    await expect(scriptItem).toBeVisible();

    const canvas = page.getByTestId('field-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');

    const slots: Array<[number, number]> = [
      [8, 50], // GK (slot 1)
      [25, 30], // DEF1 (slot 2)
      [25, 70], // DEF2 (slot 3)
      [40, 30], // ATK1 (slot 4)
      [40, 70], // ATK2 (slot 5)
    ];
    const pitchRect = computePitchRect(canvasBox.width, canvasBox.height);

    for (const [x, y] of slots) {
      const putTacticPromise = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
      );
      await scriptItem.dragTo(canvas, { targetPosition: percentToScreen(pitchRect, x, y) });
      await putTacticPromise;
    }

    // All 5 assigned -> the gate opens
    await expect(page.getByTestId('lineup-incomplete-message')).toBeHidden();
    await expect(page.getByTestId('test-vs-bot-button')).toBeEnabled();
  });

  test('should detach a deleted script from its players on the field @P0', async ({
    page,
    userFactory,
    scriptFactory,
    apiContext,
  }) => {
    const user = await userFactory.createAuthenticated();
    // A second script so the lineup can still be edited after the deletion
    const backupScript = await scriptFactory.create({
      token: user.token!,
      name: 'BackupAI.js',
      code: 'code',
    });

    await seedAuthToken(page, user.token ?? '');
    await page.goto('/workspace');
    await expect(page.getByTestId('tab-bar')).toBeVisible();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    const scriptItem = page
      .locator('[data-testid^="script-item-"]')
      .filter({ hasText: 'StarterAI.js' });
    await expect(scriptItem).toBeVisible();

    const canvas = page.getByTestId('field-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');
    const pitchRect = computePitchRect(canvasBox.width, canvasBox.height);
    const slots: Array<[number, number]> = [
      [8, 50], // GK (slot 1)
      [25, 30], // DEF1 (slot 2)
      [25, 70], // DEF2 (slot 3)
      [40, 30], // ATK1 (slot 4)
      [40, 70], // ATK2 (slot 5)
    ];

    // Assign StarterAI.js to all 5 slots and capture its id from the auto-save
    let starterScriptId: string | null = null;
    for (const [x, y] of slots) {
      const putTacticPromise = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
      );
      await scriptItem.dragTo(canvas, { targetPosition: percentToScreen(pitchRect, x, y) });
      const putResponse = await putTacticPromise;
      expect(putResponse.ok()).toBeTruthy();
      const body = (await putResponse.json()) as {
        players: { playerSlot: number; scriptId: string | null }[];
      };
      starterScriptId ??= body.players.find((player) => player.scriptId !== null)?.scriptId ?? null;
    }
    expect(starterScriptId).toBeTruthy();

    // Full lineup -> the gate opens
    await expect(page.getByTestId('lineup-incomplete-message')).toBeHidden();
    await expect(page.getByTestId('test-vs-bot-button')).toBeEnabled();

    // The detach must be silent: no redundant PUT may fire around the deletion
    let putsAroundDelete = 0;
    const countPut = (request: {
      method: () => string;
      url: () => string;
    }) => {
      if (request.method() === 'PUT' && /\/tactics\//.test(request.url())) putsAroundDelete++;
    };
    page.on('request', countPut);

    // Delete StarterAI.js via the scripts panel
    await scriptItem.click({ button: 'right' });
    await expect(page.getByTestId('script-context-menu')).toBeVisible();
    await page.getByTestId('delete-option').click();
    await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();
    await page.getByTestId('delete-confirm-button').click();
    await expect(scriptItem).toBeHidden();

    // Frontend detached the script: the Start gate re-locks without a reload
    await expect(page.getByTestId('lineup-incomplete-message')).toBeVisible();
    await expect(page.getByTestId('test-vs-bot-button')).toBeDisabled();
    expect(putsAroundDelete).toBe(0);
    page.off('request', countPut);

    // The next auto-save must carry no deleted script id (regression: 422)
    const backupItem = page
      .locator('[data-testid^="script-item-"]')
      .filter({ hasText: 'BackupAI.js' });
    await expect(backupItem).toBeVisible();
    const putAfterDelete = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await backupItem.dragTo(canvas, { targetPosition: percentToScreen(pitchRect, 8, 50) });
    const putResponse = await putAfterDelete;
    expect(putResponse.ok()).toBeTruthy();

    const payload = putResponse.request().postDataJSON() as {
      players: { player_slot: number; script_id: string | null }[];
    };
    for (const slot of payload.players) {
      expect(slot.script_id).not.toBe(starterScriptId);
    }
    expect(payload.players.find((slot) => slot.player_slot === 1)?.script_id).toBe(backupScript.id);

    // The server truth (FK nullOnDelete) matches the detached frontend state
    const tacticId = (await page.evaluate(() =>
      localStorage.getItem('last_active_tactic_id')
    )) as string | null;
    expect(tacticId).toBeTruthy();
    const saved = await apiContext.get(`tactics/${tacticId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(saved.ok()).toBeTruthy();
    const savedBody = (await saved.json()) as {
      players: { playerSlot: number; scriptId: string | null }[];
    };
    for (const player of savedBody.players) {
      expect(player.scriptId).not.toBe(starterScriptId);
    }
    expect(savedBody.players.find((player) => player.playerSlot === 1)?.scriptId).toBe(
      backupScript.id
    );
  });
});
