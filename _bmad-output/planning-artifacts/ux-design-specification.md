---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/analysis/brainstorming-consolidated.md'
workflowType: 'ux-design'
lastStep: 9
status: 'in-progress'
documentCounts:
  prd: 1
  briefs: 0
  brainstorming: 1
  projectDocs: 0
  projectContext: 0
---

# UX Design Specification - Lachatadédé

**Author:** Pelo
**Date:** 2026-01-15

---

## Executive Summary

### Project Vision

Lachatadédé is a competitive programming platform where JavaScript developers code AI to control 5v5 indoor football teams. The core UX promise is **instant iteration** — the fastest feedback loop in the programming game genre. Users should flow seamlessly from idea → code → test → understand → iterate, all within seconds.

### Target Users

**Primary Audience:** JavaScript developers who want to express strategic thinking through code.

| Persona | Profile | Core Need |
|---------|---------|-----------|
| **The Spark** | Junior dev seeking creative coding projects | Zero-friction onboarding, immediate "aha!" moment |
| **The Ritualist** | Experienced coder with regular play sessions | Quick iteration loop, easy AI versioning, async ranked |
| **The Detective** | Competitive player hunting edge cases | Powerful debug tools, tick-level replay analysis |

**User Characteristics:**
- All users proficient in JavaScript (no coding onboarding needed)
- Desktop-only experience (optimized for large screens, keyboard shortcuts)
- Session pattern: 20 min code → 10 min play → repeat (~1 hour total)
- Solo play focus (social features deferred to post-MVP)

### Key Design Challenges

1. **API Discoverability** — Users know JavaScript but must learn the game API. Documentation must be discoverable without leaving the coding flow.

2. **Context Switching Cost** — The editor → lineup → match → replay → editor cycle must feel seamless. Each transition risks breaking flow state.

3. **Information Density** — Debug panel, match visualization, and code compete for screen real estate. Must feel organized, not overwhelming.

4. **Behavior Traceability** — When AI behaves unexpectedly, users must instantly understand *why*. Log-to-code correlation is critical.

### Design Opportunities

1. **Inline API Documentation** — Monaco autocomplete with rich tooltips and examples. Documentation lives inside the editor, not in a separate tab.

2. **Persistent Editor Layout** — Code visible alongside replay. Users read their AI logic while watching it execute.

3. **Keyboard-First Interactions** — Desktop power users expect shortcuts. Cmd+Enter to test, Space to pause, arrow keys to scrub.

4. **Smart Debug Filtering** — Click a player in the match → debug panel filters to that player. Direct manipulation reduces cognitive load.

## Core User Experience

### Defining Experience

The core experience of Lachatadédé is **understanding through observation**. While users write code in the editor, the true product experience happens in the replay — watching AI behavior unfold and comprehending exactly why each decision was made.

**Core User Action:** Debug and replay analysis — understanding why AI behaved the way it did.

**Core Loop:** Code → Test → Watch → Understand → Iterate

The editor is the input mechanism. The match replay with debug panel is where value is delivered.

### Platform Strategy

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Platform** | Desktop web only | Optimized for large screens, precision mouse control, keyboard shortcuts |
| **Input** | Mouse + Keyboard | Power users expect shortcuts; replay scrubbing needs precision |
| **Browser** | Modern evergreen (Chrome, Firefox, Safari, Edge) | No legacy support needed; enables modern APIs |
| **Offline** | Not required | All matches simulated server-side; internet required |

### Effortless Interactions

**Must Feel Instant:**
- Replay scrubbing — tick-by-tick navigation should feel like video scrubbing
- Practice match start — one click from editor to running match
- Debug panel filtering — click player to filter logs immediately

**Must Feel Natural:**
- Switching between AI files while watching replay
- Correlating log entries with game moments
- Pausing and resuming playback

### Critical Success Moments

| Moment | Description | Success Criteria |
|--------|-------------|------------------|
| **The Revelation** | User understands WHY their AI made a bad decision | Debug log clearly shows the triggering condition |
| **The Control Feeling** | User realizes their code dictates every team movement | Watching replay feels like watching a puppet show they directed |
| **The Iteration Spark** | User immediately knows what to change after watching | Clear path from "I saw the problem" to "I know the fix" |
| **The First Goal** | New user's AI scores against practice bot | Happens within first 20 minutes of playing |

### Experience Principles

1. **Clarity Over Speed** — Users value understanding more than faster matches. Every UX decision should make AI behavior more transparent, even at the cost of additional UI complexity.

2. **The Replay is Sacred** — Match visualization and debug panel are the emotional center of the product. This experience must be polished, responsive, and delightful. No compromises.

3. **Seamless Scrubbing** — Navigating through match ticks must feel like scrubbing a video timeline — instant feedback, zero lag, complete control. This is the most-used interaction.

4. **Agency Through Visibility** — Users feel in control when they can SEE their decisions playing out. Always show the connection between code logic and on-field behavior.

## Desired Emotional Response

### Primary Emotional Goals

**Core Emotion: Curiosity**
The dominant feeling should be "I want to try one more thing..." — an addictive pull that keeps users iterating. Not accomplishment, not mastery, but endless curiosity about what their next tweak will do.

**Secondary Emotions:**
- **Entertainment** — Watching matches should feel like "absolute cinema," not debugging
- **Humor** — Failures should make users laugh, not rage ("my AI is so dumb")
- **Agency** — Every outcome traces back to user decisions

### Emotional Journey Mapping

| Stage | Emotion | UX Goal |
|-------|---------|---------|
| Discovery | Intrigued | "This looks fun, I want to try it" |
| First Match | Amused | "My AI did something! Even if it was dumb" |
| First Loss | Curious | "Why did that happen? Let me check the logs" |
| First Win | Satisfied | "My code caused that goal — I did that" |
| Iteration | Addicted | "Just one more tweak..." |
| Replay Viewing | Entertained | Watching feels like spectating a sport |
| Ranked Loss | Determined | "I see the problem, I know the fix" |

### Micro-Emotions

**Must Cultivate:**
- Confidence → Users trust they can understand any AI behavior
- Amusement → Failures are funny, not frustrating
- Anticipation → Excitement before each match result
- Pride → "I made something that works"

**Must Prevent:**
- Confusion → Never lose without understanding why (THE cardinal sin)
- Helplessness → Always show a clear next step
- Tedium → Iteration must feel fast, never grindy
- Isolation → Even in solo play, the spectacle creates shared language

### Design Implications

| Emotion Goal | UX Design Approach |
|--------------|-------------------|
| **Curiosity** | Make testing instant; remove all friction between "idea" and "result" |
| **Entertainment** | Match visualization should be polished, satisfying physics, smooth animations |
| **Humor** | Debug logs should make AI "stupidity" visible and understandable |
| **Clarity** | Every tick, every decision, every behavior traceable to code |
| **Determination** | After any loss, the "fix path" should be obvious within 30 seconds |

### Emotional Design Principles

1. **Curiosity Over Completion** — Don't reward finishing; reward exploring. The fun is in the "one more thing," not the leaderboard climb.

2. **Cinema, Not Diagnostics** — Match replays are entertainment first, debugging second. Polish the viewer like it's a spectator sport.

3. **Laugh at Failure** — If users can't laugh at their AI's mistakes, we've failed at clarity. Visible stupidity is funny; invisible stupidity is frustrating.

4. **Zero Confusion Tolerance** — Any moment of "why did that happen?" without an answer is a UX failure. The debug panel must always have the answer.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**VSCode / Monaco Editor**
- Autocomplete with rich tooltips and examples (not just signatures)
- Keyboard-first design for power users
- Instant feedback (errors appear while typing)
- Minimal chrome — code is the star

**Leek Wars**
- Excellent live match execution quality
- Working competitive game loop
- *Weakness:* Complex, cluttered UI that overwhelms new users

**Football Manager**
- Tactical depth that makes players feel like coaches
- Complex information organized with clear hierarchy
- Addictive "one more match" iteration loop

**Haxball**
- Clean, readable 2D aesthetic
- Satisfying arcade physics
- *Enhancement opportunity:* Add celebration moments (confetti, lights on goals)

### Transferable UX Patterns

**Navigation:**
- Tab-based workspace for multiple AI files (VSCode)
- Collapsible sidebar for focused coding (VSCode)
- Persistent layout that remembers user preferences (FM)

**Interactions:**
- Cmd+P fuzzy search for quick file access (VSCode)
- Timeline scrubbing with hover preview (YouTube)
- Space bar universal pause/play (video players)
- Inline hover actions for file management (VSCode)

**Visual:**
- Minimal chrome — pitch dominates screen real estate (Haxball)
- Color-coded team and player identification (FM)
- Goal celebrations with confetti, lights, screen effects (sports games)
- Smooth, satisfying ball physics (Haxball)

### Anti-Patterns to Avoid

| Anti-Pattern | Risk | Mitigation |
|--------------|------|------------|
| Feature overload | Analysis paralysis, cognitive overwhelm | Ship fewer features with more polish |
| Modal dialogs | Flow state interruption | Use inline editing and slide-out panels |
| Hidden debug info | "Why did that happen?" confusion | Debug panel always visible during replay |
| Loading spinners | Kills iteration speed | Optimistic UI, background processing |
| Tiny click targets | Precision frustration | Generous hit areas + keyboard shortcuts |

### Design Inspiration Strategy

**Adopt Directly:**
- Monaco editor with custom autocomplete (VSCode quality)
- Space bar pause, arrow key scrubbing (universal video patterns)
- Haxball's clean 2D pitch aesthetic

**Adapt for Our Needs:**
- Leek Wars' live execution quality + simplified UI
- Football Manager's data hierarchy + our debug panel
- VSCode tabs + our AI file management

**Enhance Beyond Inspiration:**
- Goal celebrations (confetti, lights, screen shake) — make scoring feel SPECIAL
- Click-to-filter debug panel — direct manipulation innovation
- Side-by-side code + replay — unique to our "understanding" focus

**Explicitly Avoid:**
- Leek Wars' UI complexity
- Feature creep before core polish
- Any interaction requiring more than 2 clicks for common actions

## Design System Foundation

### Design System Choice

**Primary Framework:** Tailwind CSS + shadcn/ui components

**Rationale:**
- Full visual control for custom match visualization
- Tailwind's utility-first approach enables rapid iteration
- shadcn/ui provides accessible, unstyled component primitives
- No vendor lock-in — components are copy-pasted and owned
- Developer already proficient with Tailwind

### Color Strategy

**Theme:** VSCode Dark-inspired with strategic contrast

| Element | Color | Hex | Purpose |
|---------|-------|-----|---------|
| Editor Background | Dark Charcoal | `#1e1e1e` | Familiar coding environment |
| Panel Background | Slightly Lighter | `#252526` | Subtle depth separation |
| Borders | Subtle Gray | `#3c3c3c` | Structure without distraction |
| Primary Text | Light Gray | `#d4d4d4` | High readability |
| Muted Text | Medium Gray | `#808080` | Secondary information |
| Accent (Primary) | VSCode Blue | `#007acc` | Interactive elements, links |
| Success | Teal Green | `#4ec9b0` | Positive feedback, wins |
| Warning | Soft Yellow | `#dcdcaa` | Caution states |
| Error | Soft Red | `#f14c4c` | Errors, losses |
| Pitch Area | Lighter Green | Custom | Contrast focal point |

**Dark/Light Balance Strategy:**
- **Dark:** Editor, debug panel, navigation, sidebars
- **Lighter:** Match pitch area (the "stage" needs to stand out)
- **Bright:** Goal celebrations, important highlights, CTAs

### Implementation Approach

**Component Library:** shadcn/ui
- Install base components: Button, Tabs, Dialog, Dropdown, Tooltip
- Customize with Lachatadédé color tokens
- Build custom: MatchViewer, DebugPanel, TimelineScrubber, LineupSelector

**Tailwind Configuration:**
- Extend theme with VSCode-inspired color palette
- Define semantic color tokens (background, foreground, accent, muted)
- Configure dark mode as default (no toggle needed for MVP)

**Custom Components (Build from scratch):**
- Match Canvas (WebGL/Canvas2D for game rendering)
- Debug Log Panel (virtual scrolling for performance)
- Timeline Scrubber (custom slider with tick markers)
- Lineup Selector (drag-and-drop AI assignment)

### Typography Strategy

**Font Stack:** System fonts for performance, monospace for code

| Use Case | Font | Weight |
|----------|------|--------|
| UI Text | System UI (-apple-system, etc.) | 400, 500, 600 |
| Code/Logs | Monaco/Menlo/Consolas | 400 |
| Headings | System UI | 600 |

**Type Scale:**
- Base: 14px (matches VSCode default)
- Small: 12px (debug logs, metadata)
- Large: 16px (headings, important labels)

## Defining Experience

### The Core Interaction

**Defining Experience:** "Code AI football teams and watch them compete"

This is what users will tell their friends. The spectacle of watching code become living, competing entities is the emotional hook that draws users in and keeps them engaged.

**Supporting Experience:** "Click any player to instantly understand WHY they did what they did"

The debug-on-click interaction is the mechanism that transforms entertainment into mastery. Without it, users watch but don't learn. With it, every loss becomes a lesson.

### User Mental Model

Users bring expectations from familiar tools:

| Mental Model Source | Expectation | Application |
|---------------------|-------------|-------------|
| **VSCode/IDE** | Code → instant feedback → errors highlighted | Editor shows problems as you type |
| **Video Players** | Scrub anywhere, pause, play at will | Timeline control feels like YouTube |
| **Browser DevTools** | Click element → see its properties | Click player → see their logs |
| **Sports Broadcasts** | Watch action, see stats, replays | Match viewer feels like watching a game |

**Key Insight:** The experience should feel like "DevTools meets ESPN" — the investigative power of debugging with the entertainment value of sports viewing.

### Success Criteria

| Criteria | Measure | Target |
|----------|---------|--------|
| **Instant Understanding** | Time from "what happened?" to "I see why" | < 10 seconds |
| **Effortless Scrubbing** | Perceived latency when dragging timeline | < 16ms (60fps feel) |
| **Click-to-Filter** | Clicks needed to isolate one player's logs | Exactly 1 |
| **First Match Speed** | Time from signup to watching first match | < 2 minutes |
| **Iteration Speed** | Time from "I want to change this" to "watching new result" | < 30 seconds |

### Novel UX Patterns

**Must Innovate:**

| Pattern | Description | Why Novel |
|---------|-------------|-----------|
| **Click-to-Filter Debug** | Click player on pitch → debug panel shows only their logs | No existing tool does this for game replay |
| **Side-by-Side Code+Replay** | Editor visible while watching match | Unique to our "understanding" focus |
| **Tick-Synced Logs** | Scrubbing timeline scrolls debug panel to that tick | Real-time correlation |

**Adopt Established:**

| Pattern | Source | Application |
|---------|--------|-------------|
| Timeline scrubbing | YouTube, video editors | Drag to seek through match |
| Space to pause | Universal video | Instant playback control |
| Tab-based files | VSCode | Multiple AI files open |
| Color-coded logs | DevTools | Player identification in debug |

### Experience Mechanics

**1. The Code Phase**
- User opens editor → Writes/edits AI code → Sees syntax errors instantly
- Trigger: User has an idea to try
- Controls: Monaco editor with custom autocomplete
- Feedback: Red squiggles for errors, green for valid syntax
- Completion: Code is ready when no errors shown

**2. The Test Phase**
- User clicks "Test vs Bot" → Lineup screen appears (if needed) → Match simulates
- Trigger: User wants to see their code in action
- Controls: Single button click, lineup drag-and-drop
- Feedback: Brief loading state, then match begins
- Completion: Match result screen with "Watch Replay" prominent

**3. The Watch Phase (DEFINING EXPERIENCE)**
- User watches replay → Clicks player to filter logs → Scrubs to key moment
- Trigger: Curiosity about AI behavior
- Controls: Click player, drag timeline, Space to pause
- Feedback: Debug panel updates instantly, pitch highlights selected player
- Completion: User says "Ah, I see why!" → Returns to editor

**4. The Iterate Phase**
- User returns to editor → Makes targeted change → Tests again
- Trigger: Understanding leads to improvement idea
- Controls: Cmd+Tab or click to switch, Cmd+Enter to test
- Feedback: Instant switch, test starts immediately
- Completion: New match to watch → Loop continues

### Experience Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌──────┐    ┌──────┐    ┌──────┐    ┌──────────────┐     │
│   │ CODE │───▶│ TEST │───▶│WATCH │───▶│ UNDERSTAND   │     │
│   └──────┘    └──────┘    └──────┘    └──────────────┘     │
│       ▲                                      │              │
│       │                                      │              │
│       └──────────────────────────────────────┘              │
│                    "One more thing..."                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The loop should feel effortless. Each transition (code→test, test→watch, watch→understand, understand→code) must be frictionless.

## Visual Design Foundation

### Color System

**Base Theme:** VSCode Dark-inspired

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#1e1e1e` | Editor background, main panels |
| `--bg-secondary` | `#252526` | Sidebars, secondary panels |
| `--bg-tertiary` | `#2d2d2d` | Hover states, subtle highlights |
| `--border` | `#3c3c3c` | Panel borders, dividers |
| `--text-primary` | `#d4d4d4` | Main text |
| `--text-muted` | `#808080` | Secondary text, labels |
| `--accent` | `#007acc` | Links, active states |
| `--success` | `#4ec9b0` | Positive feedback |
| `--warning` | `#dcdcaa` | Caution states |
| `--error` | `#f14c4c` | Errors, negative feedback |

**Team Colors (Rocket League-inspired):**

| Token | Hex | Usage |
|-------|-----|-------|
| `--team-orange` | `#ff6b1a` | Orange team players, highlights |
| `--team-orange-light` | `#ff8c4a` | Orange team accents |
| `--team-blue` | `#1a8cff` | Blue team players, highlights |
| `--team-blue-light` | `#4aa3ff` | Blue team accents |

**Pitch Colors:**

| Token | Hex | Usage |
|-------|-----|-------|
| `--pitch-bg` | `#1a2634` | Pitch background (dark blue-gray) |
| `--pitch-lines` | `#3a4a5a` | Field markings |
| `--pitch-center` | `#2a3a4a` | Center circle, goal areas |

**Celebration Colors:**

| Token | Hex | Usage |
|-------|-----|-------|
| `--goal-flash` | `#ffffff` | Screen flash on goal |
| `--confetti-gold` | `#ffd700` | Confetti particles |
| `--confetti-team` | Team color | Team-colored confetti |

### Typography System

**Font Stack:**
```css
--font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
```

**Type Scale:**

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `--text-xs` | 11px | 1.4 | Timestamps, tick numbers |
| `--text-sm` | 12px | 1.4 | Debug logs, metadata |
| `--text-base` | 14px | 1.5 | Body text, UI labels |
| `--text-lg` | 16px | 1.4 | Section headings |
| `--text-xl` | 18px | 1.3 | Page titles |
| `--text-2xl` | 24px | 1.2 | Score display |

**Font Weights:**
- 400: Body text, logs
- 500: UI labels, buttons
- 600: Headings, emphasis

### Spacing & Layout Foundation

**Spacing Scale (4px base):**

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Inline spacing, small gaps |
| `--space-3` | 12px | Component padding |
| `--space-4` | 16px | Section spacing |
| `--space-6` | 24px | Panel padding |
| `--space-8` | 32px | Large section gaps |

**Layout Density:** Balanced
- Enough whitespace to breathe
- Efficient use of screen real estate
- Not cramped, not wasteful

**Panel Layout:** Flexible/Resizable

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  [AI Files ▼]  [Test vs Bot]  [Queue Ranked]  [?]   │
├──────────────────┬─────────────────────┬────────────────────┤
│                  │                     │                    │
│                  │                     │                    │
│     EDITOR       │      MATCH          │      DEBUG         │
│   (resizable)    │    (resizable)      │    (resizable)     │
│                  │                     │                    │
│                  │                     │                    │
├──────────────────┴─────────────────────┴────────────────────┤
│  [◀◀] [▶/❚❚] [▶▶]  ═══════●═══════════════  00:42 / 03:00  │
└─────────────────────────────────────────────────────────────┘
```

**Panel Behavior:**
- Drag borders to resize panels
- Double-click border to reset to default
- Panels remember size on refresh (localStorage)
- Minimum widths prevent unusable states

### Accessibility Considerations

**Color Contrast:**
- All text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- Team colors (orange/blue) are colorblind-friendly (distinguishable in all types)
- Error states use both color AND icon/text

**Keyboard Navigation:**
- All interactive elements focusable
- Visible focus indicators (blue outline)
- Logical tab order through panels

**Motion:**
- Respect `prefers-reduced-motion`
- No autoplay with motion that can't be paused

**Screen Reader:**
- Semantic HTML structure
- ARIA labels for custom components
- Live regions for score updates

## Design Direction Decision

### Design Directions Explored

A unified design direction was developed based on clear requirements established throughout the UX discovery process:

- **VSCode Dark Theme** — Familiar environment for developers
- **Rocket League Team Colors** — Orange vs Blue for instant team recognition
- **Three-Panel Workspace** — Editor | Match Viewer | Debug Panel
- **Flexible/Resizable Layout** — User-controlled panel sizes

### Chosen Direction

**Direction:** "DevTools meets ESPN" — IDE-quality coding experience with sports broadcast entertainment value

**Visual Style:**
- Dark theme (`#1e1e1e` base) with strategic contrast
- Orange (`#ff6b1a`) and Blue (`#1a8cff`) team colors against dark pitch (`#1a2634`)
- Balanced spacing — breathable but efficient
- Monaco-style code editor with syntax highlighting

**Layout:**
- Horizontal three-panel split (Editor | Match | Debug)
- All panels resizable with drag handles
- Timeline scrubber pinned to bottom
- Header with file selector and action buttons

**Interactive Mockup:** `_bmad-output/planning-artifacts/ux-design-directions.html`

### Design Rationale

| Decision | Rationale |
|----------|-----------|
| **VSCode Dark** | Developers spend hours in dark IDEs; this feels like home |
| **Orange vs Blue** | Colorblind-friendly, instantly recognizable team identity |
| **Dark Pitch** | Creates "stage" effect; match area pops against UI chrome |
| **Resizable Panels** | Power users customize their workspace; no one-size-fits-all |
| **Persistent Timeline** | Always visible; scrubbing is the core interaction |

### Implementation Approach

**Phase 1 — Core Layout:**
- Implement resizable panel system (react-resizable-panels or similar)
- Set up Tailwind with custom color tokens
- Build header with navigation and actions

**Phase 2 — Editor Panel:**
- Integrate Monaco editor
- Add custom autocomplete for game API
- Implement tab system for multiple AI files

**Phase 3 — Match Viewer:**
- Canvas-based pitch rendering
- Player circles with team colors
- Ball with physics trail
- Click-to-select player interaction

**Phase 4 — Debug Panel:**
- Virtual scrolling for log performance
- Color-coded entries by team/player
- Filter buttons for team/player isolation
- Sync with timeline position

**Phase 5 — Timeline:**
- Custom scrubber component
- Playback controls (play/pause, step, speed)
- Tick markers for key events (goals, kicks)
