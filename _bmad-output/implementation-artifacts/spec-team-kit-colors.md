---
title: 'Team kits in the match view + distinct colors in the Équipement modal'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'b104430cc61f6d15b8107b45221c88a50542852e'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** In the match view the away side never wears its real away kit: when both teams share a primary color the code falls back to the DEFAULT away blue instead of the away team's own secondary, and the replay drawer paints every badge/chip/disc/stat value with a static base palette (`#ff6b1a`/`#1a8cff`) regardless of the teams' actual colors — so customized colors barely show. On top, the Équipement modal still lets a team pick primary == secondary, which makes its away kit meaningless.

**Approach:** Centralize kit resolution in `src/lib/teamColors.ts` — home always wears its primary; away wears its primary unless it reads as home's color, then changes into its OWN secondary, then the engine defaults. Feed the resolved hexes to the match page (canvas, score pill, celebration), the replay drawer (accents AND event badges), and the goal confetti. Enforce distinct colors in the modal (cross-row swatches disabled, legacy equal pairs reseeded on open) and server-side (422 on an effective equal pair).

## Boundaries & Constraints

**Always:**
- Home side always renders its primary color — home never falls back.
- Away kit ladder: away primary → away secondary (only when present AND distinct from home) → `PLAYER_AWAY_HEX` → `PLAYER_HOME_HEX`; "same color" = `teamHexDistance(homeHex, candidate) >= AWAY_COLLISION_DISTANCE` (existing story-7.6 law, kept).
- Backend validation compares the EFFECTIVE pair (incoming-or-current values, partial updates included) and rejects equality with 422.
- Practice matches keep today's outcome: challenger wears its tactic colors, bot wears the default ladder.

**Ask First:**
- If removing `EVENT_TEAM_COLORS` breaks an importer other than the drawer.
- If the new away ladder changes a practice-match bot outcome in any tested scenario.

**Never:**
- No migration, no column change, no new endpoint; `MatchSerializer` shape unchanged (all fields already exist).
- No change to Epic 5.1's law: floor/stripes/walls never take team colors.
- No change to the bot's default palette or `SystemTacticService`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ranked, distinct primaries | home `#e4573f`, away `#4aa8e8` | away wears `#4aa8e8` everywhere | N/A |
| Ranked, same primary | both `#31c48d`, away secondary `#ffc244` | away wears `#ffc244` (its OWN kit, not the default blue) | N/A |
| Same primary + colliding secondary | home `#4aa8e8`, away `#4aa8e8`/`#1a8cff` | away ladder ends on `PLAYER_HOME_HEX` `#ff6b1a` | N/A |
| Practice match | challenger tactic colors, opponent side null | home = challenger primary; away = default ladder (unchanged behavior) | N/A |
| Drawer event colors | match with custom colors | badges/chips/discs/stat values use the resolved kits, not the base palette | N/A |
| Modal, legacy equal pair | tactic stored with primary == secondary | modal opens with secondary reseeded to a different palette swatch | N/A |
| Modal cross-row pick | click the swatch equal to the other row's selection | click ignored — swatch disabled + visually dimmed | N/A |
| API equal pair | store or update that would make effective primary == secondary | 422 validation error | client keeps state, shows API error |

## Code Map

- `src/lib/teamColors.ts` -- add `resolveMatchKits(home, away)`; extend `resolveAwayTeamHex`'s candidate ladder with the away secondary
- `src/pages/MatchPage.tsx` -- two duplicated resolution blocks (lines ~138-142, ~443-444) → single `resolveMatchKits` call
- `src/components/match/ReplayDrawer.tsx` -- lines 92-93 + all `EVENT_TEAM_COLORS` uses → resolved kits (accents vars + badges/chips/discs/stat values)
- `src/lib/matchEvents.ts` -- remove static `EVENT_TEAM_COLORS` (drawer is its only consumer)
- `src/components/teams/EquipmentModal.tsx` -- cross-row disabled swatches + seed normalization for legacy equal pairs
- `lachatadede-api/app/Http/Controllers/TacticController.php` -- effective-pair distinctness in `store()` + `update()` (after the has()/changes resolution)
- `lachatadede-api/tests/Feature/Tactics/TacticTest.php` -- 422 tests (store, update, partial update)
- `src/components/canvas/engine/Game.ts` -- line ~332 confetti uses `this.teamColors.home/away` instead of static constants
- `tests/unit/lib/team-colors.test.ts` -- rewrite the ladder tests for the secondary-kit step
- `tests/unit/components/replay-drawer.test.tsx` -- assert badges use resolved kit colors
- `tests/unit/components/equipment-modal.test.tsx` (new) -- cross-row disable + legacy reseed

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/teamColors.ts` -- extend `resolveAwayTeamHex(homeHex, awayHex, awaySecondaryHex?)` and add `resolveMatchKits(home?, away?)` returning `{ homeHex, awayHex }` -- one source of truth for the kit law
- [x] `src/pages/MatchPage.tsx` -- replace both resolution blocks with `resolveMatchKits(replayMatch)` (challenger = home side, opponent = away) -- dedupe + away kit
- [x] `src/components/match/ReplayDrawer.tsx` -- derive kits via `resolveMatchKits(match)`; local `teamColor` map replaces every `EVENT_TEAM_COLORS` use; `--home-accent`/`--away-accent` keep the resolved values -- drawer stops painting base colors
- [x] `src/lib/matchEvents.ts` -- delete `EVENT_TEAM_COLORS` (and its now-unused import) -- dead static palette out
- [x] `src/components/canvas/engine/Game.ts` -- confetti scorer color from `this.teamColors` -- celebration matches the teams
- [x] `src/components/teams/EquipmentModal.tsx` -- disable the swatch equal to the other row's selection (both rows), dimmed style, `disabled` attr; on open/reseed, if stored primary == secondary, reseed secondary to the first different `TEAM_COLOR_SWATCHES` entry -- cannot save an equal pair
- [x] `lachatadede-api/app/Http/Controllers/TacticController.php` -- after resolving `$changes`, if effective primary == secondary → 422 `['message' => ...]`; same check in `store()` -- server-side guarantee
- [x] `lachatadede-api/tests/Feature/Tactics/TacticTest.php` -- add equal-pair 422 cases (store, full update, partial update keeping the other color) -- locks the contract
- [x] `tests/unit/lib/team-colors.test.ts`, `tests/unit/components/replay-drawer.test.tsx`, `tests/unit/components/equipment-modal.test.tsx` -- update/extend per the I/O matrix -- matrix covered by unit tests

**Acceptance Criteria:**
- Given a ranked match where both tactics picked the same primary, when the replay plays, then home wears its primary and away wears its OWN secondary in the canvas, score pill, celebration overlay and drawer badges.
- Given tactics with distinct primaries, when watching the match, then each side wears its primary everywhere (canvas, pill, celebration, drawer, confetti).
- Given a practice match, when watching, then the challenger keeps its colors and the bot side outcome is unchanged from today.
- Given the Équipement modal, when the user tries to pick for one row the color selected in the other, then the swatch is disabled; opening a legacy equal-pair tactic reseeds the secondary instead.
- Given an API write that sends at least one color and whose effective pair is equal (case-insensitive), when it hits `store`/`update`, then it fails 422 and nothing is persisted; a write touching no color key (rename, ready-toggle, lineup save) is never vetoed by a stored legacy equal pair.

## Verification

**Commands:**
- `npm run test:unit` -- expected: green, incl. new/updated team-colors, drawer, equipment-modal tests
- `npx tsc -b` -- expected: no errors
- `npm run lint` -- expected: no new errors
- `php artisan test --filter=TacticTest` -- expected: green incl. new 422 cases (run in `lachatadede-api/`)

**Manual checks:**
- Edit a team's colors, play Test vs Bot with a same-primary setup, watch: away side shows its secondary kit on the pitch, pill, badges.

## Spec Change Log

- 2026-09-24 (step-04 review, patch tier): three-reviewer pass (blind hunter, edge-case hunter, acceptance auditor — all ACs + matrix rows MET) surfaced two real defects, both patched. (1) The update-side effective-pair 422 fired even when the request sent NO color key, bricking rename/ready/lineup saves on legacy equal-pair rows — the check is now gated on a sent color key (the frozen matrix row says 422 for writes that would MAKE the pair equal; a rename never chose a color, and the intent heals legacy pairs via the modal); AC #5 amended accordingly; locked by `test_update_tactic_without_color_keys_allows_legacy_equal_pair`. (2) Hex equality was case-sensitive on both sides while the collision law is case-insensitive — PHP comparisons now `strtolower`, the modal seeds lowercased hexes; locked by `test_create_tactic_rejects_case_variant_of_equal_pair` + a modal case-variant test. Deferred: the column-default literals (`#ff6b1a`/`#1a8cff`) are duplicated across the model attributes, `store()` defaults and the distinctness checks — extract `Tactic::COLOR_*_DEFAULT` constants in a later hygiene pass. Rejected after verification: missing `MatchResult` secondary fields (they exist in shared.ts + MatchSerializer), uninitialized `teamColors` (class-field default), orphaned `EVENT_TEAM_COLORS` importers (zero), vacuous fixture assertions (checked against `formationPayload`/`makeFrames`).

## Suggested Review Order

**The kit law — one resolver**

- The away ladder: own primary → OWN secondary → engine defaults, collision = story-7.6 distance law
  [`teamColors.ts:63`](../../src/lib/teamColors.ts#L63)

- `resolveMatchKits` — single source of truth; home never falls back
  [`teamColors.ts:95`](../../src/lib/teamColors.ts#L95)

**Match view consumption**

- Canvas kits before `loadFrames` (challenger = home, opponent = away)
  [`MatchPage.tsx:139`](../../src/pages/MatchPage.tsx#L139)

- Score pill + celebration share the same resolution (duplication removed)
  [`MatchPage.tsx:451`](../../src/pages/MatchPage.tsx#L451)

- Drawer kits: accents + crest backgrounds now ride the resolver
  [`ReplayDrawer.tsx:95`](../../src/components/match/ReplayDrawer.tsx#L95)

- Every badge/chip/disc/stat value painted from resolved kits — no static palette
  [`ReplayDrawer.tsx:107`](../../src/components/match/ReplayDrawer.tsx#L107)

- Confetti celebrates in the kit actually worn
  [`Game.ts:334`](../../src/components/canvas/engine/Game.ts#L334)

**Editor constraint (primary ≠ secondary)**

- Seed helpers: lowercase normalization + legacy equal-pair reseed
  [`EquipmentModal.tsx:24`](../../src/components/teams/EquipmentModal.tsx#L24)

- Primary row: the secondary's swatch is untouchable
  [`EquipmentModal.tsx:112`](../../src/components/teams/EquipmentModal.tsx#L112)

- Secondary row: same law, mirrored
  [`EquipmentModal.tsx:138`](../../src/components/teams/EquipmentModal.tsx#L138)

**Server-side rule (422)**

- store(): effective pair (incoming-or-default), case-insensitive equality
  [`TacticController.php:49`](../../lachatadede-api/app/Http/Controllers/TacticController.php#L49)

- update(): fires only when a color key is sent — renames/ready/lineup saves never vetoed
  [`TacticController.php:137`](../../lachatadede-api/app/Http/Controllers/TacticController.php#L137)

**Static palette removal**

- `EVENT_TEAM_COLORS` deleted — the drawer was its only consumer
  [`matchEvents.ts:13`](../../src/lib/matchEvents.ts#L13)

**Tests**

- Secondary-kit ladder + `resolveMatchKits` contract
  [`team-colors.test.ts:114`](../../tests/unit/lib/team-colors.test.ts#L114)

- Drawer paints resolved kits (accents + goal badges in rgb)
  [`replay-drawer.test.tsx:273`](../../tests/unit/components/replay-drawer.test.tsx#L273)

- Modal: cross-row disable, reseed, case-insensitive seeding, save contract
  [`equipment-modal.test.tsx:48`](../../tests/unit/components/equipment-modal.test.tsx#L48)

- API: case-variant pair rejected; legacy equal-pair row still renamable
  [`TacticTest.php:863`](../../lachatadede-api/tests/Feature/Tactics/TacticTest.php#L863)
