/**
 * Public Leaderboard E2E Tests (Epic 4 v2, story 4.5)
 *
 * The ranked board against the real stack (Laravel API + Node engine):
 * after one real settled match the leaderboard ranks both fighters by
 * their moved elo, exposes the server-computed rank + owner + name +
 * record on each row, and highlights the viewer's own tactics.
 *
 * The simulation is REAL (same engine-backed setup as ranked-matchmaking
 .spec): the test allows the engine's simulation budget.
 *
 * @see Epic 4 v2: Ranked Competition — Public Leaderboard
 * @see Story 4.5: AC #1 (ranked census), #2 (my tactics highlighted)
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';
import type { Page } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

test.describe('Public Leaderboard', () => {
  // Serial per project: the match holds the single PHP worker and the
  // engine's single event loop for the whole simulation (same rationale as
  // ranked-matchmaking.spec). CI runs workers:1.
  test.describe.configure({ mode: 'serial' });

  /**
   * Register a user (FIXED name — the e2e DB is migrate:fresh per run),
   * give it a complete lineup (5 StarterAI slots) and mark the tactic
   * ready through the API. Returns token + tactic for asserts.
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
    name: string
  ): Promise<{ token: string; tacticId: string }> => {
    const user = await deps.userFactory.createAuthenticated({ name });
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

  const openLeaderboard = async (browser: import('@playwright/test').Browser, token: string): Promise<Page> => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedAuthToken(page, token);
    await page.goto('/classement');
    await expect(page.getByTestId('leaderboard-view')).toBeVisible();
    return page;
  };

  test('a settled match ranks both fighters, with mine highlighted (AC #1 + #2)', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    const a = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext }, 'LeaderA');
    const b = await createReadyFighter({ userFactory, scriptFactory, matchFactory, apiContext }, 'LeaderB');

    // Settle ONE real match via API as B (synchronous simulation). B is the
    // challenger; A's ready tactic is the only pool opponent. An equal-elo
    // draw would not move the ratings apart — replay the rare draw.
    let result: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await apiContext.post('matchmaking/quick', {
        data: { tactic_id: b.tacticId },
        headers: { Authorization: `Bearer ${b.token}` },
        timeout: 120000,
      });
      expect(response.ok(), `quick match failed: ${response.status()}`).toBeTruthy();
      result = ((await response.json()) as { result: string | null }).result;
      if (result === 'challenger_win' || result === 'opponent_win') break;
    }
    expect(['challenger_win', 'opponent_win']).toContain(result);

    // Who won? The winner pocketed +25, the loser -25 (equal ratings) —
    // fetch A's record to tell the two rows apart.
    const tacticsResponse = await apiContext.get('tactics', {
      headers: { Authorization: `Bearer ${a.token}` },
    });
    if (!tacticsResponse.ok()) {
      throw new Error(`tactics fetch failed: ${tacticsResponse.status()}`);
    }
    const tacticsA = (await tacticsResponse.json()) as { id: string; elo: number }[];
    const aTactic = tacticsA.find((tactic) => tactic.id === a.tacticId);
    if (!aTactic) {
      throw new Error(`tactic ${a.tacticId} missing from GET /tactics response`);
    }
    const aWon = aTactic.elo > 1000;
    const winnerId = aWon ? a.tacticId : b.tacticId;
    const loserId = aWon ? b.tacticId : a.tacticId;

    // Open the app as A and navigate to the leaderboard
    const page = await openLeaderboard(browser, a.token);

    // AC #1: both fighters on the board (≥2 rows — the full-suite DB also
    // carries tactics left by earlier specs; the census never hides them)
    const rowA = page.locator(`[data-testid="leaderboard-row"][data-tactic-id="${a.tacticId}"]`);
    const rowB = page.locator(`[data-testid="leaderboard-row"][data-tactic-id="${b.tacticId}"]`);
    await expect(rowA).toHaveCount(1);
    await expect(rowB).toHaveCount(1);

    // The winner ranks above the loser (elo moved apart): compare their
    // positions in the payload order — the client never re-sorts
    const boardIds = await page.getByTestId('leaderboard-row').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-tactic-id'))
    );
    const winnerPos = boardIds.indexOf(winnerId);
    const loserPos = boardIds.indexOf(loserId);
    expect(winnerPos).toBeGreaterThanOrEqual(0);
    expect(loserPos).toBeGreaterThanOrEqual(0);
    expect(winnerPos).toBeLessThan(loserPos);

    // Each fighter row: numeric rank, owner text, elo · W-L record
    for (const row of [rowA, rowB]) {
      await expect(row.getByTestId('leaderboard-rank')).toHaveText(/#\d+/);
      await expect(row.getByTestId('leaderboard-owner')).toHaveText(/Leader[AB]/);
      await expect(row.getByTestId('leaderboard-record')).toHaveText(/\d+ · \d+-\d+/);
    }

    // AC #2: A's own tactic carries the You badge, B's does not
    await expect(rowA.getByTestId('leaderboard-you')).toHaveText('You');
    await expect(rowB.getByTestId('leaderboard-you')).toHaveCount(0);

    // Back to the teams editor via the appbar (routes replaced the overlay)
    await page.getByTestId('nav-teams').click();
    await expect(page.getByTestId('leaderboard-view')).not.toBeVisible();
    await expect(page.getByTestId('field-canvas')).toBeVisible();
  });
});
