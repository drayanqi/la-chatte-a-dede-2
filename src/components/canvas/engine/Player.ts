/**
 * PlayerSprite - Représentation visuelle d'un joueur
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Player, Position, PlayerFrameState } from '@/types';
import { computePitchRect, computePlayerRadius, percentToScreen } from './fieldGeometry';

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
  private isHovered: boolean = false;
  private isSelected: boolean = false;
  private radius: number;

  // Colors (Epic 5.1 — Rocket League-style, never the ground tint underneath)
  private readonly HOME_COLOR = 0xff6b1a; // Orange
  private readonly AWAY_COLOR = 0x1a8cff; // Bleu
  private readonly SELECTED_COLOR = 0xfbbf24; // Jaune

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
    this.radius = computePlayerRadius(computePitchRect(screenWidth, screenHeight));

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
      fontSize: Math.max(10, this.radius * 0.7),
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
    this.circle.circle(0, 0, this.radius);
    this.circle.fill({ color });

    // Bordure (plus épaisse si sélectionné)
    this.circle.circle(0, 0, this.radius);
    this.circle.stroke({
      color: selected ? this.SELECTED_COLOR : 0xffffff,
      width: selected ? Math.max(1, this.radius * 0.2) : Math.max(1, this.radius * 0.1),
    });
  }

  private updateScriptIndicator(): void {
    this.scriptIndicator.clear();

    if (this.hasScript) {
      // Petit point vert en haut à droite pour indiquer qu'un script est assigné
      this.scriptIndicator.circle(
        this.radius * 0.7,
        -this.radius * 0.7,
        Math.max(2, this.radius * 0.3)
      );
      this.scriptIndicator.fill({ color: 0x22c55e });
      this.scriptIndicator.stroke({ color: 0xffffff, width: 1 });
    }
  }

  private setupEvents(): void {
    this.container.on('pointerdown', () => {
      this.callbacks.onSelect(this.player.id);
    });

    this.container.on('pointerover', () => {
      this.isHovered = true;
      this.drawCircle(true);
      this.callbacks.onHover(this.player.id, this.player.position);
    });

    this.container.on('pointerout', () => {
      this.isHovered = false;
      this.drawCircle(this.isSelected);
      this.callbacks.onHover(null, null);
    });
  }

  /** Persistent selection: the ring stays until explicitly deselected */
  setSelected(selected: boolean): void {
    this.isSelected = selected;
    this.drawCircle(selected || this.isHovered);
  }

  private updatePosition(): void {
    const pitch = computePitchRect(this.screenWidth, this.screenHeight);
    const pos = percentToScreen(pitch, this.player.position.x, this.player.position.y);
    this.container.x = pos.x;
    this.container.y = pos.y;
  }

  setScript(scriptId: string | null): void {
    this.player.assignedScriptId = scriptId;
    this.hasScript = scriptId !== null;
    this.updateScriptIndicator();
  }

  /**
   * Move the player to a new percent position (drag support). The engine
   * stores the position; the container is repositioned to match.
   */
  setPosition(position: Position): void {
    this.player.position = position;
    this.updatePosition();
  }

  /** Toggle drag visual feedback (cursor) */
  setDragging(dragging: boolean): void {
    this.container.cursor = dragging ? 'grabbing' : 'pointer';
  }

  updateFromState(state: PlayerFrameState): void {
    const pitch = computePitchRect(this.screenWidth, this.screenHeight);
    const pos = percentToScreen(pitch, state.position.x, state.position.y);
    this.container.x = pos.x;
    this.container.y = pos.y;

    // Optionnel: effet visuel basé sur l'état
    // this.container.alpha = state.state === 'idle' ? 0.8 : 1;
  }

  updateScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.radius = computePlayerRadius(computePitchRect(width, height));
    this.numberText.style.fontSize = Math.max(10, this.radius * 0.7);
    this.drawCircle(this.isHovered || this.isSelected);
    this.updateScriptIndicator();
    this.updatePosition();
  }

  containsPoint(screenX: number, screenY: number): boolean {
    const dx = screenX - this.container.x;
    const dy = screenY - this.container.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius;
  }

  getPosition(): Position {
    return this.player.position;
  }

  getScriptId(): string | null {
    return this.player.assignedScriptId;
  }

  getName(): string {
    return this.player.name;
  }

  getTeamId(): 'home' | 'away' {
    return this.player.teamId;
  }

  getNumber(): number {
    return this.player.number;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
