/**
 * Editor Store - État de l'éditeur Monaco
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

import { create } from 'zustand';
import type { Script, ScriptLanguage } from '@/types';

interface EditorState {
  // Scripts disponibles
  scripts: Map<string, Script>;

  // Script actif dans l'éditeur
  activeScriptId: string | null;

  // État de modification
  hasUnsavedChanges: boolean;

  // Erreurs de syntaxe
  syntaxErrors: Array<{
    scriptId: string;
    line: number;
    message: string;
  }>;
}

interface EditorActions {
  // Gestion des scripts
  addScript: (script: Script) => void;
  updateScript: (id: string, code: string) => void;
  deleteScript: (id: string) => void;

  // Navigation
  openScript: (id: string) => void;
  closeScript: () => void;

  // Sauvegarde
  markSaved: () => void;
  markUnsaved: () => void;

  // Erreurs
  setSyntaxErrors: (errors: EditorState['syntaxErrors']) => void;

  // Reset
  reset: () => void;
}

// Scripts par défaut pour la démo
const defaultScripts: Script[] = [
  {
    id: 'script-1',
    name: 'Attaquant Basique',
    code: `// Script IA pour attaquant
function update(player, ball, teammates, opponents) {
  // Aller vers le ballon
  const direction = {
    x: ball.position.x - player.position.x,
    y: ball.position.y - player.position.y
  };

  return {
    move: direction,
    action: 'none'
  };
}`,
    language: 'javascript',
    lastModified: new Date(),
  },
  {
    id: 'script-2',
    name: 'Défenseur Zone',
    code: `// Script IA pour défenseur en zone
function update(player, ball, teammates, opponents) {
  // Rester dans la zone défensive
  const zoneCenter = { x: 25, y: 50 };

  const toBall = {
    x: ball.position.x - player.position.x,
    y: ball.position.y - player.position.y
  };

  const toZone = {
    x: zoneCenter.x - player.position.x,
    y: zoneCenter.y - player.position.y
  };

  // Équilibre entre zone et ballon
  return {
    move: {
      x: toZone.x * 0.7 + toBall.x * 0.3,
      y: toZone.y * 0.7 + toBall.y * 0.3
    },
    action: 'none'
  };
}`,
    language: 'javascript',
    lastModified: new Date(),
  },
  {
    id: 'script-3',
    name: 'Gardien',
    code: `// Script IA pour gardien
function update(player, ball, teammates, opponents) {
  // Suivre le ballon sur l'axe Y uniquement
  const targetY = Math.max(35, Math.min(65, ball.position.y));

  return {
    move: {
      x: 0,
      y: targetY - player.position.y
    },
    action: ball.position.x < 20 ? 'dive' : 'none'
  };
}`,
    language: 'javascript',
    lastModified: new Date(),
  },
];

const initialState: EditorState = {
  scripts: new Map(defaultScripts.map((s) => [s.id, s])),
  activeScriptId: null,
  hasUnsavedChanges: false,
  syntaxErrors: [],
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

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

  reset: () => set(initialState),
}));
