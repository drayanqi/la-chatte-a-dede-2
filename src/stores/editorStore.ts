/**
 * Editor Store - Monaco editor state management
 * OWNER: Dev Team
 */

import { create } from 'zustand';
import type { Script } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

  // Renaming state for scripts
  isRenaming: boolean;

  // Duplicating state for scripts
  isDuplicating: boolean;

  // Deleting state for scripts
  isDeleting: boolean;

  // Saving state for scripts
  isSaving: boolean;

  // Save status for UI indicator
  saveStatus: SaveStatus;

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
  deleteScript: (id: string) => Promise<boolean>;

  // API operations
  fetchScripts: () => Promise<void>;
  createScript: (name: string, code?: string) => Promise<void>;
  saveScript: (id: string) => Promise<boolean>;
  renameScript: (id: string, newName: string) => Promise<boolean>;
  duplicateScript: (id: string) => Promise<string | null>;

  // Navigation
  openScript: (id: string) => void;
  closeScript: () => void;

  // Save state
  markSaved: () => void;
  markUnsaved: () => void;
  setSaveStatus: (status: SaveStatus) => void;

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
  isRenaming: false,
  isDuplicating: false,
  isDeleting: false,
  isSaving: false,
  saveStatus: 'idle',
  scriptsError: null,
  syntaxErrors: [],
};

/**
 * Generate a unique duplicate name for a script
 * Pattern: "Copy of X.js" -> "Copy of X (2).js" -> "Copy of X (3).js"
 */
const generateDuplicateName = (
  originalName: string,
  existingNames: string[]
): string => {
  // Remove .js extension for manipulation
  const baseName = originalName.replace(/\.js$/i, '');

  // Start with "Copy of X"
  let newName = `Copy of ${baseName}`;
  let counter = 2;

  // If already exists, add (2), (3), etc.
  while (existingNames.includes(`${newName}.js`)) {
    newName = `Copy of ${baseName} (${counter})`;
    counter++;
  }

  return `${newName}.js`;
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

  saveScript: async (id: string): Promise<boolean> => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ scriptsError: 'Not authenticated', saveStatus: 'error' });
      return false;
    }

    // Prevent concurrent saves
    if (get().isSaving) {
      return false;
    }

    const script = get().scripts.get(id);
    if (!script) {
      set({ scriptsError: 'Script not found', saveStatus: 'error' });
      return false;
    }

    set({ isSaving: true, saveStatus: 'saving', scriptsError: null });

    try {
      const response = await fetch(`${API_URL}/scripts/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          code: script.code,
          name: script.name,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        set({
          scriptsError: data.message || 'Failed to save script',
          isSaving: false,
          saveStatus: 'error',
        });
        return false;
      }

      const scriptData = await response.json();

      // Update script with server response
      set((state) => {
        const newScripts = new Map(state.scripts);
        const existingScript = newScripts.get(id);
        if (existingScript) {
          newScripts.set(id, {
            ...existingScript,
            lastModified: new Date(scriptData.updated_at),
          });
        }
        return {
          scripts: newScripts,
          hasUnsavedChanges: false,
          isSaving: false,
          saveStatus: 'saved',
          scriptsError: null,
        };
      });

      return true;
    } catch (error) {
      console.error('Error saving script:', error);
      set({
        scriptsError: 'Failed to save script. Please try again.',
        isSaving: false,
        saveStatus: 'error',
      });
      return false;
    }
  },

  renameScript: async (id: string, newName: string): Promise<boolean> => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ scriptsError: 'Not authenticated' });
      return false;
    }

    // Prevent concurrent renames
    if (get().isRenaming) {
      return false;
    }

    const script = get().scripts.get(id);
    if (!script) {
      set({ scriptsError: 'Script not found' });
      return false;
    }

    // Skip API call if name hasn't changed
    if (newName === script.name) {
      return true;
    }

    set({ isRenaming: true, scriptsError: null });

    try {
      const response = await fetch(`${API_URL}/scripts/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newName,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        set({
          scriptsError: data.message || 'Failed to rename script',
          isRenaming: false,
        });
        return false;
      }

      const scriptData = await response.json();

      // Update script with server response
      set((state) => {
        const newScripts = new Map(state.scripts);
        const existingScript = newScripts.get(id);
        if (existingScript) {
          newScripts.set(id, {
            ...existingScript,
            name: scriptData.name,
            lastModified: new Date(scriptData.updated_at),
          });
        }
        return {
          scripts: newScripts,
          isRenaming: false,
          scriptsError: null,
        };
      });

      return true;
    } catch (error) {
      console.error('Error renaming script:', error);
      set({
        scriptsError: 'Failed to rename script. Please try again.',
        isRenaming: false,
      });
      return false;
    }
  },

  duplicateScript: async (id: string): Promise<string | null> => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ scriptsError: 'Not authenticated' });
      return null;
    }

    // Prevent concurrent duplications
    if (get().isDuplicating) {
      return null;
    }

    const script = get().scripts.get(id);
    if (!script) {
      set({ scriptsError: 'Script not found' });
      return null;
    }

    set({ isDuplicating: true, scriptsError: null });

    try {
      // Generate unique name
      const existingNames = Array.from(get().scripts.values()).map((s) => s.name);
      const newName = generateDuplicateName(script.name, existingNames);

      const response = await fetch(`${API_URL}/scripts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newName,
          code: script.code,
          language: script.language,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        set({
          scriptsError: data.message || 'Failed to duplicate script',
          isDuplicating: false,
        });
        return null;
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
        for (const [scriptId, s] of entries) {
          newScripts.set(scriptId, s);
        }
        return {
          scripts: newScripts,
          activeScriptId: newScript.id,
          isDuplicating: false,
          scriptsError: null,
        };
      });

      return newScript.id;
    } catch (error) {
      console.error('Error duplicating script:', error);
      set({
        scriptsError: 'Failed to duplicate script. Please try again.',
        isDuplicating: false,
      });
      return null;
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

  deleteScript: async (id: string): Promise<boolean> => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      set({ scriptsError: 'Not authenticated' });
      return false;
    }

    // Prevent concurrent deletions
    if (get().isDeleting) {
      return false;
    }

    const script = get().scripts.get(id);
    if (!script) {
      set({ scriptsError: 'Script not found' });
      return false;
    }

    set({ isDeleting: true, scriptsError: null });

    try {
      const response = await fetch(`${API_URL}/scripts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        set({
          scriptsError: data.message || 'Failed to delete script',
          isDeleting: false,
        });
        return false;
      }

      // Remove from local state and handle active script
      set((state) => {
        const newScripts = new Map(state.scripts);
        newScripts.delete(id);

        // Determine new active script if deleted was active
        let newActiveId = state.activeScriptId;
        if (state.activeScriptId === id) {
          const scriptIds = Array.from(newScripts.keys());
          newActiveId = scriptIds.length > 0 ? scriptIds[0] : null;
        }

        return {
          scripts: newScripts,
          activeScriptId: newActiveId,
          hasUnsavedChanges: state.activeScriptId === id ? false : state.hasUnsavedChanges,
          isDeleting: false,
          scriptsError: null,
        };
      });

      return true;
    } catch (error) {
      console.error('Error deleting script:', error);
      set({
        scriptsError: 'Failed to delete script. Please try again.',
        isDeleting: false,
      });
      return false;
    }
  },

  openScript: (id) => set({ activeScriptId: id }),

  closeScript: () => set({ activeScriptId: null }),

  markSaved: () => set({ hasUnsavedChanges: false }),

  markUnsaved: () => set({ hasUnsavedChanges: true }),

  setSaveStatus: (status: SaveStatus) => set({ saveStatus: status }),

  setSyntaxErrors: (errors) => set({ syntaxErrors: errors }),

  clearScriptsError: () => set({ scriptsError: null }),

  reset: () => set(initialState),
}));
