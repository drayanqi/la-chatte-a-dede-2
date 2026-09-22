/**
 * BallSprite - Visual ball for the match canvas
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 *
 * White circle with a dark outline, positioned in pitch percent coordinates.
 * Keeps a short fading trail (last positions) unless the user prefers
 * reduced motion.
 */

import { Container, Graphics } from 'pixi.js';
import { computePitchRect, computePlayerRadius, percentToScreen } from './fieldGeometry';

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
  // Kickoff pause (goal countdown): nudge the ball just off the holder's
  // feet toward the pitch center so the engagement reads clearly
  private kickoffOffsetActive = false;
  private lastFramePosition: { x: number; y: number } | null = null;

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
   * Kickoff pause: while active the ball renders a step off the holder
   * toward the pitch center ("ball at the keeper's feet" instead of a dot
   * buried in the sprite). Deactivating snaps back to the true frame spot.
   */
  setKickoffOffset(active: boolean): void {
    if (this.kickoffOffsetActive === active) return;
    this.kickoffOffsetActive = active;
    if (active) {
      // Fresh engagement: the pre-goal flight trail must not linger frozen
      this.trailPoints.length = 0;
      this.drawTrail();
    } else if (this.lastFramePosition) {
      this.updateFromFrame(this.lastFramePosition);
    }
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
    this.lastFramePosition = { x, y };
    const pos = percentToScreen(pitch, x, y);
    this.container.x = pos.x;
    this.container.y = pos.y;

    if (this.kickoffOffsetActive) {
      // Toward the pitch center — the direction the keeper engages in.
      // Degenerate when the ball already sits at the center: no offset.
      const dx = pitch.x + pitch.width / 2 - pos.x;
      const dy = pitch.y + pitch.height / 2 - pos.y;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        const distance = computePlayerRadius(pitch) + this.radius * 0.9;
        this.container.x = pos.x + (dx / length) * distance;
        this.container.y = pos.y + (dy / length) * distance;
      }
    }

    // While the kickoff offset is active the trail stays frozen (cleared at
    // activation) — trail dots are container-relative and would inherit the
    // offset
    if (!this.reducedMotion && !this.kickoffOffsetActive) {
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
