/**
 * Tactics Store - Saved lineup state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError } from '@/lib/apiClient';
import type { TacticConfig, TacticPlayerConfig } from '@/types';

interface TacticsState {
  // Saved tactics
  tactics: TacticConfig[];

  // Currently selected tactic
  activeTacticId: string | null;

  // Loading state for tactics
  isLoadingTactics: boolean;

  // Saving/creating/updating state
  isSavingTactic: boolean;

  // Error state for tactics
  tacticsError: string | null;
}

interface TacticsActions {
  // API operations
  fetchTactics: () => Promise<void>;
  saveTactic: (name: string, slots: TacticPlayerConfig[]) => Promise<void>;
  updateTactic: (id: string, name?: string, slots?: TacticPlayerConfig[]) => Promise<void>;

  // Selection
  selectTactic: (id: string | null) => void;

  // Errors
  clearTacticsError: () => void;

  // Reset
  reset: () => void;
}

const initialState: TacticsState = {
  tactics: [],
  activeTacticId: null,
  isLoadingTactics: false,
  isSavingTactic: false,
  tacticsError: null,
};

/** camelCase store shape -> snake_case API payload */
const slotsToPayload = (slots: TacticPlayerConfig[]) =>
  slots.map((slot) => ({
    player_slot: slot.playerSlot,
    position_x: slot.positionX,
    position_y: slot.positionY,
    script_id: slot.scriptId,
  }));

export const useTacticsStore = create<TacticsState & TacticsActions>((set, get) => ({
  ...initialState,

  fetchTactics: async () => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ tacticsError: 'Not authenticated', isLoadingTactics: false });
      return;
    }

    set({ isLoadingTactics: true, tacticsError: null });

    try {
      const response = await apiFetch('/tactics');
      const tacticsData = await response.json();

      set((state) => {
        const fetched = tacticsData as TacticConfig[];
        return {
          tactics: fetched,
          // Drop a stale selection that no longer exists server-side
          activeTacticId:
            state.activeTacticId !== null && fetched.some((tactic) => tactic.id === state.activeTacticId)
              ? state.activeTacticId
              : null,
          isLoadingTactics: false,
          tacticsError: null,
        };
      });
    } catch (error) {
      if (error instanceof ApiError) {
        set({
          tacticsError: error.message || 'Failed to fetch tactics',
          isLoadingTactics: false,
        });
        return;
      }
      console.error('Error fetching tactics:', error);
      set({
        tacticsError: 'Failed to load tactics. Please try again.',
        isLoadingTactics: false,
      });
    }
  },

  saveTactic: async (name: string, slots: TacticPlayerConfig[]) => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ tacticsError: 'Not authenticated', isSavingTactic: false });
      return;
    }

    // Prevent concurrent saves (double-click would create duplicate tactics)
    if (get().isSavingTactic) {
      return;
    }

    set({ isSavingTactic: true, tacticsError: null });

    try {
      const response = await apiFetch('/tactics', {
        method: 'POST',
        body: JSON.stringify({
          name,
          players: slotsToPayload(slots),
        }),
      });

      const tacticData = await response.json();
      const newTactic = tacticData as TacticConfig;

      set((state) => ({
        tactics: [newTactic, ...state.tactics],
        activeTacticId: newTactic.id,
        isSavingTactic: false,
        tacticsError: null,
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        set({
          tacticsError: error.message || 'Failed to save tactic',
          isSavingTactic: false,
        });
        return;
      }
      console.error('Error saving tactic:', error);
      set({
        tacticsError: 'Failed to save tactic. Please try again.',
        isSavingTactic: false,
      });
    }
  },

  updateTactic: async (id: string, name?: string, slots?: TacticPlayerConfig[]) => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ tacticsError: 'Not authenticated', isSavingTactic: false });
      return;
    }

    // Prevent overlapping updates (last-write-wins races)
    if (get().isSavingTactic) {
      return;
    }

    set({ isSavingTactic: true, tacticsError: null });

    try {
      const body: Record<string, unknown> = {};
      if (name !== undefined) {
        body.name = name;
      }
      if (slots !== undefined) {
        body.players = slotsToPayload(slots);
      }

      const response = await apiFetch(`/tactics/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      const tacticData = await response.json();
      const updatedTactic = tacticData as TacticConfig;

      set((state) => ({
        tactics: state.tactics.map((tactic) =>
          tactic.id === id ? updatedTactic : tactic,
        ),
        isSavingTactic: false,
        tacticsError: null,
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        set({
          tacticsError: error.message || 'Failed to update tactic',
          isSavingTactic: false,
        });
        return;
      }
      console.error('Error updating tactic:', error);
      set({
        tacticsError: 'Failed to update tactic. Please try again.',
        isSavingTactic: false,
      });
    }
  },

  selectTactic: (id) =>
    set((state) => ({
      // Ignore ids that do not exist in the list; null always deselects
      activeTacticId:
        id === null || state.tactics.some((tactic) => tactic.id === id) ? id : state.activeTacticId,
    })),

  clearTacticsError: () => set({ tacticsError: null }),

  reset: () => set(initialState),
}));
