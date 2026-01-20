/**
 * Canvas Store - État observable du Canvas côté React
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

import { create } from 'zustand';
import type { Position, PlayerFrameState } from '@/types';

interface CanvasState {
  // État de lecture
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;

  // Sélection
  selectedPlayerId: string | null;
  hoveredPlayerId: string | null;

  // État de la tactique
  tacticLoaded: boolean;
  simulationReady: boolean;

  // États des joueurs (dernière frame)
  playerStates: PlayerFrameState[];
}

interface CanvasActions {
  // Mise à jour depuis le Canvas
  setSelectedPlayer: (id: string | null) => void;
  setHoveredPlayer: (id: string | null) => void;
  updatePlaybackState: (playing: boolean, frame: number, total: number) => void;
  updatePlayerStates: (states: PlayerFrameState[]) => void;

  // Mise à jour du state
  setTacticLoaded: (loaded: boolean) => void;
  setSimulationReady: (ready: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState: CanvasState = {
  isPlaying: false,
  currentFrame: 0,
  totalFrames: 0,
  selectedPlayerId: null,
  hoveredPlayerId: null,
  tacticLoaded: false,
  simulationReady: false,
  playerStates: [],
};

export const useCanvasStore = create<CanvasState & CanvasActions>((set) => ({
  ...initialState,

  setSelectedPlayer: (id) => set({ selectedPlayerId: id }),

  setHoveredPlayer: (id) => set({ hoveredPlayerId: id }),

  updatePlaybackState: (playing, frame, total) =>
    set({
      isPlaying: playing,
      currentFrame: frame,
      totalFrames: total,
    }),

  updatePlayerStates: (states) => set({ playerStates: states }),

  setTacticLoaded: (loaded) => set({ tacticLoaded: loaded }),

  setSimulationReady: (ready) => set({ simulationReady: ready }),

  reset: () => set(initialState),
}));
