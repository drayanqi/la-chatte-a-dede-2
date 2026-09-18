/**
 * Ranked Queue & Matchmaking E2E Tests (story 4.1)
 *
 * Full-stack proof of the ranked loop: a user with a complete lineup
 * clicks "Queue Ranked" and sees the non-blocking "Searching for
 * opponent..." banner (AC #1). A second user joining in a separate
 * browser context pairs with them — both land on "Match found!" (AC #2).
 * Waiting alone ends in the server-enforced 30s timeout message (AC #3)
 * and Cancel leaves the queue at any time (AC #4).
 *
 * The created match is only a row (status 'pending', mode 'ranked') —
 * simulation, notifications and results are stories 4.2+; the banners
 * deliberately show no score/replay affordances.
 *
 * Runs against the real stack: Laravel API + Vite frontend (the engine is
 * never called — the queue must not simulate, deferred-work.md#61).
 *
 * @see Story 4.1: Ranked Queue & Matchmaking
 * @see FR23-FR26 in PRD
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';
import type { Browser, Page } from '@playwright/test';

test.describe('Ranked Queue', () => {
  // Serial per project: two users polling every 2s hold the single PHP
  // worker (ms-fast requests, but parallel tests would still interleave
  // with factory calls). CI runs workers:1; locally this keeps the queue
  // flows deterministic — never raise parallelism for this spec
  // (deferred-work.md#73: the shared dev stack starves under full-parallel).
  test.describe.configure({ mode: 'serial' });

  /**
   * Register a user with a complete lineup (5 StarterAI slots, same setup
   * as the practice spec) and open an authenticated workspace page in the
   * given context. Returns the page and the user (token for API asserts).
   */
  const openRankedWorkspace = async (
    browser: Browser,
    createUser: () => Promise<{ token: string }>
  ): Promise<{ page: Page; token: string }> => {
    const user = await createUser();
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedAuthToken(page, user.token);
    await page.goto('/workspace');

    // The factory tactic (complete lineup) is the only user tactic, so the
    // workspace auto-selects it and the queue button enables.
    await expect(page.getByTestId('queue-ranked-button')).toBeEnabled();

    return { page, token: user.token };
  };

  test('pairs two queued users into a ranked match (AC #1, #2)', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
    apiContext,
  }) => {
    // Two players, each with a complete lineup
    const setupUser = async () => {
      const user = await userFactory.createAuthenticated();
      const script = await scriptFactory.createStarter(user.token!);
      await matchFactory.createTactic({
        token: user.token!,
        scriptIds: [script.id, script.id, script.id, script.id, script.id],
      });
      return user;
    };

    const { page: pageA, token: tokenA } = await openRankedWorkspace(browser, setupUser);
    const { page: pageB, token: tokenB } = await openRankedWorkspace(browser, setupUser);

    // AC #1: A queues alone and sees the non-blocking searching banner
    await pageA.getByTestId('queue-ranked-button').click();
    const searchingA = pageA.getByTestId('queue-searching-banner');
    await expect(searchingA).toBeVisible();
    await expect(searchingA).toContainText('Searching for opponent...');

    // AC #4: the queue is exitable while searching (cancel affordance present)
    await expect(pageA.getByTestId('queue-cancel-button')).toBeVisible();

    // AC #2: B joins in a second context — the join response already
    // carries the created match, so B lands on "Match found!" immediately
    await pageB.getByTestId('queue-ranked-button').click();
    const matchedB = pageB.getByTestId('queue-matched-banner');
    await expect(matchedB).toBeVisible();
    await expect(matchedB).toContainText('Match found!');

    // AC #2: A discovers the pairing through the 2s poll (allowance ~5s)
    const matchedA = pageA.getByTestId('queue-matched-banner');
    await expect(matchedA).toBeVisible({ timeout: 10000 });
    await expect(matchedA).toContainText('Match found!');

    // Full-stack proof: the pairing created ONE ranked match row, pending,
    // visible to both players through the matchmaking status endpoint
    // (scope boundary: no simulation, no replay — stories 4.2+)
    const statusA = await apiContext.get('matchmaking/queue', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(statusA.ok()).toBeTruthy();
    const payloadA = await statusA.json();
    expect(payloadA.status).toBe('matched');
    expect(payloadA.match.mode).toBe('ranked');
    expect(payloadA.match.status).toBe('pending');

    // B sees the same match row
    const statusB = await apiContext.get('matchmaking/queue', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(statusB.ok()).toBeTruthy();
    const payloadB = await statusB.json();
    expect(payloadB.status).toBe('matched');
    expect(payloadB.match.id).toBe(payloadA.match.id);

    // No score/replay affordances for ranked matches (story 4.2's territory)
    await expect(pageA.getByTestId('watch-replay-button')).toHaveCount(0);
    await expect(pageB.getByTestId('watch-replay-button')).toHaveCount(0);
  });

  test('cancels the search and re-enables the queue button (AC #4)', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.createStarter(user.token!);
    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');
    await expect(page.getByTestId('queue-ranked-button')).toBeEnabled();

    await page.getByTestId('queue-ranked-button').click();
    await expect(page.getByTestId('queue-searching-banner')).toBeVisible();

    // While queued the practice flow is mutually excluded (one active flow)
    await expect(page.getByTestId('test-vs-bot-button')).toBeDisabled();

    // AC #4: Cancel removes the user from the queue
    await page.getByTestId('queue-cancel-button').click();

    await expect(page.getByTestId('queue-searching-banner')).toBeHidden();
    await expect(page.getByTestId('queue-ranked-button')).toBeEnabled();
    await expect(page.getByTestId('test-vs-bot-button')).toBeEnabled();
  });

  // The only true full-stack proof of AC #3: the 30s window is enforced
  // server-side from joined_at, so the client cannot shortcut it. The wait
  // is intentional — keep it (story 4.1 Task 9).
  test('times out alone in the queue with the AC #3 message (AC #3)', async ({
    browser,
    userFactory,
    scriptFactory,
    matchFactory,
  }) => {
    test.setTimeout(90_000);

    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.createStarter(user.token!);
    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');
    await expect(page.getByTestId('queue-ranked-button')).toBeEnabled();

    await page.getByTestId('queue-ranked-button').click();
    await expect(page.getByTestId('queue-searching-banner')).toBeVisible();

    // AC #3: no opponent within 30s (server clock) + up to one 2s poll
    // cadence of client-side lag. Generous ceiling absorbs worker jitter.
    const timeoutBanner = page.getByTestId('queue-timeout-banner');
    await expect(timeoutBanner).toBeVisible({ timeout: 45_000 });
    await expect(timeoutBanner).toContainText('No opponent found, try again later');

    // After the expiry the queue button is available again
    await expect(page.getByTestId('queue-ranked-button')).toBeEnabled();
  });
});
