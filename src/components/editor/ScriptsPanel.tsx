/**
 * ScriptsPanel - Scripts column of the Teams page (story 7.5)
 * OWNER: Dev Team
 *
 * One row per script: status dot (ok / err), name, assignment-count chip.
 * Single click opens the code in the adjacent Code panel, double click
 * renames, right-click opens the context menu (rename / duplicate /
 * delete). Assignment happens from the pitch picker — no drag-and-drop.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useEditorStore, useTacticsStore } from '@/stores';
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

interface ScriptsPanelProps {
  /** Called after a successful deletion, to detach the script from players */
  onScriptDeleted?: (scriptId: string) => void;
}

export const ScriptsPanel: React.FC<ScriptsPanelProps> = ({ onScriptDeleted }) => {
  const {
    scripts,
    activeScriptId,
    openScript,
    isLoadingScripts,
    isCreatingScript,
    isRenaming,
    isDuplicating,
    isDeleting,
    syntaxErrors,
    scriptsError,
    createScript,
    renameScript,
    duplicateScript,
    deleteScript,
  } = useEditorStore();

  const activeTactic = useTacticsStore((state) =>
    state.activeTacticId
      ? state.tactics.find((tactic) => tactic.id === state.activeTacticId) ?? null
      : null
  );

  // Assignment counts (story 7.5 chip): scriptId -> how many slots use it
  const assignmentCounts = new Map<string, number>();
  if (activeTactic) {
    for (const player of activeTactic.players) {
      if (player.scriptId) {
        assignmentCounts.set(player.scriptId, (assignmentCounts.get(player.scriptId) ?? 0) + 1);
      }
    }
  }
  const hasSyntaxError = (scriptId: string): boolean =>
    syntaxErrors.some((error) => error.scriptId === scriptId);

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

  const handleCreateScript = useCallback(async () => {
    // Generate unique name based on existing scripts
    const existingNames = new Set(
      Array.from(scripts.values()).map((s) => s.name)
    );
    const uniqueName = generateUniqueName(existingNames);
    await createScript(uniqueName);
  }, [scripts, createScript]);

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
    const scriptId = deleteConfirmScriptId;
    const deleted = await deleteScript(scriptId);
    if (deleted) {
      onScriptDeleted?.(scriptId);
    }
    setDeleteConfirmScriptId(null);
  }, [deleteConfirmScriptId, isDeleting, deleteScript, onScriptDeleted]);

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
      <div style={styles.colhead}>
        <span style={styles.colheadTitle}>Scripts</span>
        <button
          data-testid="create-script-button"
          style={{
            ...styles.plus,
            ...(isCreatingScript ? styles.plusDisabled : {}),
          }}
          onClick={handleCreateScript}
          disabled={isCreatingScript}
          title="Create new AI file"
        >
          {isCreatingScript ? (
            <span data-testid="script-creating" style={styles.creating}>
              ...
            </span>
          ) : (
            '+'
          )}
        </button>
      </div>

      <div data-testid="scripts-list" style={styles.scriptList}>
        {isLoadingScripts && (
          <div style={styles.stateText}>Loading scripts...</div>
        )}

        {scriptsError && (
          <div style={{ ...styles.stateText, ...styles.errorText }}>{scriptsError}</div>
        )}

        {!isLoadingScripts && !scriptsError && scripts.size === 0 && (
          <div style={styles.stateText}>No scripts yet</div>
        )}

        {Array.from(scripts.values()).map((script) => {
          const usage = assignmentCounts.get(script.id) ?? 0;
          const errored = hasSyntaxError(script.id);

          return (
            <div
              key={script.id}
              data-testid={`script-item-${script.id}`}
              style={{
                ...styles.srow,
                ...(activeScriptId === script.id ? styles.srowActive : {}),
              }}
              onClick={() => handleScriptClick(script)}
              onContextMenu={(e) => handleContextMenu(e, script)}
            >
              <span
                data-testid="script-status-dot"
                data-status={errored ? 'err' : 'ok'}
                style={{ ...styles.statusDot, background: errored ? 'var(--corail)' : 'var(--mint)' }}
              />
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
                <>
              <span
                data-testid={`script-name-${script.id}`}
                style={styles.scriptName}
              >
                {script.name}
              </span>
              <span
                data-testid="script-usage"
                data-tactic-id={activeTactic?.id ?? ''}
                style={styles.usageChip}
              >
                {usage}
              </span>
                </>
              )}
            </div>
          );
        })}

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
              Renommer
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
              {isDuplicating ? 'Duplication...' : 'Dupliquer'}
            </button>
            <button
              data-testid="delete-option"
              style={{
                ...styles.contextMenuItem,
                ...styles.contextMenuItemDanger,
              }}
              onClick={() => handleDeleteClick(contextMenuScriptId)}
            >
              Supprimer
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
                Supprimer {scripts.get(deleteConfirmScriptId)?.name} ?
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
                  Annuler
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
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div data-testid="script-hint" style={styles.scripthint}>
        Clique un joueur du terrain pour lui assigner un script. Un script
        peut être partagé par plusieurs joueurs.
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
  colheadTitle: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
  },
  plus: {
    marginLeft: 'auto',
    width: '26px',
    height: '26px',
    borderRadius: '10px',
    background: 'var(--corail)',
    color: '#fff',
    fontSize: '15px',
    display: 'grid',
    placeItems: 'center',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1,
  },
  plusDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  creating: {
    fontSize: '10px',
  },
  scriptList: {
    flex: 1,
    overflowY: 'auto',
    padding: '9px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  stateText: {
    padding: '12px',
    color: 'var(--muted)',
    fontSize: '12.5px',
    textAlign: 'center',
  },
  errorText: {
    color: 'var(--corail)',
  },
  srow: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '9px 11px',
    borderRadius: 'var(--r-sm, 12px)',
    fontSize: '12.5px',
    cursor: 'pointer',
    color: 'var(--ink)',
  },
  srowActive: {
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1.5px var(--corail)',
    fontWeight: 700,
  },
  statusDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  scriptName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  usageChip: {
    marginLeft: 'auto',
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--muted)',
    background: 'var(--bg)',
    padding: '2px 8px',
    borderRadius: '99px',
    flexShrink: 0,
  },
  scripthint: {
    flex: 'none',
    margin: '8px',
    padding: '9px 12px',
    borderRadius: 'var(--r-sm, 12px)',
    background: 'var(--panel2)',
    fontSize: '11px',
    color: 'var(--muted)',
    lineHeight: 1.5,
  },
  renameContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
  },
  renameInput: {
    fontSize: '12.5px',
    color: 'var(--ink)',
    backgroundColor: 'var(--panel2)',
    border: '1.5px solid var(--corail)',
    borderRadius: '8px',
    padding: '2px 6px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  renameInputError: {
    borderColor: 'var(--corail)',
  },
  renameErrorText: {
    fontSize: '11px',
    color: 'var(--corail)',
  },
  contextMenu: {
    position: 'fixed',
    background: 'var(--panel)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)',
    padding: '7px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    zIndex: 1000,
    minWidth: '140px',
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '9px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '11px',
    color: 'var(--ink)',
    fontSize: '12.5px',
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  },
  contextMenuItemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  contextMenuItemDanger: {
    color: 'var(--corail)',
  },
  dialogOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10, 20, 14, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    backdropFilter: 'blur(3px)',
  },
  dialogContent: {
    background: 'var(--panel)',
    borderRadius: 'var(--r-modal)',
    boxShadow: 'var(--shadow-lg)',
    padding: '24px',
    minWidth: '320px',
    maxWidth: '400px',
  },
  dialogTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: '12px',
  },
  dialogButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '9px',
    marginTop: '16px',
  },
  dialogButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
  },
  dialogButtonDanger: {
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
  dialogButtonSecondary: {
    backgroundColor: 'var(--panel2)',
    color: 'var(--ink)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  dialogButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
