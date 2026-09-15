/**
 * BallSprite - Visual ball for the match canvas
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 *
 * White circle with a dark outline, positioned in pitch percent coordinates.
 * Keeps a short fading trail (last positions) unless the user prefers
 * reduced motion.
 */

import { Container, Graphics } from 'pixi.js';
import { computePitchRect, percentToScreen } from './fieldGeometry';

/** Trail length: number of past positions kept for the fading trail. */
export const BALL_TRAIL_LENGTH = 8;

/** Floor radius so the ball stays readable on small (collapsed) pitches. */
export const BALL_MIN_RADIUS = 4;

/** Ball radius is 0.8% of the pitch width (never below BALL_MIN_RADIUS). */
export function computeBallRadius(pitchWidth: number): number {
  return Math.max(pitchWidth * 0.008, BALL_MIN_RADIUS);
}

const BALL_FILL_COLOR = 0xffffff;
const BALL_OUTLINE_COLOR = 0x111a24;

interface TrailPoint {
  x: number;
  y: number;
}

export class BallSprite {
  public container: Container;
  private ball: Graphics;
  private trail: Graphics;

  private screenWidth: number;
  private screenHeight: number;
  private trailPoints: TrailPoint[] = [];

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.container = new Container();
    this.container.eventMode = 'none';

    // Trail below the ball
    this.trail = new Graphics();
    this.container.addChild(this.trail);

    this.ball = new Graphics();
    this.container.addChild(this.ball);

    this.draw();
  }

  /** Queried live so a mid-session toggle is honored like the engine does */
  private get reducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private get radius(): number {
    const pitch = computePitchRect(this.screenWidth, this.screenHeight);
    return computeBallRadius(pitch.width);
  }

  private draw(): void {
    this.ball.clear();
    const radius = this.radius;

    this.ball.circle(0, 0, radius);
    this.ball.fill({ color: BALL_FILL_COLOR });
    this.ball.circle(0, 0, radius);
    this.ball.stroke({
      color: BALL_OUTLINE_COLOR,
      width: Math.max(1, radius * 0.25),
    });
  }

  /**
   * Move the ball to a percent pitch position and refresh the trail.
   * Coordinates are clamped to the pitch percent range; a non-finite value
   * falls back to the center instead of rendering the ball off-pitch (or at
   * a NaN position).
   */
  updateFromFrame(position: { x: number; y: number }): void {
    const pitch = computePitchRect(this.screenWidth, this.screenHeight);
    const x = Number.isFinite(position.x) ? Math.max(0, Math.min(100, position.x)) : 50;
    const y = Number.isFinite(position.y) ? Math.max(0, Math.min(100, position.y)) : 50;
    const pos = percentToScreen(pitch, x, y);
    this.container.x = pos.x;
    this.container.y = pos.y;

    if (!this.reducedMotion) {
      this.trailPoints.push({ x: pos.x, y: pos.y });
      if (this.trailPoints.length > BALL_TRAIL_LENGTH) {
        this.trailPoints.shift();
      }
      this.drawTrail();
    }
  }

  private drawTrail(): void {
    this.trail.clear();
    const radius = this.radius;

    // Oldest first, fading alpha towards the newest point
    for (let i = 0; i < this.trailPoints.length; i++) {
      const point = this.trailPoints[i];
      if (!point) continue;
      const alpha = ((i + 1) / this.trailPoints.length) * 0.35;
      // Trail circles are relative to the container position
      this.trail.circle(point.x - this.container.x, point.y - this.container.y, radius * 0.8);
      this.trail.fill({ color: BALL_FILL_COLOR, alpha });
    }
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  updateScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.trailPoints.length = 0;
    this.draw();
    this.drawTrail();
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
