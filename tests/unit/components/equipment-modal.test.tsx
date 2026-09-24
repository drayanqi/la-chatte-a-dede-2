/**
 * EquipmentModal Component Unit Tests (kit distinctness)
 *
 * The Équipement modal is the only place a team picks its colors: the
 * secondary is the away kit, so the two rows can never hold the same
 * swatch (cross-row disabled) and a legacy equal pair is reseeded on open.
 *
 * @priority P1
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EquipmentModal } from '@/components/teams/EquipmentModal';
import type { TacticConfig } from '@/types';

const makeTactic = (overrides: Partial<TacticConfig> = {}): TacticConfig =>
  ({
    id: 'tactic-1',
    name: 'Les Roulants',
    isSystem: false,
    isReady: false,
    elo: 1000,
    wins: 0,
    losses: 0,
    colorPrimary: '#e4573f',
    colorSecondary: '#4aa8e8',
    crest: null,
    players: [],
    ...overrides,
  }) as unknown as TacticConfig;

/** One swatch of one row, addressed by its data-role/data-color pair */
const swatch = (role: 'primary' | 'secondary', color: string) => {
  const found = screen
    .getAllByTestId('equipment-color-swatch')
    .find((el) => el.dataset.role === role && el.dataset.color === color);
  if (!found) throw new Error(`No ${role} swatch ${color} rendered`);
  return found;
};

const renderModal = (tactic: TacticConfig = makeTactic(), onSave = vi.fn()) => {
  render(
    <EquipmentModal tactic={tactic} isSaving={false} onClose={vi.fn()} onSave={onSave} />
  );
  return { onSave };
};

describe('EquipmentModal', () => {
  it('disables the secondary swatch equal to the current primary and ignores its click', () => {
    renderModal();

    const taken = swatch('secondary', '#e4573f');
    expect(taken).toBeDisabled();

    // The disabled swatch cannot steal the primary's color: the secondary
    // keeps the selected swatch, the click is a no-op
    fireEvent.click(taken);
    expect(swatch('secondary', '#4aa8e8')).toHaveAttribute('aria-pressed', 'true');
    expect(taken).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables the primary swatch equal to the current secondary', () => {
    renderModal();

    expect(swatch('primary', '#4aa8e8')).toBeDisabled();
    expect(swatch('primary', '#e4573f')).not.toBeDisabled();
  });

  it('selects a valid swatch on click', () => {
    renderModal();

    const candidate = swatch('secondary', '#31c48d');
    expect(candidate).not.toBeDisabled();
    fireEvent.click(candidate);
    expect(candidate).toHaveAttribute('aria-pressed', 'true');
  });

  it('reseeds the secondary of a legacy equal-pair tactic on open', () => {
    renderModal(makeTactic({ colorPrimary: '#31c48d', colorSecondary: '#31c48d' }));

    // Stored pair was equal: the secondary opens on the first palette
    // swatch that differs from the primary, the primary keeps its color
    expect(swatch('secondary', '#e4573f')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('primary', '#31c48d')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('secondary', '#31c48d')).toBeDisabled();
  });

  it('treats stored hexes case-insensitively (swatch selection + cross-row law)', () => {
    renderModal(makeTactic({ colorPrimary: '#E4573F', colorSecondary: '#4AA8E8' }));

    // The uppercase stored colors still select their swatches and trip the
    // cross-row disable — the collision law reads hex case-insensitively
    expect(swatch('primary', '#e4573f')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('secondary', '#4aa8e8')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('primary', '#4aa8e8')).toBeDisabled();
    expect(swatch('secondary', '#e4573f')).toBeDisabled();
  });

  it('emits the customization patch on save', () => {
    const onSave = vi.fn();
    renderModal(makeTactic(), onSave);

    fireEvent.click(swatch('secondary', '#31c48d'));
    fireEvent.click(screen.getByTestId('equipment-save-button'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      colorPrimary: '#e4573f',
      colorSecondary: '#31c48d',
      crest: null,
    });
  });
});
