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
  logs: string[];
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
}

export interface SimulateErrorResponse {
  success: false;
  error: string;
}

export type PlayerAction =
  | { type: 'moveToward'; x: number; y: number }
  | { type: 'dribble'; x: number; y: number }
  | { type: 'shoot'; x: number; y: number }
  | { type: 'stop' };

export interface SlotAction {
  team: Team;
  slot: number;
  action: PlayerAction;
}
