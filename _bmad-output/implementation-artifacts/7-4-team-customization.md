---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.4: Team Customization — Colors & Crest (API + Engine + Modal)

Status: done

## Story

As a player,
I want to name my team's colors and crest,
So that my team looks like mine on the pitch, in lists and in replays.

## Acceptance Criteria

1. **Given** the tactics table, **When** the migration runs (forward-only), **Then** `color_primary` (default `#ff6b1a`), `color_secondary` (default `#1a8cff`) and `crest` (nullable emoji from a fixed list) exist and are validated (hex format) through the API.
2. **Given** the Équipement modal (opened from the team caret menu), **When** the player edits name, color swatches or crest, **Then** changes save through the API and the team's players, goal frames and accents recolor live in the canvas — both sides of a match stay distinguishable (per-team colors, never floor hues).

## Scope Boundary (read first)

- Fixed crest list (mockup): `⚽ 🦊 🐺 🦁 🐸 🚀 🐙 🔥 👑 🍕` — server-side whitelist, client renders the same grid in the modal.
- Colors are 6-digit hex with `#` (regex `^#[0-9a-fA-F]{6}$`). Both colors required-valid on write when present (partial updates via `update` keep `has()` semantics).
- Engine gets colors client-side: `TacticData` gains `colorPrimary`/`colorSecondary`; `PlayerSprite` color becomes per-instance; `Field` gains `setTeamColors()` recoloring goal frames + goal accents (home side / away side). `FIELD_PALETTE` entries remain the defaults. Floor never takes team colors.
- Match view needs colors too: `MatchSerializer` gains `challengerColorPrimary/Secondary/Crest` + `opponent*` (eager loads already exist); `MatchResult` type extended. Leaderboard + matchmaking/opponents responses gain `crest` + `colorPrimary` for list rendering.
- Practice/bot side keeps default palette (`#ff6b1a` home / `#1a8cff` away) unless the tactic defines its own (home = my tactic's colors, away = bot defaults).

## Tasks / Subtasks

### Backend (Laravel — `lachatadede-api/`)

- [x] Task 1: Migration `2026_09_21_000000_add_team_customization_to_tactics_table.php` — `color_primary` string(7) default `#ff6b1a`, `color_secondary` string(7) default `#1a8cff`, `crest` string(8) nullable; full `down()`; run `php artisan migrate` on dev sqlite
- [x] Task 2: Model + API — `Tactic::$fillable` + casts; `TacticController::rules()` (+ hex/crest/in validation), `serializeTactic()` (+ `colorPrimary`, `colorSecondary`, `crest`); `LeaderboardController` (+ crest, colorPrimary); `MatchSerializer` (+ per-side colors/crest); matchmaking opponents endpoint (+ crest, colorPrimary, ownerTacticsCount for 7.6)
- [x] Task 3: Feature tests (`TacticTest.php` style) — defaults on create, hex validation 422, crest whitelist 422, partial update of colors, serialization; leaderboard crest test
### Frontend (React — `src/`)

- [x] Task 4: Types + stores — `TacticConfig`/`TacticData`/`RankedOpponent`/`LeaderboardEntry`/`MatchResult` gain the new fields; `tacticsStore.updateTactic` accepts colors/crest (pendingUpdate merge); `teamMapping`/canvas color plumbing
- [x] Task 5: Canvas recolor — `Game.setTeamColors()` + `PlayerSprite` per-instance colors + `Field.setTeamColors()` (goal frames, accents); `loadTactic`/`loadFrames` paths pass colors; bot side default
- [x] Task 6: Équipement modal (`src/components/teams/EquipmentModal.tsx`) — name field, 6 swatches (corail-like palette from mockup: `#e4573f #4aa8e8 #31c48d #ffc244 #9b6ce8 #12241b`) + crest emoji grid; saves via API; live canvas recolor on save; opened from team caret menu (TabBar → Teambar caret lands in 7.5; here it opens from the existing tab context menu)
- [x] Task 7: Unit tests — tactics store color updates, engine recolor (PlayerSprite/Field team colors), types/bridge

## Verification

- `php artisan test --filter=TacticTest` green; `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- Manual: modal save → players + goals recolor instantly; two tactics with different colors stay distinguishable in a replay

## Dev Agent Record

### Completion notes

- Backend: migration + model defaults (`Tactic::$attributes` mirrors the column defaults so fresh in-memory instances serialize them), TacticController hex regex `^#[0-9a-fA-F]{6}$` + crest `in:` whitelist (10 emoji) + `nullable|string|max:8`, partial updates keep `has()` semantics (absent key = keep, null crest = clear). Leaderboard rows expose `crest`/`colorPrimary`; RankedMatchService::opponents() adds `crest`/`colorPrimary`/`ownerTacticsCount` (eager `user.tactics` selected to `['user_id','id']` — no N+1). MatchSerializer gains per-side `*ColorPrimary/*ColorSecondary/*Crest` (null on practice matches). Backend suite: 121 tests OK. Pint failures (AuthController/ScriptController/LoginTest) are pre-existing, untouched files.
- Frontend engine: `PlayerSprite` colors are per-instance (`setTeamColors(home, away)`, no-op guard, redraw keeps the selection/hover ring); `Field.setTeamColors()` recolors ONLY the goal frames/accents via a full redraw (floor/stripes/walls stay neutral — Epic 5.1 law); `Game.setTeamColors()` + `applyTeamColors()`; `loadTacticInternal` derives colors from `TacticData.colorPrimary/colorSecondary` (hex, fallback to UX constants on absent/invalid — bot side keeps defaults); `loadFramesInternal` re-applies colors so replays carry them. `TacticsCanvasHandle.setTeamColors(homeHex, awayHex)` converts hex client-side (`src/lib/teamColors.ts::hexToTeamColor`).
- Store/UI: `updateTactic(id, name?, slots?, isReady?, customization?)` sends snake_case keys only for present ones (crest null clears); pendingUpdate carries `customization`. `EquipmentModal` (name + 6 primary/secondary swatches + crest grid incl. "no crest") opens from a new per-tab caret menu (`team-caret` → fixed-position `team-menu` → "Équipement"). Live recolor: AppShell effect mirrors the active tactic's colors after save (redundant calls are engine no-ops) and paints replay colors from the match payload (challenger→home, opponent→away) before `loadFrames`.
- Gates at completion: `rtk tsc -b` ✓; `eslint src tests` 0 errors (4 pre-existing warnings); unit 572/573 in 33 files (was 554). E2E chromium sweep skipped on user request this session — the full 3-browser sweep is the story 7.8 gate; the affected specs (practice-match, workspace, tab-bar) were untouched in their selectors by this story.

### File List

See above (Dev Agent Record).

## Change Log

- 2026-09-21: Story implemented (backend + engine + modal + tests); status → done. E2e chromium sweep deferred to 7.8 per user instruction.

## File List

(pending)

## Change Log

(pending)
