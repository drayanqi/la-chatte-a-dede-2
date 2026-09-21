---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.5: Teams Page — Scripts, Code & Terrain

Status: done

## Story

As a player,
I want scripts, the code editor and the pitch side by side in the order Scripts | Code | Terrain,
So that clicking a script opens its code right next to it and the pitch keeps the most space.

## Acceptance Criteria

1. **Given** the teambar (floating rounded capsule), **When** the player manages teams, **Then** team pills show status dot (mint ready / sun draft) and a caret menu (Renommer, Équipement, Dupliquer, Supprimer with confirm), "+ Nouvelle équipe" opens the creation modal, and the ready toggle + Test vs Bot actions sit on the right.
2. **Given** the scripts panel (left, 255px), **When** the player selects a script, **Then** its code opens in the adjacent Monaco panel (row shows status dot + assignment count), scripts are creatable/renamable/deletable, and errors are visible at a glance.
3. **Given** the pitch (right, fills remaining width), **When** the player clicks a player, **Then** a rounded picker opens on the pitch listing scripts (status + usage count) with "Retirer le script" — replacing drag-and-drop assignment; the script name shows as a tag under each player; positional drag of players still works with auto-save.
4. **Given** a practice match, **When** launched from the teambar or its result is watched, **Then** it lands in `/match/:id`.

## Scope Boundary (read first)

- Layout locked by Pelo: fixed scripts 255px + code 430px + pitch flex, 8px gaps, floating rounded panels. PanelDivider/usePanelLayout leave the page (cleanup of the lib happens in 7.8).
- Script assignment = click player → picker (NO drag-and-drop of scripts; the HTML5 dnd path in TacticsCanvas is removed).
- Script tag under players: Pixi text tag in tactic (edit) mode only (replay frames carry no script names).
- Team caret menu actions map to existing store operations (rename/duplicate/delete) + EquipmentModal from 7.4; "Dupliquer" = tacticsStore duplicate if it exists, else reuse creation pattern (check store API).
- Practice match: startPracticeMatch (POST) with simulating overlay on the pitch, then navigate `/match/:id`; "watch result" path from 7.7+ lands on the same route.
- Brouillon/Prêt pill + ready button = existing isReady gating (lineupComplete); Test vs Bot gated likewise.

## Tasks / Subtasks

- [x] Task 1: `Teambar` (`src/components/teams/Teambar.tsx`) replacing TabBar — pills (dot + caret), context menu (Renommer inline, Équipement, Dupliquer, Supprimer + confirm), "+ Nouvelle équipe" modal (creation flow), Brouillon/Prêt pill, ready button, Test vs Bot; keep existing testids where possible (`ready-toggle`, tactic create/delete) + new ones (`team-menu`, `team-rename`, `team-equipment`, `team-duplicate`, `team-delete`, `new-team-button`, `test-vs-bot`)
- [x] Task 2: Teams page layout — Scripts (255px, colhead + rows + hint) | Code (Monaco + colhead with script status) | Terrain (canvas flex); panel look per tokens (rounded 18, shadow, 8px gaps)
- [x] Task 3: Scripts panel rework — row = status dot (ok/err/warn) + name + assignment count chip; create/rename/duplicate/delete preserved (existing editorStore flows); remove drag-to-pitch
- [x] Task 4: Script picker — TacticsCanvas exposes `hitTestPlayer` + selection; picker HTML overlay positioned near the selected player (viewport coords via canvas rect + player %), lists scripts (status + usage), "Retirer le script"; assignment via canvasStore + `assignScript`/`detachScript` + auto-save (existing persist flow)
- [x] Task 5: Player script tags — PlayerSprite optional `scriptLabel` (tag under circle, "non assigné" italic gray); TacticsCanvas handle updates labels on assign/detach
- [x] Task 6: Practice match handoff — Test vs Bot → simulating overlay (spinner + frames estimate) → `navigate(/match/:id)`; remove workspace replay-view path (replay rendering moves to MatchPage in 7.7 — until then keep loadReplay-in-teams for in-place watch, final cutover in 7.7)
- [x] Task 7: Unit tests — Teambar (menu actions, ready gating), picker logic, tag rendering; update tab-bar tests → teambar tests

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- E2E `tactic-tabs.spec.ts` updated → `teams-page.spec.ts` traversal (create/rename/ready/delete + assignment picker) on chromium

## Dev Agent Record

### Completion notes

- **Layout (Task 2)**: `AppShell` renders the fixed 3-panel layout — scripts 255px, code 430px, pitch flex, 8px gaps, floating rounded panels (tokens). `PanelDivider`/`usePanelLayout` leave the page; the lib + its unit tests stay until the 7.8 cleanup. The DebuggerPanel stops rendering (it leaves with the replay cutover in 7.7; the component survives for now).
- **Teambar (Task 1)**: one pill per user tactic (`tactic-tab` + `team-dot` data-ready + `team-caret`), caret menu (`team-menu`: `team-rename` inline, `team-equipment` → 7.4 EquipmentModal, `team-duplicate`, `team-delete` → `delete-tactic-confirm-dialog`), `new-team-button` → `new-team-modal` (name + create; the store seeds the default 5-slot formation), right side: `team-status-pill` (Prêt/Brouillon), `ready-toggle` (disabled while the lineup is incomplete, mirrors the 422), `test-vs-bot-button`, `lineup-incomplete-message`. Saved flash + error surfacing carried over from the old tab bar.
- **Store**: `createTactic(name?)` accepts an optional name; new `duplicateTactic(id)` POSTs "X (copie)" with the source lineup (not ready) and becomes active. `saveTactic` now returns the created `TacticConfig | null` (contract change, callers unaffected).
- **Picker (Task 4)**: clicking an edit-mode player opens `ScriptPicker` (mockup `.picker`): "Assigner à n°N", one option per script (`picker-script-option` with `picker-script-status` ok/err from `syntaxErrors` + `picker-script-usage` count from the active tactic), "Retirer le script" (`picker-remove-script`, disabled when nothing assigned). Placement is computed at selection time from the pitch panel rect (`computePickerPosition`, viewport coords, clamped) and frozen in component state — refs are never read during render (React Compiler rule). The picker is gated on the live store selection, so tactic switches/replays close it without a cascading local-state reset. The HTML5 drag-and-drop assignment path is REMOVED from TacticsCanvas.
- **Script tags (Task 5)**: `PlayerSprite` gains `showScriptLabel` (edit sprites only — replay keeps the 4-layer contract), a dark capsule pill + tag under the circle; null label renders the italic muted "non assigné". `Game.setScriptLabels/detachPlayerScript` + `TacticsCanvas` handle plumbing; the shell recomputes id→name labels from the active tactic + script list (renames included).
- **Practice handoff (Task 6)**: Test vs Bot (and error retry) → `simulating-overlay` pinned to the pitch (spinner + "≈ 10 800 frames · a few seconds" chip, per mockup `s-equipes`) → on completion `navigate(/match/:id)`. Per the scope note, the in-place watch paths (watch-last-match / watch-replay → `loadReplay` on /teams) are KEPT until the 7.7 cutover — the result banner is now effectively unreachable (navigation wins), and 7.7 removes the residue. MatchPage gained the 7.4 `setTeamColors` handoff (challenger → home, opponent → away).
- **Scripts panel (Task 3)**: rows are status dot (ok/err via `syntaxErrors`) + name + `script-usage` chip (assignments in the active tactic); create/rename/duplicate/delete/context-menu flows and the workspace.spec contracts (active row `#37373d`, `editor-container`, etc.) preserved. The editor moved to a new `CodePanel` (colhead with `code-status-dot` + name + SaveIndicator, Monaco, auto-save + unsaved-changes guard).
- **E2E (verification)**: `tactic-tabs.spec.ts` → `teams-page.spec.ts` (teambar CRUD + duplicate, picker assignment + remove + persistence, drag-move auto-save, ready/status gating, delete-detach regression), `panel-layout.spec.ts` deleted (dividers gone), `practice-match.spec.ts` updated for the handoff (URL /match/:id + viewer census; 3.8-3.11 keep the in-place watch entry via watch-last-match until 7.7; the retry test fakes POST-only and asserts the viewer's error state for the fake id). Full 3-browser run deferred to the 7.8 sweep (user decision, 7.4).
- **Test infra**: the vitest 2d-canvas stub was upgraded to a measureText-capable context (`getContext('2d')` only; WebGL stays null) + `CanvasRenderingContext2D`/`Path2D` globals — pixi text measurement works in jsdom now.
- **Gates at completion**: `tsc -b` ✓, eslint 0 errors / 4 pre-existing warnings ✓, unit 588/588 in 35 files ✓ (572 → 588: +team-bar 21, +picker-position 7, +player-script-tag 6, -tab-bar 13, +2 net from saveTactic signature fallout fixes).

## File List

- src/components/layout/AppShell.tsx (reworked: fixed 3-panel layout, Teambar, picker, script-tag labels, /match/:id handoff; PanelDivider/usePanelLayout/TabBar/DebuggerPanel removed from the page)
- src/components/teams/Teambar.tsx (new)
- src/components/teams/ScriptPicker.tsx (new)
- src/components/teams/index.ts (exports Teambar, ScriptPicker, EquipmentModal)
- src/components/editor/ScriptsPanel.tsx (reworked: list-only)
- src/components/editor/CodePanel.tsx (new; editor moved out of ScriptsPanel)
- src/components/editor/index.ts (exports CodePanel)
- src/components/layout/MatchStatusOverlay.tsx (pitch-anchored overlay, spinner + frames-estimate chip)
- src/components/canvas/TacticsCanvas.tsx (dnd removed; handle setScriptLabels/detachPlayerScript)
- src/components/canvas/engine/Game.ts (scriptLabels map, apply/drop, edit-sprite labels)
- src/components/canvas/engine/Player.ts (script tag + pill layers, setScriptLabel)
- src/lib/pickerPosition.ts (new)
- src/stores/tacticsStore.ts (createTactic(name?), duplicateTactic, saveTactic returns TacticConfig | null)
- src/pages/MatchPage.tsx (7.4 setTeamColors handoff)
- src/components/tactics/TabBar.tsx, src/components/tactics/index.ts (deleted; directory removed)
- tests/support/vitest-setup.ts (2d-context measurement stub + pixi globals)
- tests/unit/components/tab-bar.test.tsx (deleted)
- tests/unit/components/team-bar.test.tsx (new, 21 tests)
- tests/unit/lib/picker-position.test.ts (new, 7 tests)
- tests/unit/components/player-script-tag.test.ts (new, 6 tests)
- tests/e2e/tactic-tabs.spec.ts, tests/e2e/panel-layout.spec.ts (deleted)
- tests/e2e/teams-page.spec.ts (new, 5 tests)
- tests/e2e/practice-match.spec.ts (handoff updates)
- _bmad-output/implementation-artifacts/sprint-status.yaml (7-5 → done)

## Change Log

- 2026-09-21: Story 7.5 implemented — teams page layout (Scripts 255 | Code 430 | Terrain flex), Teambar with caret menu + creation modal + status pill, on-pitch script picker replacing drag-and-drop, player script tags, tacticsStore duplicate, practice-match handoff to /match/:id (in-place watch kept for 7.7), unit suite 588/588, e2e specs updated (full run deferred to 7.8). Status → done.
- 2026-09-21: Post-done UI feedback (Pelo) — picker no longer opens during player drags (Game.onPlayerDragStart fires on first real movement, AppShell closes it, selection ring stays); Monaco wordWrap 'off'; active script row restyled to the mockup tokens (var(--panel2) + corail inset ring + bold, usage chip on var(--bg)); token sweep of AppShell/MatchStatusOverlay/Timeline (non-editor surfaces ride the theme tokens); PanelDivider reintroduced — resizable scripts (200–480) & code (320–820) panels, persisted in localStorage `teams_panel_layout`, no collapse chevron, both handles on their panel's right edge (side="left"), testids `panel-divider-scripts`/`panel-divider-code`; custom Monaco themes (`la-ronde` solarized-flavored light on Pelo's request — "trop blanc, genre solarized" — and `la-ronde-dark` mockup palette) following the themeStore. Stale e2e color contract in workspace.spec.ts updated (rgb(244, 250, 246) = --panel2 light). Gates re-run: tsc ✓, eslint 0 errors ✓, unit 588/588 ✓.
- 2026-09-21: Post-done UI feedback (Pelo) — duplicate badges: the Brouillon/Prêt status pill was removed; the ready toggle now carries the state itself (green "Prêt" when ready, neutral "Prêt pour le match" otherwise, `data-status` kept for tests). A ready team whose lineup later breaks stays clickable so it can be un-readied (previously stuck disabled). Regression: un-ready with incomplete lineup. Unit 617/617.
