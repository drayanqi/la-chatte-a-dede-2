---
title: 'Home players on the left half — tactic positions are kickoff positions'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: 'a03255ff3203e329e54372cc4ad6e8a81414190d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tactic positions are each player's kickoff position, and home defends the left goal (game-rules.md: home attacks toward x=100) — yet the default formation places ATK1/ATK2 at x=60 and the e2e match-factory places them at x=70, i.e. in the opponent's half. The editor therefore shows half the user's team on the wrong side of the pitch.

**Approach:** Make the left half (x ≤ 50) the invariant for home players in the tactics bridge: the default formation moves its attackers to x=40, and any position arriving with x > 50 is mirrored across the halfway line (x' = 100 − x) on load and save, so legacy tactics self-heal while keeping their formation shape.

## Boundaries & Constraints

**Always:** Tactic positions are kickoff positions; home players always render and save with x in [0, 50]; mirroring applies only to x > 50 and is idempotent after one pass; y bounds unchanged (API 0-50, engine 0-100).

**Ask First:** Any change to backend/API validation (the API keeps accepting x 0-100 — the left-half rule lives in the bridge, not the DB constraint); any change to how the match engine interprets positions at kickoff.

**Never:** No DB migration or Laravel changes; no player drag-to-move implementation (story 3.2 owns that); no away-team/bot rendering changes (story 3.6 mirrors from the corrected home geometry).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New tactic | Click "+" with no tactics | Default formation all x ≤ 50: GK (8,25), DEF (25,15)/(25,35), ATK (40,15)/(40,35) | N/A |
| Legacy right-half player | Load tactic with player at x=60 | Engine renders x=40; next save persists x=40 | N/A |
| Already-left position | Player at x=40 | Unchanged (40 in, 40 out) | N/A |
| Halfway line | Player at x=50 | Stays 50 (no mirror at the boundary) | N/A |
| Out-of-range API value | Player at x=120 | Mirrored to −20, clamped to 0 | Clamp to [0, 50] |
| Y axis untouched | Player at API y=15 | Engine y=30 (×2), reverse ÷2 — existing behavior | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/tacticBridge.ts` -- single API↔engine conversion point; add left-half normalization helper and apply to x in both directions (load + save)
- `src/stores/tacticsStore.ts` -- `DEFAULT_FORMATION` (lines 69-75): ATK x 60 → 40
- `tests/unit/lib/tactic-bridge.test.ts` -- NEW: unit tests for the normalization matrix
- `tests/unit/stores/tactics-store.test.ts` -- asserts default-formation POST payload (lines 530-541)
- `tests/e2e/tactic-tabs.spec.ts` -- script drop targets at engine coords [60,30]/[60,70] (lines 154-160) must track the new ATK slots
- `tests/support/fixtures/factories/match-factory.ts` -- e2e tactic formation ATK x 70 → 30 + comment (lines 58-69)
- `_bmad-output/implementation-artifacts/3-2-team-lineup-configuration-ui.md` -- Dev Notes default-formation line (line 74)
- `_bmad-output/implementation-artifacts/3-6-easy-bot-ai.md` -- bot geometry "mirrored from 3.2" line (line 56): bot ATK becomes x=60

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/tacticBridge.ts` -- add `normalizeHomeX(x)`: if x > 50 → 100 − x, then clamp to [0, 50]; apply to `position.x` in `tacticConfigToTacticData` and `tacticDataToPlayerConfigs` -- invariant lives in one place; both load and save paths self-heal legacy data
- [x] `src/stores/tacticsStore.ts` -- change `DEFAULT_FORMATION` ATK1/ATK2 `positionX` 60 → 40 and update the comment to state the kickoff-left-half rule -- new tactics are kickoff-legal
- [x] `tests/unit/lib/tactic-bridge.test.ts` -- create: cover the I/O matrix (mirror 60→40, idempotence on second pass, 50 boundary, 120→0 clamp, y ×2/÷2 scaling unchanged) -- the normalization is the behavioral core of this change
- [x] `tests/unit/stores/tactics-store.test.ts` -- update expected default payload `position_x: 60` → `40` for slots 4-5 -- keep unit suite truthful
- [x] `tests/e2e/tactic-tabs.spec.ts` -- update drop targets [60,30]/[60,70] → [40,30]/[40,70] -- targets must hit players where they now render
- [x] `tests/support/fixtures/factories/match-factory.ts` -- ATK `position_x` 70 → 30; update comment to "kickoff positions in home's left half (x 0-50)" -- fixtures match the product rule
- [x] `_bmad-output/implementation-artifacts/3-2-team-lineup-configuration-ui.md` -- update the Dev Notes default formation to ATK (40,15)/(40,35) with the left-half note -- keep the story artifact truthful
- [x] `_bmad-output/implementation-artifacts/3-6-easy-bot-ai.md` -- update mirrored bot geometry to GK x=92, DEF x=75, ATK x=60 -- future bot story stays consistent with home geometry

**Acceptance Criteria:**
- Given a fresh user, when the workspace auto-creates "Tactic 1", then all 5 players render with x ≤ 50 (GK 8, DEF 25/25, ATK 40/40) and the POST payload sends exactly those values.
- Given a stored tactic with a player at x=60, when it loads into the canvas, then the player renders at x=40, and after any subsequent save the API holds x=40.
- Given a player at x=50, when the tactic loads and saves, then x stays exactly 50.
- Given the e2e suite, when the tactic-tabs "gate Test vs Bot" test assigns scripts to all 5 slots, then every drop lands on a player and all PUTs succeed.

## Design Notes

Why mirror instead of clamp: clamping to 50 parks players on the halfway line — for the old default ATK (60,15) that is exactly ON the center-circle boundary (distance 10 from center (50,25)), while the mirrored (40,15) sits ≈14.1 away, safely outside. Mirroring also preserves formation depth, so legacy tactics keep their shape.

The engine read-back path stays consistent because normalization happens before `loadTactic`: sprites hold the normalized position, so `getTactic()` → save round-trips the healed values.

Center-circle exclusion at kickoff is a match-engine concern (story 3.3); the editor only enforces the left-half invariant requested here. Backend validation intentionally still accepts x 0-100 so legacy rows never fail a save.

## Verification

**Commands:**
- `npm run test:unit` -- expected: all unit tests pass, including the new `tactic-bridge` suite
- `npm run lint` -- expected: no errors
- `npm run build` -- expected: tsc + vite build succeed
- `npx playwright test tests/e2e/tactic-tabs.spec.ts` -- expected: all tactic-tabs tests pass (requires dev servers per playwright.config.ts)

## Suggested Review Order

**The invariant**

- The whole rule in one line: mirror right-half x across the halfway line, then clamp to [0, 50]
  [`tacticBridge.ts:35`](../../src/lib/tacticBridge.ts#L35)

- Applied on load — legacy tactics render healed (60 → 40) before sprites are created
  [`tacticBridge.ts:53`](../../src/lib/tacticBridge.ts#L53)

- Applied on save — the next PUT persists healed values, making the fix self-healing
  [`tacticBridge.ts:80`](../../src/lib/tacticBridge.ts#L80)

**Kickoff-legal default formation**

- New tactics place all five players in home's left half (ATK 60 → 40), outside the center circle
  [`tacticsStore.ts:75`](../../src/stores/tacticsStore.ts#L75)

**Behavior pinned by tests**

- Mirror, idempotence, 50-boundary, 120→0 clamp, and untouched y-scaling — both directions
  [`tactic-bridge.test.ts:43`](../../tests/unit/lib/tactic-bridge.test.ts#L43)

- Default-formation POST payload asserted exactly (slots 4-5 now x=40)
  [`tactics-store.test.ts:536`](../../tests/unit/stores/tactics-store.test.ts#L536)

**Fixtures & e2e alignment**

- Script drop targets moved to where ATKs now render (engine coords 40,30 / 40,70)
  [`tactic-tabs.spec.ts:158`](../../tests/e2e/tactic-tabs.spec.ts#L158)

- Match-factory fixture formation made kickoff-legal (x=30) with a clarified comment
  [`match-factory.ts:67`](../../tests/support/fixtures/factories/match-factory.ts#L67)

**Artifact docs kept truthful**

- Story 3.2 Dev Notes: formation updated + left-half/bridge-normalization wording de-conflicted
  [`3-2-team-lineup-configuration-ui.md:74`](3-2-team-lineup-configuration-ui.md#L74)

- Story 3.6 bot geometry re-mirrored from the corrected home side (bot ATK x=60)
  [`3-6-easy-bot-ai.md:56`](3-6-easy-bot-ai.md#L56)
