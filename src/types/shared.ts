/**
 * Types partagés entre le Canvas (Game Architect) et le Web (Software Architect)
 * PROPRIÉTAIRE CONJOINT: Les deux architectes doivent valider toute modification
 */

// ============================================================================
// TYPES DE BASE
// ============================================================================

export interface Position {
  /** Position X en pourcentage du terrain (0-100) */
  x: number;
  /** Position Y en pourcentage du terrain (0-100) */
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

// ============================================================================
// JOUEURS & ÉQUIPES
// ============================================================================

export type TeamId = 'home' | 'away';

export interface Player {
  id: string;
  name: string;
  teamId: TeamId;
  number: number;
  position: Position;
  assignedScriptId: string | null;
}

export interface PlayerFrameState {
  playerId: string;
  position: Position;
  velocity: Velocity;
  state: 'idle' | 'moving' | 'action';
  debugInfo?: Record<string, unknown>;
}

// ============================================================================
// SCRIPTS IA
// ============================================================================

export type ScriptLanguage = 'javascript' | 'typescript';

export interface Script {
  id: string;
  name: string;
  code: string;
  language: ScriptLanguage;
  lastModified: Date;
}

// ============================================================================
// TACTIQUES
// ============================================================================

export interface TacticData {
  id: string;
  name: string;
  players: Player[];
  ball: Position;
  scripts: Record<string, Script>;
  /** Team customization (story 7.4), #rrggbb hex; absent = engine defaults */
  colorPrimary?: string;
  colorSecondary?: string;
}

/**
 * One player slot of a saved tactic: which script drives it and where it
 * starts on the field. scriptId is a reference only (never script code).
 */
export interface TacticPlayerConfig {
  playerSlot: 1 | 2 | 3 | 4 | 5;
  positionX: number;
  positionY: number;
  scriptId: string | null;
}

/**
 * Team customization patch (story 7.4): the fields the Équipement modal
 * edits. Absent keys keep the current value (PUT has() semantics); crest
 * null clears it.
 */
export interface TacticCustomizationPatch {
  colorPrimary?: string;
  colorSecondary?: string;
  crest?: string | null;
}

/**
 * A saved tactic as exposed by the API (camelCase shape). A tactic is a
 * ranked fighter (Epic 4 v2): isReady marks it challengeable, elo/wins/
 * losses are its own record (server-managed, never client-writable).
 * Team customization (story 7.4): hex colors + an optional crest emoji
 * from the server whitelist; colors always exist (server defaults).
 */
export interface TacticConfig {
  id: string;
  name: string;
  isSystem: boolean;
  isReady: boolean;
  elo: number;
  wins: number;
  losses: number;
  colorPrimary: string;
  colorSecondary: string;
  crest: string | null;
  players: TacticPlayerConfig[];
}

// ============================================================================
// SIMULATION
// ============================================================================

export interface SimulationOptions {
  maxFrames?: number;
  frameRate?: number;
  debugMode?: boolean;
}

export interface SimulationError {
  frame: number;
  playerId: string;
  scriptId: string;
  message: string;
  stack?: string;
}

export interface SimulationResult {
  frames: PlayerFrameState[][];
  duration: number;
  errors: SimulationError[];
}

// ============================================================================
// MATCHES
// ============================================================================

export type MatchMode = 'practice' | 'ranked';
export type MatchStatus = 'pending' | 'completed' | 'failed';

/** Final outcome, derived from the score by the API (null while pending/failed) */
export type MatchOutcome = 'challenger_win' | 'opponent_win' | 'draw' | null;

// ----------------------------------------------------------------------------
// Match replay frames (mirror of the engine's Frame format, percent coords)
// ----------------------------------------------------------------------------

/** Team as written in match frame files: challenger = the user, opponent = the bot/rival */
export type MatchTeam = 'challenger' | 'opponent';

export interface MatchFrameBall {
  x: number;
  y: number;
}

export interface MatchFramePlayer {
  slot: number;
  team: MatchTeam;
  x: number;
  y: number;
  state: 'idle' | 'moving' | 'action';
}

export interface MatchGoalEvent {
  type: 'goal';
  team: MatchTeam;
  /** 1-5 for an attributable goal; null for an own goal / no-touch trajectory */
  scorerSlot: number | null;
}

export interface MatchShotEvent {
  type: 'shot';
  team: MatchTeam;
  shooterSlot: number;
  /** Honest direct-trajectory verdict computed by the engine (story 7.9) */
  onTarget: boolean;
}

/** Pelo's law: a camp change — a teammate pickup is never a turnover */
export interface MatchTurnoverEvent {
  type: 'turnover';
  /** Team that won the ball */
  team: MatchTeam;
  takerSlot: number;
  fromTeam: MatchTeam;
}

export type MatchFrameEvent = MatchGoalEvent | MatchShotEvent | MatchTurnoverEvent;

/** Structured log entry attached to a frame (debug panel, story 3.10) */
export interface MatchFrameLog {
  team: MatchTeam;
  slot: number;
  level: 'log' | 'warn' | 'error';
  type: string;
  message: string;
}

/**
 * One replay frame as produced by the simulation engine. Coordinates are
 * percent of the pitch (0-100). `events` carries per-tick events (goals).
 */
export interface MatchFrame {
  index: number;
  ball: MatchFrameBall;
  players: MatchFramePlayer[];
  events: MatchFrameEvent[];
  logs: MatchFrameLog[];
}

/** Per-team telemetry aggregates, engine truth (story 7.9) */
export interface MatchTeamStats {
  possessionTicks: number;
  /** TIRS (shot law): on-target kicks only — a non-cadré kick is a passe */
  shots: number;
  /** Passes tentées + completed (optional: replays predating the pass law) */
  passes?: number;
  passesCompleted?: number;
  turnovers: number;
}

export interface MatchPlayerStats {
  team: MatchTeam;
  slot: number;
  /** Distance covered in field units (1 unit = 1 m for display) */
  distance: number;
  shots: number;
}

export interface MatchStats {
  teams: { challenger: MatchTeamStats; opponent: MatchTeamStats };
  players: MatchPlayerStats[];
  /** Challenger possession share % per 300-tick bin (5s) — sparkline source */
  possessionTimeline: number[];
}

/**
 * A match as exposed by the API (camelCase shape). The challenger is the
 * user who started the match; scores compare their AI against the bot
 * (practice) or the opponent (ranked, Epic 4). pointsChallenger/
 * pointsOpponent carry the signed elo deltas of ranked matches.
 */
export interface MatchResult {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  scoreChallenger: number;
  scoreOpponent: number;
  result: MatchOutcome;
  pointsChallenger?: number | null;
  pointsOpponent?: number | null;
  challengerName?: string | null;
  opponentName?: string | null;
  /** Fighter names, not ids (serializer law); practice has no opponent tactic */
  challengerTacticName?: string | null;
  opponentTacticName?: string | null;
  /** Team customization (story 7.4); absent on practice matches (no opponent tactic) */
  challengerColorPrimary?: string | null;
  challengerColorSecondary?: string | null;
  challengerCrest?: string | null;
  opponentColorPrimary?: string | null;
  opponentColorSecondary?: string | null;
  opponentCrest?: string | null;
  durationFrames: number;
  createdAt: string;
}

/**
 * The simulation frame file as written by the engine and served raw by
 * GET /api/matches/{id}/frames (story 3.8). `stats` arrived with story 7.9:
 * older replays (and any payload the engine has not re-simulated) carry no
 * stats block — consumers must degrade gracefully, never crash.
 */
export interface MatchFramesFile {
  frames: MatchFrame[];
  stats?: MatchStats | null;
}

// ----------------------------------------------------------------------------
// Ranked matchmaking (Epic 4 v2)
// ----------------------------------------------------------------------------

/**
 * One challengeable ready tactic from another player (GET
 * /api/matchmaking/opponents), ranked by elo on the server.
 */
export interface RankedOpponent {
  id: string;
  name: string;
  owner: string | null;
  elo: number;
  wins: number;
  losses: number;
  /** Team identity (story 7.4); colors always exist, crest may be null */
  colorPrimary: string;
  crest: string | null;
  /** How many tactics the owner has (census badge, story 7.6) */
  ownerTacticsCount: number;
}

/**
 * One row of the public leaderboard (GET /api/leaderboard, story 4.5).
 * `rank` is computed server-side (1-based, elo desc with deterministic
 * tie-breaks) — the client renders rows in payload order and never
 * re-sorts or recomputes ranks.
 */
export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  owner: string | null;
  elo: number;
  wins: number;
  losses: number;
  /** Team identity (story 7.4); colors always exist, crest may be null */
  colorPrimary: string;
  crest: string | null;
}

// ============================================================================
// DEBUGGER
// ============================================================================

export interface Breakpoint {
  id: string;
  scriptId: string;
  line: number;
  enabled: boolean;
}

export interface WatchedVariable {
  id: string;
  name: string;
  expression: string;
  value: unknown;
}

export interface CallStackFrame {
  functionName: string;
  scriptId: string;
  line: number;
  column: number;
}
