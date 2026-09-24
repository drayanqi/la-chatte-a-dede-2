---
title: 'Sandbox global `game` — zero-JSDoc script typing'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'a69586560828deaa054656f86b036b91121c7542'
context:
  - '{project-root}/_bmad-output/planning-artifacts/script-ia-api.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Plain-JS AI scripts only get IntelliSense when every function that receives `game` carries a copied `/** @param {Game} game */` JSDoc line; helper functions each need their own copy, which users hate.

**Approach:** Make the sandbox expose the tick's `game` object as a global (`globalThis.game`, set per tick by the shim before `update()` runs) and declare it ambiently in the editor's contract types, so `function update() { game.me... }` and every helper gets full completions with zero JSDoc. The `update(game)` parameter style stays fully supported (backward compatible); the JSDoc auto-injection remains as a typing safety net for legacy param-style scripts only.

## Boundaries & Constraints

**Always:**
- Keep passing `game` as the first argument to `update()` — legacy scripts must run unchanged.
- The global must be set fresh per tick, per player isolate, before `update()` executes.
- `ensureGameApiJSDoc` keeps injecting for `function update(game)` (param present) and stops injecting for param-less `function update()`.
- The canonical contract stays single-source: the ambient declaration lives in `gameApiTypes.ts`; the generated d.ts picks it up unchanged (no export keyword on the declare line).
- Engine determinism untouched: no clock reads, no new host-isolate traffic.

**Ask First:**
- Changing the missing-`update` validation message wording beyond dropping the mandatory `(game)` param.
- Converting Easy/Demo bot scripts (kept in legacy style).

**Never:**
- No removal of the JSDoc injection machinery or of the parameter-passing (no breaking change).
- No new engine endpoint, no protocol/payload change.
- No conversion of existing users' stored scripts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New-style script | `function update() { game.me.stop(); }` in sandbox | stop action emitted; global `game` matches the per-player snapshot | N/A |
| Fresh per tick | Two consecutive ticks with different ball positions | global `game` reflects each tick's snapshot (helpers reading `game` mid-tick see current state) | N/A |
| Legacy script | `function update(game) { game.me.stop(); }` | unchanged behavior; JSDoc still auto-injected in editor (param is `any` without it) | N/A |
| Editor completions, new style | Param-less script, type `game.ball.` | completions x/y from the ambient global — no JSDoc anywhere in the file | N/A |
| Top-level `game` use | `console.log(game)` outside update | ReferenceError at init → SCRIPT_ERROR, player disabled (same as today) | existing classification |
| Missing update | Script without any `update` | validation error message no longer mandates `(game)` | N/A |

</frozen-after-approval>

## Code Map

- `lachatadede-engine/src/engine/contextBuilder.ts` -- SCRIPT_SHIM builds `game` per tick and calls `update(game)`; add the `globalThis.game = game;` assignment here
- `lachatadede-engine/src/engine/__tests__/IsolatedScriptRunner.test.ts` -- sandbox behavior tests (`prepareRunner`/`consoleScript` helpers to reuse)
- `lachatadede-engine/src/routes/validate.ts` (+ `__tests__/validate.test.ts`) -- missing-update error message teaches `function update(game)`
- `src/lib/gameApiTypes.ts` -- canonical contract; add the non-exported `declare const game: Game;` ambient declaration (editor-only) + fix the `Game` doc example
- `src/lib/gameApiDts.ts` -- passes contract text through verbatim (strips `export` before interface/type only); NO change expected — verify
- `tests/unit/lib/gameApiDts.test.ts` -- asserts generated d.ts content; add the global declaration assertion
- `src/lib/gameScript.ts` (+ `tests/unit/lib/gameScript.test.ts`) -- JSDoc injection; gate `UPDATE_FUNCTION_PATTERN` to require the `game` param
- `src/stores/editorStore.ts` (+ `tests/unit/stores/editor-store.test.ts`) -- `generateDefaultCode` scaffold; `ensureGameApiJSDoc` call sites stay
- `src/lib/scriptingGuide.ts` -- in-app guide snippets teach `update(game)` style
- `docs/scripting.md` -- companion guide examples teach `update(game)` style
- `_bmad-output/planning-artifacts/script-ia-api.md` -- canonical contract v2.0 → v2.1: document the global + de-emphasize the param
- `lachatadede-api/app/Http/Controllers/AuthController.php` (+ `tests/Feature/Auth/RegisterTest.php`) -- `STARTER_AI_CODE` starter script
- `tests/e2e/editor-intellisense.spec.ts` (+ `tests/support/helpers/editor.ts`) -- IntelliSense e2e; add a global-`game` scaffold + test

## Tasks & Acceptance

**Execution:**
- [x] `lachatadede-engine/src/engine/contextBuilder.ts` -- in SCRIPT_SHIM's `__run`, after building `game`, set `globalThis.game = game;` before `update(game)` -- exposes the sandbox global
- [x] `lachatadede-engine/src/engine/__tests__/IsolatedScriptRunner.test.ts` -- add tests: param-less update emits actions via the global; global is fresh on tick 2; legacy `update(game)` unchanged -- lock the engine contract
- [x] `lachatadede-engine/src/routes/validate.ts` -- reword the missing-update error to not mandate the `(game)` param (check `validate.test.ts` assertions) -- stop teaching the old style
- [x] `src/lib/gameApiTypes.ts` -- add non-exported `declare const game: Game;` with a doc comment (set per tick by the sandbox shim; helpers read current-tick state) and update the `Game` `@example` to the param-less style -- single-source typing
- [x] `tests/unit/lib/gameApiDts.test.ts` -- assert the generated d.ts declares the global `game` -- guard the editor pipeline
- [x] `src/lib/gameScript.ts` -- require the `game` param in `UPDATE_FUNCTION_PATTERN` so param-less scripts are left untouched; refresh the file doc comment -- legacy-only injection
- [x] `tests/unit/lib/gameScript.test.ts` -- add: param-less `function update()` gets no injection; `function update(game)` still does -- regression safety
- [x] `src/stores/editorStore.ts` -- `generateDefaultCode` becomes param-less global style (no JSDoc line); update editor-store unit test assertions -- new scripts start clean
- [x] `lachatadede-api/app/Http/Controllers/AuthController.php` -- `STARTER_AI_CODE` becomes param-less global style; align `RegisterTest` assertions -- new users learn the new style
- [x] `tests/support/helpers/editor.ts` + `tests/e2e/editor-intellisense.spec.ts` -- add `GLOBAL_SCAFFOLD` (param-less, no JSDoc) and a P0 test: typing `game.ball.` completes x/y -- proves the feature end-to-end
- [x] `src/lib/scriptingGuide.ts`, `docs/scripting.md`, `_bmad-output/planning-artifacts/script-ia-api.md` -- convert example scripts to the global style; bump the contract to v2.1 documenting the global (param style stays valid) -- one teaching voice

**Acceptance Criteria:**
- Given a param-less `function update() { game.me.stop(); }`, when it runs in the sandbox, then a stop action is recorded for the tick.
- Given two ticks with different ball positions, when a script logs `game.ball.position` each tick, then the two logs differ and match the snapshots.
- Given a legacy `function update(game)`, when its script is fetched by the editor, then the JSDoc line is still injected above it and completions work.
- Given a param-less script in the editor with no JSDoc, when the user types `game.ball.` (and deeper, `game.ball.position.`), then the matching members complete (position/velocity/owner, then x/y) — the deep x/y chain mirrors the legacy-style test.
- Given "create new script", then the default code contains no `@param {Game}` text and uses `function update()`.

## Spec Change Log

- 2026-09-24 (review loop 1, acceptance auditor — 4 minor findings, all patched, no loopback):
  1. **Trigger:** the validate message added teaching text beyond the Ask-First boundary ("wording beyond dropping the mandatory (game) param"). **Amended:** message is now the minimal `missing update function: define function update() { ... }`. **Known-bad state avoided:** unauthorized message content needing a human sign-off. **KEEP:** the param-less acceptance test stays.
  2. **Trigger:** task "update the Game @example to the param-less style" was checked but the example still showed `function update(game)`. **Amended:** example is param-less; it flows into editor hover docs. **Known-bad state avoided:** teaching the param style in the very declaration that introduces the global.
  3. **Trigger:** converted snippets in docs/scripting.md and scriptingGuide.ts used bare `me` with no destructuring — copy-paste would ReferenceError (flaw inherited from the original param-style snippets). **Amended:** every converted snippet starts with `const { me } = game;`. **Known-bad state avoided:** docs that teach a broken snippet. **KEEP:** `game.ball.*` references stay explicit to show both access styles.
  5. **Trigger:** blind hunter — ensureGameApiJSDoc docstring implied the validator flags param-less scripts (false: they are valid); e2e comment said the mirrored deep-chain test is "above" when it is below. **Amended:** docstring now separates the two unchanged cases; comment fixed. **Known-bad state avoided:** misleading maintainer docs. **REJECTED finding** (no action): "editor offers completions for top-level `game` that crashes every tick" — top-level use throws at INIT and validateScriptCode compiles+runs the top level, so such scripts are rejected at save time (I/O matrix row "Top-level game use"), and the declaration's JSDoc already warns.

  4. **Trigger:** AC #4 said "game.ball. → x/y completions", which is impossible per the contract (x/y live on `game.ball.position.`). The frozen I/O row is interpreted by its INTENT (zero-JSDoc typed completions — the only possible reading); the non-frozen AC was reworded to the deep chain and the P0 e2e now asserts both levels. **Known-bad state avoided:** an AC naming members that cannot exist at that level.

## Design Notes

- Why a global instead of better JSDoc tooling: a parameter can only be typed from its own declaration site; a sandbox-provided global is typed once in the ambient lib and shadows nothing. Helpers need no parameter at all — they just read `game`.
- Injection gating detail: the stored-JSDoc design (gameScript.ts) exists so editor line numbers stay true. The pattern `/^[ \t]*function\s+update\s*\(\s*game\b/m` keeps that property while refusing to touch param-less scripts, where a JSDoc line would be dead weight.
- The shim runs in strict mode inside an IIFE: use `globalThis.game = ...`, not a bare assignment to an undeclared identifier.

## Verification

**Commands:**
- `cd lachatadede-engine && npm test` -- expected: all green incl. new global-game tests
- `npm run test:unit` -- expected: all green incl. gameApiDts, gameScript, editor-store suites
- `npm run lint && npx tsc -b` -- expected: clean
- `cd lachatadede-api && php artisan test --filter=RegisterTest` -- expected: green with new starter assertions

**Manual checks (if no CLI):**
- `npm run dev`: create a script, confirm the default code is param-less and typing `game.` offers me/ball/teammates/opponents/field with hover docs.

## Suggested Review Order

**The sandbox contract change (entry point)**

- One line gives every script a typed global: per-tick, before `update(game)` (param kept — legacy untouched)
  [`contextBuilder.ts:279`](../../lachatadede-engine/src/engine/contextBuilder.ts#L279)

- The ambient declaration: typed everywhere with zero JSDoc; JSDoc warns against top-level use
  [`gameApiTypes.ts:234`](../../src/lib/gameApiTypes.ts#L234)

**Editor pipeline**

- Param-gated injection: legacy `update(game)` gets the JSDoc line, param-less scripts stay clean
  [`gameScript.ts:30`](../../src/lib/gameScript.ts#L30)

- New-script template: global style, no JSDoc line to copy anymore
  [`editorStore.ts:134`](../../src/stores/editorStore.ts#L134)

- Validation message no longer teaches the mandatory param
  [`validate.ts:55`](../../lachatadede-engine/src/routes/validate.ts#L55)

**Teaching surfaces**

- The canonical contract v2.1: global (recommended) vs parameter (legacy), top-level caveat
  [`script-ia-api.md:16`](../../_bmad-output/planning-artifacts/script-ia-api.md#L16)

- Companion guide header: global game, helpers read it directly
  [`scripting.md:3`](../../docs/scripting.md#L3)

- In-app guide "Lire le jeu": sandbox rebinds `game` every tick
  [`scriptingGuide.ts:202`](../../src/lib/scriptingGuide.ts#L202)

- Laravel starter every new user receives (is_valid by construction)
  [`AuthController.php:35`](../../lachatadede-api/app/Http/Controllers/AuthController.php#L35)

**Proof**

- Engine: param-less action, helper reads current tick, fresh rebind per tick
  [`IsolatedScriptRunner.test.ts:247`](../../lachatadede-engine/src/engine/__tests__/IsolatedScriptRunner.test.ts#L247)

- E2E P0: zero-JSDoc scaffold completes shallow AND deep (`game.ball.position.` → x/y)
  [`editor-intellisense.spec.ts:29`](../../tests/e2e/editor-intellisense.spec.ts#L29)

- GLOBAL_SCAFFOLD fixture used by the P0 test
  [`editor.ts:38`](../../tests/support/helpers/editor.ts#L38)

- d.ts guard: the generated lib must declare the global
  [`gameApiDts.test.ts:54`](../../tests/unit/lib/gameApiDts.test.ts#L54)

- Injection gating regression: param-less untouched, `update(game, extra)` still injected
  [`gameScript.test.ts:75`](../../tests/unit/lib/gameScript.test.ts#L75)

- Store: param-less POSTed verbatim, legacy gets the JSDoc line
  [`editor-store.test.ts:916`](../../tests/unit/stores/editor-store.test.ts#L916)
