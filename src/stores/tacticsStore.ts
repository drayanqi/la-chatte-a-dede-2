/**
 * Tactics Store - Saved lineup state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import { apiFetch, ApiError } from '@/lib/apiClient';
import type { TacticConfig, TacticCustomizationPatch, TacticPlayerConfig } from '@/types';

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

  // Work queued while a save is in flight (drained when the in-flight settles)
  pendingUpdate: {
    id: string;
    name?: string;
    slots?: TacticPlayerConfig[];
    isReady?: boolean;
    customization?: TacticCustomizationPatch;
  } | null;
  pendingCreate: boolean;
}

interface TacticsActions {
  // API operations
  fetchTactics: () => Promise<void>;
  saveTactic: (name: string, slots: TacticPlayerConfig[]) => Promise<TacticConfig | null>;
  updateTactic: (
    id: string,
    name?: string,
    slots?: TacticPlayerConfig[],
    isReady?: boolean,
    customization?: TacticCustomizationPatch
  ) => Promise<void>;
  createTactic: (name?: string) => Promise<TacticConfig | null>;
  deleteTactic: (id: string) => Promise<boolean>;
  duplicateTactic: (id: string) => Promise<TacticConfig | null>;

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
  pendingUpdate: null,
  pendingCreate: false,
};

/**
 * Drain the work queued while a save was in flight (latest-wins). Called when
 * an in-flight save settles, so no edit is silently dropped: the last queued
 * update (merged fields, same id) or a queued default-creation runs next.
 */
const runPendingWork = (): void => {
  const state = useTacticsStore.getState();
  if (state.pendingUpdate) {
    useTacticsStore.setState({ pendingUpdate: null });
    void state.updateTactic(
      state.pendingUpdate.id,
      state.pendingUpdate.name,
      state.pendingUpdate.slots,
      state.pendingUpdate.isReady,
      state.pendingUpdate.customization
    );
  } else if (state.pendingCreate) {
    useTacticsStore.setState({ pendingCreate: false });
    void state.createTactic();
  }
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

/** localStorage can throw (quota exceeded, private mode) — persistence is best-effort */
const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Script ids observed deleted while a save referencing them could be in
 * flight. A stale server response must never resurrect them into the cache
 * (the next auto-save would PUT a dead script_id and 422).
 */
const deletedScriptIds = new Set<string>();

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
        // System tactics are never editable in MVP — filter at the source so
        // every selection path (tabs, delete-neighbor, restore) sees users' only
        const fetched = (tacticsData as TacticConfig[]).filter((tactic) => !tactic.isSystem);
        let activeTacticId =
          state.activeTacticId !== null && fetched.some((tactic) => tactic.id === state.activeTacticId)
            ? state.activeTacticId
            : null;

        // Restore the last active tactic from a previous session
        if (activeTacticId === null) {
          const remembered = safeGetItem(LAST_ACTIVE_KEY);
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
      return null;
    }

    // Prevent concurrent saves (double-click would create duplicate tactics)
    if (get().isSavingTactic) {
      return null;
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

      // Append (same pipeline as createTactic): duplicate pills land at the
      // end and delete-promotion hands the active slot back to the source
      // neighbor, not to whichever tactic happens to sit first
      set((state) => ({
        tactics: [...state.tactics, newTactic],
        activeTacticId: newTactic.id,
        isSavingTactic: false,
        lastSavedTacticId: newTactic.id,
        lastSavedAt: Date.now(),
        tacticsError: null,
      }));
      safeSetItem(LAST_ACTIVE_KEY, newTactic.id);
      return newTactic;
    } catch (error) {
      if (error instanceof ApiError) {
        set({
          tacticsError: error.message || 'Failed to save tactic',
          isSavingTactic: false,
        });
        return null;
      }
      console.error('Error saving tactic:', error);
      set({
        tacticsError: 'Failed to save tactic. Please try again.',
        isSavingTactic: false,
      });
      return null;
    } finally {
      runPendingWork();
    }
  },

  updateTactic: async (
    id: string,
    name?: string,
    slots?: TacticPlayerConfig[],
    isReady?: boolean,
    customization?: TacticCustomizationPatch
  ) => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ tacticsError: 'Not authenticated', isSavingTactic: false });
      return;
    }

    // A save is in flight: never drop the edit — queue it (latest-wins,
    // merged fields for the same tactic) and it runs when the PUT settles
    if (get().isSavingTactic) {
      const prev = get().pendingUpdate;
      const pendingUpdate =
        prev && prev.id === id
          ? {
              id,
              name: name ?? prev.name,
              slots: slots ?? prev.slots,
              isReady: isReady ?? prev.isReady,
              // Patch-merge customizations: a later queue entry without one
              // must not silently discard an earlier queued crest/color edit
              customization:
                customization || prev.customization
                  ? { ...prev.customization, ...customization }
                  : undefined,
            }
          : { id, name, slots, isReady, customization };
      set({ pendingUpdate });
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
      if (isReady !== undefined) {
        body.is_ready = isReady;
      }
      if (customization) {
        // has() semantics server-side: an absent key keeps the current
        // value; crest null clears it (story 7.4)
        if (customization.colorPrimary !== undefined) {
          body.color_primary = customization.colorPrimary;
        }
        if (customization.colorSecondary !== undefined) {
          body.color_secondary = customization.colorSecondary;
        }
        if (customization.crest !== undefined) {
          body.crest = customization.crest;
        }
      }

      const response = await apiFetch(`/tactics/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      const tacticData = await response.json();
      const updatedTactic = tacticData as TacticConfig;

      // A script deleted while this PUT was in flight must not be resurrected
      // by the stale response body
      const sanitized: TacticConfig = {
        ...updatedTactic,
        players: updatedTactic.players.map((player) =>
          player.scriptId && deletedScriptIds.has(player.scriptId)
            ? { ...player, scriptId: null }
            : player
        ),
      };

      set((state) => ({
        tactics: state.tactics.map((tactic) =>
          tactic.id === id ? sanitized : tactic,
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
    } finally {
      runPendingWork();
    }
  },

  createTactic: async (name?: string) => {
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
      const finalName = name?.trim() || `Tactic ${get().tactics.length + 1}`;

      const response = await apiFetch('/tactics', {
        method: 'POST',
        body: JSON.stringify({
          name: finalName,
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
      safeSetItem(LAST_ACTIVE_KEY, newTactic.id);

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
    } finally {
      runPendingWork();
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
      // apiFetch throws ApiError on non-ok responses — the catch handles it
      await apiFetch(`/tactics/${id}`, {
        method: 'DELETE',
      });

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
          safeRemoveItem(LAST_ACTIVE_KEY);
        }

        return {
          tactics: remaining,
          activeTacticId,
          isDeletingTactic: false,
          tacticsError: null,
        };
      });

      // Invariant (story 3.2): the user always keeps at least one tactic —
      // deleting the last one immediately recreates a default one. If a save
      // is still in flight, queue the creation so it survives the guard.
      if (get().tactics.length === 0) {
        if (get().isSavingTactic) {
          set({ pendingCreate: true });
        } else {
          await get().createTactic();
        }
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

  /**
   * Duplique une équipe (story 7.5): POST d'une copie nommée "X (copie)"
   * avec la même line-up. La copie démarre en Brouillon (isReady n'est
   * pas copié) et devient l'équipe active — même pipeline que createTactic.
   * Le nom est tronqué pour tenir dans la limite serveur (max:100) même
   * avec le suffixe.
   */
  duplicateTactic: async (id: string) => {
    const source = get().tactics.find((tactic) => tactic.id === id);
    if (!source) return null;
    const suffix = ' (copie)';
    const base = source.name.slice(0, 100 - suffix.length);
    return get().saveTactic(`${base}${suffix}`, source.players);
  },

  selectTactic: (id) =>
    set((state) => {
      // Ignore ids that do not exist in the list; null always deselects
      const activeTacticId =
        id === null || state.tactics.some((tactic) => tactic.id === id) ? id : state.activeTacticId;
      // Remember the selection so a reload restores it (story 3.2 AC #6)
      if (activeTacticId !== null && activeTacticId !== state.activeTacticId) {
        safeSetItem(LAST_ACTIVE_KEY, activeTacticId);
      } else if (activeTacticId === null) {
        safeRemoveItem(LAST_ACTIVE_KEY);
      }

      return { activeTacticId };
    }),

  detachScriptFromPlayers: (scriptId) => {
    // Tombstone: in-flight saves must not resurrect this id from stale responses
    deletedScriptIds.add(scriptId);

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
    }));
  },

  clearTacticsError: () => set({ tacticsError: null }),

  reset: () => set(initialState),
}));
