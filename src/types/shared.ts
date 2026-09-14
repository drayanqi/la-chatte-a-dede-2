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
 * A saved tactic as exposed by the API (camelCase shape).
 */
export interface TacticConfig {
  id: string;
  name: string;
  isSystem: boolean;
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

/**
 * A match as exposed by the API (camelCase shape). The challenger is the
 * user who started the match; scores compare their AI against the bot
 * (practice) or the opponent (ranked, Epic 4).
 */
export interface MatchResult {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  scoreChallenger: number;
  scoreOpponent: number;
  result: MatchOutcome;
  durationFrames: number;
  createdAt: string;
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
