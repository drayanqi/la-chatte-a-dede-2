/**
 * Field - Rendu du terrain de jeu
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Container, Graphics } from 'pixi.js';

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

    const padding = 40;
    const fieldWidth = this.width - padding * 2;
    const fieldHeight = this.height - padding * 2;

    // Fond du terrain
    g.rect(padding, padding, fieldWidth, fieldHeight);
    g.fill({ color: this.FIELD_COLOR });

    // Bordure extérieure
    g.rect(padding, padding, fieldWidth, fieldHeight);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Ligne médiane
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    g.moveTo(centerX, padding);
    g.lineTo(centerX, this.height - padding);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Cercle central
    const circleRadius = Math.min(fieldWidth, fieldHeight) * 0.15;
    g.circle(centerX, centerY, circleRadius);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Point central
    g.circle(centerX, centerY, 4);
    g.fill({ color: this.LINE_COLOR });

    // Surfaces de réparation (simplifiées pour 5v5)
    const boxWidth = fieldWidth * 0.2;
    const boxHeight = fieldHeight * 0.4;
    const boxY = (this.height - boxHeight) / 2;

    // Surface gauche
    g.rect(padding, boxY, boxWidth, boxHeight);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Surface droite
    g.rect(this.width - padding - boxWidth, boxY, boxWidth, boxHeight);
    g.stroke({ color: this.LINE_COLOR, width: this.LINE_WIDTH });

    // Buts (lignes de but)
    const goalWidth = 8;
    const goalHeight = fieldHeight * 0.2;
    const goalY = (this.height - goalHeight) / 2;

    // But gauche
    g.rect(padding - goalWidth, goalY, goalWidth, goalHeight);
    g.fill({ color: this.LINE_COLOR });

    // But droit
    g.rect(this.width - padding, goalY, goalWidth, goalHeight);
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
    const padding = 40;
    const fieldWidth = this.width - padding * 2;
    const fieldHeight = this.height - padding * 2;

    return {
      x: padding + (x / 100) * fieldWidth,
      y: padding + (y / 100) * fieldHeight,
    };
  }

  /**
   * Convertit des coordonnées écran vers une position en pourcentage
   */
  screenToPercent(screenX: number, screenY: number): { x: number; y: number } {
    const padding = 40;
    const fieldWidth = this.width - padding * 2;
    const fieldHeight = this.height - padding * 2;

    return {
      x: ((screenX - padding) / fieldWidth) * 100,
      y: ((screenY - padding) / fieldHeight) * 100,
    };
  }
}
