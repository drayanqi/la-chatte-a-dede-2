/**
 * Editor Store - Monaco editor state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import type { Script } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface EditorState {
  // Available scripts
  scripts: Map<string, Script>;

  // Active script in editor
  activeScriptId: string | null;

  // Modification state
  hasUnsavedChanges: boolean;

  // Loading state for scripts
  isLoadingScripts: boolean;

  // Creating state for scripts
  isCreatingScript: boolean;

  // Error state for scripts
  scriptsError: string | null;

  // Syntax errors
  syntaxErrors: Array<{
    scriptId: string;
    line: number;
    message: string;
  }>;
}

interface EditorActions {
  // Script management
  addScript: (script: Script) => void;
  updateScript: (id: string, code: string) => void;
  deleteScript: (id: string) => void;

  // API operations
  fetchScripts: () => Promise<void>;
  createScript: (name: string, code?: string) => Promise<void>;

  // Navigation
  openScript: (id: string) => void;
  closeScript: () => void;

  // Save state
  markSaved: () => void;
  markUnsaved: () => void;

  // Errors
  setSyntaxErrors: (errors: EditorState['syntaxErrors']) => void;
  clearScriptsError: () => void;

  // Reset
  reset: () => void;
}

const initialState: EditorState = {
  scripts: new Map(),
  activeScriptId: null,
  hasUnsavedChanges: false,
  isLoadingScripts: false,
  isCreatingScript: false,
  scriptsError: null,
  syntaxErrors: [],
};

/**
 * Generate default code template for new AI scripts
 */
const generateDefaultCode = (name: string): string => {
  const date = new Date().toISOString().split('T')[0];
  return `// AI Script: ${name}
// Created: ${date}

function update(me, ball, teammates, opponents, goal) {
  // Your AI logic here

  // Example: Move toward the ball if closest
  if (me.isClosestToBall()) {
    me.moveTo(ball.position.x, ball.position.y);
  }
}
`;
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  fetchScripts: async () => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ scriptsError: 'Not authenticated', isLoadingScripts: false });
      return;
    }

    set({ isLoadingScripts: true, scriptsError: null });

    try {
      const response = await fetch(`${API_URL}/scripts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        set({
          scriptsError: data.message || 'Failed to fetch scripts',
          isLoadingScripts: false,
        });
        return;
      }

      const scriptsData = await response.json();

      const scriptsMap = new Map<string, Script>();
      for (const script of scriptsData) {
        scriptsMap.set(script.id, {
          id: script.id,
          name: script.name,
          code: script.code,
          language: script.language,
          lastModified: new Date(script.updated_at),
        });
      }

      set({
        scripts: scriptsMap,
        isLoadingScripts: false,
        scriptsError: null,
      });
    } catch (error) {
      console.error('Error fetching scripts:', error);
      set({
        scriptsError: 'Failed to load scripts. Please try again.',
        isLoadingScripts: false,
      });
    }
  },

  createScript: async (name: string, code?: string) => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ scriptsError: 'Not authenticated', isCreatingScript: false });
      return;
    }

    // Prevent concurrent script creation
    if (get().isCreatingScript) {
      return;
    }

    set({ isCreatingScript: true, scriptsError: null });

    try {
      const scriptCode = code ?? generateDefaultCode(name);

      const response = await fetch(`${API_URL}/scripts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          code: scriptCode,
          language: 'javascript',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        set({
          scriptsError: data.message || 'Failed to create script',
          isCreatingScript: false,
        });
        return;
      }

      const scriptData = await response.json();

      const newScript: Script = {
        id: scriptData.id,
        name: scriptData.name,
        code: scriptData.code,
        language: scriptData.language,
        lastModified: new Date(scriptData.updated_at),
      };

      // Add script to map and open it in editor
      set((state) => {
        const newScripts = new Map(state.scripts);
        // Insert at beginning to appear at top (most recent)
        const entries = Array.from(newScripts.entries());
        newScripts.clear();
        newScripts.set(newScript.id, newScript);
        for (const [id, script] of entries) {
          newScripts.set(id, script);
        }
        return {
          scripts: newScripts,
          activeScriptId: newScript.id,
          isCreatingScript: false,
          scriptsError: null,
        };
      });
    } catch (error) {
      console.error('Error creating script:', error);
      set({
        scriptsError: 'Failed to create script. Please try again.',
        isCreatingScript: false,
      });
    }
  },

  addScript: (script) =>
    set((state) => {
      const newScripts = new Map(state.scripts);
      newScripts.set(script.id, script);
      return { scripts: newScripts };
    }),

  updateScript: (id, code) =>
    set((state) => {
      const script = state.scripts.get(id);
      if (!script) return state;

      const newScripts = new Map(state.scripts);
      newScripts.set(id, {
        ...script,
        code,
        lastModified: new Date(),
      });
      return { scripts: newScripts, hasUnsavedChanges: true };
    }),

  deleteScript: (id) =>
    set((state) => {
      const newScripts = new Map(state.scripts);
      newScripts.delete(id);
      return {
        scripts: newScripts,
        activeScriptId: state.activeScriptId === id ? null : state.activeScriptId,
      };
    }),

  openScript: (id) => set({ activeScriptId: id }),

  closeScript: () => set({ activeScriptId: null }),

  markSaved: () => set({ hasUnsavedChanges: false }),

  markUnsaved: () => set({ hasUnsavedChanges: true }),

  setSyntaxErrors: (errors) => set({ syntaxErrors: errors }),

  clearScriptsError: () => set({ scriptsError: null }),

  reset: () => set(initialState),
}));
