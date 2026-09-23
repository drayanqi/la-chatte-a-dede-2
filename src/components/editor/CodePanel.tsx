/**
 * CodePanel - Code column of the Teams page (story 7.5)
 * OWNER: Dev Team
 *
 * Colhead with the active script's status dot + name, Monaco underneath,
 * save indicator. Owns the auto-save hooks that used to live inside
 * ScriptsPanel (testid `editor-container` preserved for the E2E contract).
 */

import { useCallback } from 'react';
import { useEditorStore } from '@/stores';
import { useUnsavedChangesWarning, useAutoSave } from '@/hooks';
import { MonacoEditor } from './MonacoEditor';
import { SaveIndicator } from './SaveIndicator';

export const CodePanel: React.FC = () => {
  const {
    scripts,
    activeScriptId,
    isSaving,
    hasUnsavedChanges,
    saveScript,
    updateScript,
    syntaxErrors,
  } = useEditorStore();

  const activeScript = activeScriptId ? scripts.get(activeScriptId) ?? null : null;
  const activeHasError =
    activeScriptId !== null && syntaxErrors.some((error) => error.scriptId === activeScriptId);

  // Warn user before leaving with unsaved changes
  useUnsavedChangesWarning(hasUnsavedChanges);

  // Auto-save changes after 2 seconds of inactivity or every 30 seconds
  useAutoSave({
    hasUnsavedChanges,
    isSaving,
    activeScriptId,
    saveScript,
  });

  const handleSave = useCallback(async () => {
    // Prevent save if already saving or no active script
    if (isSaving || !activeScriptId) {
      return;
    }
    await saveScript(activeScriptId);
  }, [isSaving, activeScriptId, saveScript]);

  // Monaco markers → store (the status dots read syntaxErrors). Read the
  // active script at call time: only one editor instance exists, so its
  // markers always describe the script currently open.
  const handleMarkersChange = useCallback(
    (errors: Array<{ line: number; message: string }>) => {
      const { activeScriptId: scriptId, setSyntaxErrors } = useEditorStore.getState();
      if (!scriptId) return;
      setSyntaxErrors(
        errors.map((error) => ({ scriptId, line: error.line, message: error.message }))
      );
    },
    []
  );

  return (
    <div data-testid="code-panel" style={styles.container}>
      <div style={styles.colhead}>
        {activeScript && (
          <>
            <span
              data-testid="code-status-dot"
              data-status={activeHasError ? 'err' : 'ok'}
              style={{
                ...styles.statusDot,
                background: activeHasError ? 'var(--corail)' : 'var(--mint)',
              }}
            />
            <span
              data-testid="editor-script-name"
              style={styles.scriptName}
            >
              {activeScript.name}
            </span>
            <span style={styles.saveSlot}>
              <SaveIndicator />
            </span>
          </>
        )}
      </div>

      <div data-testid="editor-container" style={styles.editorContainer}>
        {activeScript ? (
          <div style={styles.editorContent}>
            <div style={styles.monacoWrapper}>
              <MonacoEditor
                value={activeScript.code}
                onChange={(newCode) => updateScript(activeScript.id, newCode)}
                onSave={handleSave}
                onMarkersChange={handleMarkersChange}
              />
            </div>
          </div>
        ) : (
          <div style={styles.noSelection}>Sélectionne un script à éditer</div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--panel)',
  },
  colhead: {
    flex: 'none',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '0 14px',
    borderBottom: '1px solid var(--line)',
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  scriptName: {
    fontSize: '12.5px',
    fontWeight: 700,
    color: 'var(--ink)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  saveSlot: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
  },
  editorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  editorContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  monacoWrapper: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  noSelection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--muted)',
    fontSize: '13px',
    padding: '16px',
    textAlign: 'center',
  },
};
