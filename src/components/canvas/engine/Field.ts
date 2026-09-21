/**
 * Field - Rendu du terrain de jeu
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import * as fieldGeometry from './fieldGeometry';
import watermarkUrl from '@/assets/watermark.png';

/**
 * Pitch palette (UX spec, "Wild Card" arena — values locked by Epic 5.1,
 * v4 mockup for the La Ronde habillage, story 7.3). Hard law: team/player
 * colors are reserved for players and accents — they never paint the floor
 * beneath them.
 */
export const FIELD_PALETTE = {
  letterbox: 0x111a24,
  pitchBase: 0x1a2634,
  pitchStripeLight: 0x3fae62,
  pitchStripeDark: 0x379c56,
  wallBand: 0x0a140e,
  wallLine: 0xffffff,
  homeHalf: 0xff6b1a,
  awayHalf: 0x1a8cff,
  lines: 0xffffff,
  goalHome: 0xff6b1a,
  goalAway: 0x1a8cff,
} as const;

export class Field {
  public container: Container;
  private background: Graphics;
  private stripes: Graphics;
  private stripesMask: Graphics;
  private watermark: Sprite;
  private graphics: Graphics;
  private width: number;
  private height: number;
  private watermarkLoaded = false;

  // Habillage v4 (story 7.3) — un seul bloc, un seul fichier
  private readonly LETTERBOX_COLOR = FIELD_PALETTE.letterbox;
  private readonly STRIPE_LIGHT_COLOR = FIELD_PALETTE.pitchStripeLight;
  private readonly STRIPE_DARK_COLOR = FIELD_PALETTE.pitchStripeDark;
  private readonly STRIPE_BAND_PX = 78;
  private readonly WALL_BAND_COLOR = FIELD_PALETTE.wallBand;
  private readonly WALL_BAND_ALPHA = 0.16;
  private readonly WALL_BAND_WIDTH = 6;
  private readonly WALL_LINE_COLOR = FIELD_PALETTE.wallLine;
  private readonly WALL_LINE_ALPHA = 0.42;
  private readonly WALL_LINE_WIDTH = 3;
  private readonly MASCOT_CIRCLE_RATIO = 0.8;
  private readonly BOARD_ALPHA = 0.15;
  private readonly LINE_COLOR = FIELD_PALETTE.lines;
  private readonly LINE_WIDTH = 2;
  // Goal frame colors (team accents — recolorable per tactic, story 7.4;
  // the floor NEVER takes team colors)
  private goalHomeColor: number = FIELD_PALETTE.goalHome;
  private goalAwayColor: number = FIELD_PALETTE.goalAway;
  private readonly GOAL_FILL_ALPHA = 0.12;
  private readonly GOAL_HALO_ALPHA = 0.18;
  private readonly NET_ALPHA = 0.22;
  private readonly BOARD_BRAND = 'LACHATADEDE';
  private readonly BOARD_TEXT_ALPHA = 0.16;
  private readonly PITCH_CORNER_RADIUS_RATIO = 0.04;

  private topBoard: Text | null = null;
  private bottomBoard: Text | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.container = new Container();
    this.background = new Graphics();
    this.stripes = new Graphics();
    this.stripesMask = new Graphics();
    this.graphics = new Graphics();
    this.watermark = new Sprite();
    this.watermark.anchor.set(0.5);
    this.watermark.visible = false;
    this.container.addChild(this.background);
    this.container.addChild(this.stripesMask);
    this.container.addChild(this.stripes);
    this.stripes.mask = this.stripesMask;
    this.container.addChild(this.graphics);
    // Blason au-dessus des marquages (mockup : le rond central passe derrière)
    this.container.addChild(this.watermark);
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
    // Blason sans fond : l'image seule, contain-fit dans 80 % du rond central
    const scale =
      (this.watermarkRadius(pitch) * 2) /
      Math.max(this.watermark.texture.width, this.watermark.texture.height);
    this.watermark.scale.set(scale);
    this.watermark.position.set(
      pitch.x + pitch.width / 2,
      pitch.y + pitch.height / 2
    );
  }

  /**
   * Blason central : l'image seule (sans disque), contain-fit dans 80 %
   * du rond central, comme un blason peint au centre d'un vrai terrain.
   */
  private watermarkRadius(pitch: fieldGeometry.PitchRect): number {
    const circleRadius = Math.min(pitch.width, pitch.height) * 0.15;
    return circleRadius * this.MASCOT_CIRCLE_RATIO;
  }

  private draw(): void {
    const g = this.background;
    g.clear();

    const pitch = fieldGeometry.computePitchRect(this.width, this.height);

    // Hors-jeu (letterbox) sur tout le canvas
    g.rect(0, 0, this.width, this.height);
    g.fill({ color: this.LETTERBOX_COLOR });

    this.drawMarkings(pitch);

    if (pitch.width === 0 || pitch.height === 0) {
      return;
    }

    // Base du terrain = bande foncée des rayures (coins arrondis — loi Pelo)
    const cornerRadius = this.pitchCornerRadius(pitch);
    g.roundRect(pitch.x, pitch.y, pitch.width, pitch.height, cornerRadius);
    g.fill({ color: this.STRIPE_DARK_COLOR });

    this.drawStripes(pitch, cornerRadius);
    // Les murs passent dans la couche markings (au-dessus des rayures)
    this.drawWalls(pitch, cornerRadius);

    this.layoutBoardTexts(pitch);
  }

  /**
   * Rayures verticales (mockup .pitch) : bandes claires de 78px en topes
   * égales sur la bande foncée, clippées aux coins arrondis par le mask.
   */
  private drawStripes(pitch: fieldGeometry.PitchRect, radius: number): void {
    const mask = this.stripesMask;
    mask.clear();
    mask.roundRect(pitch.x, pitch.y, pitch.width, pitch.height, radius);
    mask.fill({ color: this.STRIPE_DARK_COLOR });

    const stripes = this.stripes;
    stripes.clear();
    const band = this.STRIPE_BAND_PX;
    for (let x = pitch.x; x < pitch.x + pitch.width; x += band * 2) {
      stripes.rect(x, pitch.y, Math.min(band, pitch.x + pitch.width - x), pitch.height);
      stripes.fill({ color: this.STRIPE_LIGHT_COLOR });
    }
  }

  /**
   * Murs (mockup .walls) : bande sombre + liseré blanc, l'une dans l'autre,
   * le long de toute la bordure du terrain. Dessinés dans la couche
   * markings — les rayures masquées passent dessous.
   */
  private drawWalls(pitch: fieldGeometry.PitchRect, radius: number): void {
    const g = this.graphics;
    const inset = this.WALL_BAND_WIDTH / 2;
    g.roundRect(
      pitch.x + inset,
      pitch.y + inset,
      pitch.width - this.WALL_BAND_WIDTH,
      pitch.height - this.WALL_BAND_WIDTH,
      Math.max(1, radius - inset)
    );
    g.stroke({
      color: this.WALL_BAND_COLOR,
      width: this.WALL_BAND_WIDTH,
      alpha: this.WALL_BAND_ALPHA,
    });

    const lineInset = this.WALL_BAND_WIDTH + this.WALL_LINE_WIDTH / 2;
    g.roundRect(
      pitch.x + lineInset,
      pitch.y + lineInset,
      pitch.width - lineInset * 2,
      pitch.height - lineInset * 2,
      Math.max(1, radius - lineInset)
    );
    g.stroke({
      color: this.WALL_LINE_COLOR,
      width: this.WALL_LINE_WIDTH,
      alpha: this.WALL_LINE_ALPHA,
    });
  }

  private pitchCornerRadius(pitch: fieldGeometry.PitchRect): number {
    return Math.max(8, pitch.height * this.PITCH_CORNER_RADIUS_RATIO);
  }

  /**
   * Cycle de vie (appelé par Game.destroy) — plus de gradients à libérer
   * depuis le 7.3, le hook reste pour l'habillage par équipe (7.4).
   */
  dispose(): void {
    this.stripes.clear();
    this.stripesMask.clear();
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

    // La bordure blanche du mockup est le liseré des murs (drawWalls) —
    // pas de second trait sur le bord du terrain

    // Ligne médiane
    const centerX = pitch.x + pitch.width / 2;
    const centerY = pitch.y + pitch.height / 2;

    g.moveTo(centerX, pitch.y);
    g.lineTo(centerX, pitch.y + pitch.height);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Rond central
    const circleRadius = Math.min(pitch.width, pitch.height) * 0.15;
    g.circle(centerX, centerY, circleRadius);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

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
    // Mouth = engine scoring zone GOAL_Y_MIN..GOAL_Y_MAX (20 of a 50-tall
    // field = 40% of the pitch height, centered): the drawn net must exactly
    // cover the hitbox so only balls visually entering the goal score.
    const goalHeight = pitch.height * 0.4;
    const goalY = pitch.y + (pitch.height - goalHeight) / 2;

    this.drawGoal(g, pitch.x, goalY, goalDepth, goalHeight, this.goalHomeColor, -1);
    this.drawGoal(g, pitch.x + pitch.width, goalY, goalDepth, goalHeight, this.goalAwayColor, 1);
  }

  /**
   * Team customization (story 7.4): recolor the goal frames + accents. A
   * full redraw keeps the walls and markings layered exactly as built —
   * the stripes and letterbox stay neutral (no floor hues).
   */
  setTeamColors(home: number, away: number): void {
    if (home === this.goalHomeColor && away === this.goalAwayColor) return;
    this.goalHomeColor = home;
    this.goalAwayColor = away;
    this.draw();
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
