/**
 * Ranked Matchmaking E2E Tests (Epic 4 v2 flows on the La Ronde lobby,
 * story 7.6 traversal)
 *
 * The full ranked loop against the real stack (Laravel API + Node engine),
 * driven from /play: the hero's "Match classé" opens the chooser, the
 * challenge simulates the match synchronously even though the opponent
 * never opens a browser, the result card carries the outcome and the elo
 * delta, and "Revoir le match" lands in the /match/:id viewer. The offline
 * opponent finds the match in their history, with their tactic's record
 * moved. The lobby history rows offer the same viewer.
 *
 * The simulation is REAL (same engine-backed setup as practice-match.spec):
 * each test allows the engine's queued-simulation budget.
 *
 * @see Epic 4 v2: Ranked Competition — Ready Tactics & Challenge Mode
 * @see Story 7.6: Play Page
 * @see FR23-FR26 in PRD
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';
import type { Browser, Page } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

test.describe('Ranked Matchmaking', () => {
  // Serial per project: each test holds the single PHP worker and the
  // engine's single event loop for the whole simulation (same rationale as
  // practice-match.spec). CI runs workers:1.
  test.describe.configure({ mode: 'serial' });

  /**
   * Register a user, give it a complete lineup (5 StarterAI slots) and mark
   * the tactic ready through the API. Returns token + tactic for asserts.
   */
  const createReadyFighter = async (
    deps: {
      userFactory: {
        createAuthenticated: (overrides?: { name: string }) => Promise<{ token: string }>;
      };
      scriptFactory: { createStarter: (token: string) => Promise<{ id: string }> };
      matchFactory: {
        createTactic: (params: { token: string; scriptIds: string[] }) => Promise<{ id: string }>;
      };
      apiContext: APIRequestContext;
    },
    name?: string
  ): Promise<{ token: string; tacticId: string }> => {
    const user = await deps.userFactory.createAuthenticated(name ? { name } : {});
    const script = await deps.scriptFactory.createStarter(user.token!);
    const tactic = await deps.matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    const ready = await deps.apiContext.put(`tactics/${tactic.id}`, {
      data: { is_ready: true },
      headers: { Authorization: `Bearer ${user.token}` },
    });
    if (!ready.ok()) {
      throw new Error(`Failed to mark tactic ready: ${ready.status()}`);
    }

    return { token: user.token!, tacticId: tactic.id };
  };

  const openPlayPage = async (browser: Browser, token: string): Promise<Page> => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedAuthToken(page, token);
    await page.goto('/play');
    await expect(page.getByTestId('play-hero')).toBeVisible();
    return page;
  };

  const openChooser = async (browser: Browser, token: string): Promise<Page> => {
    const page = await openPlayPage(browser, token);
    await page.getByTestId('ranked-open-button').click();
    await expect(page.getByTestId('ranked-view')).toBeVisible();
    return page;
  };

  test('challenge flow: hero opens the chooser, the challenge settles in a result card, the match opens in the viewer', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // Two fighters, both ready. B plays in the browser; A is OFFLINE.
    const a = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });
    const b = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });

    const pageB = await openChooser(browser, b.token);

    // My fighter select lists the ready tactic
    const fighterSelect = pageB.getByTestId('ranked-fighter-select');
    await expect(fighterSelect).toBeVisible();
    await expect(fighterSelect).toContainText('Formation');

    // The pool lists the offline player's ready tactic
    const opponentRow = pageB.getByTestId('ranked-opponent-row').first();
    await expect(opponentRow).toBeVisible();
    await expect(opponentRow).toContainText('Formation');

    // Challenge — the simulation runs in the request
    await opponentRow.getByTestId('ranked-challenge-button').click();

    const simulating = pageB.getByTestId('ranked-simulating-banner');
    await expect(simulating).toBeVisible();

    const result = pageB.getByTestId('result-card');
    await expect(result).toBeVisible({ timeout: 120000 });
    await expect(pageB.getByTestId('result-outcome')).toHaveText(/Victoire|Défaite|Match nul/);
    await expect(pageB.getByTestId('result-score')).toContainText(/\d+ – \d+/);

    // Story 7.6 AC #3: "Revoir le match" opens the /match/:id viewer
    await pageB.getByTestId('result-watch-replay-button').click();
    await expect(pageB).toHaveURL(/\/match\/[0-9a-f-]{36}/);
    await expect(pageB.getByTestId('field-canvas')).toBeVisible();
    await expect(pageB.getByTestId('score-display')).toBeVisible({ timeout: 30000 });

    // The offline opponent: their history holds the match and their tactic
    // record moved (story 4.2 AC #4)
    const historyA = await apiContext.get('matches', {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    expect(historyA.ok()).toBeTruthy();
    const historyBody = (await historyA.json()) as { data: { mode: string; status: string }[] };
    expect(historyBody.data).toHaveLength(1);
    expect(historyBody.data[0].mode).toBe('ranked');
    expect(historyBody.data[0].status).toBe('completed');

    const tacticsA = await apiContext.get('tactics', {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    const tacticsABody = (await tacticsA.json()) as {
      elo: number;
      wins: number;
      losses: number;
      isReady: boolean;
    }[];
    expect(tacticsABody[0].elo).not.toBe(1000);
    expect(tacticsABody[0].wins + tacticsABody[0].losses).toBe(1);
    expect(tacticsABody[0].isReady).toBe(true);

  });

  test('empty pool: the chooser says no opponents are ready', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // A single player: only their own ready tactic exists — the pool is empty
    const solo = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });

    const page = await openChooser(browser, solo.token);

    // Story 4.3 AC #4: the empty state
    await expect(page.getByTestId('ranked-empty-opponents')).toBeVisible();
  });

  test('history flow: the loser reads their row on /play and watches the replay in the viewer (story 4.4)', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // A deliberately weak (idle scripts) and OFFLINE, B plays in the browser.
    // A losing is the point: the history must show their defeat AND the
    // replay must open for them (the both-sides fix in show()/frames()).
    const a = await userFactory.createAuthenticated({ name: 'HistoryLoserA' });
    const idleScript = await scriptFactory.create({
      name: 'IdleAI',
      code: 'function update(game) {\n  game.me.stop();\n}',
      token: a.token!,
    });
    const idleTactic = await matchFactory.createTactic({
      token: a.token!,
      scriptIds: [idleScript.id, idleScript.id, idleScript.id, idleScript.id, idleScript.id],
      name: 'Idle Formation',
    });
    const ready = await apiContext.put(`tactics/${idleTactic.id}`, {
      data: { is_ready: true },
      headers: { Authorization: `Bearer ${a.token}` },
    });
    if (!ready.ok()) {
      throw new Error(`Failed to mark tactic ready: ${ready.status()}`);
    }

    const b = await createReadyFighter(
      { userFactory, scriptFactory, matchFactory, apiContext },
      'HistoryWinnerB'
    );

    // B challenges A's idle fighter SPECIFICALLY (earlier tests left other
    // ready tactics in the shared pool)
    const pageB = await openChooser(browser, b.token);
    await pageB
      .locator(`[data-testid="ranked-opponent-row"][data-opponent-id="${idleTactic.id}"]`)
      .getByTestId('ranked-challenge-button')
      .click();
    await expect(pageB.getByTestId('result-card')).toBeVisible({ timeout: 120000 });

    // A opens /play: their history shows the match from THEIR side
    const pageA = await openPlayPage(browser, a.token);

    const row = pageA.getByTestId('history-row').first();
    await expect(row).toBeVisible({ timeout: 120000 });
    await expect(row.getByTestId('history-outcome')).toHaveText('D');
    await expect(row.getByTestId('history-score')).toHaveText(/\d+ – \d+/);
    await expect(row.getByTestId('history-points')).toHaveText(/-\d+/);

    // Story 7.6 AC #3: the row offers "Revoir" → the match viewer
    await row.getByTestId('history-watch-button').click();
    await expect(pageA).toHaveURL(/\/match\/[0-9a-f-]{36}/);
    await expect(pageA.getByTestId('field-canvas')).toBeVisible();
    await expect(pageA.getByTestId('score-display')).toBeVisible({ timeout: 30000 });
    await expect(pageA.getByTestId('score-display')).toHaveText(/\d+ — \d+/);

  });

  test('practice from the lobby: "Test vs Bot" simulates and lands in the viewer', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // The synchronous simulate POST runs a full engine sim in one request
    // and blows the 60s default on a starved CI runner (the URL wait below
    // already budgets 120s) — this test owns a 180s ceiling.
    test.setTimeout(180_000);
    const solo = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });

    const page = await openPlayPage(browser, solo.token);

    // The sun button on the hero (best ready tactic = the only one)
    await page.getByTestId('practice-start-button').click();

    // Simulating veil while the synchronous POST runs
    await expect(page.getByTestId('practice-simulating-overlay')).toBeVisible();

    await expect(page).toHaveURL(/\/match\/[0-9a-f-]{36}/, { timeout: 120000 });
    await expect(page.getByTestId('field-canvas')).toBeVisible();
    await expect(page.getByTestId('score-display')).toBeVisible({ timeout: 30000 });

    // The practice match exists in the history
    const matches = await apiContext.get('matches', {
      headers: { Authorization: `Bearer ${solo.token}` },
    });
    const body = (await matches.json()) as { data: { mode: string; status: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].mode).toBe('practice');
    expect(body.data[0].status).toBe('completed');
  });

  test('no-ready lobby: the hero explains and sends the player to Équipes', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // A tactic exists but is NOT ready: the lobby must not offer dead CTAs
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.createStarter(user.token!);
    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    const page = await openPlayPage(browser, user.token);

    await expect(page.getByTestId('no-ready-state')).toBeVisible();
    await expect(page.getByTestId('no-ready-text')).toContainText('Aucune équipe prête');
    await expect(page.getByTestId('ranked-open-button')).toHaveCount(0);
    await expect(page.getByTestId('practice-start-button')).toHaveCount(0);

    await page.getByTestId('go-to-teams-button').click();
    await expect(page).toHaveURL(/\/teams/);
  });
});
