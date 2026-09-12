/**
 * Field - Rendu du terrain de jeu
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Container, Graphics } from 'pixi.js';
import * as fieldGeometry from './fieldGeometry';

export class Field {
  public container: Container;
  private graphics: Graphics;
  private width: number;
  private height: number;

  // Couleurs
  private readonly FIELD_COLOR = 0x2d5a27;
  private readonly LINE_COLOR = 0xffffff;
  private readonly LINE_WIDTH = 2;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    this.draw();
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    const pitch = fieldGeometry.computePitchRect(this.width, this.height);

    // Fond (herbe sur tout le canvas, le letterbox est hors-jeu)
    g.rect(0, 0, this.width, this.height);
    g.fill({ color: this.FIELD_COLOR });

    if (pitch.width === 0 || pitch.height === 0) {
      return;
    }

    // Bordure extérieure
    g.rect(pitch.x, pitch.y, pitch.width, pitch.height);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Ligne médiane
    const centerX = pitch.x + pitch.width / 2;
    const centerY = pitch.y + pitch.height / 2;

    g.moveTo(centerX, pitch.y);
    g.lineTo(centerX, pitch.y + pitch.height);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Cercle central
    const circleRadius = Math.min(pitch.width, pitch.height) * 0.15;
    g.circle(centerX, centerY, circleRadius);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Point central
    g.circle(centerX, centerY, 4);
    g.fill({ color: this.LINE_COLOR });

    // Surfaces de réparation (simplifiées pour 5v5)
    const boxWidth = pitch.width * 0.2;
    const boxHeight = pitch.height * 0.4;
    const boxY = pitch.y + (pitch.height - boxHeight) / 2;

    // Surface gauche
    g.rect(pitch.x, boxY, boxWidth, boxHeight);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Surface droite
    g.rect(pitch.x + pitch.width - boxWidth, boxY, boxWidth, boxHeight);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Buts (lignes de but)
    const goalWidth = 12;
    const goalHeight = pitch.height * 0.3;
    const goalY = pitch.y + (pitch.height - goalHeight) / 2;

    // But gauche
    g.rect(pitch.x - goalWidth, goalY, goalWidth, goalHeight);
    g.fill({ color: this.LINE_COLOR });

    // But droit
    g.rect(pitch.x + pitch.width, goalY, goalWidth, goalHeight);
    g.fill({ color: this.LINE_COLOR });
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.draw();
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
