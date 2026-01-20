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
