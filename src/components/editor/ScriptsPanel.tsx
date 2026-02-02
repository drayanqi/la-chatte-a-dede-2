/**
 * ScriptsPanel - Scripts list and Monaco editor placeholder
 * OWNER: Dev Team
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores';
import { useUnsavedChangesWarning, useAutoSave } from '@/hooks';
import { MonacoEditor } from './MonacoEditor';
import { SaveIndicator } from './SaveIndicator';
import type { Script } from '@/types';

/**
 * Validation constants for script names
 */
const INVALID_CHARS_REGEX = /[/\\:*?"<>|]/;
const MAX_NAME_LENGTH = 255;

/**
 * Validate a script name and return error message if invalid
 */
const validateScriptName = (name: string): string | null => {
  const trimmed = name.trim();

  if (trimmed === '') {
    return 'Name cannot be empty';
  }

  if (INVALID_CHARS_REGEX.test(trimmed)) {
    return 'Name contains invalid characters';
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Name is too long (max ${MAX_NAME_LENGTH} characters)`;
  }

  return null;
};

/**
 * Ensure script name has .js extension
 */
const ensureJsExtension = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed.toLowerCase().endsWith('.js')) {
    return `${trimmed}.js`;
  }
  return trimmed;
};

/**
 * Generate a unique script name that doesn't conflict with existing names
 */
const generateUniqueName = (existingNames: Set<string>, baseName = 'NewAI.js'): string => {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Try NewAI (1).js, NewAI (2).js, etc.
  let counter = 1;
  const nameWithoutExt = baseName.replace('.js', '');
  while (existingNames.has(`${nameWithoutExt} (${counter}).js`)) {
    counter++;
  }
  return `${nameWithoutExt} (${counter}).js`;
};

export const ScriptsPanel: React.FC = () => {
  const {
    scripts,
    activeScriptId,
    openScript,
    isLoadingScripts,
    isCreatingScript,
    isRenaming,
    isDuplicating,
    isDeleting,
    isSaving,
    hasUnsavedChanges,
    scriptsError,
    createScript,
    updateScript,
    saveScript,
    renameScript,
    duplicateScript,
    deleteScript,
  } = useEditorStore();

  // Rename state
  const [renamingScriptId, setRenamingScriptId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenuScriptId, setContextMenuScriptId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Delete confirmation dialog state
  const [deleteConfirmScriptId, setDeleteConfirmScriptId] = useState<string | null>(null);

  // Click timeout for distinguishing single vs double click
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus and select input when entering rename mode
  useEffect(() => {
    if (renamingScriptId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingScriptId]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuScriptId(null);
    };
    if (contextMenuScriptId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuScriptId]);

  // Warn user before leaving with unsaved changes
  useUnsavedChangesWarning(hasUnsavedChanges);

  // Auto-save changes after 2 seconds of inactivity or every 30 seconds
  useAutoSave({
    hasUnsavedChanges,
    isSaving,
    activeScriptId,
    saveScript,
  });

  const handleDragStart = useCallback(
    (e: React.DragEvent, script: Script) => {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({
          type: 'script',
          scriptId: script.id,
        })
      );
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  const handleCreateScript = useCallback(async () => {
    // Generate unique name based on existing scripts
    const existingNames = new Set(
      Array.from(scripts.values()).map((s) => s.name)
    );
    const uniqueName = generateUniqueName(existingNames);
    await createScript(uniqueName);
  }, [scripts, createScript]);

  const handleSave = useCallback(async () => {
    // Prevent save if already saving or no active script
    if (isSaving || !activeScriptId) {
      return;
    }
    await saveScript(activeScriptId);
  }, [isSaving, activeScriptId, saveScript]);

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, script: Script) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuScriptId(script.id);
    },
    []
  );

  // Start rename mode
  const startRename = useCallback(
    (scriptId: string) => {
      const script = scripts.get(scriptId);
      if (script) {
        setRenamingScriptId(scriptId);
        setRenameValue(script.name);
        setRenameError(null);
        setContextMenuScriptId(null);
      }
    },
    [scripts]
  );

  // Cancel rename
  const cancelRename = useCallback(() => {
    setRenamingScriptId(null);
    setRenameValue('');
    setRenameError(null);
  }, []);

  // Confirm rename
  const confirmRename = useCallback(async () => {
    if (!renamingScriptId || isRenaming) return;

    const script = scripts.get(renamingScriptId);
    if (!script) {
      cancelRename();
      return;
    }

    // Validate name
    const error = validateScriptName(renameValue);
    if (error) {
      setRenameError(error);
      return;
    }

    // Ensure .js extension
    const finalName = ensureJsExtension(renameValue);

    // Skip if name unchanged
    if (finalName === script.name) {
      cancelRename();
      return;
    }

    // Call API
    const success = await renameScript(renamingScriptId, finalName);
    if (success) {
      cancelRename();
    } else {
      setRenameError('Failed to rename script');
    }
  }, [renamingScriptId, renameValue, scripts, isRenaming, renameScript, cancelRename]);

  // Handle rename input keyboard events
  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        confirmRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    },
    [confirmRename, cancelRename]
  );

  // Handle rename input blur (click outside)
  const handleRenameBlur = useCallback(() => {
    // Use setTimeout to allow click handlers to fire first
    setTimeout(() => {
      if (renamingScriptId) {
        confirmRename();
      }
    }, 100);
  }, [renamingScriptId, confirmRename]);

  // Handle script item click (with double-click detection)
  const handleScriptClick = useCallback(
    (script: Script) => {
      // Don't handle clicks when renaming
      if (renamingScriptId === script.id) return;

      if (clickTimeoutRef.current) {
        // Double click detected
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        startRename(script.id);
      } else {
        // Single click - wait to see if it's a double click
        clickTimeoutRef.current = setTimeout(() => {
          clickTimeoutRef.current = null;
          openScript(script.id);
        }, 200);
      }
    },
    [renamingScriptId, openScript, startRename]
  );

  // Handle duplicate script
  const handleDuplicate = useCallback(
    async (scriptId: string) => {
      setContextMenuScriptId(null);
      await duplicateScript(scriptId);
    },
    [duplicateScript]
  );

  // Handle delete click - show confirmation dialog
  const handleDeleteClick = useCallback((scriptId: string) => {
    setContextMenuScriptId(null);
    setDeleteConfirmScriptId(scriptId);
  }, []);

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmScriptId || isDeleting) return;
    await deleteScript(deleteConfirmScriptId);
    setDeleteConfirmScriptId(null);
  }, [deleteConfirmScriptId, isDeleting, deleteScript]);

  // Cancel delete
  const cancelDelete = useCallback(() => {
    setDeleteConfirmScriptId(null);
  }, []);

  // Handle escape key to close delete dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmScriptId) {
        cancelDelete();
      }
    };
    if (deleteConfirmScriptId) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [deleteConfirmScriptId, cancelDelete]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>AI Scripts</h3>
        <button
          data-testid="create-script-button"
          style={{
            ...styles.addButton,
            ...(isCreatingScript ? styles.addButtonDisabled : {}),
          }}
          onClick={handleCreateScript}
          disabled={isCreatingScript}
          title="Create new AI file"
        >
          {isCreatingScript ? (
            <span data-testid="script-creating" style={styles.spinnerIcon}>
              ...
            </span>
          ) : (
            '+'
          )}
        </button>
      </div>

      <div data-testid="scripts-list" style={styles.scriptList}>
        {isLoadingScripts && (
          <div style={styles.loadingState}>Loading scripts...</div>
        )}

        {scriptsError && (
          <div style={styles.errorState}>{scriptsError}</div>
        )}

        {!isLoadingScripts && !scriptsError && scripts.size === 0 && (
          <div style={styles.emptyState}>No scripts yet</div>
        )}

        {Array.from(scripts.values()).map((script) => (
          <div
            key={script.id}
            data-testid={`script-item-${script.id}`}
            style={{
              ...styles.scriptItem,
              ...(activeScriptId === script.id ? styles.scriptItemActive : {}),
            }}
            draggable={renamingScriptId !== script.id}
            onDragStart={(e) => handleDragStart(e, script)}
            onClick={() => handleScriptClick(script)}
            onContextMenu={(e) => handleContextMenu(e, script)}
          >
            <span style={styles.scriptIcon}>📜</span>
            <div style={styles.scriptInfo}>
              {renamingScriptId === script.id ? (
                <div style={styles.renameContainer}>
                  <input
                    ref={renameInputRef}
                    data-testid="script-rename-input"
                    type="text"
                    value={renameValue}
                    onChange={(e) => {
                      setRenameValue(e.target.value);
                      setRenameError(null);
                    }}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleRenameBlur}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      ...styles.renameInput,
                      ...(renameError ? styles.renameInputError : {}),
                    }}
                    disabled={isRenaming}
                  />
                  {renameError && (
                    <span data-testid="rename-error" style={styles.renameErrorText}>
                      {renameError}
                    </span>
                  )}
                </div>
              ) : (
                <span
                  data-testid={`script-name-${script.id}`}
                  style={styles.scriptName}
                >
                  {script.name}
                </span>
              )}
              <span style={styles.scriptLang}>{script.language}</span>
            </div>
            <span style={styles.dragHandle}>⋮⋮</span>
          </div>
        ))}

        {/* Context Menu */}
        {contextMenuScriptId && (
          <div
            data-testid="script-context-menu"
            style={{
              ...styles.contextMenu,
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              data-testid="rename-option"
              style={styles.contextMenuItem}
              onClick={() => startRename(contextMenuScriptId)}
            >
              Rename
            </button>
            <button
              data-testid="duplicate-option"
              style={{
                ...styles.contextMenuItem,
                ...(isDuplicating ? styles.contextMenuItemDisabled : {}),
              }}
              onClick={() => handleDuplicate(contextMenuScriptId)}
              disabled={isDuplicating}
            >
              {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </button>
            <button
              data-testid="delete-option"
              style={{
                ...styles.contextMenuItem,
                ...styles.contextMenuItemDanger,
              }}
              onClick={() => handleDeleteClick(contextMenuScriptId)}
            >
              Delete
            </button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirmScriptId && (
          <div
            data-testid="delete-confirm-dialog"
            style={styles.dialogOverlay}
            onClick={cancelDelete}
          >
            <div
              style={styles.dialogContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={styles.dialogTitle}>
                Delete {scripts.get(deleteConfirmScriptId)?.name}?
              </div>
              <div style={styles.dialogButtons}>
                <button
                  data-testid="delete-cancel-button"
                  style={{
                    ...styles.dialogButton,
                    ...styles.dialogButtonSecondary,
                  }}
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
                <button
                  data-testid="delete-confirm-button"
                  style={{
                    ...styles.dialogButton,
                    ...styles.dialogButtonDanger,
                    ...(isDeleting ? styles.dialogButtonDisabled : {}),
                  }}
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div data-testid="editor-container" style={styles.editorPlaceholder}>
        {activeScriptId ? (
          <div style={styles.editorContent}>
            <div style={styles.editorHeader}>
              <span>{scripts.get(activeScriptId)?.name}</span>
              <SaveIndicator />
            </div>
            <div style={styles.monacoWrapper}>
              <MonacoEditor
                value={scripts.get(activeScriptId)?.code ?? ''}
                onChange={(newCode) => updateScript(activeScriptId, newCode)}
                onSave={handleSave}
              />
            </div>
          </div>
        ) : (
          <div style={styles.noSelection}>
            Select a script or drag it onto a player
          </div>
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
    backgroundColor: '#252526',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #3c3c3c',
  },
  title: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: '#cccccc',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  addButton: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  addButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  spinnerIcon: {
    fontSize: '10px',
    letterSpacing: '1px',
  },
  scriptList: {
    flex: '0 0 auto',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  loadingState: {
    padding: '16px',
    color: '#888888',
    fontSize: '13px',
    textAlign: 'center',
  },
  errorState: {
    padding: '16px',
    color: '#f14c4c',
    fontSize: '13px',
    textAlign: 'center',
  },
  emptyState: {
    padding: '16px',
    color: '#666666',
    fontSize: '13px',
    textAlign: 'center',
  },
  scriptItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: 'grab',
    borderBottom: '1px solid #2d2d2d',
    transition: 'background-color 0.15s',
  },
  scriptItemActive: {
    backgroundColor: '#37373d',
  },
  scriptIcon: {
    fontSize: '16px',
    marginRight: '8px',
  },
  scriptInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  scriptName: {
    fontSize: '13px',
    color: '#ffffff',
  },
  scriptLang: {
    fontSize: '11px',
    color: '#888888',
  },
  dragHandle: {
    color: '#666666',
    fontSize: '12px',
    cursor: 'grab',
  },
  editorPlaceholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid #3c3c3c',
    overflow: 'hidden',
  },
  editorContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  editorHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
    fontSize: '12px',
    color: '#cccccc',
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
    color: '#666666',
    fontSize: '13px',
    padding: '16px',
    textAlign: 'center',
  },
  renameContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
  },
  renameInput: {
    fontSize: '13px',
    color: '#d4d4d4',
    backgroundColor: '#3c3c3c',
    border: '1px solid #007acc',
    borderRadius: '2px',
    padding: '2px 4px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  renameInputError: {
    borderColor: '#f14c4c',
  },
  renameErrorText: {
    fontSize: '11px',
    color: '#f14c4c',
  },
  contextMenu: {
    position: 'fixed',
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    minWidth: '120px',
    padding: '4px 0',
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#cccccc',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  contextMenuItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  contextMenuItemDanger: {
    color: '#f14c4c',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  dialogContent: {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '16px',
    minWidth: '280px',
    maxWidth: '400px',
  },
  dialogTitle: {
    fontSize: '14px',
    color: '#ffffff',
    marginBottom: '12px',
  },
  dialogButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '16px',
  },
  dialogButton: {
    padding: '6px 14px',
    borderRadius: '2px',
    fontSize: '13px',
    cursor: 'pointer',
    border: 'none',
  },
  dialogButtonDanger: {
    backgroundColor: '#f14c4c',
    color: '#ffffff',
  },
  dialogButtonSecondary: {
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
  },
  dialogButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
