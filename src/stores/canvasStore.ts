/**
 * Canvas Store - État observable du Canvas côté React
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

import { create } from 'zustand';
import type { MatchFrame, Position, PlayerFrameState } from '@/types';

interface CanvasState {
  // État de lecture
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;

  // Sélection
  selectedPlayerId: string | null;
  hoveredPlayerId: string | null;

  // Debugger log filter (story 3.11): same id convention as
  // selectedPlayerId (matchPlayerKey: 'challenger-3') — the pitch
  // selection drives both; null = all players
  logFilterPlayerId: string | null;

  // État de la tactique
  tacticLoaded: boolean;

  // États des joueurs (dernière frame)
  playerStates: PlayerFrameState[];

  // Match replay (story 3.7): frames driving the score display
  matchFrames: MatchFrame[];
}

interface CanvasActions {
  // Mise à jour depuis le Canvas
  setSelectedPlayer: (id: string | null) => void;
  /** Filter the debugger's replay logs to one match player (null = all) */
  setLogFilter: (id: string | null) => void;
  setHoveredPlayer: (id: string | null) => void;
  updatePlaybackState: (playing: boolean, frame: number, total: number) => void;
  updatePlayerStates: (states: PlayerFrameState[]) => void;
  setMatchFrames: (frames: MatchFrame[]) => void;

  // Mise à jour du state
  setTacticLoaded: (loaded: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState: CanvasState = {
  isPlaying: false,
  currentFrame: 0,
  totalFrames: 0,
  selectedPlayerId: null,
  hoveredPlayerId: null,
  logFilterPlayerId: null,
  tacticLoaded: false,
  playerStates: [],
  matchFrames: [],
};

export const useCanvasStore = create<CanvasState & CanvasActions>((set) => ({
  ...initialState,

  setSelectedPlayer: (id) => set({ selectedPlayerId: id }),

  setLogFilter: (id) => set({ logFilterPlayerId: id }),

  setHoveredPlayer: (id) => set({ hoveredPlayerId: id }),

  updatePlaybackState: (playing, frame, total) =>
    set({
      isPlaying: playing,
      currentFrame: frame,
      totalFrames: total,
    }),

  updatePlayerStates: (states) => set({ playerStates: states }),

  setMatchFrames: (frames) => set({ matchFrames: frames }),

  setTacticLoaded: (loaded) => set({ tacticLoaded: loaded }),

  reset: () => set(initialState),
}));
