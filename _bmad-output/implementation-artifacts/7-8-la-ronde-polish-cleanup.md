---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.8: La Ronde Polish & Cleanup

Status: ready-for-dev

## Story

As a player,
I want every remaining screen (login, register, modals, empty states) wearing the La Ronde identity,
So that no screen still looks like the old IDE.

## Acceptance Criteria

1. **Given** all pages after 7.1-7.7, **When** reviewed, **Then** auth pages, creation/assignment modals and empty states use the tokens (rounded cards, halos, light/dark), and dead code (old header, tab bar, overlay anatomy, debugger remnants) is removed.
2. **Given** the full test suite, **When** the end-of-epic sweep runs (lint, tsc, unit, e2e × 3 browsers), **Then** it passes, with e2e traversal rewritten for the new routes and a test covering the no-ready-team → Équipes → ready → back-to-Play flow.

## Scope Boundary (read first)

- Dead code list: `Header.tsx`, `TabBar.tsx`, `DebuggerPanel.tsx`, `RankedView.tsx` (overlay version), `LeaderboardView.tsx` (overlay version), `MatchStatusOverlay.tsx` (replaced by ResultCard + per-page overlays), `usePanelLayout`/`panelLayout.ts`/`PanelDivider.tsx`, `debuggerStore.ts`, `types/canvas-events.ts`/`canvas-commands.ts` (declared-unused), `WorkspacePage.tsx`/`AppShell.tsx` (fully replaced by TeamsPage by now), `useUnsavedChangesWarning` kept if still used. Delete corresponding unit tests + e2e (`panel-layout.spec.ts`).
- Auth pages: acard (26px radius, shadow-lg), DD crest logo, fields per mockup; keep ALL existing testids.
- Modals: creation (script/team), rename, delete confirms, equipment → shared token-styled veil/modal style.
- Empty states: scripts list, opponents, history, leaderboard — token cards.
- E2E traversal rewrite: all `/workspace` navigations → `/teams`; replay flows → `/match/:id`; ranked → `/play`; leaderboard → `/classement`; add `no-ready-team → /teams → ready → back to /play` flow test.
- End-of-epic sweep: `npm run lint`, `npx tsc -b`, `npm run test:unit`, `npm run test:e2e` (chromium+firefox+webkit, workers 1) — full pass or documented pre-existing failures (baseline comparison precedent from 4.3).

## Tasks / Subtasks

- [ ] Task 1: Auth pages restyle (Login/Register) — acard, tokens, halos, light/dark; testids unchanged
- [ ] Task 2: Modals + empty states token pass (script create/rename/delete, team create/rename/delete, equipment, picker)
- [ ] Task 3: Dead code removal (list above) + store/test cleanup; `stores/index.ts` barrel updated
- [ ] Task 4: E2E traversal rewrite + new flow test (no-ready → teams → ready → play); delete panel-layout spec
- [ ] Task 5: Full sweep — lint, tsc, unit, e2e × 3 browsers; fix or document failures
- [ ] Task 6: Story file updates (File List/Change Log) + sprint status → review

## Verification

- Full sweep green (or documented pre-existing), DoD checklist pass

## Dev Agent Record

### Completion notes

(pending)

## File List

(pending)

## Change Log

(pending)
