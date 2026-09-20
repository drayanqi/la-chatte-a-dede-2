/**
 * TabBar - Tactic tabs above the field (between header and canvas)
 * OWNER: Dev Team
 *
 * The lineup manager: one tab per user tactic, "+" to create a new one
 * with the default formation, double-click to rename, delete with
 * confirmation (even the last one — a fresh default is recreated).
 * Every edit auto-saves; this bar only switches, renames, creates and deletes.
 * Each tab also carries the ready-to-play toggle (Epic 4 v2): a ready
 * tactic is a ranked fighter, challengeable while its owner is offline,
 * and the tab shows its elo and W-L record.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTacticsStore } from '@/stores/tacticsStore';
import type { TacticConfig } from '@/types';

/** How long the "saved" indicator stays visible on a tab */
const SAVED_FLASH_MS = 1500;

/** A tactic can only enter the ranked pool with a complete lineup */
const lineupIsComplete = (tactic: TacticConfig): boolean =>
  tactic.players.length === 5 && tactic.players.every((player) => player.scriptId !== null);

export const TabBar: React.FC = () => {
  const tactics = useTacticsStore((state) => state.tactics);
  const activeTacticId = useTacticsStore((state) => state.activeTacticId);
  const isSavingTactic = useTacticsStore((state) => state.isSavingTactic);
  const isDeletingTactic = useTacticsStore((state) => state.isDeletingTactic);
  const lastSavedTacticId = useTacticsStore((state) => state.lastSavedTacticId);
  const lastSavedAt = useTacticsStore((state) => state.lastSavedAt);
  const tacticsError = useTacticsStore((state) => state.tacticsError);
  const createTactic = useTacticsStore((state) => state.createTactic);
  const deleteTactic = useTacticsStore((state) => state.deleteTactic);
  const updateTactic = useTacticsStore((state) => state.updateTactic);
  const selectTactic = useTacticsStore((state) => state.selectTactic);
  const clearTacticsError = useTacticsStore((state) => state.clearTacticsError);

  // Only user tactics appear as tabs (system tactics are not editable in MVP)
  const userTactics = tactics.filter((tactic) => !tactic.isSystem);

  // Rename state
  const [renamingTacticId, setRenamingTacticId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirmation dialog state
  const [deleteConfirmTacticId, setDeleteConfirmTacticId] = useState<string | null>(null);

  // "Saved" flash: which tab currently shows the indicator
  const [flashTacticId, setFlashTacticId] = useState<string | null>(null);

  // Focus and select input when entering rename mode
  useEffect(() => {
    if (renamingTacticId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTacticId]);

  // Show the "saved" indicator on the last saved tab, hide it after the delay
  useEffect(() => {
    if (!lastSavedTacticId || !lastSavedAt) return;

    const showTimer = setTimeout(() => setFlashTacticId(lastSavedTacticId), 0);
    const hideTimer = setTimeout(() => setFlashTacticId(null), SAVED_FLASH_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [lastSavedTacticId, lastSavedAt]);

  const handleCreate = useCallback(() => {
    void createTactic();
  }, [createTactic]);

  const handleSelect = useCallback(
    (tacticId: string) => {
      if (renamingTacticId === tacticId) return;
      selectTactic(tacticId);
    },
    [renamingTacticId, selectTactic]
  );

  const startRename = useCallback((tacticId: string, currentName: string) => {
    setRenamingTacticId(tacticId);
    setRenameValue(currentName);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingTacticId(null);
    setRenameValue('');
  }, []);

  const confirmRename = useCallback(() => {
    if (!renamingTacticId) return;

    const tactic = tactics.find((t) => t.id === renamingTacticId);
    const trimmed = renameValue.trim();

    if (!tactic || trimmed === '' || trimmed === tactic.name) {
      cancelRename();
      return;
    }

    void updateTactic(renamingTacticId, trimmed);
    cancelRename();
  }, [renamingTacticId, renameValue, tactics, updateTactic, cancelRename]);

  const handleRenameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        confirmRename();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelRename();
      }
    },
    [confirmRename, cancelRename]
  );

  const handleRenameBlur = useCallback(() => {
    // Let click handlers fire first, then commit on blur
    setTimeout(() => {
      if (renamingTacticId) {
        confirmRename();
      }
    }, 100);
  }, [renamingTacticId, confirmRename]);

  const handleDeleteClick = useCallback((tacticId: string) => {
    setDeleteConfirmTacticId(tacticId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmTacticId || isDeletingTactic) return;
    void deleteTactic(deleteConfirmTacticId);
    setDeleteConfirmTacticId(null);
  }, [deleteConfirmTacticId, isDeletingTactic, deleteTactic]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmTacticId(null);
  }, []);

  // Ready toggle (Epic 4 v2): same auto-save pipeline as renames (the
  // update queues behind an in-flight save). The client gate mirrors the
  // server's 422: an incomplete lineup cannot go ready.
  const handleToggleReady = useCallback(
    (tactic: TacticConfig) => {
      if (lineupIsComplete(tactic)) {
        void updateTactic(tactic.id, undefined, undefined, !tactic.isReady);
      }
    },
    [updateTactic]
  );

  // Close the delete dialog on Escape
  useEffect(() => {
    if (!deleteConfirmTacticId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelDelete();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmTacticId, cancelDelete]);

  return (
    <div style={styles.container}>
      <div data-testid="tab-bar" style={styles.tabStrip}>
        {userTactics.map((tactic) => {
          const isActive = tactic.id === activeTacticId;
          // Always deletable: deleting the last one recreates a default
          // tactic (store invariant), so the field is never left without one
          const canDelete = isActive;

          return (
            <div
              key={tactic.id}
              data-testid="tactic-tab"
              aria-current={isActive ? 'true' : undefined}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => handleSelect(tactic.id)}
              onDoubleClick={() => startRename(tactic.id, tactic.name)}
              title={tactic.name}
            >
              {renamingTacticId === tactic.id ? (
                <input
                  ref={renameInputRef}
                  data-testid="tab-rename-input"
                  type="text"
                  value={renameValue}
                  maxLength={100}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={handleRenameBlur}
                  onClick={(event) => event.stopPropagation()}
                  style={styles.renameInput}
                />
              ) : (
                <>
                  <button
                    data-testid="ready-toggle"
                    data-tactic-id={tactic.id}
                    aria-pressed={tactic.isReady}
                    disabled={!lineupIsComplete(tactic)}
                    style={{
                      ...styles.readyToggle,
                      ...(tactic.isReady ? styles.readyToggleOn : {}),
                      ...(!lineupIsComplete(tactic) ? styles.readyToggleDisabled : {}),
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleReady(tactic);
                    }}
                    title={
                      lineupIsComplete(tactic)
                        ? tactic.isReady
                          ? 'Ready to play — other players can challenge this tactic while you are offline'
                          : 'Mark ready to play — other players will be able to challenge this tactic while you are offline'
                        : 'Assign AIs to all 5 positions to make this tactic ready'
                    }
                  >
                    ●
                  </button>
                  <span style={styles.tabName}>{tactic.name}</span>
                  {tactic.isReady && (
                    <span data-testid="tactic-record" data-tactic-id={tactic.id} style={styles.record}>
                      {tactic.elo} · {tactic.wins}-{tactic.losses}
                    </span>
                  )}
                  {flashTacticId === tactic.id && (
                    <span data-testid="saved-indicator" style={styles.savedIndicator}>
                      ✓
                    </span>
                  )}
                  {canDelete && (
                    <button
                      data-testid="delete-tactic-button"
                      style={styles.deleteButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteClick(tactic.id);
                      }}
                      title="Delete tactic"
                    >
                      ×
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        <button
          data-testid="new-tactic-button"
          style={{
            ...styles.addButton,
            ...(isSavingTactic ? styles.addButtonDisabled : {}),
          }}
          onClick={handleCreate}
          disabled={isSavingTactic}
          title="Create a new tactic"
        >
          +
        </button>

        {userTactics.length === 0 && !tacticsError && (
          <span style={styles.hint}>Create your first tactic</span>
        )}

        {tacticsError && (
          <span data-testid="tactics-error" style={styles.error}>
            {tacticsError}
            <button
              data-testid="tactics-error-dismiss"
              style={styles.errorDismiss}
              onClick={clearTacticsError}
              title="Dismiss"
            >
              ×
            </button>
          </span>
        )}
      </div>

      {/* Delete Confirmation Dialog (Story 2.8 pattern) */}
      {deleteConfirmTacticId && (
        <div
          data-testid="delete-tactic-confirm-dialog"
          style={styles.dialogOverlay}
          onClick={cancelDelete}
        >
          <div style={styles.dialogContent} onClick={(event) => event.stopPropagation()}>
            <div style={styles.dialogTitle}>
              Delete {tactics.find((tactic) => tactic.id === deleteConfirmTacticId)?.name}?
            </div>
            <div style={styles.dialogButtons}>
              <button
                data-testid="delete-tactic-cancel-button"
                style={{ ...styles.dialogButton, ...styles.dialogButtonSecondary }}
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                data-testid="delete-tactic-confirm-button"
                style={{
                  ...styles.dialogButton,
                  ...styles.dialogButtonDanger,
                  ...(isDeletingTactic ? styles.dialogButtonDisabled : {}),
                }}
                onClick={confirmDelete}
                disabled={isDeletingTactic}
              >
                {isDeletingTactic ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flexShrink: 0,
  },
  tabStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    height: '32px',
    padding: '0 8px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'thin',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    maxWidth: '200px',
    minWidth: '60px',
    backgroundColor: '#2d2d2d',
    border: '1px solid #3c3c3c',
    borderBottom: 'none',
    borderRadius: '4px 4px 0 0',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#aaaaaa',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    flexShrink: 1,
  },
  tabActive: {
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    borderColor: '#007acc',
    fontWeight: 500,
  },
  tabName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  readyToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    padding: 0,
    flexShrink: 0,
    backgroundColor: 'transparent',
    color: '#555555',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '11px',
    lineHeight: 1,
  },
  readyToggleOn: {
    color: '#22c55e',
  },
  readyToggleDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  record: {
    fontSize: '10px',
    color: '#9d9d9d',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  savedIndicator: {
    color: '#22c55e',
    fontSize: '11px',
  },
  deleteButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    padding: 0,
    backgroundColor: 'transparent',
    color: '#808080',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1,
    flexShrink: 0,
  },
  renameInput: {
    fontSize: '12px',
    color: '#d4d4d4',
    backgroundColor: '#3c3c3c',
    border: '1px solid #007acc',
    borderRadius: '2px',
    padding: '1px 4px',
    outline: 'none',
    width: '110px',
    boxSizing: 'border-box',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    flexShrink: 0,
    marginLeft: '4px',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '15px',
    lineHeight: 1,
  },
  addButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  hint: {
    marginLeft: '8px',
    fontSize: '12px',
    color: '#666666',
    whiteSpace: 'nowrap',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '8px',
    fontSize: '12px',
    color: '#f14c4c',
    whiteSpace: 'nowrap',
  },
  errorDismiss: {
    marginLeft: '4px',
    backgroundColor: 'transparent',
    color: '#f14c4c',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
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
