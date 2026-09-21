/**
 * Script picker positioning (story 7.5) — pure math so the picker opens
 * next to the clicked player and never leaves the pitch panel.
 */

import { computePitchRect, percentToScreen } from '@/components/canvas/engine/fieldGeometry';

/** Gap between the player circle and the picker (mockup: +24/+12) */
const GAP_X = 24;
const GAP_Y = 12;

export interface PickerPlacement {
  x: number;
  y: number;
}

/**
 * Viewport coordinates for the picker, given the pitch-percent player
 * position and the canvas panel's bounding rect. Clamped inside the panel
 * (top-left never negative; the picker's own size is clamped by max-width).
 */
export const computePickerPosition = (
  percentX: number,
  percentY: number,
  rect: { left: number; top: number; width: number; height: number }
): PickerPlacement => {
  const pitch = computePitchRect(rect.width, rect.height);
  const player = percentToScreen(pitch, percentX, percentY);

  const x = Math.max(0, Math.min(rect.width - 160, player.x + GAP_X));
  const y = Math.max(0, Math.min(rect.height - 80, player.y + GAP_Y));

  return { x: rect.left + x, y: rect.top + y };
};
