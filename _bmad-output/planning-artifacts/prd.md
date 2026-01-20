---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10, 11]
inputDocuments:
  - '_bmad-output/analysis/brainstorming-consolidated.md'
workflowType: 'prd'
lastStep: 11
status: 'complete'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 0
  projectContext: 0
---

# Product Requirements Document - Lachatadédé

**Author:** Pelo
**Date:** 2026-01-12

## Executive Summary

Lachatadédé is a competitive programming platform where players code JavaScript AI to control 5v5 indoor football teams. Players write behavior scripts for individual roles (goalkeeper, defender, attacker), then watch their AI compete against others in real-time matches.

The core promise: **iterate faster than anywhere else.** While other programming games force players through long feedback cycles, Lachatadédé delivers results in seconds — code, test against practice AIs, see what happens, adjust, repeat.

### What Makes This Special

**1. Speed** — Test your AI in seconds, not minutes. Live practice mode against configurable difficulty bots means zero queue time. The feedback loop is: idea → code → result → iterate, all within seconds.

**2. Clarity** — See exactly why your AI failed. A live debug panel with color-coded logs per player shows console output in real-time during matches. No guessing, no post-mortem confusion.

**3. Expression** — Build different strategies per role. The 1-AI-per-player model (GoalkeeperAI.js, DefenderAI.js, AttackerAI.js) lets players craft focused, readable behaviors instead of managing monolithic team logic.

**4. Competition** — Prove your code on the ranked ladder and in tournaments. Deterministic physics ensures skill beats luck, always.

## Project Classification

**Technical Type:** Web Application (SPA)
**Domain:** Gaming / Competitive Programming
**Complexity:** Medium
**Project Context:** Greenfield - new project

**Tech Direction:**
- Browser-based with Monaco Editor (VSCode engine)
- Real-time match visualization
- Turn-based simulation (tick system)
- Deterministic physics engine
- Ranked matchmaking + practice mode

## Success Criteria

### User Success

**The 'Aha!' Moment:** The player understands *why* their AI behaved a certain way — clarity through the debug panel.

**Key Metrics:**
- **Time to understanding** — Players can diagnose problems within seconds of match completion
- **Debug panel engagement** — High percentage of replays watched with debug panel open
- **Iteration velocity** — Players in a consistent loop: match → tweak code → match → tweak

**Success Signals:**
- Players modify their AI after losses (learning happened)
- Average time between code changes is short (rapid experimentation)
- Players create multiple AI variations to test strategies

### Business Success

**Philosophy:** Community engagement over monetization. Success = players who love the game and keep coming back.

**Target Metrics:**
- **100 daily active players** — Players who play at least one match per day
- **Instant ranked queue** — Always someone to match against
- **50+ active competitors** — Leaderboard feels alive and competitive
- **High recurrence** — Players returning daily/weekly to iterate on their AIs

### Technical Success

**Non-Negotiables:**
- **Deterministic physics** — Same inputs = same outputs, always. Fairness is absolute.
- **Simulation-first architecture** — Matches are simulated server-side, then replayed client-side. No real-time streaming required.

**Acceptable Trade-offs (for now):**
- Latency tolerance — Replay buffering is fine
- Uptime flexibility — Beta-level reliability acceptable

**Tick Rate:** 30 or 15 fps (final decision based on simulation speed + data storage requirements)

### Measurable Outcomes

| Timeframe | Target |
|-----------|--------|
| Launch | Functional MVP with practice + ranked modes |
| 3 months | 100 DAU, instant queue times, 50+ leaderboard |
| 12 months | Thriving community, tournament-ready (V2) |

## Product Scope

### MVP - Minimum Viable Product

| Feature | Description |
|---------|-------------|
| **Monaco Editor** | Integrated code editor with API autocomplete |
| **Flexible AI System** | Create unlimited AIs, assign any AI to any of the 5 players independently |
| **Practice Mode** | Instant testing against bots |
| **Match Simulation** | Server-side simulation with debug panel |
| **Replay System** | Watch completed matches with debug panel |
| **Ranked Matchmaking** | Simple queue system |
| **Leaderboard** | Public ranking of players |
| **Simple Ranking** | Basic Elo or points system |
| **Tick System** | 30 or 15 fps simulation |

### Growth Features (Post-MVP)

| Feature | Description |
|---------|-------------|
| **Practice Bot Difficulties** | Multiple difficulty levels |
| **Match History** | Last 10 replays saved, unlimited stats history |
| **Player Profiles** | Public profiles with stats |
| **Replay Enhancements** | Slow-mo, code highlight sync |
| **Admin Functions** | User management, leaderboard moderation, anti-cheat |

### Vision (Future)

| Feature | Description |
|---------|-------------|
| **Tournaments** | Kaggle-style competitive events |
| **Thematic Seasons** | Special rulesets or challenges |

## User Journeys

### Journey 1: Alex Chen - The First Spark (New Player Onboarding)

Alex is a junior developer who just finished a coding bootcamp. He's decent at JavaScript but hasn't built anything "fun" yet — just CRUD apps and todo lists. Scrolling through Reddit one night, he sees a post about Lachatadédé: "I coded an AI that scored a bicycle kick." Intrigued, he clicks the link.

The landing page shows a match replay — two teams of circular players zipping around a futsal pitch, the ball pinging between them with satisfying physics. "Code your AI. Watch it play." Simple. He signs up.

Within 30 seconds of creating an account, Alex is staring at a Monaco editor with a simple starter template:

```javascript
// This runs every tick for your player
if (me.isClosestToBall()) {
  me.moveTo(ball.position);
}
```

He hits "Test vs Easy Bot." A lineup screen appears — 5 player slots waiting for AI assignment. He drags his starter AI onto all 5 positions, clicks "Start Match." The match simulates instantly. He watches his five players... do absolutely nothing useful. One chases the ball but overshoots. The others stand frozen. The bot scores 4-0. Alex laughs.

He opens the debug panel. Color-coded logs scroll by: `Player 3: moveTo called, target: (234, 156)`. He sees the problem — only the closest player moves. He adds a line: `else { me.moveTo(goal.enemy); }`. Tests again. Now they all run toward the goal like headless chickens. 2-4 loss, but he scored!

The breakthrough comes 20 minutes in. Alex creates a second AI file — `DefenderAI.js` — and assigns it to two players on the lineup screen. He gives them logic to stay between the ball and his goal. Tests again. 3-3 draw. He grins. He's *coaching* now.

Two hours later, Alex has three AI files, a 60% win rate against Easy bots, and zero desire to sleep. He queues for his first ranked match.

### Journey 2: Mia Torres - The Morning Ritual (Returning Player Core Loop)

Mia is a data scientist who's been playing Lachatadédé for three weeks. She's ranked #47 on the leaderboard — not elite, but climbing. Every morning before work, she has a ritual.

7:15 AM. Coffee in hand, Mia opens Lachatadédé. First, she checks her overnight ranked results — she queued a match before bed. Her AI lost 2-3 to someone ranked #38. She clicks the replay.

Debug panel open, she watches the critical moment: 78th tick, her AttackerAI had a clear shot but passed instead. The log shows: `distanceToGoal: 142, shootThreshold: 100`. She snorts. Her threshold was too conservative. She opens `AttackerAI.js` and changes `100` to `150`.

7:22 AM. She hits "Test vs Hard Bot" to validate the change. The lineup screen shows her current setup — she confirms and starts. Her AI shoots more, scores more, but also misses more. Net positive — 4-2 win. She smiles.

7:25 AM. Before queuing ranked, she wants to test one more thing. She duplicates her AttackerAI into `AttackerAI-v2.js` and tries an experimental change: players now consider teammate positions before shooting. On the lineup screen, she assigns v2 to one attacker, keeps v1 on the other. Tests again. The v2 attacker makes smarter decisions. She promotes v2 to her main lineup.

7:32 AM. Mia queues for ranked and closes the tab. Tonight, she'll watch the result. The loop continues.

### Journey 3: Sam Park - The Debugging Detective (Error Recovery)

Sam has been stuck at rank #80 for a week. His AI works fine against bots but crumbles in ranked. He's frustrated — he can't figure out *why*.

After another loss (1-4), Sam decides to really dig in. He opens the replay with debug panel and watches tick by tick. At tick 42, something weird happens: his goalkeeper rushes out toward midfield, leaving the goal empty. The opponent scores easily.

Sam pauses. He checks the log: `GoalkeeperAI: isClosestToBall = true, moving to ball`. Ah. His goalkeeper logic doesn't account for *position* — when the ball is at midfield and no other player is close, the keeper becomes "closest" and charges out.

He opens `GoalkeeperAI.js` and adds a condition: `if (me.isClosestToBall() && me.position.x < 200)` — only chase if the ball is in the defensive third. Tests against Hard Bot. The keeper stays home. 3-1 win.

Sam grins. He didn't just fix a bug — he *understood* his AI better. He queues ranked with confidence.

### Journey Requirements Summary

| Capability Area | Required For |
|----------------|--------------|
| **Instant Onboarding** | New players must reach first match in < 60 seconds |
| **Starter Templates** | Working (but basic) AI to copy and modify |
| **One-Click Practice** | Test vs Bot with instant simulation |
| **Pre-Match Lineup Screen** | Drag-and-drop (or click-select) to assign any AI to any of the 5 players. Match starts only when all 5 slots filled. |
| **Debug Panel** | Color-coded, per-player, tick-by-tick logs |
| **Multiple AI Files** | Create, duplicate, version different strategies |
| **Async Ranked** | Queue match, close browser, check later |
| **Match History** | Access recent match replays |
| **Replay Scrubbing** | Tick-by-tick navigation with debug sync |
| **Leaderboard** | Public ranking, progress tracking |

## Web Application Requirements

### Architecture Overview

**Application Type:** Single Page Application (SPA)
**Rendering:** Client-side JavaScript application
**Backend Communication:** REST API (no WebSocket)

### Browser Support

| Browser | Versions |
|---------|----------|
| Chrome | Last 2 versions |
| Firefox | Last 2 versions |
| Safari | Last 2 versions |
| Edge | Last 2 versions |

**Excluded:** Internet Explorer, legacy mobile browsers

### Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Initial Load** | < 3 seconds | Get players to editor fast |
| **Match Simulation** | < 2 seconds | Instant feedback loop |
| **Replay Playback** | 60 fps | Smooth visualization |
| **Editor Response** | < 100ms | Monaco should feel native |

### SEO Strategy

**Not required for MVP.** The application is behind authentication — no public-facing content needs indexing.

Future consideration: Landing page for marketing (can be static/SSR).

### Accessibility

**MVP:** Basic keyboard navigation and focus states
**Post-MVP:** Evaluate WCAG 2.1 AA compliance based on user feedback

### Technical Stack Implications

| Decision | Implication |
|----------|-------------|
| SPA | Need client-side routing, state management |
| No WebSocket | Simpler infrastructure, polling for async match results |
| Modern browsers | Can use ES2020+, CSS Grid, no polyfills needed |
| Monaco Editor | ~2MB bundle, need code splitting strategy |

## Scoping Validation

### MVP Strategy

**Approach:** Experience MVP — Deliver the core feedback loop (code → test → understand → iterate) with reliable functionality.

**MVP Philosophy:** Ship the smallest thing that lets players experience the "aha moment" — understanding *why* their AI behaved a certain way.

### Risk Assessment

| Risk Type | Risk | Mitigation |
|-----------|------|------------|
| **Technical** | Deterministic physics is complex | Simplify: 2D, circular players, basic collision. Can iterate on "feel" later. |
| **Technical** | Monaco Editor bundle size (~2MB) | Code splitting, lazy load editor after auth |
| **Market** | Not enough players for instant queue | Seed with good practice bots; ranked can wait for critical mass |
| **Market** | Players frustrated before "aha moment" | Starter template that actually works (scores goals vs Easy bot) |
| **Resource** | Solo dev / small team | SPA + REST is simpler than WebSocket. Simulation-first reduces complexity. |

### Scope Guardrails

**In Scope for MVP:**
- Everything in MVP table above
- One difficulty level for practice bots (Easy)
- Basic auth (email/password or OAuth)

**Explicitly Out of Scope for MVP:**
- Multiple bot difficulties
- Match history beyond "last match"
- Player profiles
- Admin panel
- Tournaments
- Mobile optimization

## Functional Requirements

### User Account Management

- FR1: Visitors can create an account using email/password or OAuth
- FR2: Users can authenticate to access the platform
- FR3: Users can log out of their account

### AI Code Management

- FR4: Users can create new AI files
- FR5: Users can edit existing AI files
- FR6: Users can duplicate AI files for versioning
- FR7: Users can delete AI files
- FR8: Users can rename AI files
- FR9: Users can maintain unlimited AI files simultaneously
- FR10: System provides starter template AI that works against Easy bot

### Code Editor

- FR11: Users can write JavaScript code in an integrated editor
- FR12: Users can receive autocomplete suggestions for the game API
- FR13: Users can see syntax highlighting for JavaScript
- FR14: Users can see code errors highlighted in the editor

### Team Lineup Configuration

- FR15: Users can assign any AI file to any of the 5 player positions
- FR16: Users can assign different AIs to different positions (e.g., GoalkeeperAI, DefenderAI, AttackerAI)
- FR17: Users can assign the same AI to multiple positions
- FR18: Users can view their current lineup configuration before starting a match
- FR19: System prevents match start until all 5 positions have assigned AIs

### Practice Mode

- FR20: Users can start instant practice matches against AI bots
- FR21: Users can test their AI without queue wait times
- FR22: System provides Easy difficulty practice bot (MVP)

### Competitive Play

- FR23: Users can queue for ranked matches against other players
- FR24: Users can queue a ranked match and close the browser (async play)
- FR25: Users can view their ranked match results when returning to the platform
- FR26: System matches players using a ranking algorithm (Elo or points-based)

### Match Simulation

- FR27: System simulates matches server-side using deterministic physics
- FR28: System executes AI code at a fixed tick rate (30 or 15 fps)
- FR29: System enforces 3-minute match duration
- FR30: System calculates match outcomes based on goals scored

### Match Visualization & Replay

- FR31: Users can watch match replays after completion
- FR32: Users can see real-time visualization of match playback
- FR33: Users can navigate through replay tick-by-tick
- FR34: Users can view their most recent match replay

### Debugging & Analysis

- FR35: Users can view a debug panel during match replay
- FR36: Users can see console.log output from their AI code in the debug panel
- FR37: Users can see debug logs color-coded by player
- FR38: Users can correlate debug output with specific game ticks
- FR39: Users can identify which player triggered each log entry

### Leaderboard & Rankings

- FR40: Users can view the public leaderboard
- FR41: Users can see their current ranking position
- FR42: Users can see other players' rankings
- FR43: System updates rankings after each ranked match

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Initial page load | < 3 seconds | Get players to editor fast |
| Match simulation | < 2 seconds | Instant feedback loop is core value |
| Replay playback | 60 fps | Smooth visualization |
| Editor response | < 100ms | Monaco should feel native |
| API response time | < 500ms | Responsive interactions |

### Security

| Requirement | Specification |
|-------------|---------------|
| Authentication | Secure password hashing, OAuth integration |
| Session management | Secure session tokens with expiration |
| AI code isolation | User AI code executes in sandboxed environment |
| Code privacy | User AI code is private and not visible to other players |
| Data transmission | HTTPS for all client-server communication |

### Scalability

| Requirement | Specification |
|-------------|---------------|
| Initial capacity | Support 100 concurrent users |
| Match simulation | Handle concurrent practice + ranked matches |
| Growth path | Architecture should support 10x growth without rewrite |

### Reliability

| Requirement | Specification |
|-------------|---------------|
| Determinism | Match simulation produces identical results given same inputs (non-negotiable) |
| Data persistence | User AI files and rankings survive server restarts |
| Availability | Beta-level acceptable (~95% uptime) |
| Match integrity | Completed matches are never lost |

### Browser Compatibility

| Browser | Support Level |
|---------|---------------|
| Chrome | Last 2 versions |
| Firefox | Last 2 versions |
| Safari | Last 2 versions |
| Edge | Last 2 versions |

**Excluded:** Internet Explorer, legacy mobile browsers
