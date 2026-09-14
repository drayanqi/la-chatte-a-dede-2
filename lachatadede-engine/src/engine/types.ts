export type Team = 'challenger' | 'opponent';

export type PlayerActionState = 'idle' | 'moving' | 'action';

export interface SimulatePayloadPlayer {
  slot: number;
  x: number;
  y: number;
  script: string;
}

export interface SimulatePayloadTeam {
  players: SimulatePayloadPlayer[];
}

export interface SimulatePayload {
  match_id: string;
  seed: number;
  output_path: string;
  challenger: SimulatePayloadTeam;
  opponent: SimulatePayloadTeam;
}

export interface FrameBall {
  x: number;
  y: number;
}

export interface FramePlayer {
  slot: number;
  team: Team;
  x: number;
  y: number;
  state: PlayerActionState;
}

/**
 * Structured log entry attached to a frame. Produced by script execution
 * (console capture, warnings, script errors) so the debug panel (story 3.10)
 * can render them as data. The `tick` is implicit: the entry belongs to the
 * frame it is recorded in.
 *
 * Documented variance from backend-architecture.md's frame format (which only
 * had `events`): `logs` entries are objects, not strings.
 */
export interface FrameLog {
  team: Team;
  slot: number;
  level: 'log' | 'warn' | 'error';
  /** Machine-readable kind: 'CONSOLE', 'MULTIPLE_ACTIONS', 'DRIBBLE_NO_BALL', 'SHOOT_NO_BALL', 'SCRIPT_ERROR', 'SCRIPT_TIMEOUT', 'SCRIPT_MEMORY'. */
  type: string;
  message: string;
}

export interface GoalEvent {
  type: 'goal';
  team: Team;
  scorerSlot: number;
}

export type FrameEvent = GoalEvent;

export interface Frame {
  index: number;
  ball: FrameBall;
  players: FramePlayer[];
  events: FrameEvent[];
  logs: FrameLog[];
}

export type Winner = 'challenger' | 'opponent' | 'draw';

export interface SimulationResult {
  score_challenger: number;
  score_opponent: number;
  winner: Winner;
}

/** Top-level JSON file format written to {output_path}/{match_id}.json */
export interface SimulationFrameFile {
  match_id: string;
  seed: number;
  total_frames: number;
  result: SimulationResult;
  frames: Frame[];
}

export interface SimulateSuccessResponse {
  success: true;
  file: string;
  result: {
    score_challenger: number;
    score_opponent: number;
    duration_frames: number;
  };
  /**
   * Match-level execution problems (e.g. wall-clock watchdog exceeded).
   * Script-level errors are recorded per frame in the frame logs instead.
   */
  errors: string[];
}

export interface SimulateErrorResponse {
  success: false;
  error: string;
}

export type PlayerAction =
  | { type: 'moveToward'; x: number; y: number }
  | { type: 'dribble'; x: number; y: number }
  | { type: 'shoot'; x: number; y: number; power: number }
  | { type: 'stop' };

export interface SlotAction {
  team: Team;
  slot: number;
  action: PlayerAction;
}
