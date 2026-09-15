/**
 * Monaco Editor local bundle setup.
 *
 * Loads monaco-editor from the local node_modules bundle instead of the
 * @monaco-editor/react default CDN. This pins the runtime version to the
 * installed types, removes the network dependency (faster, deterministic
 * editor startup, works offline), and serves the web workers from the same
 * origin so the TypeScript language service cannot be blocked by CDN/CORS
 * issues.
 *
 * Imported (lazily) by MonacoEditor.tsx BEFORE loader.init() runs.
 */
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { loader } from '@monaco-editor/react';
import { GAME_API_DTS } from './gameApiDts';

window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

// Game API as ambient declarations for the TypeScript worker: combined with
// the stored `@param {Game} game` JSDoc line (see gameScript.ts), this is
// what provides hover docs, signature help and deep completions in plain-JS
// AI scripts — straight from the canonical gameApiTypes.ts contract.
// (monaco >= 0.55: the TypeScript namespace is the TOP-LEVEL `monaco.typescript`;
// `monaco.languages.typescript` is a deprecated alias.)
monaco.typescript.javascriptDefaults.addExtraLib(
  GAME_API_DTS,
  'ts:game-api.d.ts',
);

/**
 * Resolves once the TypeScript worker has registered the JavaScript mode
 * (completion/hover/signature providers live). Monaco wires the providers
 * lazily on the first javascript model, so code typed in the first second
 * after mount may otherwise see no completions. Registered at module scope,
 * before any model can exist, so the `onLanguage` callback cannot be missed.
 */
export const javascriptModeReady: Promise<void> = new Promise((resolve) => {
  monaco.languages.onLanguage('javascript', () => {
    // `onLanguage` fires when mode setup *starts*; the worker takes a moment
    // to boot, so poll until `getJavaScriptWorker()` actually resolves.
    const poll = (attempt: number): void => {
      monaco.typescript
        .getJavaScriptWorker()
        .then(() => resolve())
        .catch(() => {
          if (attempt < 200) window.setTimeout(() => poll(attempt + 1), 50);
          else resolve();
        });
    };
    poll(0);
  });
});

export { monaco };

// Story 2.5: gutter error/warning icons are rendered as glyph-margin
// decorations (see MonacoEditor.tsx); color the codicon glyphs with the
// theme's marker colors.
const gutterIconStyle = document.createElement('style');
gutterIconStyle.textContent = `
  .gutter-error-icon::before { color: var(--vscode-editorError-foreground, #f14c4c); }
  .gutter-warning-icon::before { color: var(--vscode-editorWarning-foreground, #cca700); }
`;
document.head.appendChild(gutterIconStyle);
