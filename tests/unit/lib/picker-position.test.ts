/**
 * Script picker positioning tests (story 7.5)
 *
 * The picker opens next to the clicked player in viewport coordinates,
 * clamped inside the pitch panel so it never spills off-screen.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import { computePickerPosition } from '@/lib/pickerPosition';

const RECT = { left: 640, top: 120, width: 800, height: 600 };

describe('computePickerPosition', () => {
  it('should place the picker to the right-below of the player', () => {
    // Center of the pitch — the picker lands at player + gap
    const { x, y } = computePickerPosition(50, 50, RECT);
    expect(x).toBeGreaterThan(RECT.left);
    expect(y).toBeGreaterThan(RECT.top);
    expect(x).toBeLessThan(RECT.left + RECT.width);
    expect(y).toBeLessThan(RECT.top + RECT.height);
  });

  it('should offset from the player by the gap', () => {
    const { x, y } = computePickerPosition(50, 50, RECT);
    // The gap is 24px horizontally: the picker is strictly right of the player
    expect(x - RECT.left).toBeGreaterThan(RECT.width / 2);
    expect(y - RECT.top).toBeGreaterThan(RECT.height / 2);
  });

  it('should clamp near the right edge of the pitch', () => {
    const { x } = computePickerPosition(99, 50, RECT);
    // Clamped to width - 160 (picker min width) inside the panel
    expect(x).toBeLessThanOrEqual(RECT.left + RECT.width - 160);
  });

  it('should clamp near the bottom edge of the pitch', () => {
    const { y } = computePickerPosition(50, 99, RECT);
    expect(y).toBeLessThanOrEqual(RECT.top + RECT.height - 80);
  });

  it('should clamp at the panel origin for top-left players', () => {
    const { x, y } = computePickerPosition(1, 1, RECT);
    expect(x).toBeGreaterThanOrEqual(RECT.left);
    expect(y).toBeGreaterThanOrEqual(RECT.top);
  });

  it('should be stable for identical inputs', () => {
    const a = computePickerPosition(25, 75, RECT);
    const b = computePickerPosition(25, 75, RECT);
    expect(a).toEqual(b);
  });

  it('should shift with the panel rect (scroll-safe)', () => {
    const shifted = computePickerPosition(50, 50, { ...RECT, left: 100, top: 40 });
    const base = computePickerPosition(50, 50, RECT);
    expect(shifted.x).toBe(base.x - 540);
    expect(shifted.y).toBe(base.y - 80);
  });
});
