/**
 * Teams Page E2E Tests (story 7.5)
 *
 * The La Ronde teams workspace: floating teambar (pills + caret menu +
 * creation modal + status pill), the fixed Scripts | Code | Terrain layout,
 * and the on-pitch script picker that replaces drag-and-drop assignment.
 * Also covers the delete-detach regression: deleting a script attached to
 * players must detach it from the field and the cached lineups.
 *
 * @see Story 7.5: Teams Page — Scripts, Code & Terrain
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';
import { computePitchRect, percentToScreen } from '../../src/components/canvas/engine/fieldGeometry';

test.describe('Teams Page', () => {
  test('should create, rename, duplicate, switch and delete teams from the teambar @P0', async ({
    page,
    userFactory,
  }) => {    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    await expect(page.getByTestId('team-bar')).toBeVisible();

    // Fresh user: a default tactic is auto-created (story 3.2 AC #6)
    const firstPill = page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' });
    await expect(firstPill).toBeVisible();
    await expect(firstPill).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('ready-toggle')).toHaveAttribute('data-status', 'draft');

    // Rename through the caret menu (input -> Enter)
    await firstPill.getByTestId('team-caret').click();
    await expect(page.getByTestId('team-menu')).toBeVisible();
    await page.getByTestId('team-rename').click();
    const renameInput = page.getByTestId('team-rename-input');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Attacking');
    await renameInput.press('Enter');
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Attacking' })).toBeVisible();

    // Create a second team through the modal; it becomes active
    await page.getByTestId('new-team-button').click();
    await expect(page.getByTestId('new-team-modal')).toBeVisible();
    await page.getByTestId('new-team-name-input').fill('Defense');
    await page.getByTestId('new-team-create-button').click();
    const secondPill = page.getByTestId('tactic-tab').filter({ hasText: 'Defense' });
    await expect(secondPill).toBeVisible();
    await expect(secondPill).toHaveAttribute('aria-current', 'true');

    // Duplicate the active team: "Defense (copie)" appears and becomes active
    await secondPill.getByTestId('team-caret').click();
    await expect(page.getByTestId('team-menu')).toBeVisible();
    await page.getByTestId('team-duplicate').click();
    const copyPill = page.getByTestId('tactic-tab').filter({ hasText: 'Defense (copie)' });
    await expect(copyPill).toBeVisible();
    await expect(copyPill).toHaveAttribute('aria-current', 'true');

    // Delete the active copy: confirm dialog, then a neighbor is promoted
    await copyPill.getByTestId('team-caret').click();
    await expect(page.getByTestId('team-menu')).toBeVisible();
    await page.getByTestId('team-delete').click();
    await expect(page.getByTestId('delete-tactic-confirm-dialog')).toBeVisible();
    await page.getByTestId('delete-tactic-confirm-button').click();

    await expect(page.getByTestId('tactic-tab')).toHaveCount(2);
    await expect(secondPill).toHaveAttribute('aria-current', 'true');

    // Switch back to the first team
    await page.getByTestId('tactic-tab').filter({ hasText: 'Attacking' }).click();
    await expect(
      page.getByTestId('tactic-tab').filter({ hasText: 'Attacking' })
    ).toHaveAttribute('aria-current', 'true');

    // Delete the LAST team: a fresh default one is recreated automatically.
    // Delete Defense first (the active one), then Attacking.
    await secondPill.getByTestId('team-caret').click();
    await page.getByTestId('team-delete').click();
    await page.getByTestId('delete-tactic-confirm-button').click();
    await expect(page.getByTestId('tactic-tab')).toHaveCount(1);

    await page
      .getByTestId('tactic-tab')
      .filter({ hasText: 'Attacking' })
      .getByTestId('team-caret')
      .click();
    await page.getByTestId('team-delete').click();
    await page.getByTestId('delete-tactic-confirm-button').click();

    await expect(page.getByTestId('tactic-tab')).toHaveCount(1);
    await expect(
      page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })
    ).toHaveAttribute('aria-current', 'true');
  });

  test('should assign a script through the on-pitch picker and persist it @P0', async ({
    page,
    userFactory,
    apiContext,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    await expect(page.getByTestId('team-bar')).toBeVisible();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    // The backend provisions StarterAI.js (story 1.4)
    const scriptItem = page
      .locator('[data-testid^="script-item-"]')
      .filter({ hasText: 'StarterAI.js' });
    await expect(scriptItem).toBeVisible();

    // Click the GK player (slot 1 at engine percent x=8, y=50): the picker
    // opens on the pitch
    const canvas = page.getByTestId('field-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');
    const gk = percentToScreen(computePitchRect(canvasBox.width, canvasBox.height), 8, 50);
    await page.mouse.click(canvasBox.x + gk.x, canvasBox.y + gk.y);

    const picker = page.getByTestId('script-picker');
    await expect(picker).toBeVisible();
    await expect(picker).toContainText('Assigner à n°1');

    // Pick StarterAI.js: the assignment auto-saves through the tactics API
    const putTacticPromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await picker.getByTestId('picker-script-option').filter({ hasText: 'StarterAI.js' }).click();
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

    // "Retirer le script" detaches and persists the empty slot — the
    // waitForResponse MUST be registered before the click: the PUT can
    // complete before a post-click listener attaches (race seen in the 7.8
    // sweep)
    const putRemovePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await picker.getByTestId('picker-remove-script').click();
    const putRemoveResponse = await putRemovePromise;
    expect(putRemoveResponse.ok()).toBeTruthy();
    const removedBody = (await putRemoveResponse.json()) as {
      players: { playerSlot: number; scriptId: string | null }[];
    };
    expect(
      removedBody.players.find((player) => player.playerSlot === 1)?.scriptId
    ).toBeNull();

    // Reload: the tactic is restored with the detached assignment
    await page.reload();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();
  });

  test('should auto-save a player drag-move on the canvas @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    await expect(page.getByTestId('team-bar')).toBeVisible();
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

  test('should gate Test vs Bot and the ready toggle on a complete lineup @P1', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    await expect(page.getByTestId('team-bar')).toBeVisible();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    // Fresh default tactic (auto-created): buttons disabled with helper message
    await expect(page.getByTestId('test-vs-bot-button')).toBeDisabled();
    await expect(page.getByTestId('ready-toggle')).toBeDisabled();
    await expect(page.getByTestId('lineup-incomplete-message')).toContainText(
      'Assigne un script aux 5 positions'
    );

    // Assign StarterAI.js to all 5 slots through the on-pitch picker
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

    const scriptOption = page
      .getByTestId('picker-script-option')
      .filter({ hasText: 'StarterAI.js' });

    for (const [x, y] of slots) {
      const putTacticPromise = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
      );
      const spot = percentToScreen(pitchRect, x, y);
      await page.mouse.click(canvasBox.x + spot.x, canvasBox.y + spot.y);
      await expect(page.getByTestId('script-picker')).toBeVisible();
      await scriptOption.click();
      await putTacticPromise;
    }

    // All 5 assigned -> the gates open (the status pill stays Brouillon
    // until the player explicitly readies the team)
    await expect(page.getByTestId('lineup-incomplete-message')).toBeHidden();
    await expect(page.getByTestId('test-vs-bot-button')).toBeEnabled();
    await expect(page.getByTestId('ready-toggle')).toBeEnabled();
    await expect(page.getByTestId('ready-toggle')).toHaveAttribute('data-status', 'draft');

    // Readying the team flips the status pill
    const readyPromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await page.getByTestId('ready-toggle').click();
    const readyResponse = await readyPromise;
    expect(readyResponse.ok()).toBeTruthy();
    await expect(page.getByTestId('ready-toggle')).toHaveAttribute('data-status', 'ready');
    await expect(page.getByTestId('ready-toggle')).toContainText('Prêt');
  });

  test('should detach a deleted script from its players on the field @P0', async ({
    page,
    userFactory,
    scriptFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    // A second script so the lineup can still be edited after the deletion
    const backupScript = await scriptFactory.create({
      token: user.token!,
      name: 'BackupAI.js',
      // story 3.4: stored scripts must define an `update` function
      code: 'function update(game) {\n  game.me.stop();\n}',
    });

    await seedAuthToken(page, user.token ?? '');
    await page.goto('/teams');
    await expect(page.getByTestId('team-bar')).toBeVisible();
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

    const starterOption = page
      .getByTestId('picker-script-option')
      .filter({ hasText: 'StarterAI.js' });

    // Assign StarterAI.js to all 5 slots and capture its id from the auto-save
    let starterScriptId: string | null = null;
    for (const [x, y] of slots) {
      const putTacticPromise = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
      );
      const spot = percentToScreen(pitchRect, x, y);
      await page.mouse.click(canvasBox.x + spot.x, canvasBox.y + spot.y);
      await expect(page.getByTestId('script-picker')).toBeVisible();
      await starterOption.click();
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
    const countPut = (request: { method: () => string; url: () => string }) => {
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
    const putAfterDelete = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    const backupSpot = percentToScreen(pitchRect, 8, 50);
    await page.mouse.click(canvasBox.x + backupSpot.x, canvasBox.y + backupSpot.y);
    await expect(page.getByTestId('script-picker')).toBeVisible();
    await page
      .getByTestId('picker-script-option')
      .filter({ hasText: 'BackupAI.js' })
      .click();
    const putResponse = await putAfterDelete;
    expect(putResponse.ok()).toBeTruthy();

    const payload = putResponse.request().postDataJSON() as {
      players: { player_slot: number; script_id: string | null }[];
    };
    for (const slot of payload.players) {
      expect(slot.script_id).not.toBe(starterScriptId);
    }
    expect(payload.players.find((slot) => slot.player_slot === 1)?.script_id).toBe(
      backupScript.id
    );
  });

  test('should reload players on the pitch after navigating away and back @P0', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    await page.goto('/teams');
    await expect(page.getByTestId('team-bar')).toBeVisible();
    await expect(page.getByTestId('tactic-tab').filter({ hasText: 'Tactic 1' })).toBeVisible();

    // Edit the team (assign a script to the GK) so the active tactic is set
    const canvas = page.getByTestId('field-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not visible');
    const pitchRect = computePitchRect(canvasBox.width, canvasBox.height);

    const putTacticPromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    const gkSpot = percentToScreen(pitchRect, 8, 50);
    await page.mouse.click(canvasBox.x + gkSpot.x, canvasBox.y + gkSpot.y);
    await expect(page.getByTestId('script-picker')).toBeVisible();
    await page
      .getByTestId('picker-script-option')
      .filter({ hasText: 'StarterAI.js' })
      .click();
    await putTacticPromise;

    // Leave the teams page and come back: the canvas engine is destroyed and
    // rebuilt (route remount + StrictMode double-mount). The active tactic id
    // did not change, so the reload must still happen — players stay on pitch.
    await page.getByTestId('nav-leaderboard').click();
    await expect(page.getByTestId('nav-teams')).toBeVisible();

    await page.getByTestId('nav-teams').click();
    await expect(page.getByTestId('team-bar')).toBeVisible();

    // The fresh engine must have rebuilt the 5 formation players
    await expect(page.getByTestId('field-canvas')).toHaveAttribute(
      'data-match-players',
      '5'
    );

    // And the GK must actually be on the pitch: clicking its spot opens the picker
    const canvasBoxAfter = await page.getByTestId('field-canvas').boundingBox();
    if (!canvasBoxAfter) throw new Error('Canvas not visible after remount');
    const pitchRectAfter = computePitchRect(canvasBoxAfter.width, canvasBoxAfter.height);
    const gkSpotAfter = percentToScreen(pitchRectAfter, 8, 50);
    await page.mouse.click(canvasBoxAfter.x + gkSpotAfter.x, canvasBoxAfter.y + gkSpotAfter.y);
    await expect(page.getByTestId('script-picker')).toBeVisible();
    await expect(
      page
        .getByTestId('picker-script-option')
        .filter({ hasText: 'StarterAI.js' })
        .first()
    ).toBeVisible();
  });

  test('no-ready team flow: Play → Équipes → ready lineup → back to Play @P0', async ({
    page,
    userFactory,
  }) => {
    // Story 7.8 AC #2: the onboarding loop between the two La Ronde hubs.
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token ?? '');

    // A fresh user has no ready tactic: the Play hero shows the no-ready
    // card pointing at Équipes
    await page.goto('/play');
    await expect(page.getByTestId('no-ready-state')).toBeVisible();
    await expect(page.getByTestId('ranked-open-button')).toBeHidden();

    // "Préparer une équipe" lands in the workspace
    await page.getByTestId('go-to-teams-button').click();
    await expect(page.getByTestId('team-bar')).toBeVisible();
    await expect(page.getByTestId('test-vs-bot-button')).toBeDisabled();

    // Build the lineup: assign StarterAI.js to all 5 default slots
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
    const scriptOption = page
      .getByTestId('picker-script-option')
      .filter({ hasText: 'StarterAI.js' });

    for (const [x, y] of slots) {
      const putTacticPromise = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
      );
      const spot = percentToScreen(pitchRect, x, y);
      await page.mouse.click(canvasBox.x + spot.x, canvasBox.y + spot.y);
      await expect(page.getByTestId('script-picker')).toBeVisible();
      await scriptOption.click();
      await putTacticPromise;
    }

    // Mark the team ready
    const readyPromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && /\/tactics\//.test(response.url())
    );
    await page.getByTestId('ready-toggle').click();
    expect((await readyPromise).ok()).toBeTruthy();
    await expect(page.getByTestId('ready-toggle')).toHaveAttribute('data-status', 'ready');

    // Back to Play through the appbar: the ready hero replaces the no-ready
    // card and the ranked + practice entries appear
    await page.getByTestId('nav-play').click();
    await expect(page.getByTestId('no-ready-state')).toBeHidden();
    await expect(page.getByTestId('play-greeting')).toBeVisible();
    await expect(page.getByTestId('play-hero-sub')).toContainText('Tactic 1');
    await expect(page.getByTestId('ranked-open-button')).toBeVisible();
    await expect(page.getByTestId('practice-start-button')).toBeVisible();
  });
});
