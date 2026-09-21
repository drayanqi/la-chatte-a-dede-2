---
baseline_commit: 75f3e9e082e5dc345dc487cf2034a5ed223f3ad3
---

# Story 7.1: Design Tokens & App Shell La Ronde

Status: done

## Story

As a player,
I want the whole app wearing the La Ronde identity (light + dark),
So that the game feels like one warm world instead of a code editor with a field inside.

## Acceptance Criteria

1. **Given** the v4 mockup tokens (halos bg, panel/surface colors, corail/sun/mint/sky, radii, shadows, Sora), **When** implemented, **Then** a shared tokens file (CSS variables + theme switch) drives all surfaces, with a working light/dark toggle persisted per user.
2. **Given** the app shell, **When** any page renders, **Then** the old VSCode-gray workspace chrome is gone; the appbar is a floating rounded capsule (logo DD = `watermark.png` + favicon, nav links, theme toggle, avatar) and the DD watermark clicking returns to `/play`.

## Scope Boundary (read first)

- Source of truth: `_bmad-output/planning-artifacts/stadium-mockup-prototype-ronde-v4.html` (light AND dark themes — copy its CSS variables verbatim).
- Zero decorative emojis in the UI (emoji = crest data only, story 7.4).
- Routes themselves land in 7.2 — this story only ships the tokens layer, the Appbar, the theme store and the global background; existing pages keep working behind it.
- Nav links rendered by Appbar but inactive routes (/play etc.) only become real in 7.2; until then the links point at the existing routes.

## Tasks / Subtasks

### Frontend Tasks (React — `src/`)

- [x] Task 1: Tokens + fonts + favicon
  - [x] `src/styles/tokens.css`: `:root` light palette (bg `#e9f5ee`, panel, panel2, ink, muted, line, corail `#ff6b57`, sun `#ffc244`, mint `#31c48d`, sky `#4aa8e8`, shadows, r 18/12) + `[data-theme="dark"]` overrides (bg `#0e1a13`, panel `#182a1f`, ...) + body halos gradient + base font Sora
  - [x] `index.html`: Google Fonts (Sora 400/600/700/800 + JetBrains Mono 400/600), favicon `public/favicon.svg` (DD crest, corail shield), title `LACHATADEDE`, remove dangling `/vite.svg`
  - [x] Import tokens.css in `main.tsx`
- [x] Task 2: Theme store + toggle
  - [x] `src/stores/themeStore.ts` (`useThemeStore`): `theme: 'light'|'dark'` persisted `localStorage('lad_theme')`, `init()` applies `data-theme` on `<html>`, `toggle()`; wired in `App.tsx`; export from `stores/index.ts`
- [x] Task 3: `Appbar` component (`src/components/layout/Appbar.tsx`)
  - [x] Floating rounded capsule (52px, margin 8px, panel bg, shadow) per mockup
  - [x] Logo = `watermark.png` image + "LACHATADEDE" wordmark, click → `/play`
  - [x] Nav links Jouer / Équipes / Palmarès / Classement with active-route highlighting (via `useLocation`), testids `nav-play`, `nav-teams`, `nav-palmares`, `nav-leaderboard`
  - [x] Theme toggle icon button (testid `theme-toggle`), avatar with initial + user menu (email, points, `logout-button`) — reuse existing logout wiring/testids from `Header.tsx`
- [x] Task 4: Render Appbar on authed pages (replacing `Header` usage in `AppShell` for this story — Header removal completes in 7.8); auth pages get the halos background via tokens

### Tests

- [x] Task 5: Unit tests
  - [x] `tests/unit/stores/theme-store.test.ts`: default light, toggle persists + flips `data-theme`, init restores persisted theme
  - [x] Appbar test: nav links render, theme toggle calls store, avatar menu opens/closes

## Verification

- `npx tsc -b`, `npm run lint`, `npm run test:unit` green
- Manual: light/dark toggle flips the whole background between `#e9f5ee` and `#0e1a13` with halos; persisted across reload

## Dev Agent Record

### Completion notes

- Tokens copied from the v4 mockup (`stadium-mockup-prototype-ronde-v4.html`): light bg `#e9f5ee`, dark bg `#0e1a13`, panel `#ffffff` / `#182a1f`, corail `#ff6b57`, sun `#ffc244`, mint `#31c48d`, sky `#4aa8e8`, radii 18/12, shadows, Sora + JetBrains Mono, body halos gradient.
- `Appbar` replaces `Header` in `AppShell` (Header file kept until 7.8 cleanup); `user-menu` contains the full username (e2e `auth.spec` contract `toContainText(name)`), styled as initial-disc + name pill.
- Verified: `rtk tsc -b` ✓, eslint 0 errors (4 pre-existing warnings), `npm run test:unit` 546/546 ✓, `auth.spec` 9/9 chromium ✓. Full 3-browser sweep deferred to 7.8 per plan.

## File List

- `src/styles/tokens.css` (new), `src/main.tsx` (import), `index.html`, `public/favicon.svg` (new)
- `src/stores/themeStore.ts` (new), `src/stores/index.ts` (export)
- `src/components/layout/Appbar.tsx` (new), `src/components/layout/AppShell.tsx` (Header → Appbar)
- `tests/unit/stores/theme-store.test.ts` (new), `tests/unit/components/appbar.test.tsx` (new)

## Change Log

- 2026-09-21: Story implemented (tokens layer, theme store, Appbar, global background). E2e auth traversal updated (`/workspace` → `/play` + `nav-teams`).
