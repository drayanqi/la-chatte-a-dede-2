/**
 * Teambar - La Ronde floating team capsule (story 7.5)
 * OWNER: Dev Team
 *
 * One pill per user tactic: status dot (mint prêt / sun brouillon), name,
 * caret menu (Renommer inline, Équipement, Dupliquer, Supprimer with
 * confirm), "+ Nouvelle équipe" creation modal. On the right: the
 * Brouillon/Prêt pill, the ready toggle and Test vs Bot.
 * Every edit auto-saves; deletion of the last team recreates a default.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTacticsStore } from '@/stores/tacticsStore';
import { EquipmentModal } from '@/components/teams/EquipmentModal';
import type { EquipmentSavePatch } from '@/components/teams/EquipmentModal';

interface TeambarProps {
  /** True when all 5 lineup slots have a script assigned (story 3.2 AC #7) */
  lineupComplete: boolean;
  /** True while a practice match simulation is running (blocks double-start) */
  isSimulating: boolean;
  /** Start a practice match (story 3.5 wiring) */
  onStartPractice: () => void;
}

export const Teambar: React.FC<TeambarProps> = ({
  lineupComplete,
  isSimulating,
  onStartPractice,
}) => {
  const tactics = useTacticsStore((state) => state.tactics);
  const activeTacticId = useTacticsStore((state) => state.activeTacticId);
  const isSavingTactic = useTacticsStore((state) => state.isSavingTactic);
  const isDeletingTactic = useTacticsStore((state) => state.isDeletingTactic);
  const lastSavedTacticId = useTacticsStore((state) => state.lastSavedTacticId);
  const lastSavedAt = useTacticsStore((state) => state.lastSavedAt);
  const tacticsError = useTacticsStore((state) => state.tacticsError);
  const createTactic = useTacticsStore((state) => state.createTactic);
  const duplicateTactic = useTacticsStore((state) => state.duplicateTactic);
  const deleteTactic = useTacticsStore((state) => state.deleteTactic);
  const updateTactic = useTacticsStore((state) => state.updateTactic);
  const selectTactic = useTacticsStore((state) => state.selectTactic);
  const clearTacticsError = useTacticsStore((state) => state.clearTacticsError);

  // Only user tactics appear as pills (system tactics are not editable in MVP)
  const userTactics = tactics.filter((tactic) => !tactic.isSystem);
  const activeTactic = userTactics.find((tactic) => tactic.id === activeTacticId) ?? null;

  // Rename state (inline in the pill)
  const [renamingTacticId, setRenamingTacticId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Caret menu (fixed, anchored under the caret)
  const [menuTacticId, setMenuTacticId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Modals
  const [equipmentTacticId, setEquipmentTacticId] = useState<string | null>(null);
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [deleteConfirmTacticId, setDeleteConfirmTacticId] = useState<string | null>(null);

  // "Saved" flash: which pill currently shows the indicator
  const [flashTacticId, setFlashTacticId] = useState<string | null>(null);

  // Focus and select input when entering rename mode
  useEffect(() => {
    if (renamingTacticId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTacticId]);

  // Show the "saved" indicator on the last saved pill, hide it after the delay
  useEffect(() => {
    if (!lastSavedTacticId || !lastSavedAt) return;

    const showTimer = setTimeout(() => setFlashTacticId(lastSavedTacticId), 0);
    const hideTimer = setTimeout(() => setFlashTacticId(null), 1500);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [lastSavedTacticId, lastSavedAt]);

  // Caret menu lifecycle: Escape or any outside click closes it
  useEffect(() => {
    if (!menuTacticId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuTacticId(null);
    };
    const handleClick = () => setMenuTacticId(null);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
    };
  }, [menuTacticId]);

  const handleSelect = useCallback(
    (tacticId: string) => {
      if (renamingTacticId === tacticId) return;
      selectTactic(tacticId);
    },
    [renamingTacticId, selectTactic]
  );

  const handleOpenMenu = useCallback((tacticId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.left, y: rect.bottom + 6 });
    setMenuTacticId(tacticId);
  }, []);

  const startRename = useCallback((tacticId: string, currentName: string) => {
    setMenuTacticId(null);
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

  const handleOpenEquipment = () => {
    setEquipmentTacticId(menuTacticId);
    setMenuTacticId(null);
  };

  const handleDuplicate = () => {
    if (menuTacticId) void duplicateTactic(menuTacticId);
    setMenuTacticId(null);
  };

  const handleDeleteFromMenu = () => {
    setDeleteConfirmTacticId(menuTacticId);
    setMenuTacticId(null);
  };

  const handleEquipmentSave = (tacticId: string, patch: EquipmentSavePatch) => {
    // Partial update: untouched keys are simply not sent (has() semantics)
    const { name, ...customization } = patch;
    void updateTactic(tacticId, name, undefined, undefined, customization);
    setEquipmentTacticId(null);
  };

  const handleCreateTeam = () => {
    void createTactic(newTeamName);
    setNewTeamName('');
    setIsNewTeamModalOpen(false);
  };

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmTacticId || isDeletingTactic) return;
    void deleteTactic(deleteConfirmTacticId);
    setDeleteConfirmTacticId(null);
  }, [deleteConfirmTacticId, isDeletingTactic, deleteTactic]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmTacticId(null);
  }, []);

  // Ready toggle (Epic 4 v2): same auto-save pipeline as renames. The
  // client gate mirrors the server's 422: an incomplete lineup cannot go
  // ready. (Plain handler: the React Compiler rejects memoizing over the
  // derived activeTactic object here.)
  const handleToggleReady = () => {
    if (!activeTactic || !lineupComplete) return;
    void updateTactic(activeTactic.id, undefined, undefined, !activeTactic.isReady);
  };

  // Close the dialogs on Escape
  useEffect(() => {
    if (!deleteConfirmTacticId && !isNewTeamModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteConfirmTacticId) cancelDelete();
      if (isNewTeamModalOpen) setIsNewTeamModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmTacticId, isNewTeamModalOpen, cancelDelete]);

  return (
    <div style={styles.container}>
      <div data-testid="team-bar" style={styles.pillStrip}>
        {userTactics.map((tactic) => {
          const isActive = tactic.id === activeTacticId;

          return (
            <div
              key={tactic.id}
              data-testid="tactic-tab"
              data-tactic-id={tactic.id}
              aria-current={isActive ? 'true' : undefined}
              style={{
                ...styles.pill,
                ...(isActive ? styles.pillActive : {}),
              }}
              onClick={() => handleSelect(tactic.id)}
              title={tactic.name}
            >
              <span
                data-testid="team-dot"
                data-ready={tactic.isReady ? 'true' : 'false'}
                style={{
                  ...styles.dot,
                  background: tactic.isReady ? 'var(--mint)' : 'var(--sun)',
                }}
              />
              {renamingTacticId === tactic.id ? (
                <input
                  ref={renameInputRef}
                  data-testid="team-rename-input"
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
                  <span style={styles.pillName}>{tactic.name}</span>
                  {tactic.isReady && (
                    <span
                      data-testid="tactic-record"
                      data-tactic-id={tactic.id}
                      style={styles.record}
                    >
                      {tactic.elo} · {tactic.wins}-{tactic.losses}
                    </span>
                  )}
                  {flashTacticId === tactic.id && (
                    <span data-testid="saved-indicator" style={styles.savedIndicator}>
                      ✓
                    </span>
                  )}
                  <button
                    data-testid="team-caret"
                    data-tactic-id={tactic.id}
                    style={styles.caretButton}
                    onClick={(event) => handleOpenMenu(tactic.id, event)}
                    aria-haspopup="menu"
                    title="Options de l'équipe"
                  >
                    ▾
                  </button>
                </>
              )}
            </div>
          );
        })}

        <button
          data-testid="new-team-button"
          style={styles.newTeamButton}
          onClick={() => setIsNewTeamModalOpen(true)}
          title="Créer une nouvelle équipe"
        >
          + Nouvelle équipe
        </button>

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

      <div style={styles.spacer} />

      {activeTactic && (
        <button
          data-testid="ready-toggle"
          data-tactic-id={activeTactic.id}
          data-status={activeTactic.isReady ? 'ready' : 'draft'}
          aria-pressed={activeTactic.isReady}
          disabled={(!lineupComplete && !activeTactic.isReady) || isSavingTactic}
          style={{
            ...styles.readyButton,
            ...(activeTactic.isReady ? styles.readyButtonActive : styles.readyButtonIdle),
            ...((!lineupComplete && !activeTactic.isReady) || isSavingTactic
              ? styles.readyButtonDisabled
              : {}),
          }}
          onClick={handleToggleReady}
          title={
            lineupComplete
              ? activeTactic.isReady
                ? 'Retirer cette équipe du pool classé'
                : 'Rendre cette équipe challengeable par les autres joueurs'
              : 'Assigne des scripts aux 5 positions pour rendre cette équipe prête'
          }
        >
          {activeTactic.isReady ? 'Prêt' : 'Prêt pour le match'}
        </button>
      )}

      {!lineupComplete && (
        <span data-testid="lineup-incomplete-message" style={styles.helperMessage}>
          Assigne un script aux 5 positions
        </span>
      )}
      <button
        data-testid="test-vs-bot-button"
        style={{
          ...styles.practiceButton,
          ...(!lineupComplete || isSimulating ? styles.practiceButtonDisabled : {}),
        }}
        onClick={onStartPractice}
        disabled={!lineupComplete || isSimulating}
      >
        Test vs Bot
      </button>

      {/* Team caret menu (mockup .ctx) */}
      {menuTacticId && menuPosition && (
        <div
          data-testid="team-menu"
          data-tactic-id={menuTacticId}
          style={{ ...styles.teamMenu, left: menuPosition.x, top: menuPosition.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            data-testid="team-rename"
            style={styles.teamMenuItem}
            onClick={() => {
              const tactic = tactics.find((t) => t.id === menuTacticId);
              if (tactic) startRename(tactic.id, tactic.name);
            }}
          >
            Renommer
          </button>
          <button data-testid="team-equipment" style={styles.teamMenuItem} onClick={handleOpenEquipment}>
            Équipement
          </button>
          <button data-testid="team-duplicate" style={styles.teamMenuItem} onClick={handleDuplicate}>
            Dupliquer
          </button>
          <button
            data-testid="team-delete"
            style={{ ...styles.teamMenuItem, ...styles.teamMenuItemDanger }}
            onClick={handleDeleteFromMenu}
          >
            Supprimer…
          </button>
        </div>
      )}

      {/* Équipement modal (story 7.4) */}
      {equipmentTacticId &&
        (() => {
          const tactic = tactics.find((t) => t.id === equipmentTacticId);
          if (!tactic) return null;
          return (
            <EquipmentModal
              tactic={tactic}
              isSaving={isSavingTactic}
              onClose={() => setEquipmentTacticId(null)}
              onSave={(patch) => handleEquipmentSave(tactic.id, patch)}
            />
          );
        })()}

      {/* Nouvelle équipe modal (mockup s-newteam) */}
      {isNewTeamModalOpen && (
        <div
          data-testid="new-team-modal"
          style={styles.dialogOverlay}
          onClick={() => setIsNewTeamModalOpen(false)}
        >
          <div style={styles.dialogContent} onClick={(event) => event.stopPropagation()}>
            <div style={styles.dialogTitle}>Nouvelle équipe</div>
            <label style={styles.fieldLabel} htmlFor="new-team-name-input">
              Nom de l&apos;équipe
            </label>
            <input
              id="new-team-name-input"
              data-testid="new-team-name-input"
              type="text"
              value={newTeamName}
              maxLength={100}
              placeholder="Ex : Les Bleus du JS"
              onChange={(event) => setNewTeamName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreateTeam();
              }}
              style={styles.fieldInput}
              autoFocus
            />
            <div style={styles.dialogHint}>
              Ton équipe démarre avec une formation par défaut. Tu pourras tout
              customiser ensuite.
            </div>
            <div style={styles.dialogButtons}>
              <button
                data-testid="new-team-cancel-button"
                style={{ ...styles.dialogButton, ...styles.dialogButtonSecondary }}
                onClick={() => setIsNewTeamModalOpen(false)}
              >
                Annuler
              </button>
              <button
                data-testid="new-team-create-button"
                style={{
                  ...styles.dialogButton,
                  ...styles.dialogButtonPrimary,
                  ...(isSavingTactic ? styles.dialogButtonDisabled : {}),
                }}
                onClick={handleCreateTeam}
                disabled={isSavingTactic}
              >
                {isSavingTactic ? 'Création...' : "Créer l'équipe"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog (Story 2.8 pattern) */}
      {deleteConfirmTacticId && (
        <div
          data-testid="delete-tactic-confirm-dialog"
          style={styles.dialogOverlay}
          onClick={cancelDelete}
        >
          <div style={styles.dialogContent} onClick={(event) => event.stopPropagation()}>
            <div style={styles.dialogTitle}>
              Supprimer {tactics.find((tactic) => tactic.id === deleteConfirmTacticId)?.name} ?
            </div>
            <div style={styles.dialogButtons}>
              <button
                data-testid="delete-tactic-cancel-button"
                style={{ ...styles.dialogButton, ...styles.dialogButtonSecondary }}
                onClick={cancelDelete}
              >
                Annuler
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
                {isDeletingTactic ? 'Suppression...' : 'Supprimer'}
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
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    margin: '8px 8px 0',
    height: '48px',
    padding: '0 10px',
    background: 'var(--panel)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow)',
    zIndex: 90,
  },
  pillStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'thin',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '12.5px',
    fontWeight: 600,
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    flexShrink: 1,
    border: 'none',
  },
  pillActive: {
    background: 'var(--panel2)',
    color: 'var(--ink)',
    boxShadow: 'inset 0 0 0 1px var(--line), var(--shadow)',
    fontWeight: 700,
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  pillName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  record: {
    fontSize: '10px',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: 'var(--mono)',
  },
  savedIndicator: {
    color: 'var(--mint)',
    fontSize: '11px',
  },
  caretButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    padding: 0,
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '9px',
    lineHeight: 1,
    flexShrink: 0,
    opacity: 0.8,
  },
  renameInput: {
    fontSize: '12.5px',
    color: 'var(--ink)',
    backgroundColor: 'var(--panel)',
    border: '1.5px solid var(--corail)',
    borderRadius: '8px',
    padding: '2px 8px',
    outline: 'none',
    width: '130px',
    boxSizing: 'border-box',
  },
  newTeamButton: {
    flexShrink: 0,
    marginLeft: '4px',
    padding: '8px 12px',
    borderRadius: '12px',
    fontSize: '12.5px',
    fontWeight: 700,
    color: 'var(--corail)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '8px',
    fontSize: '12px',
    color: 'var(--corail)',
    whiteSpace: 'nowrap',
  },
  errorDismiss: {
    marginLeft: '4px',
    backgroundColor: 'transparent',
    color: 'var(--corail)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
  },
  spacer: {
    flex: 1,
  },
  readyButton: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--panel2)',
    color: 'var(--muted)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  readyButtonActive: {
    background: 'var(--mint)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(49, 196, 141, 0.3)',
  },
  readyButtonDisabled: {
    background: 'var(--panel2)',
    color: 'var(--muted)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    cursor: 'not-allowed',
  },
  helperMessage: {
    fontSize: '12px',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
  },
  practiceButton: {
    padding: '6px 11px',
    borderRadius: '11px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'var(--sun)',
    color: '#12241b',
    boxShadow: '0 4px 14px rgba(255, 194, 68, 0.3)',
    whiteSpace: 'nowrap',
  },
  practiceButtonDisabled: {
    background: 'var(--panel2)',
    color: 'var(--muted)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
    cursor: 'not-allowed',
  },
  teamMenu: {
    position: 'fixed',
    zIndex: 1002,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '195px',
    background: 'var(--panel)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)',
    padding: '7px',
  },
  teamMenuItem: {
    textAlign: 'left',
    padding: '9px 12px',
    background: 'transparent',
    color: 'var(--ink)',
    border: 'none',
    borderRadius: '11px',
    cursor: 'pointer',
    fontSize: '12.5px',
    fontWeight: 600,
  },
  teamMenuItemDanger: {
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
    minWidth: '340px',
    maxWidth: '440px',
  },
  dialogTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: '14px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
  },
  fieldInput: {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '13px',
    color: 'var(--ink)',
    backgroundColor: 'var(--panel2)',
    border: '1.5px solid var(--line)',
    borderRadius: '13px',
    padding: '11px 12px',
    outline: 'none',
  },
  dialogHint: {
    fontSize: '12px',
    color: 'var(--muted)',
    lineHeight: 1.5,
    marginTop: '12px',
  },
  dialogButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '9px',
    marginTop: '18px',
  },
  dialogButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
  },
  dialogButtonPrimary: {
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
  dialogButtonSecondary: {
    backgroundColor: 'var(--panel2)',
    color: 'var(--ink)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  dialogButtonDanger: {
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
  dialogButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
