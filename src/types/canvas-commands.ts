/**
 * Commandes envoyées du Web vers le Canvas
 * Direction: Web (React) → Canvas (PixiJS)
 * PROPRIÉTAIRE CONJOINT: Les deux architectes doivent valider toute modification
 */

import type { TacticData, SimulationOptions } from './shared';

// ============================================================================
// COMMAND: Charger une tactique
// ============================================================================

export interface LoadTacticCommand {
  type: 'LOAD_TACTIC';
  payload: TacticData;
}

// ============================================================================
// COMMAND: Assigner un script à un joueur
// ============================================================================

export interface AssignScriptCommand {
  type: 'ASSIGN_SCRIPT';
  payload: {
    playerId: string;
    scriptId: string;
  };
}

// ============================================================================
// COMMAND: Contrôle de lecture
// ============================================================================

export type PlaybackAction =
  | 'play'
  | 'pause'
  | 'step_forward'
  | 'step_backward'
  | 'seek'
  | 'reset';

export interface PlaybackCommand {
  type: 'PLAYBACK';
  payload: {
    action: PlaybackAction;
    frameIndex?: number;
  };
}

// ============================================================================
// COMMAND: Lancer une simulation
// ============================================================================

export interface RunSimulationCommand {
  type: 'RUN_SIMULATION';
  payload: {
    tacticId: string;
    options?: SimulationOptions;
  };
}

// ============================================================================
// COMMAND: Highlight un joueur
// ============================================================================

export interface HighlightPlayerCommand {
  type: 'HIGHLIGHT_PLAYER';
  payload: {
    playerId: string | null;
  };
}

// ============================================================================
// UNION TYPE de toutes les commandes
// ============================================================================

export type CanvasCommand =
  | LoadTacticCommand
  | AssignScriptCommand
  | PlaybackCommand
  | RunSimulationCommand
  | HighlightPlayerCommand;

export type CanvasCommandType = CanvasCommand['type'];
