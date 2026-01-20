/**
 * Events émis par le Canvas vers le Web
 * Direction: Canvas (PixiJS) → Web (React)
 * PROPRIÉTAIRE CONJOINT: Les deux architectes doivent valider toute modification
 */

import type { PlayerFrameState, SimulationError, Position, TeamId } from './shared';

// ============================================================================
// EVENT: Sélection d'un joueur
// ============================================================================

export interface PlayerSelectedEvent {
  type: 'PLAYER_SELECTED';
  payload: {
    playerId: string;
    teamId: TeamId;
    position: Position;
    currentScriptId: string | null;
  };
}

// ============================================================================
// EVENT: Script déposé sur un joueur
// ============================================================================

export interface ScriptDroppedEvent {
  type: 'SCRIPT_DROPPED';
  payload: {
    playerId: string;
    scriptId: string;
    dropPosition: Position;
  };
}

// ============================================================================
// EVENT: Changement de frame pendant le replay
// ============================================================================

export interface FrameChangedEvent {
  type: 'FRAME_CHANGED';
  payload: {
    currentFrame: number;
    totalFrames: number;
    timestamp: number;
    playerStates: PlayerFrameState[];
  };
}

// ============================================================================
// EVENT: Simulation terminée
// ============================================================================

export interface SimulationCompleteEvent {
  type: 'SIMULATION_COMPLETE';
  payload: {
    success: boolean;
    totalFrames: number;
    duration: number;
    errors: SimulationError[];
  };
}

// ============================================================================
// EVENT: Joueur survolé (hover)
// ============================================================================

export interface PlayerHoveredEvent {
  type: 'PLAYER_HOVERED';
  payload: {
    playerId: string | null;
    position: Position | null;
  };
}

// ============================================================================
// UNION TYPE de tous les events Canvas
// ============================================================================

export type CanvasEvent =
  | PlayerSelectedEvent
  | ScriptDroppedEvent
  | FrameChangedEvent
  | SimulationCompleteEvent
  | PlayerHoveredEvent;

export type CanvasEventType = CanvasEvent['type'];
