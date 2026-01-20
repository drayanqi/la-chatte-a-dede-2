/**
 * PlayerSprite - Représentation visuelle d'un joueur
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Player, Position, PlayerFrameState } from '@/types';

interface PlayerCallbacks {
  onSelect: (playerId: string) => void;
  onHover: (playerId: string | null, position: Position | null) => void;
}

export class PlayerSprite {
  public container: Container;
  private circle: Graphics;
  private numberText: Text;
  private scriptIndicator: Graphics;

  private player: Player;
  private screenWidth: number;
  private screenHeight: number;
  private callbacks: PlayerCallbacks;
  private hasScript: boolean = false;

  // Couleurs
  private readonly HOME_COLOR = 0x1e3a8a; // Bleu
  private readonly AWAY_COLOR = 0xdc2626; // Rouge
  private readonly SELECTED_COLOR = 0xfbbf24; // Jaune
  private readonly RADIUS = 20;

  constructor(
    player: Player,
    screenWidth: number,
    screenHeight: number,
    callbacks: PlayerCallbacks
  ) {
    this.player = player;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.callbacks = callbacks;

    this.container = new Container();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    // Cercle du joueur
    this.circle = new Graphics();
    this.drawCircle(false);
    this.container.addChild(this.circle);

    // Numéro du joueur
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    this.numberText = new Text({ text: player.number.toString(), style });
    this.numberText.anchor.set(0.5);
    this.container.addChild(this.numberText);

    // Indicateur de script assigné
    this.scriptIndicator = new Graphics();
    this.container.addChild(this.scriptIndicator);
    this.updateScriptIndicator();

    // Positionner
    this.updatePosition();

    // Events
    this.setupEvents();

    // Script initial
    if (player.assignedScriptId) {
      this.setScript(player.assignedScriptId);
    }
  }

  private drawCircle(selected: boolean): void {
    this.circle.clear();

    const color = this.player.teamId === 'home' ? this.HOME_COLOR : this.AWAY_COLOR;

    // Cercle principal
    this.circle.circle(0, 0, this.RADIUS);
    this.circle.fill({ color });

    // Bordure (plus épaisse si sélectionné)
    this.circle.circle(0, 0, this.RADIUS);
    this.circle.stroke({
      color: selected ? this.SELECTED_COLOR : 0xffffff,
      width: selected ? 4 : 2,
    });
  }

  private updateScriptIndicator(): void {
    this.scriptIndicator.clear();

    if (this.hasScript) {
      // Petit point vert en haut à droite pour indiquer qu'un script est assigné
      this.scriptIndicator.circle(this.RADIUS * 0.7, -this.RADIUS * 0.7, 6);
      this.scriptIndicator.fill({ color: 0x22c55e });
      this.scriptIndicator.stroke({ color: 0xffffff, width: 1 });
    }
  }

  private setupEvents(): void {
    this.container.on('pointerdown', () => {
      this.callbacks.onSelect(this.player.id);
    });

    this.container.on('pointerover', () => {
      this.drawCircle(true);
      this.callbacks.onHover(this.player.id, this.player.position);
    });

    this.container.on('pointerout', () => {
      this.drawCircle(false);
      this.callbacks.onHover(null, null);
    });
  }

  private percentToScreen(x: number, y: number): { x: number; y: number } {
    const padding = 40;
    const fieldWidth = this.screenWidth - padding * 2;
    const fieldHeight = this.screenHeight - padding * 2;

    return {
      x: padding + (x / 100) * fieldWidth,
      y: padding + (y / 100) * fieldHeight,
    };
  }

  private updatePosition(): void {
    const pos = this.percentToScreen(this.player.position.x, this.player.position.y);
    this.container.x = pos.x;
    this.container.y = pos.y;
  }

  setScript(scriptId: string | null): void {
    this.player.assignedScriptId = scriptId;
    this.hasScript = scriptId !== null;
    this.updateScriptIndicator();
  }

  updateFromState(state: PlayerFrameState): void {
    const pos = this.percentToScreen(state.position.x, state.position.y);
    this.container.x = pos.x;
    this.container.y = pos.y;

    // Optionnel: effet visuel basé sur l'état
    // this.container.alpha = state.state === 'idle' ? 0.8 : 1;
  }

  updateScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.updatePosition();
  }

  containsPoint(screenX: number, screenY: number): boolean {
    const dx = screenX - this.container.x;
    const dy = screenY - this.container.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.RADIUS;
  }

  getPosition(): Position {
    return this.player.position;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
