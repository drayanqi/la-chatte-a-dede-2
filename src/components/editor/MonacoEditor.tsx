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
import {
  registerGameApiCompletionProvider,
  type GameApiProviderDisposable,
} from '@/lib';

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
// Track if completion provider is registered globally (singleton pattern)
let completionProviderDisposable: GameApiProviderDisposable | null = null;

// Track if JavaScript validation has been configured (singleton pattern)
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
    // Use Monaco loader to get the instance
    loader.init().then((monaco) => {
      monacoRef.current = monaco;

      // Story 2.4: Register Game API completion provider (singleton)
      if (!completionProviderDisposable) {
        completionProviderDisposable = registerGameApiCompletionProvider(monaco);
      }

      // Story 2.5: Configure JavaScript validation for syntax error detection (singleton)
      if (!validationConfigured) {
        // Enable JavaScript syntax and semantic validation
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false, // Enable semantic validation
          noSyntaxValidation: false, // Enable syntax validation (CRITICAL for error detection)
        });

        // Configure compiler options for better JavaScript analysis
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          checkJs: true, // Enable type checking in JS files
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
    // Add Cmd/Ctrl+S keybinding for save (Story 2.3)
    const monacoEditor = editor as {
      addCommand: (
        keybinding: number,
        handler: () => void
      ) => void;
    };

    // Monaco keycodes: KeyMod.CtrlCmd = 2048, KeyCode.KeyS = 49
    // Combined: 2048 | 49 = 2097 (but we use the actual value)
    if (onSave) {
      // KeyMod.CtrlCmd (2048) | KeyCode.KeyS (49) = 2097
      monacoEditor.addCommand(2097, () => {
        onSave();
      });
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
