---
title: 'Collapsible & Resizable Workspace Panels'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: 'c1f20d47cd81834f57a17e2a242d5cdcdb9517f0'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The AI Scripts (left) and Debugger (right) workspace panels have hardcoded widths (280px / 300px) and cannot be hidden, so users cannot give more room to the editor, the debugger, or the canvas.

**Approach:** Make both outer panels resizable via draggable dividers and collapsible via chevron toggles; collapsed panels render as a thin vertical strip with a rotated title. Persist widths and collapsed state in localStorage and restore them on load.

## Boundaries & Constraints

**Always:**
- Persist layout as a single snake_case key `panel_layout` (matches `last_active_tactic_id` / `auth_token` convention).
- Persist on drag end (pointer up) and on every collapse toggle — never per pointer-move frame.
- Clamp widths: left ≥ 180px, right ≥ 220px, each ≤ 50% of the current viewport width. Clamp persisted values again on load (viewport may have shrunk since).
- Invalid/corrupt/unparsable stored layout falls back silently to defaults (left 280, right 300, both expanded).
- Keep the center canvas `flex: 1` — it absorbs all size changes (existing ResizeObserver handles Pixi reflow).
- Collapse toggle and reset (double-click) must not start a resize drag.

**Ask First:**
- If integrating reveals a conflict with existing drag interactions (script drag-and-drop) or the TacticsCanvas pointer handling that requires touching those files, HALT and ask.

**Never:**
- No resize/collapse for the center canvas, Timeline, Header, or TabBar.
- No third-party layout/resize libraries — plain React + inline styles, matching codebase conventions.
- No per-user layout storage (single device-level key), no zustand persistence for layout.
- No changes inside ScriptsPanel, MonacoEditor (`automaticLayout: true` already reflows), or DebuggerPanel internals.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh workspace | No `panel_layout` in localStorage | Left 280px, right 300px, both expanded | N/A |
| Drag left divider right | Pointer drag +120px, within limits | Left panel width follows pointer live; canvas shrinks; on pointerup saved to localStorage | Widths clamped to [180, 50vw] |
| Drag past limits | Pointer dragged to window edge | Panel stops at min/max clamp, no layout break | N/A |
| Reload after resize | Stored `{leftWidth: 412, ...}`, viewport 1600px | Left panel renders 412px | N/A |
| Stored width too big | Stored `leftWidth: 900`, viewport 1200px | Clamped to 600px (50vw) on load | Silent clamp |
| Corrupt storage | `panel_layout = "{oops"` | Defaults applied | Silent fallback, no console crash |
| Collapse left | Click chevron on left divider | Left panel replaced by 28px strip w/ rotated "AI Scripts" title; saved immediately | N/A |
| Expand from strip | Click strip | Panel reappears at its last stored width | N/A |
| Double-click divider | Dblclick on expanded-panel divider | Width resets to default (280/300) and saves | N/A |

</frozen-after-approval>

## Code Map

- `src/components/layout/AppShell.tsx` -- integration point; fixed widths in `styles.leftPanel`/`styles.rightPanel` (~lines 241, 253)
- `src/lib/panelLayout.ts` -- NEW: layout type, constants, `loadPanelLayout()` / `savePanelLayout()`, clamping
- `src/hooks/usePanelLayout.ts` -- NEW: React hook wrapping the lib (state + actions); follows `src/hooks/` conventions
- `src/components/layout/PanelDivider.tsx` -- NEW: divider component (drag, chevron toggle, dblclick reset)
- `src/stores/tacticsStore.ts` -- localStorage convention reference (`LAST_ACTIVE_KEY`, ~line 78)
- `src/hooks/useAutoSave.ts` -- hook style reference
- `tests/e2e/tactic-tabs.spec.ts` -- e2e pattern to copy: `userFactory.createAuthenticated()`, `seedAuthToken`, `data-testid` selectors
- `tests/unit/stores/tactics-store.test.ts` -- unit test style reference

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/panelLayout.ts` -- create lib: `PanelLayout` type, `PANEL_LAYOUT_KEY = 'panel_layout'`, defaults, min/max clamp, `loadPanelLayout()` (try/catch + validation) and `savePanelLayout()` -- single persistence entry point keeps AppShell dumb
- [x] `tests/unit/lib/panel-layout.test.ts` -- unit-test every I/O Matrix row (roundtrip, clamp, corrupt JSON, missing key) -- I/O edge cases must be covered at unit level
- [x] `src/hooks/usePanelLayout.ts` -- create hook: state from `loadPanelLayout()`, `resizeLeft/Right(width)`, `toggleLeft/Right()`, `resetSide(side)`; resize mutates state without persisting, `commit()` persists (call on pointerup) -- separates live drag from disk writes
- [x] `src/components/layout/PanelDivider.tsx` -- create divider: 6px hit area, `col-resize` cursor, hover highlight, Pointer Events with `setPointerCapture`, chevron button (stopPropagation) toggling collapse, double-click reset, `role="separator"` + `aria-label`, `data-testid` -- core interaction component
- [x] `src/components/layout/AppShell.tsx` -- wire dividers + dynamic widths + collapsed 28px strip (rotated title via `writing-mode: vertical-rl`, click to expand, `data-testid`); remove fixed widths from `styles.leftPanel`/`styles.rightPanel` -- the only existing file touched
- [x] `tests/e2e/panel-layout.spec.ts` -- e2e: drag divider → reload → width restored; collapse → reload → strip still visible → expand; persist via localStorage across reloads -- verifies the user-facing promise end to end

**Acceptance Criteria:**
- Given a fresh browser profile, when the workspace loads, then panels render at 280px/300px expanded and a `panel_layout` key is absent until first change.
- Given a completed drag, when the user reloads, then both panels render at the exact widths from before the reload.
- Given either panel collapsed, when the user reloads, then it still renders as the collapsed strip and the canvas fills the freed space.
- Given the user drags a divider, then existing behavior is unaffected: script drag-and-drop onto players, canvas player selection, and Monaco editing all still work.
- Given `npm run lint`, `npm run build`, and `npm run test:unit` run, then all pass with the new tests included.

## Design Notes

Divider interaction model (avoid drag/click ambiguity):
- Chevron button: `onMouseDown`/`onPointerDown` → `stopPropagation()` so it never starts a drag; `onClick` → toggle.
- Drag: `onPointerDown` on divider body → `setPointerCapture`, record start X + start width; `onPointerMove` → `onResize(startWidth + (x - startX) * direction)`; `onPointerUp` → `commit()` persist.
- While dragging: set `document.body.style.userSelect = 'none'` and restore on pointerup (prevents text selection flicker).

Collapsed strip (JetBrains-style edge tab):
```
┌──────┬─┬──────────────┐
│ strip│▶│   canvas     │   strip: 28px, rotated label,
│ (28) │ │              │   click = expand
```

Storage shape example:
```json
{ "leftWidth": 412, "rightWidth": 300, "leftCollapsed": false, "rightCollapsed": true }
```
Direction of resize: left divider +Δ widens left panel; right divider +Δ narrows right panel (invert sign for right side).

## Verification

**Commands:**
- `npm run lint` -- expected: no errors
- `npm run build` -- expected: TypeScript compiles clean
- `npm run test:unit` -- expected: all pass incl. new `panel-layout.test.ts`
- `npm run test:e2e -- tests/e2e/panel-layout.spec.ts` -- expected: all pass

**Manual checks (if no CLI):**
- Drag both dividers: smooth live resize, no text selection, Monaco reflows.
- Collapse each panel; reload: strip + widths restored.

## Suggested Review Order

**Persistence contract**

- One key, defaults + shape validation + silent fallback — the whole storage contract in 130 lines.
  [`panelLayout.ts:85`](../../src/lib/panelLayout.ts#L85)
- Per-side clamp [min, 50vw] with degenerate-viewport guard; load-time clamping stays pure 50vw by design.
  [`panelLayout.ts:55`](../../src/lib/panelLayout.ts#L55)
- Save never throws (private-mode storage) — persistence can never crash the shell.
  [`panelLayout.ts:128`](../../src/lib/panelLayout.ts#L128)

**Resize semantics**

- Drag-time width clamp: 50vw rule tightened so the canvas keeps 320px — the anti-crush guarantee.
  [`usePanelLayout.ts:44`](../../src/hooks/usePanelLayout.ts#L44)
- State vs persistence split: live drags mutate state, `commit()` writes on pointer-up only.
  [`usePanelLayout.ts:100`](../../src/hooks/usePanelLayout.ts#L100)
- Window-resize re-clamp keeps rigid panels inside the viewport after a shrink.
  [`usePanelLayout.ts:158`](../../src/hooks/usePanelLayout.ts#L158)

**Divider interaction**

- Jitter threshold: plain clicks/double-clicks never resize or materialize the storage key.
  [`PanelDivider.tsx:73`](../../src/components/layout/PanelDivider.tsx#L73)
- Pointer lifecycle: guarded capture, commit-only-if-moved, pointercancel + unmount userSelect cleanup.
  [`PanelDivider.tsx:125`](../../src/components/layout/PanelDivider.tsx#L125)
- Chevron never drags or resets; aria-expanded/aria-controls wire it to the panel.
  [`PanelDivider.tsx:133`](../../src/components/layout/PanelDivider.tsx#L133)

**Layout wiring**

- The one existing file touched: strip/panel+divider branches per side, canvas stays flex: 1.
  [`AppShell.tsx:219`](../../src/components/layout/AppShell.tsx#L219)
- Collapsed strips are real buttons (keyboard expandable) with side-correct borders.
  [`AppShell.tsx:206`](../../src/components/layout/AppShell.tsx#L206)
- Center minWidth floor pairs with the drag-time budget clamp.
  [`AppShell.tsx:339`](../../src/components/layout/AppShell.tsx#L339)

**Tests**

- 16 unit tests: every I/O Matrix row incl. corrupt JSON, clamps, storage-throw.
  [`panel-layout.test.ts:55`](../../tests/unit/lib/panel-layout.test.ts#L55)
- 4 e2e specs (×3 browsers): drag→reload→restore, inverted right drag, dblclick reset, collapse/expand persistence.
  [`panel-layout.spec.ts:36`](../../tests/e2e/panel-layout.spec.ts#L36)
