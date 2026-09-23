# Deferred Work

## Deferred from: code review of stories 1.2, 1.3, 1.4, 2.1 (2026-09-11)

- **Demo-tactic canvas wiring unobserved by tests** — AppShell → async `Game.init` → `pendingTactic` queue and the unmount-during-init race have no test observation. Needs browser-level e2e (assert a `<canvas>` mounts on /workspace). Pair with the workspace e2e infra restoration.
- **Game.destroy()/init failure edges** — `isInitialized` is never reset after `destroy()` (allowing `loadTactic` to write into a destroyed instance) and a rejected `game.init()` leaves a dead game in `gameRef`. Only manifests on init failure; browser-level issue.
- **Laravel scaffold hygiene** — README is stock promo text; `lachatadede-api/vite.config.js` references a missing `resources/` dir (breaks `composer setup`); unused sail/pail deps. Cleanup when the API docs are next touched.
- **Shared API client** — fetch plumbing (API_URL, token header, `credentials: 'include'`) duplicated across 5 call sites with no central 401 handling. Introduce `apiClient` when story 2.3 adds save endpoints.
- **API Resources** — script serialization duplicated 4× in ScriptController; user array 3× in AuthController. Extract JsonResources when response shapes evolve.
- **Shared auth form component** — ~130 lines of duplicated form styles between LoginPage/RegisterPage. Extract during a UX polish pass.

## Deferred from: integration fix pass over stories 2.2–2.8 (2026-09-12)

- **Monaco bundle in main chunk** — `src/lib/monacoSetup.ts` replaced the CDN loader with the local npm bundle (fixes version mismatch: types 0.55.1 vs CDN 0.52.x, offline/CORS worker failures, and e2e flakiness). Cost: main bundle grew from ~0.5 MB to ~4.3 MB (gzip ~1.1 MB). Consider React.lazy around `MonacoEditor` to keep the bundle out of the login route.
- **Real-browser Cmd+Z unverified** — in headless Chromium, Cmd+Z is swallowed by the browser's native edit-context undo and never reaches Monaco (Ctrl+Z works). The e2e undo test tries Meta+z then falls back to Ctrl+z, so the exact user-facing keystroke is only asserted indirectly per engine. If users report broken undo, check Monaco's native edit-context integration first.
- **Gutter icons are a custom implementation** — Monaco standalone never renders marker icons in the glyph margin (Story 2.5's "Monaco displays error icons by default" claim was false). They are now drawn via marker→decoration sync in `MonacoEditor.tsx` (`syncGutterIcons`). If Monaco adds native gutter markers, this can be replaced.
- **Firefox/WebKit e2e verified locally only** — all 64 tests pass per engine locally; CI installs the same browsers, but the 4-way sharded run has never completed on GitHub's runners. If CI e2e turns out to be slow, consider scoping the workflow to chromium or sharding finer.

## Deferred from: code review of story 3-1 (2026-09-12)

- **No central 401 handling in tacticsStore** — when the bearer token expires or is revoked mid-session, every tactics action keeps failing with "Unauthenticated." (no token cleanup, no logout, no redirect) until a full page reload triggers restoreSession. Mirrors editorStore's existing caller-decides-401 pattern; decide a global auth policy once and apply it to all stores.
- **updateTactic succeeds server-side but silently no-ops locally when the id is absent from the tactics list** (e.g. after a failed fetchTactics) — `map()` finds no match, UI keeps stale data with no error. Add reconciliation (refetch or insert-on-miss) once story 3.2 defines the lineup UI's expectations.

## Deferred from: code review of panel layout feature (2026-09-12)

- **Keyboard resize for panel dividers** — dividers are pointer-only (`role="separator"` without `tabIndex`/arrow-key handling/`aria-valuenow`). Add `tabIndex={0}` + ArrowLeft/ArrowRight (±16px, Shift ±64px) mapped to resize/commit plus aria value attributes for WCAG 2.1.1 compliance.
- **Unit tests for usePanelLayout and PanelDivider** — the hook contract (commit-on-drag-end vs immediate toggle persistence, ref freshness, resize listener) and the divider interaction math (direction inversion, threshold, capture cleanup) are only exercised via browser e2e. Add `renderHook` + component tests if regressions appear.
- **E2E for load-time clamp + drag no-regression** — no e2e seeds an oversized stored width on a narrower viewport to watch it clamp on load (unit-covered only), and no e2e drags a divider then re-verifies script drag-and-drop/canvas selection/Monaco editing (AC4 is satisfied by construction, not by test).
- **Drag re-render perf** — each pointermove re-renders the whole AppShell subtree (ScriptsPanel/Monaco, DebuggerPanel, TacticsCanvas). Smooth in practice; if jank is reported on big workspaces, wrap heavy children in `React.memo` and/or coalesce moves with `requestAnimationFrame`.

## Deferred from: field aspect-ratio fix review (2026-09-12)

- **No rendered ball sprite** — `TacticData.ball` is data-only; the pitch shows no ball. The 2:1 aspect-ratio fix had nothing to scale for the ball. If a ball sprite is added later, derive its radius from the pitch rect (e.g. `computePitchRect`-based, ~0.45× player radius) so it scales with the same letterbox geometry.
- **Fixed-px goal depth and line width** — goal depth (12px) and `LINE_WIDTH` (2px) in `Field.ts` are absolute pixels while every other marking now scales with the letterboxed pitch; on very small collapsed-panel pitches goals look chunky, on very large ones they nearly vanish. Consider deriving them from pitch size (e.g. `max(4, pitch.height * 0.02)`).
- **Sprite-level unit tests for PlayerSprite** — `updateScreenSize` (radius/font refresh, redraw, reposition), hover-preservation through resize, and `Field.draw` on degenerate canvases are only covered at geometry level; `PlayerSprite` needs a Pixi-in-jsdom canvas harness (or a headless-WebGL setup) before it can be unit-tested. Add when test infra allows.

## Deferred from: home-left-half kickoff review (2026-09-12)

- **Non-finite position robustness in tacticBridge** — `normalizeHomeX` and the y clamps pass NaN/undefined/null through (pre-existing: the old `clamp(..., 0, 100)` behaved identically; API validation makes it unreachable through normal flows). If a hardening pass happens, guard both axes with `Number.isFinite` and a sane default in one place, not x-only.
- **Server-side left-half enforcement** — the x ≤ 50 invariant lives only in the frontend bridge; the API still accepts x 0-100, so any non-bridge writer (seeder, import, API consumer) can persist right-half rows that the bridge will then silently heal. Spec marks backend validation as human-gated: decide whether the API should validate x ≤ 50 for home tactics (would 422 legacy rows on save) or keep bridge-level healing.
- **E2E coverage for legacy-row healing** — the mirror-on-load/save self-heal is unit-tested at the bridge level only; no e2e creates a tactic with `position_x: 70` via the API, opens the workspace, saves, and asserts the stored payload is healed. Add when e2e infra is next touched.
- **Three hand-rolled formation literals** — store `DEFAULT_FORMATION`, match-factory's fixture formation, and the 3-2 doc's formation table drift independently (deliberately distinct values, but nothing links them). If a fourth consumer appears, extract a shared constant or generate the doc table from it.



## Deferred from: code review of 3-2-team-lineup-configuration-ui (2026-09-13)

- **deleteTactic→createTactic network failure** — deleting the last tactic then failing to recreate (network/401) leaves a degraded zero-tactic state: tacticsError surfaces, but activeTacticId is null and the canvas keeps rendering the deleted tactic. Needs a recovery-UX decision (auto-retry, keep-soft-deleted, or block delete-last while offline).
- **E2E canvas-side assertions missing** — tactic-tabs e2e asserts tabs/aria-current/API state only; a regression breaking canvas hydration (e.g. the `loadedTacticIdRef` load effect in AppShell) would pass the suite. Add assertions that the canvas actually re-renders the loaded tactic's players after switch/create/delete/reload.
- **TabBar a11y pass** — tactic tabs are non-focusable divs (no role="tab"/tabIndex/keyboard activation), rename is double-click-only with no keyboard alternative, the delete dialog lacks role="dialog"/aria-modal/focus trap, and collapsed panel strips set aria-controls to elements that don't exist while collapsed.
- **Rename blur-commit 100ms timer** — commit-on-blur is delayed by a fixed 100ms setTimeout to let click handlers land; no demonstrated defect (Escape is safe via re-render) but the pattern is fragile. Replace with a mousedown-aware commit or an activeElement check if flakiness appears.

## Deferred from: code review of 3-3-game-engine-core-deterministic-simulation (2026-09-13)

- **No run() deadline / ScriptRunner error-and-budget contract** — the ScriptRunner interface has no error channel, per-script timeout, or tick budget, and unknown-slot actions are silently dropped. Belongs to Story 3.4 (isolated-vm delivers the real runner); note a Promise.race timeout cannot protect a synchronous blocked event loop, so the mechanism must be designed, not bolted on.
- **Shuffled execution order does not order action application** — `applyActions` iterates the runner's array order; with the batch `runTick` interface the per-tick seeded shuffle only consumes RNG (no behavioral effect with Noop scripts). Story 3.4 must execute/authorize per-player actions in shuffled order per game-rules.md steps 1-3.
- **No auth/rate-limit/concurrency cap on POST /simulate** — each request holds a 10800-frame graph plus ~6.8MB JSON; a burst can OOM the single engine container. Engine is internal-only today (no published ports in compose); address when Story 3.5 wires Laravel to it. Fastify's default 1MB bodyLimit will also need raising for real scripts in 3.4.

## Deferred from: code review of 3-4-script-sandboxing-and-execution (2026-09-13)

- **Synchronous CPU-bound /simulate monopolizes the engine's single event loop** — one match consumes seconds-to-30s of CPU (10800 ticks × up to 10 synchronous `applySync` isolate calls), so concurrent `/validate-script` requests can miss Laravel's 10s Http timeout and degrade saves to "unreachable". Architectural: needs a worker/queue strategy, not a bolt-on. Extends the 3.3 "No auth/rate-limit/concurrency cap" item.
- **AC#4's "<2s target for reasonable scripts" is unenforced** — the only sandboxed full-match perf test asserts a 15s bound (Completion Note 13 documents 1.5–6.5s in practice). If the 2s target ever matters, tighten that test's bound.
- **No auth/rate-limit on engine endpoints; compile step has no deadline** — `/validate-script` and `/simulate` are unauthenticated/unthrottled and pathological payloads (~8MB JS) can CPU-exhaust the single engine process; `compileScriptSync` in validate.ts runs without a timeout. Deferred per review decision (2026-09-14): engine is internal-only (compose, no published ports) and throttling is not a concern for now. Consolidate with the 3.3 POST /simulate hardening item in a future story.

## Deferred from: code review of 3-5-practice-match-trigger (2026-09-14)

- **35s synchronous engine call inside a PHP-FPM request** — `Http::timeout(35)` can exceed `max_execution_time(30)` on web SAPIs; nothing marks the row failed if the worker aborts mid-call, so `pending` rows can be orphaned permanently. Story Dev Notes documents the trade-off (php artisan serve fine; prod php-fpm needs `request_terminate_timeout`); a stale-pending sweeper is the eventual fix.
- **No rate limiting on POST /matches** — each call holds a PHP worker for up to 35s and fills `storage/simulations/` unbounded. Hardening, not specced.
- **No ARIA on MatchStatusOverlay** — blocking backdrop lacks `role`/`aria-busy`; banners lack `role="status"`/`aria-live`; screen readers get no feedback. Codebase uses aria elsewhere, so this is a real gap — just not specced for 3.5.
- **updatePlayerStates per playback frame** — AppShell pushes Zustand updates at frame rate; subscribers re-render up to 60×/s. Belongs to the debugger-filter change-set (player-states wiring), not story 3.5.
- **E2E DB cleanup with reuseExistingServer** — `reuseExistingServer: !CI` skips the `migrate:fresh` webServer command when servers are already running, so repeated local runs accumulate matches; future "most recent match" assertions (FR34) would read stale rows.
- **AC1's "< 2 seconds" simulation budget is measurably violated** — code review of 3.5 (2026-09-14) added a timing measurement to the E2E happy path: POST /api/matches (the simulation itself, synchronous) measured **6.7s solo / 12.1s under parallel E2E workers** against the 2s budget. The E2E now attaches the measured duration to every report and asserts only the engine's 30s hard cap. Engine performance family: extends the 3.4 "<2s target unenforced (1.5–6.5s observed)" item — needs engine-side profiling/optimization, not 3.5 code.
- **Local full-parallel E2E starves the shared dev stack** — `php artisan serve` is a single PHP worker and the engine runs `/simulate` on a single event loop, so with `fullyParallel` + 3 browser projects, concurrent simulations block every parallel test's API calls (factory timeouts, rotating random failures). CI is unaffected (`workers: 1`). Mitigations applied in practice-match.spec.ts: serial mode per project, 90s engine-bound waits, faked (non-engine) retry response. Full fix is the engine queue/PHP worker-pool item above.

## Deferred from: code review of 3-7-match-canvas-renderer (2026-09-15)

- **runSimulation() no longer feeds playback** — the engine playback primitives (play/pause/step/seekFrame) now operate exclusively on `matchFrames` loaded via `loadFrames`; `runSimulation()` remains exposed on the TacticsCanvas imperative handle as the legacy canned generator but has zero callers, so its old `runSimulation() → play()` contract silently no-ops. Intentional transitional state: story 3.8 (replay playback system) swaps the data source and should either rewire `runSimulation` output into `loadFrames` or delete the method and its TacticsCanvas wrapper.

## Deferred from: code review of 3-8-replay-playback-system (2026-09-15)

- **Generated `tsconfig.tsbuildinfo` tracked in git** — the incremental-build artifact churns on every typecheck, producing noisy diffs and merge conflicts. Pre-existing repo hygiene: add `*.tsbuildinfo` to .gitignore and `git rm --cached tsconfig.tsbuildinfo` (outside story 3.8 scope).

## Deferred from: code review of 3-9-timeline-scrubber-and-navigation (2026-09-15)

- **[parallel-stream] `normalizeMatchFrames` dereferences frames before `loadFramesInternal`'s malformed-payload guard** — normalization (`frame.ball.y * Y_TO_PERCENT`, `frame.players.map(...)`) runs in `loadFrames()` before the validation loop that exists to keep a malformed payload from tearing down the engine (warn+ignore). The API path is pre-validated by `isPlayableFramesFile`, but the `TEST_LOAD_FRAMES_EVENT` hook only checks `Array.isArray && length > 0`, so a frame missing `ball` (or a non-array `players`) now throws `TypeError` inside `loadFrames`. Belongs to the match-preview-and-bot-fixes stream (src/lib/matchFrames.ts:22, Game.ts:361) — fix there: move validation ahead of normalization or make `normalizeMatchFrames` null-safe.

## Deferred from: code review of 3-10-debug-panel-log-display (2026-09-16)

- **[design-tokens] Log colors are hardcoded hex instead of `--warning`/`--error` design tokens** — `LOG_LEVEL_COLORS`/`LOG_TEAM_COLORS` (src/lib/replayLogs.ts:30-40) and the panel's inline styles pin raw hex (`#dcdcaa`, `#f14c4c`, `#ff6b1a`, `#1a8cff`) while the story and UX spec name `--warning`/`--error` tokens; those tokens are not defined anywhere in the app CSS and the entire codebase hardcodes hex inline styles, so introducing the token layer is systemic work beyond story 3.10 — do it when a theming pass touches the palette, then swap the log colors to `var()` and update the pinned test assertions.

## Deferred from: code review of 3-10-debug-panel-log-display (2026-09-16) — split-out workstream

- **[parallel-stream] RESOLVED 2026-09-22 via game-rules.md v1.7** — Engine balance v1.5/v1.6 (undelared work riding in the 3.10 diff, kept per Pelo's split-out decision) — `lahatadede-engine/src/engine/constants.ts` rebalances PLAYER_SPEED (1/1.8/1.1 = 0.5051) and MAX_BALL_SPEED (5/1.75 x 0.8 x 1.1 = 2.5143) and re-pins Pelo's accepted 98-0 EasyBotBalance baseline to all 0-0 draws; `game-rules.md` was rewritten to v1.6 with no recorded designer sign-off (v1.3/v1.4 entries carry "Pelo 2026-09-15" stamps, v1.6 has none). This work needed its own spec/story: (a) record the v1.6 decision and get explicit sign-off stamped in game-rules.md, (b) the re-pinned `EasyBotBalance.test.ts` suite asserts only 0-0 score draws — add liveness assertions (total shots > 0, ball enters the attacking third) so "players tuned slower" is distinguishable from "scoring is broken", (c) when that spec lands, mirror the constants contract. Closed by the v1.7 balance pass (Pelo, "go" 2026-09-22): (a) v1.6+v1.7 sign-off stamped in game-rules.md header, (b) liveness assertions added to EasyBotBalance.test.ts (attacking-third entry per seed + total shots > 0 across seeds), (c) constants mirror updated to v1.7 (PLAYER_SPEED = 1/1.8/1.1 x 0.7 = 0.3536, MAX_BALL_SPEED = 5/1.75 x 0.8 x 1.1 x 0.7 = 1.7600, MIN_BALL_SPEED = 0.07, BALL_FRICTION = 1 - 0.05/1.2 = 0.9583). Files: `lahatadede-engine/src/engine/constants.ts`, `lahatadede-engine/src/engine/__tests__/EasyBotBalance.test.ts`, `lahatadede-engine/src/engine/__tests__/Simulation.test.ts`, `lahatadede-engine/src/engine/__tests__/constants.test.ts`, `_bmad-output/planning-artifacts/game-rules.md`.

## Deferred from: code review of 3-11-debug-panel-player-filtering (2026-09-16)

- **Re-click → filter-off toggle has no direct unit test** — the toggle semantics ("re-click on selected player with logs clears the filter, keeps highlight") live in AppShell's `handlePlayerSelected` (src/components/layout/AppShell.tsx:206); the store unit test only mirrors the logic by calling `setLogFilter(null)` directly, and the real toggle branch is exercised solely by the e2e. Closing the gap needs component-test infra for AppShell (renderHook/component harness), which the repo doesn't have yet — add when component tests are introduced.

## Deferred from: dev of 4-1-ranked-queue-and-matchmaking (2026-09-17)

- **Four pre-existing workspace E2E failures (Epic 2 territory, verified failing on baseline a2c7727 with the 4.1 diff stashed)** — `should persist changes after save @P0` (chromium+firefox), `should show red underline for syntax errors @P0`, `should show error message on hover @P1`, `should show error icon in gutter @P1` (tests/e2e/workspace.spec.ts). All are Monaco behavior assertions (save persistence, marker squiggles, hoverMarkdownTips, gutter glyph) — suspect the Monaco 0.55.1 exact pin and/or the saveError refactor (a2c7727). Needs its own debugging pass against Epic 2 stories 2.2/2.3/2.5; NOT story 4.1 regressions.
- **panel-layout assertion drift (fixed in 4.1, recorded for traceability)** — story 3.9 (e4958d1) widened the collapsed strip 28px→36px without updating `tests/e2e/panel-layout.spec.ts:143`; 4.1's regression run surfaced it and the assertion was aligned to 36px.
- **workspace duplicate-flow fixtures predated the 3.4 script validator (fixed in 4.1)** — `copy code content to duplicate` and `allow editing duplicate without affecting original` created scripts without an `update` function and 422'd since story 3.4's validation; wrapped with the factory's `withUpdate()` (the helper that exists for exactly this).

## Deferred from: code review of 4-1-ranked-queue-and-matchmaking (2026-09-17)

- **`MatchSerializer::toArray($match->fresh())` accepts a nullable that TypeError's** — `fresh()` is nullable but the serializer's parameter is not (lachatadede-api/app/Http/Controllers/MatchController.php:96, app/Http/Serializers/MatchSerializer.php); a concurrent delete of the just-created row would 500 instead of degrading gracefully. Pre-existing risk the 4.1 serializer extraction moved behavior-identically; matches are never deleted in-app, so `fresh()` after a same-request create cannot realistically be null — guard it (or widen the param to `?GameMatch`) if a delete path ever lands.

## Deferred from: code review of 4-5-public-leaderboard.md (2026-09-21)

- **Cache the hot read endpoint** — `LeaderboardController@index` re-runs the full ranking query + eager load on every leaderboard open; elo only changes on match settlement, so a 30–60s `Cache::remember` is free correctness. The story deliberately kept the surface minimal (pure read, no pagination, no ceremony); revisit when NFR11 scale (~500 tactics) grows or the board becomes a landing surface.
- **Overlay a11y parity with RankedView** — LeaderboardView has no Escape-to-close (AppShell swallows all keys while an overlay is open), no focus trap/initial focus/restore on close, rows are unsemantic divs without list semantics, and loading/error states have no aria-live. Identical gaps exist in RankedView (4.3); fix both overlays in one epic-level a11y pass instead of diverging them.

## Deferred from: code review of epic 7 (7.6/7.7/7.8) (2026-09-23)

- **Editor unsaved-changes lifecycle gaps (7.8)** — debounced save (useAutoSave, story 2.3) is cancelled on unmount with no flush: editing a script then navigating away within the 2s window keeps the edit only in memory; and useUnsavedChangesWarning's beforeunload guard unmounts with CodePanel, so closing the tab from /play or /classement after editing on /teams gives no warning. Both hook contracts predate the refonte (hooks untouched in this diff); revisit as an editor-lifecycle pass (flush-on-unmount + hoist the guard to App level).
- **e2e × 3-browser end-of-epic sweep not run (7.8 AC #2)** — skipped per owner instruction ("tests take too long just push"), documented in the story as a deviation rather than a green pass. Lint/tsc/unit are green and traversals were statically verified (zero /workspace references, no-ready flow test present). Run `npm run test:e2e` (chromium+firefox+webkit, workers 1) before any production merge.

## Deferred from: code review of 6-1-forward-only-migrations-and-project-guidelines (2026-09-23)

- **No CI guard against `down()` reintroduction** — the forward-only law is enforced only by hand; a tiny test iterating `database/migrations/*.php` asserting no `function down` would lock it in. Candidate for 6.3 CI hardening.
- **Generator stubs still scaffold `down()`** — `php artisan make:migration` emits a law-violating skeleton; `stub:publish` + strip the stubs when the API is next touched.
- **Failed-migration recovery runbook** — MySQL DDL autocommits, so a half-applied ALTER can persist while `migrations` doesn't record it; no documented procedure (check `migrate:status`, guarded forward-fix). Belongs to the 6.5 operations runbook.
- **MySQL-parity validation absent** — suite runs sqlite `:memory:` while prod is MySQL 8 (identifier length, enum/charset, `->change()` semantics); a CI job with a MySQL 8 service container running `migrate --force` belongs to 6.3.
- **composer platform pin** — `require.php ^8.2` vs CI/Docker 8.4; `composer config platform.php 8.4.0` would fail installs on 8.2/8.3 early. Pre-existing.
- **Data-backfill policy** — law covers DDL only; state that data changes never go in migrations (batched artisan command/queued job instead) at the next AGENTS.md revision.
- **Squash/consolidation policy for obsolete chains** — build-then-drop churn (e.g. `matchmaking_queue` created then dropped) lengthens fresh deploys; document when `schema:dump --prune` is allowed (pre-prod only). Ops decision, 6.5 candidate.
- **Migration law discoverability** — `lachatadede-api/AGENTS.md` isn't loaded by agents entering at the repo root; consider a one-line pointer from root-level agent instructions.
- **DemoBots "passing game" engine test failing at HEAD (pre-existing)** — `lachatadede-engine/src/engine/__tests__/DemoBots.test.ts:192` asserts ≥5 challenger ball handoffs in a one-two-one vs two-two demo match, got 1. Verified failing on a clean HEAD checkout (only my engine patches stashed), so it was NOT introduced by the epic-7 review patches — it came in with the non-story engine rebalance commit a0ddccc "Rebalance player and ball speeds (v1.7)" (slower players/ball starve the passing game) which never ran the engine suite. Needs a balance pass or threshold recalibration before story 7.9's telemetry work leans on demo matches.

## Deferred from: code review of 6-2-vps-ordered-and-provisioned (2026-09-23)

- **Git-based clone flow in test.yml vs a gitless box** — Stage 6 clones/fetches on the VPS (and `rm -rf`s the app dir if `.git` is missing); the playbook no longer installs git, so every push to main fails at Stage 6 until 6.3 replaces the pipeline with GHCR images (documented transition in the story's Scope Boundary). [.github/workflows/test.yml:375-384]
- **Stale pipeline/doc sections in DEPLOYMENT.md** — "Manual Deployment" (`ssh vps_deploy`, `git pull`, `docker compose build`), authorized_keys troubleshooting lines, and the unlisted DOCKERHUB secrets contradict the new no-clone flow; the pipeline/backup doc rewrite is owned by 6.3/6.5 per Task 8.2. [docs/DEPLOYMENT.md:143-166,196-197]
- **IPv6 unmanaged by the playbook** — the kept AAAA record works today (verified live, `2001:1600:18:208::187/128` bound) but nothing provisions it on a rebuild; add an IPv6 connectivity verify step alongside 6.3's nginx work. [docs/DEPLOYMENT.md:96-101]
- **Minor VPS ops hygiene** — manual ufw rules survive playbook re-runs (the "exactly 22/80/443" health claim drifts), and the deploy key is named `id_rsa_vps` while being ed25519, with no rotation guidance. Cosmetic; revisit at the 6.5 runbook.
