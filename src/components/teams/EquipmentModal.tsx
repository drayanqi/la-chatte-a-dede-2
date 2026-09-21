/**
 * EquipmentModal — Équipement: team name, colors and crest (story 7.4)
 * OWNER: Dev Team
 *
 * Opened from the team caret menu. Edits save through the API on
 * "Enregistrer" (partial update: untouched keys are simply not sent) and
 * the canvas recolors live via the tactics store → AppShell effect.
 */

import { useEffect, useState } from 'react';
import { CREST_CHOICES, TEAM_COLOR_SWATCHES } from '@/lib/teamColors';
import type { TacticConfig, TacticCustomizationPatch } from '@/types';

/** What the modal hands back on save (name rides along the customization) */
export type EquipmentSavePatch = TacticCustomizationPatch & { name?: string };

interface EquipmentModalProps {
  tactic: TacticConfig;
  isSaving: boolean;
  onClose: () => void;
  onSave: (patch: EquipmentSavePatch) => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  tactic,
  isSaving,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(tactic.name);
  const [colorPrimary, setColorPrimary] = useState(tactic.colorPrimary);
  const [colorSecondary, setColorSecondary] = useState(tactic.colorSecondary);
  const [crest, setCrest] = useState<string | null>(tactic.crest);

  // Re-open for another team: reseed from that tactic
  useEffect(() => {
    setName(tactic.name);
    setColorPrimary(tactic.colorPrimary);
    setColorSecondary(tactic.colorSecondary);
    setCrest(tactic.crest);
  }, [tactic]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = name.trim();
    const patch: EquipmentSavePatch = {
      colorPrimary,
      colorSecondary,
      crest,
    };
    if (trimmed !== '' && trimmed !== tactic.name) {
      patch.name = trimmed;
    }
    onSave(patch);
  };

  return (
    <div
      data-testid="equipment-modal"
      data-tactic-id={tactic.id}
      style={styles.overlay}
      onClick={onClose}
    >
      <div style={styles.panel} onClick={(event) => event.stopPropagation()}>
        <div style={styles.title}>Équipement</div>

        <label style={styles.label} htmlFor="equipment-name-input">
          Nom de l&apos;équipe
        </label>
        <input
          id="equipment-name-input"
          data-testid="equipment-name-input"
          type="text"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          style={styles.nameInput}
        />

        <div style={styles.label}>Couleur principale</div>
        <div style={styles.swatchRow}>
          {TEAM_COLOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              data-testid="equipment-color-swatch"
              data-color={hex}
              data-role="primary"
              aria-pressed={colorPrimary === hex}
              style={{
                ...styles.swatch,
                background: hex,
                ...(colorPrimary === hex ? styles.swatchSelected : {}),
              }}
              onClick={() => setColorPrimary(hex)}
              title={hex}
            />
          ))}
        </div>

        <div style={styles.label}>Couleur secondaire</div>
        <div style={styles.swatchRow}>
          {TEAM_COLOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              data-testid="equipment-color-swatch"
              data-color={hex}
              data-role="secondary"
              aria-pressed={colorSecondary === hex}
              style={{
                ...styles.swatch,
                background: hex,
                ...(colorSecondary === hex ? styles.swatchSelected : {}),
              }}
              onClick={() => setColorSecondary(hex)}
              title={hex}
            />
          ))}
        </div>

        <div style={styles.label}>Blason</div>
        <div style={styles.crestGrid}>
          <button
            data-testid="equipment-crest"
            data-crest=""
            aria-pressed={crest === null}
            style={{
              ...styles.crest,
              ...(crest === null ? styles.crestSelected : {}),
            }}
            onClick={() => setCrest(null)}
            title="Aucun blason"
          >
            ␀
          </button>
          {CREST_CHOICES.map((emoji) => (
            <button
              key={emoji}
              data-testid="equipment-crest"
              data-crest={emoji}
              aria-pressed={crest === emoji}
              style={{
                ...styles.crest,
                ...(crest === emoji ? styles.crestSelected : {}),
              }}
              onClick={() => setCrest(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div style={styles.actions}>
          <button
            data-testid="equipment-cancel-button"
            style={styles.secondaryButton}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            data-testid="equipment-save-button"
            style={{
              ...styles.primaryButton,
              ...(isSaving ? styles.primaryButtonDisabled : {}),
            }}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10, 20, 14, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    backdropFilter: 'blur(3px)',
  },
  panel: {
    background: 'var(--panel)',
    borderRadius: 'var(--r-modal)',
    boxShadow: 'var(--shadow-lg)',
    padding: '24px',
    minWidth: '340px',
    maxWidth: '460px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    margin: '14px 0 6px',
  },
  nameInput: {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '13px',
    color: 'var(--ink)',
    backgroundColor: 'var(--panel2)',
    border: '1.5px solid var(--line)',
    borderRadius: '10px',
    padding: '8px 10px',
    outline: 'none',
  },
  swatchRow: {
    display: 'flex',
    gap: '8px',
  },
  swatch: {
    width: '30px',
    height: '30px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)',
  },
  swatchSelected: {
    boxShadow: '0 0 0 2.5px var(--ink), inset 0 0 0 1px rgba(255, 255, 255, 0.25)',
  },
  crestGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  crest: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '17px',
    lineHeight: 1,
    background: 'var(--panel2)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
  crestSelected: {
    boxShadow: '0 0 0 2.5px var(--ink)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '9px',
    marginTop: '20px',
  },
  primaryButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(255, 107, 87, 0.35)',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  secondaryButton: {
    padding: '9px 16px',
    borderRadius: 'var(--r-btn)',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'var(--panel2)',
    color: 'var(--ink)',
    boxShadow: 'inset 0 0 0 1px var(--line)',
  },
};
