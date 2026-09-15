/**
 * MonacoEditor - Professional code editor component
 * OWNER: Dev Team
 *
 * Wraps @monaco-editor/react with VSCode Dark theme and JavaScript support.
 * Used for editing AI scripts in the workspace.
 * Includes Game API autocomplete for AI script development.
 * Includes JavaScript validation with syntax error detection.
 *
 * @see Story 2.2: Monaco Editor Integration
 * @see Story 2.4: Game API Autocomplete
 * @see Story 2.5: Code Error Detection
 */

import { useRef, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
// Side-effect import: configures the local Monaco bundle (workers + loader +
// Game API ambient declarations) before any editor mounts, so loader.init()
// resolves the local instance instead of the CDN default. Must stay a static
// import to avoid racing @monaco-editor/react's own internal loader.init().
import '@/lib/monacoSetup';

interface MonacoEditorProps {
  /** Current code content */
  value: string;
  /** Called when code changes */
  onChange: (value: string) => void;
  /** Optional: Called when editor is mounted */
  onMount?: (editor: unknown) => void;
  /** Optional: Called when Cmd/Ctrl+S is pressed */
  onSave?: () => void;
}

/**
 * Monaco editor wrapper with VSCode Dark theme and JavaScript configuration.
 * Handles lazy loading with a loading state indicator.
 */
// Track if TypeScript language service validation has been configured (singleton pattern)
let validationConfigured = false;

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  onMount,
  onSave,
}) => {
  const monacoRef = useRef<typeof Monaco | null>(null);

  // Configure Monaco features once when available (singleton pattern)
  useEffect(() => {
    // Use Monaco loader to get the instance (local bundle via monacoSetup)
    loader.init().then((monaco) => {
        monacoRef.current = monaco;

        // Story 2.5: Configure JavaScript validation for syntax error detection (singleton)
        if (!validationConfigured) {
          // Syntax validation stays ON (error squiggles + gutter icons).
          // Semantic validation stays OFF for the quiet-trio delivery: the
          // typed game API (monacoSetup extra lib + stored JSDoc line) already
          // provides hover, signature help and completions; semantic squiggles
          // come later once calibrated against a corpus of real scripts.
          // (monaco >= 0.55: the TypeScript namespace is the top-level
          // `monaco.typescript`; `monaco.languages.typescript` is deprecated.)
          monaco.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false, // Keep syntax validation (CRITICAL for error detection)
          });

          // Configure compiler options for better JavaScript analysis
          monaco.typescript.javascriptDefaults.setCompilerOptions({
            target: monaco.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            checkJs: true, // Type-check data for IntelliSense (JSDoc-driven)
            allowJs: true,
          });

          validationConfigured = true;
        }
      });

    // Note: We intentionally don't dispose providers on unmount
    // because they are singletons that should persist across editor instances.
  }, []);

  const handleEditorChange = (newValue: string | undefined) => {
    onChange(newValue ?? '');
  };

  const handleEditorMount = (editor: unknown) => {
    const monacoEditor = editor as Monaco.editor.IStandaloneCodeEditor;

    // Add Cmd/Ctrl+S keybinding for save (Story 2.3)
    // Monaco keycodes: KeyMod.CtrlCmd = 2048, KeyCode.KeyS = 49
    // Combined: 2048 | 49 = 2097 (but we use the actual value)
    if (onSave) {
      // KeyMod.CtrlCmd (2048) | KeyCode.KeyS (49) = 2097
      monacoEditor.addCommand(2097, () => {
        onSave();
      });
    }

    // Story 2.5 (AC #2): render error icons in the gutter. Monaco standalone
    // does not draw marker icons in the glyph margin, so decorations are
    // synced from the marker list whenever markers change.
    if (monacoRef.current) {
      const decorations = monacoEditor.createDecorationsCollection();

      const syncGutterIcons = () => {
        const monaco = monacoRef.current;
        if (!monaco) {
          return;
        }

        const markers = monaco.editor
          .getModelMarkers({})
          .filter((marker) => marker.severity >= monaco.MarkerSeverity.Error);

        decorations.set(
          markers.map((marker) => ({
            range: new monaco.Range(
              marker.startLineNumber,
              1,
              marker.startLineNumber,
              1
            ),
            options: {
              glyphMarginClassName:
                marker.severity === monaco.MarkerSeverity.Error
                  ? 'codicon codicon-error gutter-error-icon'
                  : 'codicon codicon-warning gutter-warning-icon',
              glyphMarginHoverMessage: marker.message
                ? { value: marker.message }
                : undefined,
              stickiness:
                monaco.editor.TrackedRangeStickiness
                  .NeverGrowsWhenTypingAtEdges,
            },
          }))
        );
      };

      monacoRef.current.editor.onDidChangeMarkers(syncGutterIcons);
      syncGutterIcons();
    }

    // Call user's onMount if provided
    onMount?.(editor);
  };

  return (
    <div data-testid="monaco-editor" style={styles.container}>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        loading={
          <div data-testid="editor-loading" style={styles.loading}>
            Loading editor...
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          padding: { top: 8, bottom: 8 },
          // Story 2.5: Error detection display options
          glyphMargin: true, // Enable gutter for error icons
          hover: {
            enabled: true, // Enable hover for error messages
            delay: 300,
          },
          renderValidationDecorations: 'on', // Show error squiggles
        }}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888888',
    fontSize: '13px',
    backgroundColor: '#1e1e1e',
  },
};
