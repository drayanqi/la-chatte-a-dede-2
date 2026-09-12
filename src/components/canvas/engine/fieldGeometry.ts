/**
 * fieldGeometry - Géométrie pure du terrain (ratio futsal 2:1)
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

export const FIELD_PADDING = 40;

export const PITCH_ASPECT_RATIO = 2;

export interface PitchRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computePitchRect(canvasWidth: number, canvasHeight: number): PitchRect {
  const availW = Math.max(0, canvasWidth - FIELD_PADDING * 2);
  const availH = Math.max(0, canvasHeight - FIELD_PADDING * 2);

  let width = availW;
  let height = width / PITCH_ASPECT_RATIO;
  if (height > availH) {
    height = availH;
    width = height * PITCH_ASPECT_RATIO;
  }

  return {
    x: FIELD_PADDING + (availW - width) / 2,
    y: FIELD_PADDING + (availH - height) / 2,
    width,
    height,
  };
}

export function percentToScreen(rect: PitchRect, x: number, y: number): { x: number; y: number } {
  return {
    x: rect.x + (x / 100) * rect.width,
    y: rect.y + (y / 100) * rect.height,
  };
}

export function screenToPercent(
  rect: PitchRect,
  screenX: number,
  screenY: number
): { x: number; y: number } {
  if (rect.width === 0 || rect.height === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((screenX - rect.x) / rect.width) * 100,
    y: ((screenY - rect.y) / rect.height) * 100,
  };
}

export const PLAYER_RADIUS_RATIO = 1 / 27;

export const PLAYER_RADIUS_MIN = 8;

export function computePlayerRadius(pitch: PitchRect): number {
  return Math.max(PLAYER_RADIUS_MIN, pitch.height * PLAYER_RADIUS_RATIO);
}
