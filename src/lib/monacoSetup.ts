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

window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

// Story 2.5: gutter error/warning icons are rendered as glyph-margin
// decorations (see MonacoEditor.tsx); color the codicon glyphs with the
// theme's marker colors.
const gutterIconStyle = document.createElement('style');
gutterIconStyle.textContent = `
  .gutter-error-icon::before { color: var(--vscode-editorError-foreground, #f14c4c); }
  .gutter-warning-icon::before { color: var(--vscode-editorWarning-foreground, #cca700); }
`;
document.head.appendChild(gutterIconStyle);

export {};
