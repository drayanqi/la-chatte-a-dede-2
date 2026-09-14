# Spec: Persistent Player Selection + Selection-Driven Debugger Filter

Status: ready-for-dev

Date: 2026-09-13

## Goal

Clicking a player selects it and keeps it highlighted until deselected (re-click the same player, or click empty pitch). The debugger panel filters by selection: nothing selected → show all players; a player selected → show only that player.

## Background (current gaps)

- `PlayerSprite` highlight is hover-only (`pointerover`/`pointerout` redraw); `canvasStore.selectedPlayerId` is never fed back into the Pixi sprites.
- No toggle: re-clicking a selected player re-selects it.
- `AppShell.handleFrameChanged` drops the `states` array, so `canvasStore.playerStates` is always empty and the debugger never shows live positions.
- Debugger console has no data source (engine logs arrive with stories 3.5–3.10) — deferred, untouched in this change.

## User decisions (binding)

- Re-clicking the selected player **fully deselects** (highlight + filter) — overrides story 3.11's "second click keeps highlight, clears filter only". When 3.11 is implemented, `selectedPlayerId` IS the log filter (no separate `logFilterPlayerId`, no "Show All" needed).
- Clicking empty pitch also deselects.
- Console section stays as-is (no data source yet).

## Acceptance Criteria

1. **Given** a player is selected, **When** the pointer leaves it, **Then** it stays highlighted (yellow ring) until deselected.
2. **Given** a player is selected, **When** I click it again, **Then** it is deselected (ring gone, debugger shows all players).
3. **Given** a player is selected, **When** I click empty pitch, **Then** it is deselected.
4. **Given** nothing is selected, **When** the debugger panel renders, **Then** the Watch list shows ALL roster players with live position/state.
5. **Given** a player is selected, **When** the debugger panel renders, **Then** the Watch list shows only that player.
6. **Given** a tactic switch, **When** the new tactic loads, **Then** selection is cleared.

## Tasks

1. `src/stores/canvasStore.ts` — add `toggleSelectedPlayer(id)`: same id → `null`, else → `id`.
2. `src/components/canvas/engine/Player.ts` — `isSelected` field + `setSelected(bool)`; draw with `isHovered || isSelected` (also in `updateScreenSize`).
3. `src/components/canvas/engine/Game.ts` — public `setSelectedPlayer(id | null)` mirroring to sprites; reset selection in `loadTacticInternal`; stage `pointerdown` + `hitTestPlayer` → empty-pitch deselect fires optional `onPlayerDeselected` callback.
4. `src/components/canvas/TacticsCanvas.tsx` — `onPlayerDeselected?` prop; imperative `setSelectedPlayer(id | null)`.
5. `src/components/layout/AppShell.tsx` — toggle on player click; deselect handler; sync effect store→engine; `updatePlayerStates(states)` in `handleFrameChanged`; clear selection on tactic load.
6. `src/components/debugger/DebuggerPanel.tsx` — Watch list: roster from active tactic ∪ live `playerStates`; filtered by `selectedPlayerId`; team-color dots; data-testids `debug-watch-list`, `debug-watch-row-{playerId}`.
7. Tests — `tests/unit/stores/canvas-store.test.ts` (toggle semantics); `tests/unit/components/debugger-panel.test.tsx` (all vs. filtered rendering).

## Verification

- `npm run test:unit` (or `npx vitest run tests/unit`) — all green including new tests.
- TypeScript strict compile clean.
