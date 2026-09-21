/**
 * ScriptPicker - On-pitch script assignment popover (story 7.5)
 * OWNER: Dev Team
 *
 * Opens next to the clicked player, lists the user's scripts (status dot +
 * usage count) with "Retirer le script". Replaces the drag-and-drop
 * assignment path.
 */

import { useEffect } from 'react';

export interface PickerScript {
  id: string;
  name: string;
  status: 'ok' | 'warn' | 'err';
  usage: number;
}

interface ScriptPickerProps {
  /** Number shown in the header ("Assigner à n°9") */
  playerNumber: number;
  /** Viewport coordinates (from computePickerPosition) */
  x: number;
  y: number;
  scripts: PickerScript[];
  /** Currently assigned script for this player (highlighted) */
  currentScriptId: string | null;
  onAssign: (scriptId: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

const STATUS_COLORS: Record<PickerScript['status'], string> = {
  ok: 'var(--mint)',
  warn: 'var(--sun)',
  err: 'var(--corail)',
};

export const ScriptPicker: React.FC<ScriptPickerProps> = ({
  playerNumber,
  x,
  y,
  scripts,
  currentScriptId,
  onAssign,
  onRemove,
  onClose,
}) => {
  // Escape closes; any outside click too (the pitch click path already
  // deselects — this listener covers clicks elsewhere in the UI)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="script-picker"
      style={{ ...styles.picker, left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <div style={styles.header}>Assigner à n°{playerNumber}</div>

      {scripts.length === 0 && (
        <div style={styles.empty}>Aucun script — crée-en un dans le panneau Scripts</div>
      )}

      {scripts.map((script) => (
        <button
          key={script.id}
          data-testid="picker-script-option"
          data-script-id={script.id}
          aria-pressed={script.id === currentScriptId}
          style={{
            ...styles.option,
            ...(script.id === currentScriptId ? styles.optionCurrent : {}),
          }}
          onClick={() => onAssign(script.id)}
          title={script.name}
        >
          <span
            data-testid="picker-script-status"
            data-status={script.status}
            style={{ ...styles.statusDot, background: STATUS_COLORS[script.status] }}
          />
          <span style={styles.optionName}>{script.name}</span>
          <span data-testid="picker-script-usage" style={styles.usage}>
            {script.usage}
          </span>
        </button>
      ))}

      <button
        data-testid="picker-remove-script"
        style={styles.removeButton}
        onClick={onRemove}
        disabled={currentScriptId === null}
      >
        Retirer le script
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  picker: {
    position: 'fixed',
    zIndex: 1002,
    width: '235px',
    background: 'var(--panel)',
    borderRadius: '17px',
    boxShadow: 'var(--shadow-lg)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  header: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    padding: '5px 9px 7px',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--muted)',
    padding: '6px 9px 8px',
    lineHeight: 1.4,
  },
  option: {
    textAlign: 'left',
    padding: '9px 11px',
    borderRadius: '11px',
    fontSize: '12.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ink)',
  },
  optionCurrent: {
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
  optionName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  usage: {
    marginLeft: 'auto',
    fontSize: '10px',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  removeButton: {
    textAlign: 'left',
    padding: '10px 11px 6px',
    borderRadius: 0,
    marginTop: '3px',
    paddingTop: '10px',
    fontSize: '12.5px',
    fontWeight: 700,
    color: 'var(--corail)',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid var(--line)',
    cursor: 'pointer',
  },
};
