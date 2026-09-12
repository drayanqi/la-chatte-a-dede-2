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
- **Fixed-px goal width and line width** — goal depth (8px) and `LINE_WIDTH` (2px) in `Field.ts` are absolute pixels while every other marking now scales with the letterboxed pitch; on very small collapsed-panel pitches goals look chunky, on very large ones they nearly vanish. Consider deriving them from pitch size (e.g. `max(4, pitch.height * 0.02)`).
- **Sprite-level unit tests for PlayerSprite** — `updateScreenSize` (radius/font refresh, redraw, reposition), hover-preservation through resize, and `Field.draw` on degenerate canvases are only covered at geometry level; `PlayerSprite` needs a Pixi-in-jsdom canvas harness (or a headless-WebGL setup) before it can be unit-tested. Add when test infra allows.


