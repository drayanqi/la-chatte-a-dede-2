/**
 * Field - Rendu du terrain de jeu
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Assets, Container, FillGradient, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import * as fieldGeometry from './fieldGeometry';
import watermarkUrl from '@/assets/watermark.png';

export class Field {
  public container: Container;
  private background: Graphics;
  private watermark: Sprite;
  private graphics: Graphics;
  private width: number;
  private height: number;
  private watermarkLoaded = false;

  // Palette "Deep Court" (Epic 5.1) — hardcoded v1, un seul bloc, un seul fichier
  private readonly LETTERBOX_COLOR = 0x111a24;
  private readonly PITCH_BASE_COLOR = 0x1a2634;
  private readonly HALF_HOME_COLOR = 0xff6b1a;
  private readonly HALF_AWAY_COLOR = 0x1a8cff;
  private readonly HALF_TINT_MAX_ALPHA = 0.32;
  private readonly HALF_TINT_MID_ALPHA = 0.1;
  private readonly BOARD_ALPHA = 0.15;
  private readonly LINE_COLOR = 0xffffff;
  private readonly LINE_WIDTH = 2;
  private readonly GOAL_HOME_COLOR = 0xff6b1a;
  private readonly GOAL_AWAY_COLOR = 0x1a8cff;
  private readonly GOAL_FILL_ALPHA = 0.12;
  private readonly GOAL_HALO_ALPHA = 0.18;
  private readonly NET_ALPHA = 0.22;
  private readonly BOARD_BRAND = 'LACHATADEDE';
  private readonly BOARD_TEXT_ALPHA = 0.16;
  private readonly PITCH_CORNER_RADIUS_RATIO = 0.04;

  private homeWash: FillGradient | null = null;
  private awayWash: FillGradient | null = null;
  private topBoard: Text | null = null;
  private bottomBoard: Text | null = null;
  private readonly WATERMARK_ALPHA = 0.3;
  private readonly WATERMARK_SIZE_RATIO = 0.6;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.container = new Container();
    this.background = new Graphics();
    this.watermark = new Sprite();
    this.watermark.anchor.set(0.5);
    this.watermark.alpha = this.WATERMARK_ALPHA;
    this.watermark.visible = false;
    this.graphics = new Graphics();
    this.container.addChild(this.background);
    this.container.addChild(this.watermark);
    this.container.addChild(this.graphics);
    this.topBoard = this.createBoardText();
    this.bottomBoard = this.createBoardText();
    this.container.addChild(this.topBoard);
    this.container.addChild(this.bottomBoard);

    this.draw();
    void this.loadWatermark();
  }

  private createBoardText(): Text {
    const text = new Text({
      text: this.BOARD_BRAND,
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'bold',
        fill: this.LINE_COLOR,
        letterSpacing: 8,
      }),
    });
    text.anchor.set(0.5);
    text.alpha = this.BOARD_TEXT_ALPHA;
    return text;
  }

  private layoutBoardTexts(pitch: fieldGeometry.PitchRect): void {
    if (!this.topBoard || !this.bottomBoard) {
      return;
    }
    const framePad = this.boardsFramePad(pitch);
    const room = pitch.y - framePad;
    const visible = pitch.width > 0 && pitch.height > 0 && room > 14;
    this.topBoard.visible = visible;
    this.bottomBoard.visible = visible;
    if (!visible) {
      return;
    }

    const fontSize = Math.max(10, Math.min(20, room * 0.5, pitch.height * 0.05));
    for (const board of [this.topBoard, this.bottomBoard]) {
      const style = board.style as TextStyle;
      style.fontSize = fontSize;
      style.letterSpacing = fontSize * 0.35;
    }

    const bottomStripStart = pitch.y + pitch.height + framePad;
    this.topBoard.position.set(this.width / 2, room / 2);
    this.bottomBoard.position.set(this.width / 2, (bottomStripStart + this.height) / 2);
  }

  private boardsFramePad(pitch: fieldGeometry.PitchRect): number {
    const goalDepth = Math.max(16, pitch.height * 0.055);
    return goalDepth + 8;
  }

  private async loadWatermark(): Promise<void> {
    try {
      const texture = await Assets.load<Texture>(watermarkUrl);
      this.watermark.texture = texture;
      this.watermarkLoaded = true;
      this.layoutWatermark();
    } catch {
      this.watermarkLoaded = false;
      this.watermark.visible = false;
    }
  }

  private layoutWatermark(): void {
    if (!this.watermarkLoaded) {
      return;
    }
    const pitch = fieldGeometry.computePitchRect(this.width, this.height);
    this.watermark.visible = pitch.width > 0 && pitch.height > 0;
    if (!this.watermark.visible) {
      return;
    }
    const scale =
      (pitch.height * this.WATERMARK_SIZE_RATIO) / this.watermark.texture.height;
    this.watermark.scale.set(scale);
    this.watermark.position.set(
      pitch.x + pitch.width / 2,
      pitch.y + pitch.height / 2
    );
  }

  private draw(): void {
    const g = this.background;
    g.clear();
    this.disposeWashGradients();

    const pitch = fieldGeometry.computePitchRect(this.width, this.height);

    // Hors-jeu (letterbox) sur tout le canvas
    g.rect(0, 0, this.width, this.height);
    g.fill({ color: this.LETTERBOX_COLOR });

    this.drawMarkings(pitch);

    if (pitch.width === 0 || pitch.height === 0) {
      return;
    }

    // Base du terrain (coins arrondis — moins d'angles droits, loi Pelo)
    const cornerRadius = this.pitchCornerRadius(pitch);
    g.roundRect(pitch.x, pitch.y, pitch.width, pitch.height, cornerRadius);
    g.fill({ color: this.PITCH_BASE_COLOR });

    // Lueurs d'équipe : dégradé depuis chaque but, éteint au centre
    // (jamais de la peinture pleine — le centre reste neutre, le watermark respire)
    this.homeWash = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: this.rgba(this.HALF_HOME_COLOR, this.HALF_TINT_MAX_ALPHA) },
        { offset: 0.55, color: this.rgba(this.HALF_HOME_COLOR, this.HALF_TINT_MID_ALPHA) },
        { offset: 1, color: this.rgba(this.HALF_HOME_COLOR, 0) },
      ],
    });
    this.traceHalfPitch(g, pitch, 'home', cornerRadius);
    g.fill(this.homeWash);

    this.awayWash = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: this.rgba(this.HALF_AWAY_COLOR, 0) },
        { offset: 0.45, color: this.rgba(this.HALF_AWAY_COLOR, this.HALF_TINT_MID_ALPHA) },
        { offset: 1, color: this.rgba(this.HALF_AWAY_COLOR, this.HALF_TINT_MAX_ALPHA) },
      ],
    });
    this.traceHalfPitch(g, pitch, 'away', cornerRadius);
    g.fill(this.awayWash);

    this.layoutBoardTexts(pitch);
  }

  private pitchCornerRadius(pitch: fieldGeometry.PitchRect): number {
    return Math.max(8, pitch.height * this.PITCH_CORNER_RADIUS_RATIO);
  }

  private traceHalfPitch(
    g: Graphics,
    pitch: fieldGeometry.PitchRect,
    side: 'home' | 'away',
    radius: number
  ): void {
    // Demi-terrain aux coins extérieurs arrondis (bord droit au centre)
    const top = pitch.y;
    const bottom = pitch.y + pitch.height;
    const centerX = pitch.x + pitch.width / 2;

    if (side === 'home') {
      const left = pitch.x;
      g.moveTo(centerX, top);
      g.lineTo(left + radius, top);
      g.arc(left + radius, top + radius, radius, -Math.PI / 2, Math.PI, true);
      g.lineTo(left, bottom - radius);
      g.arc(left + radius, bottom - radius, radius, Math.PI, Math.PI / 2, true);
      g.lineTo(centerX, bottom);
    } else {
      const right = pitch.x + pitch.width;
      g.moveTo(centerX, top);
      g.lineTo(right - radius, top);
      g.arc(right - radius, top + radius, radius, -Math.PI / 2, 0, false);
      g.lineTo(right, bottom - radius);
      g.arc(right - radius, bottom - radius, radius, 0, Math.PI / 2, false);
      g.lineTo(centerX, bottom);
    }
    g.closePath();
  }

  private rgba(color: number, alpha: number): string {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private disposeWashGradients(): void {
    this.homeWash?.destroy();
    this.awayWash?.destroy();
    this.homeWash = null;
    this.awayWash = null;
  }

  dispose(): void {
    this.disposeWashGradients();
  }

  private drawMarkings(pitch: fieldGeometry.PitchRect): void {
    const g = this.graphics;
    g.clear();

    if (pitch.width === 0 || pitch.height === 0) {
      return;
    }

    // Profondeur des buts : le ballon (Ø ≈ 2 % de la hauteur) doit tenir dans le filet
    const goalDepth = Math.max(16, pitch.height * 0.055);

    // Boards : cadre de tribune discret autour du terrain (hors buts et halos)
    const cornerRadius = this.pitchCornerRadius(pitch);
    const framePad = this.boardsFramePad(pitch);
    g.roundRect(
      pitch.x - framePad,
      pitch.y - framePad,
      pitch.width + framePad * 2,
      pitch.height + framePad * 2,
      cornerRadius + 4
    );
    g.stroke({ color: this.LINE_COLOR, width: 1, alpha: this.BOARD_ALPHA });

    // Bordure extérieure (coins arrondis)
    g.roundRect(pitch.x, pitch.y, pitch.width, pitch.height, cornerRadius);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Ligne médiane
    const centerX = pitch.x + pitch.width / 2;
    const centerY = pitch.y + pitch.height / 2;

    g.moveTo(centerX, pitch.y);
    g.lineTo(centerX, pitch.y + pitch.height);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Rond central (double anneau)
    const circleRadius = Math.min(pitch.width, pitch.height) * 0.15;
    g.circle(centerX, centerY, circleRadius);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    g.circle(centerX, centerY, circleRadius * 1.3);
    g.stroke({ color: this.LINE_COLOR, width: 1, alpha: 0.25 });

    // Point central
    g.circle(centerX, centerY, 4);
    g.fill({ color: this.LINE_COLOR });

    // Surfaces (arcs futsal, style handball — les rectangles sont retirés)
    const arcRadius = pitch.height * 0.22;

    // Surface gauche
    g.moveTo(pitch.x, centerY - arcRadius);
    g.arc(pitch.x, centerY, arcRadius, -Math.PI / 2, Math.PI / 2, false);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Surface droite
    g.moveTo(pitch.x + pitch.width, centerY + arcRadius);
    g.arc(pitch.x + pitch.width, centerY, arcRadius, Math.PI / 2, (3 * Math.PI) / 2, false);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Buts (cadre d'équipe, filet et halo — les barres pleines sont retirées)
    const goalHeight = pitch.height * 0.3;
    const goalY = pitch.y + (pitch.height - goalHeight) / 2;

    this.drawGoal(g, pitch.x, goalY, goalDepth, goalHeight, this.GOAL_HOME_COLOR, -1);
    this.drawGoal(g, pitch.x + pitch.width, goalY, goalDepth, goalHeight, this.GOAL_AWAY_COLOR, 1);
  }

  private drawGoal(
    g: Graphics,
    mouthX: number,
    goalY: number,
    depth: number,
    height: number,
    color: number,
    dir: 1 | -1
  ): void {
    // dir: +1 = s'étend vers la droite, -1 = vers la gauche (toujours HORS du terrain)
    const radius = 4;
    const x = dir === 1 ? mouthX : mouthX - depth;

    // Halo discret (lueur sans filtre)
    g.roundRect(x - 4, goalY - 4, depth + 8, height + 8, radius + 3);
    g.stroke({ color, width: 3, alpha: this.GOAL_HALO_ALPHA });

    // Cadre d'équipe
    g.roundRect(x, goalY, depth, height, radius);
    g.fill({ color, alpha: this.GOAL_FILL_ALPHA });
    g.stroke({ color, width: 2.5 });

    // Filet
    for (let i = 1; i <= 2; i++) {
      g.moveTo(x + (depth * i) / 3, goalY + 2);
      g.lineTo(x + (depth * i) / 3, goalY + height - 2);
    }
    for (let ny = goalY + 8; ny <= goalY + height - 8; ny += 8) {
      g.moveTo(x + 2, ny);
      g.lineTo(x + depth - 2, ny);
    }
    g.stroke({ color: this.LINE_COLOR, width: 1, alpha: this.NET_ALPHA });

    // Poteaux (points blancs aux coins de la bouche)
    g.circle(mouthX, goalY, 2.5);
    g.fill({ color: this.LINE_COLOR });
    g.circle(mouthX, goalY + height, 2.5);
    g.fill({ color: this.LINE_COLOR });
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.draw();
    this.layoutWatermark();
  }

  /**
   * Convertit une position en pourcentage (0-100) vers des coordonnées écran
   */
  percentToScreen(x: number, y: number): { x: number; y: number } {
    const pitch = fieldGeometry.computePitchRect(this.width, this.height);
    return fieldGeometry.percentToScreen(pitch, x, y);
  }

  /**
   * Convertit des coordonnées écran vers une position en pourcentage
   */
  screenToPercent(screenX: number, screenY: number): { x: number; y: number } {
    const pitch = fieldGeometry.computePitchRect(this.width, this.height);
    return fieldGeometry.screenToPercent(pitch, screenX, screenY);
  }
}
