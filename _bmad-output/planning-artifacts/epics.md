---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/backend-architecture.md'
  - '_bmad-output/planning-artifacts/deployment-architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
workflowType: 'epics-and-stories'
lastStep: 3
status: 'in-progress'
---

# Lachatadede - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Lachatadede, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: Visitors can create an account using email/password or OAuth
- FR2: Users can authenticate to access the platform
- FR3: Users can log out of their account
- FR4: Users can create new AI files
- FR5: Users can edit existing AI files
- FR6: Users can duplicate AI files for versioning
- FR7: Users can delete AI files
- FR8: Users can rename AI files
- FR9: Users can maintain unlimited AI files simultaneously
- FR10: System provides starter template AI that works against Easy bot
- FR11: Users can write JavaScript code in an integrated editor
- FR12: Users can receive autocomplete suggestions for the game API
- FR13: Users can see syntax highlighting for JavaScript
- FR14: Users can see code errors highlighted in the editor
- FR15: Users can assign any AI file to any of the 5 player positions
- FR16: Users can assign different AIs to different positions (e.g., GoalkeeperAI, DefenderAI, AttackerAI)
- FR17: Users can assign the same AI to multiple positions
- FR18: Users can view their current lineup configuration before starting a match
- FR19: System prevents match start until all 5 positions have assigned AIs
- FR20: Users can start instant practice matches against AI bots
- FR21: Users can test their AI without queue wait times
- FR22: System provides Easy difficulty practice bot (MVP)
- FR23: Users can queue for ranked matches against other players
- FR24: Users can queue a ranked match and close the browser (async play)
- FR25: Users can view their ranked match results when returning to the platform
- FR26: System matches players using a ranking algorithm (Elo or points-based)
- FR27: System simulates matches server-side using deterministic physics
- FR28: System executes AI code at a fixed tick rate (30 or 15 fps)
- FR29: System enforces 3-minute match duration
- FR30: System calculates match outcomes based on goals scored
- FR31: Users can watch match replays after completion
- FR32: Users can see real-time visualization of match playback
- FR33: Users can navigate through replay tick-by-tick
- FR34: Users can view their most recent match replay
- FR35: Users can view a debug panel during match replay
- FR36: Users can see console.log output from their AI code in the debug panel
- FR37: Users can see debug logs color-coded by player
- FR38: Users can correlate debug output with specific game ticks
- FR39: Users can identify which player triggered each log entry
- FR40: Users can view the public leaderboard
- FR41: Users can see their current ranking position
- FR42: Users can see other players' rankings
- FR43: System updates rankings after each ranked match

### Non-Functional Requirements

- NFR1: Initial page load < 3 seconds
- NFR2: Match simulation < 2 seconds
- NFR3: Replay playback at 60 fps
- NFR4: Editor response < 100ms
- NFR5: API response time < 500ms
- NFR6: Secure password hashing, OAuth integration
- NFR7: Secure session tokens with expiration
- NFR8: User AI code executes in sandboxed environment (isolated-vm)
- NFR9: User AI code is private and not visible to other players
- NFR10: HTTPS for all client-server communication
- NFR11: Support 100 concurrent users
- NFR12: Handle concurrent practice + ranked matches
- NFR13: Architecture should support 10x growth without rewrite
- NFR14: Match simulation produces identical results given same inputs (determinism - NON-NEGOTIABLE)
- NFR15: User AI files and rankings survive server restarts
- NFR16: Beta-level availability (~95% uptime)
- NFR17: Completed matches are never lost
- NFR18: Browser compatibility: Chrome, Firefox, Safari, Edge (last 2 versions)

### Additional Requirements

**From Backend Architecture:**
- Microservices architecture: Laravel (API Gateway, auth, CRUD) + Node.js (Game Engine, simulation)
- MySQL database for persistence
- Laravel Sanctum for authentication
- HTTP synchronous communication between Laravel and Node.js services
- isolated-vm for JavaScript sandboxing with limits: 10ms/tick, 30s total simulation, 8MB/script, 1000 frames max
- JSON file storage for match frames (permanent storage in /storage/simulations/)
- Node.js game engine endpoints: POST /validate-script, POST /simulate
- Match simulation flow: Laravel creates match → calls Node.js → Node.js writes JSON → Laravel imports result

**From Deployment Architecture:**
- Docker + Docker Compose orchestration
- VPS Debian (4 cores, 4GB RAM, 80GB SSD)
- Nginx reverse proxy serving frontend and routing to Laravel
- PHP-FPM for Laravel runtime
- Frontend React build served as static files by Nginx
- Manual deployment via git pull + docker-compose

**From UX Design:**
- Desktop web only platform (no mobile optimization for MVP)
- Tailwind CSS + shadcn/ui component library
- VSCode Dark-inspired theme (#1e1e1e base background)
- Three-panel resizable layout: Editor | Match Viewer | Debug Panel
- Team colors: Orange (#ff6b1a) vs Blue (#1a8cff) - Rocket League inspired
- Monaco editor integration with custom autocomplete for game API
- Click-to-filter debug panel: click player on pitch to filter their logs
- Timeline scrubber with tick-by-tick navigation
- Keyboard shortcuts: Space = pause/play, Arrow keys = scrub, Cmd+Enter = test
- WCAG AA color contrast compliance
- Goal celebrations with visual feedback (confetti, flash)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Create account (email/password or OAuth) |
| FR2 | Epic 1 | Authenticate to access platform |
| FR3 | Epic 1 | Log out |
| FR10 | Epic 1 | Starter template AI provided |
| FR4 | Epic 2 | Create new AI files |
| FR5 | Epic 2 | Edit existing AI files |
| FR6 | Epic 2 | Duplicate AI files for versioning |
| FR7 | Epic 2 | Delete AI files |
| FR8 | Epic 2 | Rename AI files |
| FR9 | Epic 2 | Maintain unlimited AI files |
| FR11 | Epic 2 | Write JavaScript in integrated editor |
| FR12 | Epic 2 | Autocomplete for game API |
| FR13 | Epic 2 | Syntax highlighting |
| FR14 | Epic 2 | Error highlighting |
| FR15 | Epic 3 | Assign any AI to any of 5 positions |
| FR16 | Epic 3 | Assign different AIs to different positions |
| FR17 | Epic 3 | Assign same AI to multiple positions |
| FR18 | Epic 3 | View lineup configuration before match |
| FR19 | Epic 3 | Prevent match start without full lineup |
| FR20 | Epic 3 | Start instant practice matches |
| FR21 | Epic 3 | Test AI without queue wait |
| FR22 | Epic 3 | Easy difficulty practice bot |
| FR27 | Epic 3 | Server-side deterministic simulation |
| FR28 | Epic 3 | Fixed tick rate execution |
| FR29 | Epic 3 | 3-minute match duration |
| FR30 | Epic 3 | Calculate outcomes by goals |
| FR31 | Epic 3 | Watch match replays |
| FR32 | Epic 3 | Real-time visualization |
| FR33 | Epic 3 | Tick-by-tick navigation |
| FR34 | Epic 3 | View most recent replay |
| FR35 | Epic 3 | Debug panel during replay |
| FR36 | Epic 3 | Console.log in debug panel |
| FR37 | Epic 3 | Color-coded logs by player |
| FR38 | Epic 3 | Correlate logs with ticks |
| FR39 | Epic 3 | Identify player per log entry |
| FR23 | Epic 4 | Queue for ranked matches |
| FR24 | Epic 4 | Async play (queue and close) |
| FR25 | Epic 4 | View ranked results on return |
| FR26 | Epic 4 | Matchmaking algorithm |
| FR40 | Epic 4 | View public leaderboard |
| FR41 | Epic 4 | See current ranking position |
| FR42 | Epic 4 | See other players' rankings |
| FR43 | Epic 4 | Rankings updated after matches |

## Epic List

### Epic 1: User Authentication & Onboarding
Users can access the platform and start with a working AI template.

**FRs covered:** FR1, FR2, FR3, FR10 (4 FRs)

**User Outcome:** Complete authentication system with starter code provided on first login.

---

### Epic 2: AI Development Workspace
Users can write and manage their AI code with a professional IDE-quality experience.

**FRs covered:** FR4, FR5, FR6, FR7, FR8, FR9, FR11, FR12, FR13, FR14 (10 FRs)

**User Outcome:** Full Monaco editor integration with file management, autocomplete, syntax highlighting, and error display.

---

### Epic 3: Practice Mode & Match Experience
Users can test their AI and understand its behavior - THE CORE VALUE PROPOSITION.

**FRs covered:** FR15-FR22, FR27-FR39 (21 FRs)

**User Outcome:** Complete **Code → Test → Watch → Understand → Iterate** feedback loop including:
- Team lineup configuration (5 positions)
- Instant practice matches vs Easy bot
- Deterministic match simulation
- Replay viewer with tick-by-tick navigation
- Debug panel with color-coded, player-filtered logs

---

### Epic 4: Ranked Competition & Leaderboard
Users can prove their code against other players and track their progression.

**FRs covered:** FR23, FR24, FR25, FR26, FR40, FR41, FR42, FR43 (8 FRs)

**User Outcome:** Complete competitive experience with async ranked queue, matchmaking, and public leaderboard.

---

## Epic 1: User Authentication & Onboarding

Users can access the platform and start with a working AI template.

### Story 1.1: User Registration

As a visitor,
I want to create an account with email and password,
So that I can access the platform and save my AI code.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter a valid email, password (min 8 chars), and password confirmation
**Then** my account is created and I am logged in automatically
**And** I am redirected to the main workspace

**Given** I enter an email that already exists
**When** I submit the registration form
**Then** I see an error message "Email already registered"

**Given** I enter mismatched passwords
**When** I submit the form
**Then** I see an error message "Passwords do not match"

---

### Story 1.2: User Login

As a registered user,
I want to log in with my email and password,
So that I can access my saved AI code.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I enter valid credentials
**Then** I am authenticated and redirected to the workspace
**And** my session persists across page refreshes

**Given** I enter invalid credentials
**When** I submit the login form
**Then** I see an error message "Invalid email or password"
**And** I remain on the login page

---

### Story 1.3: User Logout

As a logged-in user,
I want to log out of my account,
So that I can secure my session on shared devices.

**Acceptance Criteria:**

**Given** I am logged in
**When** I click the logout button
**Then** my session is terminated
**And** I am redirected to the login page

**Given** I am logged out
**When** I try to access protected routes
**Then** I am redirected to the login page

---

### Story 1.4: Starter AI Template Provisioning

As a new user,
I want to receive a working starter AI template on first login,
So that I can immediately test and learn from working code.

**Acceptance Criteria:**

**Given** I just created my account
**When** I first access the workspace
**Then** I have a default AI file named "StarterAI.js"
**And** the starter AI contains working code that can score against Easy bot
**And** the starter AI demonstrates basic API usage (me.moveTo, me.isClosestToBall)

**Given** I already have AI files
**When** I log in
**Then** no additional starter files are created

---

## Epic 2: AI Development Workspace

Users can write and manage their AI code with a professional IDE-quality experience.

### Story 2.1: Create and List AI Files

As a user,
I want to create new AI files and see all my files,
So that I can organize multiple strategies.

**Acceptance Criteria:**

**Given** I am in the workspace
**When** I click "New AI File"
**Then** a new file is created with default name "NewAI.js"
**And** the file appears in my file list
**And** the editor opens with the new file

**Given** I have multiple AI files
**When** I view the file list
**Then** I see all my files sorted by last modified
**And** I can click any file to open it in the editor

---

### Story 2.2: Monaco Editor Integration

As a user,
I want to write JavaScript code in a professional editor,
So that I have a familiar coding experience.

**Acceptance Criteria:**

**Given** I open an AI file
**When** the editor loads
**Then** I see a Monaco editor with the file content
**And** JavaScript syntax is highlighted with proper colors
**And** line numbers are displayed
**And** the editor supports standard shortcuts (Cmd+Z, Cmd+C, etc.)

**Given** I am typing code
**When** I write JavaScript keywords and syntax
**Then** they are highlighted appropriately (keywords, strings, comments, etc.)

---

### Story 2.3: Save AI File Changes

As a user,
I want my code changes to be saved,
So that I don't lose my work.

**Acceptance Criteria:**

**Given** I have made changes to an AI file
**When** I press Cmd+S (or Ctrl+S)
**Then** the file is saved to the server
**And** I see a brief "Saved" indicator

**Given** I have unsaved changes
**When** I try to close the file or navigate away
**Then** I am warned about unsaved changes

**Given** the save fails (network error)
**When** I try to save
**Then** I see an error message
**And** my changes are preserved locally

---

### Story 2.4: Game API Autocomplete

As a user,
I want autocomplete suggestions for the game API,
So that I can discover available functions without leaving the editor.

**Acceptance Criteria:**

**Given** I am typing in the editor
**When** I type "me."
**Then** I see autocomplete suggestions for player methods (moveTo, kick, isClosestToBall, etc.)
**And** each suggestion shows a description

**Given** I am typing "ball."
**When** the autocomplete appears
**Then** I see ball properties (position, velocity)
**And** I see ball methods if any

**Given** I select an autocomplete suggestion
**When** I press Tab or Enter
**Then** the suggestion is inserted into my code

---

### Story 2.5: Code Error Detection

As a user,
I want to see syntax errors in my code,
So that I can fix problems before testing.

**Acceptance Criteria:**

**Given** I write invalid JavaScript syntax
**When** the editor analyzes my code
**Then** syntax errors are underlined in red
**And** I can hover to see the error message

**Given** I have a syntax error
**When** I look at the editor gutter
**Then** I see an error icon on the affected line

**Given** my code is syntactically valid
**When** I write code
**Then** no error indicators are shown

---

### Story 2.6: Rename AI File

As a user,
I want to rename my AI files,
So that I can organize them by strategy (GoalkeeperAI, AttackerAI, etc.).

**Acceptance Criteria:**

**Given** I have an AI file
**When** I right-click and select "Rename" (or double-click the name)
**Then** I can edit the filename inline
**And** pressing Enter saves the new name

**Given** I enter an invalid name (empty, special characters)
**When** I try to save
**Then** I see a validation error

**Given** I rename a file
**When** the rename completes
**Then** the file list updates immediately
**And** the editor tab shows the new name

---

### Story 2.7: Duplicate AI File

As a user,
I want to duplicate an AI file,
So that I can create variations of my strategies for testing.

**Acceptance Criteria:**

**Given** I have an AI file
**When** I right-click and select "Duplicate"
**Then** a new file is created with name "Copy of [original name]"
**And** the new file contains the same code as the original
**And** the new file is opened in the editor

**Given** I duplicate a file
**When** the operation completes
**Then** both files appear in my file list independently
**And** editing one does not affect the other

---

### Story 2.8: Delete AI File

As a user,
I want to delete AI files I no longer need,
So that I can keep my workspace organized.

**Acceptance Criteria:**

**Given** I have an AI file
**When** I right-click and select "Delete"
**Then** I see a confirmation dialog "Delete [filename]?"

**Given** I confirm deletion
**When** the delete completes
**Then** the file is removed from my list
**And** if it was open in the editor, the editor shows another file or empty state

**Given** I cancel deletion
**When** I click "Cancel"
**Then** the file remains unchanged

---

## Epic 3: Practice Mode & Match Experience

Users can test their AI and understand its behavior - THE CORE VALUE PROPOSITION.

### Story 3.1: Tactics Data Model & API

As a user,
I want my team lineup to be saved,
So that I don't have to reconfigure it every match.

**Acceptance Criteria:**

**Given** I am authenticated
**When** I access the tactics API
**Then** I can create, read, update tactics configurations

**Given** I create a tactic
**When** I assign scripts to the 5 positions
**Then** the configuration is persisted with:
  - Position 1-5 slot assignments
  - Script ID for each slot
  - Starting positions (x, y) for each slot

---

### Story 3.2: Team Lineup Configuration UI

As a user,
I want to assign my AI scripts to the 5 player positions,
So that I can create team strategies with different roles.

**Acceptance Criteria:**

**Given** I am preparing for a match
**When** I open the lineup screen
**Then** I see 5 player slots with positions labeled (GK, DEF1, DEF2, ATK1, ATK2)
**And** I can select any of my AI scripts for each slot

**Given** I assign different AIs to different positions
**When** I view my lineup
**Then** each position shows its assigned AI name
**And** I can assign the same AI to multiple positions

**Given** not all 5 positions have AIs assigned
**When** I try to start a match
**Then** the "Start Match" button is disabled
**And** I see a message "Assign AIs to all 5 positions"

**Given** all 5 positions have AIs
**When** I view the lineup
**Then** the "Start Match" button is enabled

---

### Story 3.3: Game Engine Core - Deterministic Simulation

As a developer,
I want matches to be deterministic,
So that same inputs always produce same outputs (fairness).

**Acceptance Criteria:**

**Given** a match configuration with seed
**When** the simulation runs
**Then** the same seed produces identical frame output every time

**Given** the simulation starts
**When** the engine runs
**Then** it executes at fixed tick rate (30 fps)
**And** match duration is exactly 3 minutes (5400 ticks)
**And** physics calculations use deterministic math (no random floats)

**Given** a simulation completes
**When** results are calculated
**Then** score is determined by goals scored
**And** frames are written to JSON file at /storage/simulations/{match_id}.json

---

### Story 3.4: Script Sandboxing & Execution

As a system,
I want to execute user AI code safely,
So that malicious code cannot harm the server.

**Acceptance Criteria:**

**Given** user AI code
**When** it executes in the sandbox
**Then** it has access to: me, ball, goal, teammates, opponents
**And** it cannot access: filesystem, network, process
**And** console.log calls are captured per player per tick

**Given** AI code exceeds time limit (10ms per tick)
**When** the tick executes
**Then** execution is terminated for that tick
**And** player takes no action

**Given** AI code exceeds memory limit (8MB)
**When** memory is exceeded
**Then** execution is terminated
**And** player is disabled for remaining match

**Given** a 3-minute match
**When** simulation runs
**Then** total simulation completes within 30 seconds

---

### Story 3.5: Practice Match Trigger

As a user,
I want to instantly start a practice match against a bot,
So that I can test my AI without waiting.

**Acceptance Criteria:**

**Given** I have a valid lineup configured
**When** I click "Test vs Bot"
**Then** the match starts simulating immediately
**And** I see a loading state "Simulating..."
**And** simulation completes in < 2 seconds

**Given** simulation completes
**When** results are ready
**Then** I see the final score
**And** the "Watch Replay" button appears

**Given** I don't need to wait for other players
**When** I start practice
**Then** there is zero queue time

---

### Story 3.6: Easy Bot AI

As a user,
I want to practice against a functional bot,
So that I can test my strategies.

**Acceptance Criteria:**

**Given** I start a practice match
**When** the Easy bot plays
**Then** it demonstrates basic competent behavior:
  - Goalkeeper stays near goal
  - Defenders position between ball and goal
  - Attackers move toward ball and shoot

**Given** my starter AI plays against Easy bot
**When** the match completes
**Then** my starter AI has a reasonable chance to score
**And** Easy bot scores but is beatable

**Given** Easy bot
**When** it makes decisions
**Then** its behavior is predictable enough to learn from

---

### Story 3.7: Match Canvas Renderer

As a user,
I want to see the match visually,
So that I can watch my AI play.

**Acceptance Criteria:**

**Given** a match has frames data
**When** the renderer initializes
**Then** I see a 2D pitch with correct dimensions
**And** field markings are visible (center, goals, etc.)

**Given** frames are being rendered
**When** a frame displays
**Then** I see 10 players as colored circles (5 orange, 5 blue)
**And** player numbers are visible
**And** the ball is clearly distinguishable

**Given** a goal is scored
**When** the event occurs
**Then** I see visual celebration feedback (flash, confetti)
**And** the score updates on screen

---

### Story 3.8: Replay Playback System

As a user,
I want to watch match replays,
So that I can analyze what happened.

**Acceptance Criteria:**

**Given** a completed match
**When** I click "Watch Replay"
**Then** the match loads and begins playback
**And** frames render at smooth 60fps

**Given** replay is playing
**When** I click pause
**Then** playback stops at current frame
**And** I can click play to resume

**Given** replay is playing
**When** I press Space
**Then** playback toggles pause/play

**Given** a match has ended
**When** I watch replay
**Then** I can view my most recent match

---

### Story 3.9: Timeline Scrubber & Navigation

As a user,
I want to navigate through the replay tick-by-tick,
So that I can analyze specific moments.

**Acceptance Criteria:**

**Given** replay is loaded
**When** I view the timeline
**Then** I see current position and total duration (00:42 / 03:00)
**And** I see a scrubber handle I can drag

**Given** I drag the scrubber
**When** I release
**Then** playback jumps to that tick
**And** the frame renders immediately

**Given** I press left/right arrow keys
**When** the replay is paused
**Then** it steps backward/forward one tick

**Given** I press Shift+left/right
**When** navigating
**Then** it jumps 30 ticks (1 second)

---

### Story 3.10: Debug Panel - Log Display

As a user,
I want to see console.log output from my AI,
So that I can understand what my code is doing.

**Acceptance Criteria:**

**Given** my AI uses console.log
**When** I watch the replay
**Then** I see log entries in the debug panel
**And** each entry shows: tick number, player ID, message

**Given** multiple players log messages
**When** I view the debug panel
**Then** logs are color-coded by player (matching pitch colors)
**And** I can distinguish which player logged what

**Given** replay is at tick N
**When** I view the debug panel
**Then** logs are scrolled to show entries around tick N

---

### Story 3.11: Debug Panel - Player Filtering

As a user,
I want to filter logs by player,
So that I can focus on specific AI behavior.

**Acceptance Criteria:**

**Given** the replay is showing
**When** I click a player on the pitch
**Then** the debug panel filters to show only that player's logs
**And** the selected player is highlighted on the pitch

**Given** I have filtered by player
**When** I click the same player again (or "Show All")
**Then** the filter is cleared and all logs are shown

**Given** I am viewing filtered logs
**When** I scrub the timeline
**Then** filtered logs stay filtered to selected player
**And** I can identify which player triggered each log entry

---

## Epic 4: Ranked Competition & Leaderboard

Users can prove their code against other players and track their progression.

### Story 4.1: Ranked Queue & Matchmaking

As a user,
I want to queue for ranked matches against other players,
So that I can compete and prove my AI skills.

**Acceptance Criteria:**

**Given** I have a valid lineup configured
**When** I click "Queue Ranked"
**Then** I am added to the matchmaking queue
**And** I see "Searching for opponent..."

**Given** another player is in queue with similar rating
**When** matchmaking runs
**Then** we are paired together
**And** a ranked match is created

**Given** no opponent is found within 30 seconds
**When** the timeout occurs
**Then** I see "No opponent found, try again later"
**And** I am removed from queue

**Given** I am in queue
**When** I click "Cancel"
**Then** I am removed from queue

---

### Story 4.2: Async Ranked Match Completion

As a user,
I want to queue a ranked match and close my browser,
So that I don't have to wait online for results.

**Acceptance Criteria:**

**Given** I am matched with an opponent
**When** the match starts simulating
**Then** I can close the browser
**And** the match continues server-side

**Given** a ranked match is in progress
**When** I return to the platform
**Then** I see my pending match status

**Given** I have a completed ranked match
**When** I return to the platform
**Then** I see a notification "Match completed!"
**And** I can view the results

---

### Story 4.3: Ranked Match Results View

As a user,
I want to view my ranked match results,
So that I can see how I performed.

**Acceptance Criteria:**

**Given** I have completed ranked matches
**When** I view my match history
**Then** I see my recent ranked matches
**And** each shows: opponent name, score, result (win/loss/draw), rating change

**Given** I click on a ranked match
**When** the details load
**Then** I can watch the replay
**And** I see the same debug panel features as practice mode

**Given** I just finished a ranked match
**When** I view results
**Then** I see my new rating
**And** I see how many points I gained/lost

---

### Story 4.4: Points/Elo Rating System

As a system,
I want to calculate player ratings after matches,
So that rankings reflect skill accurately.

**Acceptance Criteria:**

**Given** a new user
**When** they play their first ranked match
**Then** they start with initial rating (e.g., 1000 points)

**Given** a ranked match completes
**When** ratings are calculated
**Then** winner gains points and loser loses points
**And** point change is based on rating difference (upset = more points)

**Given** two players of equal rating
**When** one wins
**Then** they gain standard points (e.g., +25)
**And** loser loses standard points (e.g., -25)

**Given** a lower-rated player beats higher-rated
**When** ratings update
**Then** upset bonus applies (winner gains more, loser loses more)

---

### Story 4.5: Public Leaderboard

As a user,
I want to view the public leaderboard,
So that I can see top players and my ranking.

**Acceptance Criteria:**

**Given** I navigate to leaderboard
**When** the page loads
**Then** I see top 100 players ranked by rating
**And** each entry shows: rank, username, rating, win/loss record

**Given** I am logged in
**When** I view leaderboard
**Then** my position is highlighted
**And** I see my current ranking position (e.g., "#47 of 156 players")

**Given** I want to find a specific player
**When** I view the leaderboard
**Then** I can see other players' rankings
**And** click their name to see their profile stats (wins, losses, rating history)
