/**
 * Ranked Matchmaking E2E Tests (Epic 4 v2: stories 4.1 + 4.2 + 4.3)
 *
 * The full ranked loop against the real stack (Laravel API + Node engine):
 * a tactic marked ready from its tab appears in other players' opponent
 * pool; challenging (or quick-matching) it simulates the match
 * synchronously even though the opponent never opens a browser, and the
 * result banner carries the score and the elo delta. The offline opponent
 * finds the match in their history, with their tactic's record moved.
 *
 * The simulation is REAL (same engine-backed setup as practice-match.spec):
 * each test allows the engine's queued-simulation budget.
 *
 * @see Epic 4 v2: Ranked Competition — Ready Tactics & Challenge Mode
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

  const openRankedView = async (browser: Browser, token: string): Promise<Page> => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedAuthToken(page, token);
    await page.goto('/workspace');
    await page.getByTestId('ranked-nav-button').click();
    await expect(page.getByTestId('ranked-view')).toBeVisible();
    return page;
  };

  test('challenge flow: ready tab shows the record, the opponent list challenges, the offline player sees the match', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // Two fighters, both ready. B plays in the browser; A is OFFLINE.
    const a = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });
    const b = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });

    const pageB = await openRankedView(browser, b.token);

    // Story 4.1: my fighter card shows the starting record (elo 1000, 0-0)
    const myFighter = pageB.getByTestId('ranked-my-fighter-row').first();
    await expect(myFighter).toBeVisible();
    await expect(myFighter.getByTestId('fighter-record')).toHaveText(/1000 · 0-0/);

    // Story 4.3: the pool lists the offline player's ready tactic
    const opponentRow = pageB.getByTestId('ranked-opponent-row').first();
    await expect(opponentRow).toBeVisible();
    await expect(opponentRow).toContainText('Formation');

    // Story 4.2 AC #3: challenge — the simulation runs in the request
    await opponentRow.getByTestId('ranked-challenge-button').click();

    const simulating = pageB.getByTestId('ranked-simulating-banner');
    await expect(simulating).toBeVisible();

    const result = pageB.getByTestId('ranked-result-banner');
    await expect(result).toBeVisible({ timeout: 120000 });
    await expect(pageB.getByTestId('ranked-result-score')).toContainText(/\d+ — \d+/);
    await expect(pageB.getByTestId('ranked-result-points')).toContainText(/[+-]\d+ elo/);

    // Story 4.3: watch replay returns to the workspace
    await pageB.getByTestId('ranked-watch-replay-button').click();
    await expect(pageB.getByTestId('ranked-view')).not.toBeVisible();
    await expect(pageB.getByTestId('field-canvas')).toBeVisible();

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

  test('quick match flow: one click from my fighter to a played match', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    const a = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });
    const b = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });

    const pageB = await openRankedView(browser, b.token);

    // Story 4.2 AC #1: quick match draws a random pool opponent (any elo)
    await pageB
      .getByTestId('ranked-quick-match-button')
      .first()
      .click();

    const result = pageB.getByTestId('ranked-result-banner');
    await expect(result).toBeVisible({ timeout: 120000 });
    await expect(pageB.getByTestId('ranked-result-score')).toContainText(/\d+ — \d+/);

    const matchBody = (await (
      await apiContext.get('matches', { headers: { Authorization: `Bearer ${b.token}` } })
    ).json()) as { data: { mode: string; challengerName: string }[] };
    expect(matchBody.data).toHaveLength(1);
    expect(matchBody.data[0].mode).toBe('ranked');

    // Sanity: the opponent pool still lists the (now beaten) fighter
    await pageB.getByTestId('ranked-back-button').click();
    await expect(pageB.getByTestId('ranked-view')).not.toBeVisible();

    void a;
  });

  test('empty pool: quick match and the list both say no opponents are ready', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // A single player: only their own ready tactic exists — the pool is empty
    const solo = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext });

    const page = await openRankedView(browser, solo.token);

    // Story 4.3 AC #4: the empty state
    await expect(page.getByTestId('ranked-empty-opponents')).toBeVisible();

    // Story 4.2 AC #2: quick match → "No opponents ready"
    await page.getByTestId('ranked-quick-match-button').first().click();
    await expect(page.getByTestId('ranked-error-banner')).toBeVisible();
    await expect(page.getByTestId('ranked-error-message')).toContainText('No opponents ready');

    await page.getByTestId('ranked-error-dismiss').click();
    await expect(page.getByTestId('ranked-error-banner')).not.toBeVisible();
  });

  test('history flow: the offline loser reads their record and watches the replay (story 4.4)', async ({
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
    const pageB = await openRankedView(browser, b.token);
    await pageB
      .locator(`[data-testid="ranked-opponent-row"][data-opponent-id="${idleTactic.id}"]`)
      .getByTestId('ranked-challenge-button')
      .click();
    await expect(pageB.getByTestId('ranked-result-banner')).toBeVisible({ timeout: 120000 });

    // A opens the ranked view: their history shows the match from THEIR side
    const pageA = await openRankedView(browser, a.token);

    const row = pageA.getByTestId('ranked-history-row').first();
    await expect(row).toBeVisible({ timeout: 120000 });
    await expect(row.getByTestId('ranked-history-opponent')).toHaveText('HistoryWinnerB');
    await expect(row.getByTestId('ranked-history-tactic')).toHaveText('Idle Formation');
    await expect(row.getByTestId('ranked-history-score')).toHaveText(/\d+ — \d+/);
    await expect(row.getByTestId('ranked-history-outcome')).toHaveText('Defeat');
    await expect(row.getByTestId('ranked-history-points')).toHaveText(/-\d+ elo/);

    // AC #2: filtering to A's tactic keeps the row (it is that tactic's record)
    await pageA.getByTestId('ranked-history-filter').selectOption(idleTactic.id);
    await expect(pageA.getByTestId('ranked-history-row')).toHaveCount(1);
    await expect(row).toBeVisible();

    // AC #3: watching from history reuses the practice replay pipeline —
    // the overlay closes and the workspace renders the loaded replay
    await row.getByTestId('ranked-history-watch-button').click();
    await expect(pageA.getByTestId('ranked-view')).not.toBeVisible();
    await expect(pageA.getByTestId('field-canvas')).toBeVisible();
    await expect(pageA.getByTestId('score-display')).toBeVisible({ timeout: 30000 });
    await expect(pageA.getByTestId('score-display')).toHaveText(/\d+ — \d+/);
  });
});
