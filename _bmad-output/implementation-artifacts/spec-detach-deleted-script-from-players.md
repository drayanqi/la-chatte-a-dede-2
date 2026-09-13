---
title: 'Detach deleted script from lineup players'
type: 'bugfix'
created: '2026-09-12'
status: 'in-review'
baseline_commit: '99c70fd8dd29a821aec1bc8d3d734af768014d5e'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a user deletes a script that is attached to players in the lineup, the backend correctly nulls `tactic_player.script_id` (FK `nullOnDelete`), but the frontend keeps stale references: canvas sprites keep the attached-script indicator, and the cached `TacticConfig.players[].scriptId` still holds the deleted id — so `lineupComplete` gating lies and the next auto-save sends the deleted id and fails with 422.

**Approach:** After a successful script deletion, synchronously detach the script from all in-memory players (engine sprites and tactics-store cache). No extra API call is needed — the database is already correct; the fix only re-syncs frontend state to that truth.

## Boundaries & Constraints

**Always:**
- Detach must affect every player holding the deleted script, in every cached tactic (not just the active one).
- Engine detach must clear both `assignedScriptId` and the visual indicator (reuse `PlayerSprite.setScript(null)`).
- Detach runs only after `deleteScript` succeeds (API returned OK and editor store removed the script).

**Ask First:**
- If engine detach cannot be reached through the existing `TacticsCanvasHandle` (e.g. canvas not mounted), do not invent a new sync mechanism — report back.

**Never:**
- No new PUT/POST to `/tactics` during delete (DB is already nulled by FK; a redundant full-replace save risks races with the `isSavingTactic` guard).
- No changes to backend code or DB migrations.
- No reload/recreation of canvas players to force a visual sync.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Script attached to active-tactic player | Delete script via panel confirm | Sprite indicator disappears; `getTactic()` reports `assignedScriptId: null`; cached tactic slot has `scriptId: null` | N/A |
| Script attached in a non-active tactic | Delete script via panel confirm | Cached slots in ALL tactics holding that script become `scriptId: null` | N/A |
| Script attached to multiple players | Delete script via panel confirm | Every holding player is detached | N/A |
| Script not attached anywhere | Delete script via panel confirm | No-op detach; normal delete flow unchanged | N/A |
| Deletion fails (API error) | Confirm delete, API rejects | No detach happens; state unchanged | Existing `deleteScript` error path untouched |
| Canvas has no tactic loaded | Delete a script before lineup loads | Engine detach is a safe no-op | N/A |
| Lineup was complete via deleted script | Delete script after full lineup | `lineupComplete` recomputes to false (Start gate re-locks) | N/A |

</frozen-after-approval>

## Code Map

- `src/components/canvas/engine/Game.ts` -- engine orchestrator; has `players: Map<string, PlayerSprite>` and `assignScript()` precedent (line ~171)
- `src/components/canvas/engine/Player.ts` -- `PlayerSprite.setScript(scriptId: string | null)` (line ~140) already handles indicator visuals for null
- `src/components/canvas/TacticsCanvas.tsx` -- imperative handle `TacticsCanvasHandle` (line ~57) to extend with `detachScript`
- `src/stores/tacticsStore.ts` -- cached `tactics: TacticConfig[]`; new action `detachScriptFromPlayers` goes here
- `src/components/editor/ScriptsPanel.tsx` -- `confirmDelete` (line ~295) invokes `deleteScript`; wiring point for the detach orchestration
- `src/components/layout/AppShell.tsx` -- owns `canvasRef` + both stores; the only place that can reach the engine
- `tests/unit/stores/tactics-store.test.ts` -- unit tests for tactics store actions
- `tests/e2e/tactic-tabs.spec.ts` -- e2e flows for script assignment/auto-save on the field

## Tasks & Acceptance

**Execution:**
- [x] `src/components/canvas/engine/Game.ts` -- add `detachScript(scriptId: string): void` iterating `players` and calling `player.setScript(null)` on holders (no `onScriptAssigned` callback) -- engine-side detach primitive
- [x] `src/components/canvas/TacticsCanvas.tsx` -- add `detachScript(scriptId: string): void` to `TacticsCanvasHandle` and its implementation in `useImperativeHandle` -- expose the primitive to React
- [x] `src/stores/tacticsStore.ts` -- add `detachScriptFromPlayers(scriptId: string): void` action that maps all cached tactics and nulls matching `players[].scriptId` -- kills stale cache for every tactic, fixes `lineupComplete`
- [x] `src/components/editor/ScriptsPanel.tsx` -- add optional prop `onScriptDeleted?: (scriptId: string) => void`; call it in `confirmDelete` only when `deleteScript` resolves `true` -- explicit seam for post-delete cleanup
- [x] `src/components/layout/AppShell.tsx` -- add `handleScriptDeleted` callback: `useTacticsStore.getState().detachScriptFromPlayers(id)` then `canvasRef.current?.detachScript(id)`; pass as `onScriptDeleted` to `<ScriptsPanel />` -- orchestration at the only layer owning canvas + stores
- [x] `tests/unit/stores/tactics-store.test.ts` -- add unit tests for `detachScriptFromPlayers` (all-tactics cleanup, no-op when unattached, immutability of untouched slots) -- verify store behavior
- [x] `tests/e2e/tactic-tabs.spec.ts` -- add e2e regression test: assign a script to a player, delete the script via panel, assert player slot is unassigned (persisted state via reload) -- user-visible bug regression guard

**Acceptance Criteria:**
- Given a script attached to any player on the field, when the user confirms its deletion in the scripts panel, then the player's attached-script indicator disappears immediately and `getTactic()` returns `assignedScriptId: null` for that player.
- Given the deleted script was the reason a tactic's lineup was complete, when deletion completes, then the Start gate (`lineupComplete`) is false again without a page reload.
- Given a successful deletion, when the user later drags any script onto a player (triggering auto-save), then the PUT payload contains no deleted script ids and succeeds without 422.
- Given a failed deletion (API error), when confirm is clicked, then no player state changes (detach skipped).

## Spec Change Log

## Design Notes

- **Why no persistence call:** `TacticController`'s FK design (`nullOnDelete()`) already nulls every slot referencing the deleted script — backend test `test_deleting_a_script_leaves_the_slot_unassigned` proves it. A follow-up PUT would be redundant and could silently no-op if `isSavingTactic` is mid-flight.
- **Why AppShell, not the stores:** `editorStore` must stay script-CRUD-only; the engine handle lives in AppShell's ref. AppShell already bridges both stores (see `handleScriptAssigned`), so this mirrors existing patterns.
- **Detach is silent:** unlike `assignScript`, detach must NOT fire `onScriptAssigned` — that callback triggers the auto-save flow, which we deliberately skip.

## Verification

**Commands:**
- `npm run test:unit` -- expected: all pass, including new `detachScriptFromPlayers` tests
- `npx tsc --noEmit` (or repo typecheck script) -- expected: no type errors
- `npm run lint` -- expected: clean
- `npx playwright test tests/e2e/tactic-tabs.spec.ts` -- expected: all pass, including new delete-detach test

**Manual checks (if no CLI):**
- Assign a script to the GK, delete it via right-click → Delete → confirm: green indicator vanishes; Start button re-locks; no console 422 on subsequent drag-assign.
