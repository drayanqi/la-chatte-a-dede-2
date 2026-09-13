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

  // Deleting state
  isDeletingTactic: boolean;

  // Id of the tactic last successfully created/saved (drives the "saved" feedback)
  lastSavedTacticId: string | null;

  // Timestamp of the last successful save (changes every save, even same tactic)
  lastSavedAt: number | null;

  // Error state for tactics
  tacticsError: string | null;
}

interface TacticsActions {
  // API operations
  fetchTactics: () => Promise<void>;
  saveTactic: (name: string, slots: TacticPlayerConfig[]) => Promise<void>;
  updateTactic: (id: string, name?: string, slots?: TacticPlayerConfig[]) => Promise<void>;
  createTactic: () => Promise<TacticConfig | null>;
  deleteTactic: (id: string) => Promise<boolean>;

  // Selection
  selectTactic: (id: string | null) => void;

  // Cleanup: null out a deleted script's references in every cached tactic
  detachScriptFromPlayers: (scriptId: string) => void;

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
  isDeletingTactic: false,
  lastSavedTacticId: null,
  lastSavedAt: null,
  tacticsError: null,
};

/**
 * Default formation applied when the "+" button creates a tactic.
 * Positions are kickoff positions in home's left half (x 0-50; home defends
 * the left goal and attacks toward x=100), matching Story 3.6 bot geometry
 * (API bounds: y 0-50).
 */
const DEFAULT_FORMATION: TacticPlayerConfig[] = [
  { playerSlot: 1, positionX: 8, positionY: 25, scriptId: null }, // GK
  { playerSlot: 2, positionX: 25, positionY: 15, scriptId: null }, // DEF1
  { playerSlot: 3, positionX: 25, positionY: 35, scriptId: null }, // DEF2
  { playerSlot: 4, positionX: 40, positionY: 15, scriptId: null }, // ATK1
  { playerSlot: 5, positionX: 40, positionY: 35, scriptId: null }, // ATK2
];

/** localStorage key remembering the last active tactic across sessions */
const LAST_ACTIVE_KEY = 'last_active_tactic_id';

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
        let activeTacticId =
          state.activeTacticId !== null && fetched.some((tactic) => tactic.id === state.activeTacticId)
            ? state.activeTacticId
            : null;

        // Restore the last active tactic from a previous session
        if (activeTacticId === null) {
          const remembered = localStorage.getItem(LAST_ACTIVE_KEY);
          if (remembered && fetched.some((tactic) => tactic.id === remembered)) {
            activeTacticId = remembered;
          }
        }

        return {
          tactics: fetched,
          activeTacticId,
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
        lastSavedTacticId: newTactic.id,
        lastSavedAt: Date.now(),
        tacticsError: null,
      }));
      localStorage.setItem(LAST_ACTIVE_KEY, newTactic.id);
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
        lastSavedTacticId: id,
        lastSavedAt: Date.now(),
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

  createTactic: async () => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ tacticsError: 'Not authenticated', isSavingTactic: false });
      return null;
    }

    // Prevent concurrent creations (double-click would create duplicate tactics)
    if (get().isSavingTactic) {
      return null;
    }

    set({ isSavingTactic: true, tacticsError: null });

    try {
      const name = `Tactic ${get().tactics.length + 1}`;

      const response = await apiFetch('/tactics', {
        method: 'POST',
        body: JSON.stringify({
          name,
          players: slotsToPayload(DEFAULT_FORMATION),
        }),
      });

      const tacticData = await response.json();
      const newTactic = tacticData as TacticConfig;

      set((state) => ({
        tactics: [...state.tactics, newTactic],
        activeTacticId: newTactic.id,
        isSavingTactic: false,
        lastSavedTacticId: newTactic.id,
        lastSavedAt: Date.now(),
        tacticsError: null,
      }));
      localStorage.setItem(LAST_ACTIVE_KEY, newTactic.id);

      return newTactic;
    } catch (error) {
      if (error instanceof ApiError) {
        set({
          tacticsError: error.message || 'Failed to create tactic',
          isSavingTactic: false,
        });
        return null;
      }
      console.error('Error creating tactic:', error);
      set({
        tacticsError: 'Failed to create tactic. Please try again.',
        isSavingTactic: false,
      });
      return null;
    }
  },

  deleteTactic: async (id: string) => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ tacticsError: 'Not authenticated', isDeletingTactic: false });
      return false;
    }

    if (get().isDeletingTactic) {
      return false;
    }

    set({ isDeletingTactic: true, tacticsError: null });

    try {
      const response = await apiFetch(`/tactics/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          (errorData as { message?: string }).message || 'Failed to delete tactic'
        );
      }

      set((state) => {
        const index = state.tactics.findIndex((tactic) => tactic.id === id);
        const remaining = state.tactics.filter((tactic) => tactic.id !== id);

        let activeTacticId = state.activeTacticId;
        if (state.activeTacticId === id) {
          // Promote the neighbor that took the deleted slot, else the last one
          const neighbor = remaining[Math.min(index, remaining.length - 1)] ?? null;
          activeTacticId = neighbor ? neighbor.id : null;
        }

        if (activeTacticId === null) {
          localStorage.removeItem(LAST_ACTIVE_KEY);
        }

        return {
          tactics: remaining,
          activeTacticId,
          isDeletingTactic: false,
          tacticsError: null,
        };
      });

      // Invariant (story 3.2): the user always keeps at least one tactic —
      // deleting the last one immediately recreates a default one.
      if (get().tactics.length === 0) {
        await get().createTactic();
      }

      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        set({
          tacticsError: error.message || 'Failed to delete tactic',
          isDeletingTactic: false,
        });
        return false;
      }
      console.error('Error deleting tactic:', error);
      set({
        tacticsError: 'Failed to delete tactic. Please try again.',
        isDeletingTactic: false,
      });
      return false;
    }
  },

  selectTactic: (id) =>
    set((state) => {
      // Ignore ids that do not exist in the list; null always deselects
      const activeTacticId =
        id === null || state.tactics.some((tactic) => tactic.id === id) ? id : state.activeTacticId;

      // Remember the selection so a reload restores it (story 3.2 AC #6)
      if (activeTacticId !== null && activeTacticId !== state.activeTacticId) {
        localStorage.setItem(LAST_ACTIVE_KEY, activeTacticId);
      } else if (activeTacticId === null) {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      }

      return { activeTacticId };
    }),

  detachScriptFromPlayers: (scriptId) =>
    set((state) => ({
      tactics: state.tactics.map((tactic) =>
        tactic.players.some((player) => player.scriptId === scriptId)
          ? {
              ...tactic,
              players: tactic.players.map((player) =>
                player.scriptId === scriptId ? { ...player, scriptId: null } : player
              ),
            }
          : tactic
      ),
    })),

  clearTacticsError: () => set({ tacticsError: null }),

  reset: () => set(initialState),
}));
