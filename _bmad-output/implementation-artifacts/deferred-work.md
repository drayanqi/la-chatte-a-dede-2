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
