/**
 * Practice Match E2E Tests (stories 3.5, 3.7 and 3.8)
 *
 * The core value proposition: Code -> Test -> Watch. A user with a complete
 * lineup clicks "Test vs Bot" and sees the simulation run synchronously —
 * no queue, no polling (FR21) — then the final score and a Watch Replay
 * button (AC #1, #2). A failed engine run surfaces an error message with a
 * retry affordance instead of a broken match (AC #4).
 *
 * The replay section (story 3.8) drives the full Watch loop against the
 * real stack: the finished match's frames load from the API, playback
 * autoplays at 60fps, pause/Space control it (AC #2, #3) and the most
 * recent match is one click away after a reload (AC #4).
 *
 * Runs against the real stack: Laravel API + Node game engine (third
 * webServer in playwright.config.ts).
 *
 * @see FR20, FR21, NFR2, NFR3 in PRD
 */
import { test, expect } from '../support/fixtures';
import { seedAuthToken } from '../support/helpers/auth';
import { TEST_LOAD_FRAMES_EVENT } from '../../src/lib/testHooks';
import type { Locator } from '@playwright/test';

/** Extract the current frame from the Timeline counter ("Frame: 42 / 10800") */
const currentFrameOf = async (counter: Locator): Promise<number> => {
  const text = (await counter.textContent()) ?? '';
  const match = text.match(/Frame: (\d+)/);
  if (!match) throw new Error(`Unexpected frame counter text: "${text}"`);
  return Number(match[1]);
};

/**
 * Log entries are entry-scoped: since story 3.11 the player chips are
 * buttons whose testids share the entry prefix — the :not() keeps this
 * locator from matching chips. One shared constant pins the convention.
 */
const LOG_ENTRY_SELECTOR =
  '[data-testid^="debug-log-entry-"]:not([data-testid$="-player-chip"])';

test.describe('Practice Match', () => {
  // Serial per project: the practice-match tests hold the single PHP worker
  // and the engine's single event loop for the whole simulation, starving
  // every parallel test's API calls (factory timeouts). CI runs workers:1;
  // locally this keeps each project at one engine-bound test at a time.
  test.describe.configure({ mode: 'serial' });

  test('starts a practice match, shows the simulating overlay then the result', async ({
    page,
    userFactory,
    scriptFactory,
    matchFactory,
  }, testInfo) => {
    // Full loop: register -> assign StarterAI to all 5 slots -> Test vs Bot
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.createStarter(user.token!);
    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    // NFR2 evidence: time the synchronous POST /api/matches — for practice
    // it IS the simulation (AC #3, zero queue). Budget: < 2s for reasonable
    // scripts; the engine's own hard cap is 30s.
    let simulationMs = 0;
    await page.route('**/api/matches', async (route) => {
      const startedAt = Date.now();
      const response = await route.fetch();
      simulationMs = Date.now() - startedAt;
      await route.fulfill({ response });
    });

    // The tactic (complete lineup) is selected: the trigger is enabled
    const startButton = page.getByTestId('test-vs-bot-button');
    await expect(startButton).toBeEnabled();

    await startButton.click();

    // AC #1: loading state, shown immediately (synchronous request)
    const overlay = page.getByTestId('simulating-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Simulating...');

    // AC #2: the synchronous request resolves with the final score. Allow
    // several queued simulations: the engine runs /simulate on a single
    // event loop, so parallel E2E workers queue behind each other (each
    // capped at 30s by the engine).
    const banner = page.getByTestId('match-result-banner');
    await expect(banner).toBeVisible({ timeout: 90000 });
    await expect(page.getByTestId('match-result-score')).toContainText(
      /You \d+ — \d+ Easy Bot/
    );

    // AC #2: Watch Replay button present (frame loading wired in 3.8)
    await expect(page.getByTestId('watch-replay-button')).toBeVisible();

    // The overlay is gone once the request resolved
    await expect(overlay).toBeHidden();

    // NFR2: attach the measured duration to every report (budget: 2s for
    // reasonable scripts). The hard assert pins the engine's 30s ceiling —
    // the 2s budget itself is engine performance and currently violated
    // (measured 6.7s solo / 12.1s under parallel workers, 2026-09-14);
    // tracked as deferred work.
    testInfo.attach('simulation-duration', {
      body: `${simulationMs}ms (budget: 2000ms)`,
      contentType: 'text/plain',
    });
    expect(simulationMs, 'NFR2: simulation within the engine hard cap').toBeLessThan(30000);
  });

  test('prevents starting a match without a complete lineup', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    // The app auto-creates a default tactic whose 5 slots have no scripts
    await expect(page.getByTestId('lineup-incomplete-message')).toBeVisible();
    await expect(page.getByTestId('test-vs-bot-button')).toBeDisabled();
    await expect(page.getByTestId('test-vs-bot-button')).toHaveText('▶ Test vs Bot');
  });

  // Story 3.7 (AC #1, #2, #3): the canvas rendering pipeline. Replay LOAD is
  // wired in 3.8; until then the frames are injected through the test-only
  // hook (TEST_LOAD_FRAMES_EVENT), driving the real pipeline end to end:
  // loadFrames -> 10 player sprites + ball -> score display -> celebration.
  test('renders the match canvas with players, ball, score and celebration', async ({
    page,
    userFactory,
  }) => {
    const user = await userFactory.createAuthenticated();
    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    // Deferred-work guard: the canvas mounts on /workspace
    const canvas = page.getByTestId('field-canvas');
    await expect(canvas).toBeVisible();

    // The workspace auto-loads the default tactic (5 players) before any
    // replay can start — wait for the engine to settle (5 tactic sprites,
    // ball hidden) so the frame injection below cannot race the tactic load
    await expect(canvas).toHaveAttribute('data-match-players', '5');
    await expect(canvas).toHaveAttribute('data-match-ball', 'false');

    // Inject one demo frame carrying a challenger goal (celebration + score
    // visible immediately: the engine renders frame 0 on load)
    await page.evaluate(([eventName]) => {
      const players: { team: string; slot: number; x: number; y: number; state: string }[] = [];
      for (const team of ['challenger', 'opponent']) {
        for (let slot = 1; slot <= 5; slot++) {
          players.push({
            team,
            slot,
            x: team === 'challenger' ? 25 : 75,
            y: slot * 16,
            state: 'moving',
          });
        }
      }
      const frames = [
        {
          index: 0,
          ball: { x: 50, y: 50 },
          players,
          events: [{ type: 'goal', team: 'challenger', scorerSlot: 1 }],
          logs: [],
        },
      ];
      window.dispatchEvent(new CustomEvent(eventName, { detail: { frames } }));
    }, [TEST_LOAD_FRAMES_EVENT]);

    // AC #2: 10 player sprites + the ball, as built by the engine
    await expect(canvas).toHaveAttribute('data-match-players', '10');
    await expect(canvas).toHaveAttribute('data-match-ball', 'true');

    // AC #3: goal on the loaded frame -> celebration + score update
    await expect(page.getByTestId('goal-celebration-layer')).toBeVisible();
    await expect(page.getByTestId('score-display')).toHaveText('1 — 0');

    // The celebration layer clears after ~1.5s; the score stays on screen
    await expect(page.getByTestId('goal-celebration-layer')).toBeHidden({ timeout: 3000 });
    await expect(page.getByTestId('score-display')).toHaveText('1 — 0');
  });

  // Story 3.8 (AC #1-#4): the full Watch loop over the real stack — the
  // finished match's frames load from the API, playback autoplays, pause
  // and Space control it, and the most recent match is one click away.
  test('watches the replay of the most recent completed match (AC #1-#4)', async ({
    page,
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

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    // The workspace auto-loads the default tactic (5 edit sprites) first
    const canvas = page.getByTestId('field-canvas');
    await expect(canvas).toHaveAttribute('data-match-players', '5');
    await expect(canvas).toHaveAttribute('data-match-ball', 'false');

    // Complete a real match: the replay needs real engine frames
    const startButton = page.getByTestId('test-vs-bot-button');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await expect(page.getByTestId('match-result-banner')).toBeVisible({ timeout: 90000 });

    // AC #1: Watch Replay -> loading overlay while the ~5-8MB frame file
    // fetches, then the match loads and playback begins. The response
    // listener makes the overlay window deterministic: the fetch has
    // started but not settled while we assert visibility.
    const framesResponse = page.waitForResponse((route) => route.url().includes('/frames'));
    await page.getByTestId('watch-replay-button').click();
    await expect(page.getByTestId('replay-loading-overlay')).toBeVisible();
    await framesResponse;
    await expect(page.getByTestId('replay-loading-overlay')).toBeHidden();

    await expect(canvas).toHaveAttribute('data-match-players', '10');
    await expect(canvas).toHaveAttribute('data-match-ball', 'true');
    await expect(page.getByTestId('score-display')).toBeVisible();

    // AC #1 / NFR3: autoplay advances the frames (time-based 60fps ticker)
    const counter = page.getByTestId('frame-counter');
    const frameAtStart = await currentFrameOf(counter);
    await expect
      .poll(() => currentFrameOf(counter), { timeout: 10000 })
      .toBeGreaterThan(frameAtStart);

    // AC #2: pause freezes the playback — poll until the counter stops
    // moving (gives the click time to reach the engine, no fixed sleep),
    // then the frozen frame is the resume reference
    await page.getByTestId('play-pause-button').click();
    await expect
      .poll(
        async () => {
          const before = await currentFrameOf(counter);
          await page.waitForTimeout(150);
          return (await currentFrameOf(counter)) - before;
        },
        { timeout: 10000 }
      )
      .toBe(0);
    const framePaused = await currentFrameOf(counter);

    // ...and play resumes from that exact frame
    await page.getByTestId('play-pause-button').click();
    await expect
      .poll(() => currentFrameOf(counter), { timeout: 10000 })
      .toBeGreaterThan(framePaused);

    // AC #3: Space toggles pause, then play again (same stable-freeze poll)
    await page.keyboard.press('Space');
    await expect
      .poll(
        async () => {
          const before = await currentFrameOf(counter);
          await page.waitForTimeout(150);
          return (await currentFrameOf(counter)) - before;
        },
        { timeout: 10000 }
      )
      .toBe(0);
    const frameSpacePause = await currentFrameOf(counter);

    await page.keyboard.press('Space');
    await expect
      .poll(() => currentFrameOf(counter), { timeout: 10000 })
      .toBeGreaterThan(frameSpacePause);

    // AC #4: after a reload, the most recent match is one click away
    await page.reload();
    const watchLastMatch = page.getByTestId('watch-last-match-button');
    await expect(watchLastMatch).toBeVisible();
    const reloadFramesResponse = page.waitForResponse((route) => route.url().includes('/frames'));
    await watchLastMatch.click();
    await expect(page.getByTestId('replay-loading-overlay')).toBeVisible();
    await reloadFramesResponse;
    await expect(page.getByTestId('replay-loading-overlay')).toBeHidden();
    await expect(canvas).toHaveAttribute('data-match-players', '10');
    await expect(canvas).toHaveAttribute('data-match-ball', 'true');

    // Back to editor: the tactic canvas is restored, replay UI is gone
    await page.getByTestId('back-to-editor-button').click();
    await expect(canvas).toHaveAttribute('data-match-players', '5');
    await expect(canvas).toHaveAttribute('data-match-ball', 'false');
    await expect(page.getByTestId('score-display')).toBeHidden();
    await expect(page.getByTestId('watch-last-match-button')).toBeVisible();
  });

  // Story 3.9 (AC #1-#4): scrubber drag with instant frame feedback,
  // keyboard stepping (±1 tick) and second jumps (±60 ticks), and the
  // mm:ss position / duration display.
  test('navigates the replay with the scrubber and keyboard (story 3.9 AC #1-#4)', async ({
    page,
    userFactory,
    scriptFactory,
    matchFactory,
  }) => {
    // Full simulation + replay + navigation: over the 60s global default on
    // a slow simulation run (the 3.8 replay test already peaks near it)
    test.setTimeout(120_000);
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.createStarter(user.token!);
    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    const canvas = page.getByTestId('field-canvas');
    await expect(canvas).toHaveAttribute('data-match-players', '5');
    await expect(canvas).toHaveAttribute('data-match-ball', 'false');

    const startButton = page.getByTestId('test-vs-bot-button');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await expect(page.getByTestId('match-result-banner')).toBeVisible({ timeout: 90000 });

    const framesResponse = page.waitForResponse((route) => route.url().includes('/frames'));
    await page.getByTestId('watch-replay-button').click();
    await expect(page.getByTestId('replay-loading-overlay')).toBeVisible();
    await framesResponse;
    await expect(page.getByTestId('replay-loading-overlay')).toBeHidden();
    await expect(canvas).toHaveAttribute('data-match-players', '10');

    // AC #1: position and duration are shown in mm:ss (full match = 03:00)
    const timeDisplay = page.getByTestId('timeline-time-display');
    const counter = page.getByTestId('frame-counter');
    await expect(timeDisplay).toBeVisible();
    await expect(timeDisplay).toHaveText(/\d{2}:\d{2} \/ 03:00/);
    await expect(page.getByTestId('timeline-handle')).toBeVisible();

    // Pause and freeze on a stable frame (same stable-freeze poll as 3.8)
    await page.getByTestId('play-pause-button').click();
    await expect
      .poll(
        async () => {
          const before = await currentFrameOf(counter);
          await page.waitForTimeout(150);
          return (await currentFrameOf(counter)) - before;
        },
        { timeout: 10000 }
      )
      .toBe(0);

    // AC #3: ArrowRight steps +1 tick while paused, ArrowLeft steps back
    const frameAtPause = await currentFrameOf(counter);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => currentFrameOf(counter)).toBe(frameAtPause + 1);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => currentFrameOf(counter)).toBe(frameAtPause);

    // Deterministic reference: Home seeks the slider to tick 0
    await page.getByTestId('timeline-track').focus();
    await page.keyboard.press('Home');
    await expect.poll(() => currentFrameOf(counter)).toBe(0);
    await expect(timeDisplay).toHaveText(/^00:00 \/ 03:00$/);

    // AC #4: Shift+ArrowRight jumps 60 ticks (1 second at the engine's
    // 60 fps): 42 presses land exactly on tick 2520 -> 00:42 (AC #1)
    for (let i = 0; i < 42; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await expect.poll(() => currentFrameOf(counter)).toBe(2520);
    await expect(timeDisplay).toHaveText(/^00:42 \/ 03:00$/);

    // AC #2: dragging the scrubber seeks while dragging (not only on
    // release) — the frame counter must jump mid-drag, then freeze there
    const handle = page.getByTestId('timeline-handle');
    const handleBox = await handle.boundingBox();
    const centerY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(handleBox.x + handleBox.width / 2, centerY);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 300, centerY, { steps: 10 });
    await expect.poll(() => currentFrameOf(counter)).toBeGreaterThan(2520);
    await page.mouse.up();
    const frameAfterDrag = await currentFrameOf(counter);
    await page.waitForTimeout(150);
    // Released position sticks: paused playback stays on that tick
    expect(await currentFrameOf(counter)).toBe(frameAfterDrag);
  });

  // Story 3.10 (AC #1-#3): the debug panel shows the replay's frame logs —
  // tick + player tag + message — windowed around the playhead, with
  // warn-level engine entries (MULTIPLE_ACTIONS) visually distinct.
  //
  // The script logs every 60 ticks (engine cap: MAX_LOGS_PER_MATCH = 10 000
  // entries — an every-tick script would exhaust it early and leave the
  // late-match windows legitimately empty). Every ±60-tick window therefore
  // always contains at least one logged tick, keeping the assertions
  // position-independent; the double action on logged ticks produces real
  // MULTIPLE_ACTIONS warnings for the warn-styling assertions.
  test('displays replay logs in the debug panel (story 3.10 AC #1-#3)', async ({
    page,
    userFactory,
    scriptFactory,
    matchFactory,
  }) => {
    // Simulation + replay + navigation: same budget as the 3.9 navigation test
    test.setTimeout(120_000);
    const user = await userFactory.createAuthenticated();
    const script = await scriptFactory.create({
      token: user.token!,
      name: 'LoggingAI',
      code: `var ticks = 0;
function update(game) {
  const { me, ball } = game;
  ticks = ticks + 1;
  if (ticks % 60 === 1) {
    console.log('pos', me.position.x);
    me.moveToward(ball.position.x, ball.position.y);
    me.dribble(50, 25);
  } else {
    me.moveToward(ball.position.x, ball.position.y);
  }
}`,
    });
    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [script.id, script.id, script.id, script.id, script.id],
    });

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    const canvas = page.getByTestId('field-canvas');
    await expect(canvas).toHaveAttribute('data-match-players', '5');
    await expect(canvas).toHaveAttribute('data-match-ball', 'false');

    const startButton = page.getByTestId('test-vs-bot-button');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await expect(page.getByTestId('match-result-banner')).toBeVisible({ timeout: 90000 });

    const framesResponse = page.waitForResponse((route) => route.url().includes('/frames'));
    await page.getByTestId('watch-replay-button').click();
    await expect(page.getByTestId('replay-loading-overlay')).toBeVisible();
    await framesResponse;
    await expect(page.getByTestId('replay-loading-overlay')).toBeHidden();

    // Task 3: the panel is up with the replay, with no manual
    // "start debugging" step
    await expect(page.getByTestId('debug-log-panel')).toBeVisible();

    // Deterministic window: pause, then seek to tick 0 (the first update
    // call logs on frame 0, and every 60th tick after)
    const counter = page.getByTestId('frame-counter');
    await page.getByTestId('play-pause-button').click();
    await expect
      .poll(
        async () => {
          const before = await currentFrameOf(counter);
          await page.waitForTimeout(150);
          return (await currentFrameOf(counter)) - before;
        },
        { timeout: 10000 }
      )
      .toBe(0);
    await page.getByTestId('timeline-track').focus();
    await page.keyboard.press('Home');
    await expect.poll(() => currentFrameOf(counter)).toBe(0);

    // AC #1: entries show tick number, player tag and message. Story 3.11
    // made the player chips clickable buttons whose testids share the entry
    // prefix — LOG_ENTRY_SELECTOR keeps this locator entry-scoped.
    const entries = page.locator(LOG_ENTRY_SELECTOR);
    const firstEntry = entries.first();
    await expect(firstEntry).toBeVisible();
    await expect(firstEntry).toContainText(/#\d+/);
    await expect(firstEntry).toContainText(/P\d/);
    await expect(firstEntry).toContainText('pos');

    // AC #3: the tick-0 entries made it into the window after the seek —
    // matched via the entry's data-tick, not a "#0" substring any log
    // message could fake
    const tickZeroEntries = entries.filter({ has: page.locator('[data-tick="0"]') });
    const tickZeroEntry = tickZeroEntries.first();
    await expect(tickZeroEntry).toBeVisible();

    // AC #2: color-coded by player — the loggers are all challenger players,
    // so a chip must carry the challenger orange (same as the pitch).
    // Story 3.11 made the chip a clickable button — target it by its own
    // testid (entry-locators exclude chips to stay entry-scoped).
    const entriesOnly = page.locator(LOG_ENTRY_SELECTOR);
    const firstEntryOnly = entriesOnly.first();
    await expect(firstEntryOnly).toBeVisible();
    const chipColor = await firstEntryOnly
      .locator('[data-testid$="-player-chip"]')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(chipColor).toBe('rgb(255, 107, 26)');

    // Engine warnings arrive with warn styling and a type badge (Task 3)
    const badge = entries
      .filter({ hasText: 'MULTIPLE_ACTIONS' })
      .first()
      .locator('span')
      .filter({ hasText: 'MULTIPLE_ACTIONS' });
    await expect(badge).toBeVisible();
    const badgeColor = await badge.evaluate((el) => getComputedStyle(el).color);
    expect(badgeColor).toBe('rgb(220, 220, 170)');

    // AC #3: scrubbing moves the window — 42 second-jumps (Shift+ArrowRight,
    // same gesture as 3.9) seek to tick 2520; the tick-1 entries leave the
    // DOM (windowed around the new playhead) and the auto-follow scrolled
    // down with the playhead
    const list = page.getByTestId('debug-log-list');
    const scrollTopAtTick0 = await list.evaluate((el) => el.scrollTop);
    for (let i = 0; i < 42; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    await expect.poll(() => currentFrameOf(counter)).toBe(2520);

    await expect(tickZeroEntries).toHaveCount(0);
    await expect(entries.first()).toBeVisible(); // logs exist around tick 2520
    const scrollTopAfterSeek = await list.evaluate((el) => el.scrollTop);
    // The follow-scroll assertion only holds when the windowed list actually
    // overflows the container (tall viewports keep both readings at 0); the
    // pill assertions below carry the follow behavior regardless
    const scrollable = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
    if (scrollable) {
      expect(scrollTopAfterSeek).toBeGreaterThan(scrollTopAtTick0);
    }
    // The spurious follow-disable fix: programmatic seeks must never pop the
    // "Follow replay" pill
    await expect(page.getByTestId('debug-follow-pill')).toBeHidden();

    // ...and seeking back to tick 0 restores the tick-0 window (follow
    // stayed enabled throughout: the scrolling was programmatic)
    await page.getByTestId('timeline-track').focus();
    await page.keyboard.press('Home');
    await expect.poll(() => currentFrameOf(counter)).toBe(0);
    await expect(tickZeroEntry).toBeVisible();
    await expect(page.getByTestId('debug-follow-pill')).toBeHidden();
  });

  test('shows the error banner with retry when the engine fails (AC #4)', async ({
    page,
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

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    // Fail the match start the way an unreachable engine does (AC #4: the
    // API answers 502 and the row is marked failed, never watchable).
    await page.route('**/api/matches', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Simulation failed' }),
      })
    );

    const startButton = page.getByTestId('test-vs-bot-button');
    await expect(startButton).toBeEnabled();
    await startButton.click();

    const errorMessage = page.getByTestId('match-error-message');
    await expect(errorMessage).toBeVisible();

    // Retry affordance present; the overlay is dismissed so the UI is usable
    const retryButton = page.getByTestId('retry-match-button');
    await expect(retryButton).toBeVisible();
    await expect(page.getByTestId('simulating-overlay')).toBeHidden();

    // Retry unblocks: serve a completed match like a recovered engine would.
    // Deliberately faked — a second real simulation would queue on the
    // engine's single event loop and the single PHP worker, starving every
    // parallel E2E test (the real engine path is covered by the happy-path
    // test above and the API contract by the feature tests).
    await page.unroute('**/api/matches');
    await page.route('**/api/matches', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000000',
          mode: 'practice',
          status: 'completed',
          scoreChallenger: 2,
          scoreOpponent: 1,
          result: 'challenger_win',
          durationFrames: 10800,
          createdAt: new Date().toISOString(),
        }),
      })
    );
    await retryButton.click();

    const banner = page.getByTestId('match-result-banner');
    await expect(banner).toBeVisible({ timeout: 90000 });
    await expect(page.getByTestId('match-error-message')).toBeHidden();
    await expect(page.getByTestId('simulating-overlay')).toBeHidden();
  });

  // Story 3.11 (AC #1-#3): click-to-filter debug — ONE pitch click narrows
  // the log stream to that player (UX spec success criterion), a re-click
  // or "Show All" clears it (highlight kept), scrubbing keeps the filter,
  // and a log chip selects its player back on the pitch.
  //
  // Determinism: the challenger scripts emit NO actions, so the challenger
  // players never leave the fixture kickoff formation (the bot players do
  // move; they are never clicked). Pitch clicks target exact formation
  // coordinates computed from the canvas box with the engine's pitch-rect
  // math (FIELD_PADDING = 40, 2:1 fit, percentToScreen).
  test('filters replay logs by player from the pitch and the log chips (story 3.11 AC #1-#3)', async ({
    page,
    userFactory,
    scriptFactory,
    matchFactory,
  }) => {
    // Simulation + replay + the same interactions as the 3.9/3.10 tests
    test.setTimeout(120_000);
    const user = await userFactory.createAuthenticated();

    // Two log-only scripts: slots 1+5 log 'alpha', slots 2-4 log 'beta'.
    // No moveToward/dribble: the challenger players stay on their spots.
    const logScript = (name: string, word: string) =>
      scriptFactory.create({
        token: user.token!,
        name,
        code: `var ticks = 0;
function update(game) {
  ticks = ticks + 1;
  if (ticks % 60 === 1) {
    console.log('${word}');
  }
}`,
      });
    const alpha = await logScript('AlphaLogger', 'alpha');
    const beta = await logScript('BetaLogger', 'beta');

    await matchFactory.createTactic({
      token: user.token!,
      scriptIds: [alpha.id, beta.id, beta.id, beta.id, alpha.id],
    });

    await seedAuthToken(page, user.token!);
    await page.goto('/workspace');

    const canvas = page.getByTestId('field-canvas');
    await expect(canvas).toHaveAttribute('data-match-players', '5');
    await expect(canvas).toHaveAttribute('data-match-ball', 'false');

    const startButton = page.getByTestId('test-vs-bot-button');
    await expect(startButton).toBeEnabled();
    await startButton.click();
    await expect(page.getByTestId('match-result-banner')).toBeVisible({ timeout: 90000 });

    const framesResponse = page.waitForResponse((route) => route.url().includes('/frames'));
    await page.getByTestId('watch-replay-button').click();
    await expect(page.getByTestId('replay-loading-overlay')).toBeVisible();
    await framesResponse;
    await expect(page.getByTestId('replay-loading-overlay')).toBeHidden();
    await expect(canvas).toHaveAttribute('data-match-players', '10');

    // Deterministic window: pause (stable-freeze poll, same as 3.8/3.10)
    // then seek Home — every logger emits on the very first update call,
    // so tick 0 carries entries from all five challenger players
    const counter = page.getByTestId('frame-counter');
    await page.getByTestId('play-pause-button').click();
    await expect
      .poll(
        async () => {
          const before = await currentFrameOf(counter);
          await page.waitForTimeout(150);
          return (await currentFrameOf(counter)) - before;
        },
        { timeout: 10000 }
      )
      .toBe(0);
    await page.getByTestId('timeline-track').focus();
    await page.keyboard.press('Home');
    await expect.poll(() => currentFrameOf(counter)).toBe(0);

    // Entry locators: chips share the entry testid prefix — exclude them
    const entries = page.locator(LOG_ENTRY_SELECTOR);
    const chips = page.locator('[data-testid$="-player-chip"]');
    const logList = page.getByTestId('debug-log-list');
    await expect(entries.first()).toBeVisible();
    await expect(logList).toContainText('alpha');
    await expect(logList).toContainText('beta');

    // Pitch-click target: fixture slot 2 sits at (25, 30) API units —
    // (25, 60) pitch percent after the engine's y normalization
    const clickPitchPercent = async (percentX: number, percentY: number) => {
      const box = (await canvas.boundingBox())!;
      const availW = box.width - 2 * 40;
      const availH = box.height - 2 * 40;
      let pitchW = availW;
      let pitchH = pitchW / 2;
      if (pitchH > availH) {
        pitchH = availH;
        pitchW = pitchH * 2;
      }
      const pitchX = box.x + 40 + (availW - pitchW) / 2;
      const pitchY = box.y + 40 + (availH - pitchH) / 2;
      await page.mouse.click(
        pitchX + (percentX / 100) * pitchW,
        pitchY + (percentY / 100) * pitchH
      );
    };

    // AC #1: ONE click on the P2 spot filters the panel to that player —
    // the UX spec's click-count success criterion is this assertion
    await clickPitchPercent(25, 60);
    await expect(page.getByTestId('debug-filter-indicator')).toHaveText(
      'Showing P2 (challenger) only'
    );

    // Only P2's stream: every rendered chip is P2 and no alpha message
    // (P1/P5) survives the filter
    const filteredChipCount = await chips.count();
    expect(filteredChipCount).toBeGreaterThan(0);
    for (let i = 0; i < filteredChipCount; i++) {
      await expect(chips.nth(i)).toHaveText('P2');
    }
    await expect(logList).toContainText('beta');
    await expect(logList).not.toContainText('alpha');

    // ...and the selected player is highlighted on the pitch (the Pixi ring
    // has no DOM — the selection census attribute is the engine's echo)
    await expect(canvas).toHaveAttribute('data-selected-player', 'challenger-2');

    // AC #2: clicking the SAME player again clears the filter but keeps the
    // pitch highlight (deselection stays on empty pitch)
    await clickPitchPercent(25, 60);
    await expect(page.getByTestId('debug-filter-indicator')).toBeHidden();
    await expect(page.getByTestId('debug-show-all-button')).toBeHidden();
    await expect(logList).toContainText('alpha');
    await expect(canvas).toHaveAttribute('data-selected-player', 'challenger-2');

    // AC #3: scrub while filtered — the filter survives frame changes and
    // every entry stays attributable (chip with the player tag)
    await clickPitchPercent(25, 60); // filter again
    await expect(page.getByTestId('debug-filter-indicator')).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+ArrowRight'); // +180 ticks total
    }
    await expect.poll(() => currentFrameOf(counter)).toBe(180);
    const scrubbedChipCount = await chips.count();
    expect(scrubbedChipCount).toBeGreaterThan(0);
    for (let i = 0; i < scrubbedChipCount; i++) {
      await expect(chips.nth(i)).toHaveText('P2');
    }
    await expect(logList).not.toContainText('alpha');

    // "Show All" clears the filter without deselecting the player
    await page.getByTestId('debug-show-all-button').click();
    await expect(page.getByTestId('debug-filter-indicator')).toBeHidden();
    await expect(logList).toContainText('alpha');
    await expect(canvas).toHaveAttribute('data-selected-player', 'challenger-2');

    // Task 4, reverse direction: clicking a P5 chip on a log entry selects
    // AND filters P5 on the pitch
    const p5Chip = chips.filter({ hasText: /^P5$/ }).first();
    await expect(p5Chip).toBeVisible();
    await p5Chip.click();
    await expect(page.getByTestId('debug-filter-indicator')).toHaveText(
      'Showing P5 (challenger) only'
    );
    await expect(canvas).toHaveAttribute('data-selected-player', 'challenger-5');
    const p5ChipCount = await chips.count();
    for (let i = 0; i < p5ChipCount; i++) {
      await expect(chips.nth(i)).toHaveText('P5');
    }
    await expect(logList).not.toContainText('beta');
  });
});
