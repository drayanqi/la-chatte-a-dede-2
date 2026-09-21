/**
 * PlayerSprite - Représentation visuelle d'un joueur
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Container, FillGradient, Graphics, Text, TextStyle } from 'pixi.js';
import type { Player, Position, PlayerFrameState } from '@/types';
import { computePitchRect, computePlayerRadius, percentToScreen } from './fieldGeometry';

interface PlayerCallbacks {
  onSelect: (playerId: string) => void;
  onHover: (playerId: string | null, position: Position | null) => void;
}

/**
 * Team colors (UX spec, Rocket League-inspired): home = orange,
 * away = blue. Exported as the single source of truth for the engine,
 * celebrations and tests.
 */
export const PLAYER_HOME_COLOR = 0xff6b1a; // Orange
export const PLAYER_AWAY_COLOR = 0x1a8cff; // Bleu

/**
 * Radial gradients need a 2D canvas to bake their texture — absent in
 * jsdom (unit tests) and some exotic webviews: the stepped translucent
 * fills stand in there.
 */
const CANVAS_2D_SUPPORTED = (() => {
  try {
    return document.createElement('canvas').getContext('2d') !== null;
  } catch {
    return false;
  }
})();

/** Options for replay (non-editable) sprites */
interface PlayerSpriteOptions {
  /** When false the sprite ignores pointer events (replay rendering) */
  interactive?: boolean;
  /**
   * Script tag under the circle (story 7.5): tactic (edit) sprites only —
   * replay frames carry no script names.
   */
  showScriptLabel?: boolean;
}

export class PlayerSprite {
  public container: Container;
  private groundShadow: Graphics;
  private circle: Graphics;
  private numberText: Text;
  private scriptIndicator: Graphics;
  private scriptTag: Text | null = null;

  private player: Player;
  private screenWidth: number;
  private screenHeight: number;
  private callbacks: PlayerCallbacks;
  private hasScript: boolean = false;
  private isHovered: boolean = false;
  private isSelected: boolean = false;
  private radius: number;

  // Colors (Epic 5.1 — Rocket League-style, never the ground tint
  // underneath). Per-instance since story 7.4: team customization recolors
  // each side live (defaults = the UX-spec constants).
  private homeColor: number = PLAYER_HOME_COLOR;
  private awayColor: number = PLAYER_AWAY_COLOR;
  private readonly SELECTED_COLOR = 0xfbbf24; // Jaune

  // Habillage v4 (story 7.3, mockup .player/.pnum)
  private readonly SHADOW_WIDTH_RATIO = 30 / 34;
  private readonly SHADOW_HEIGHT_RATIO = 10 / 34;
  private readonly SHADOW_ALPHA = 0.2;
  private readonly NUMBER_SHADOW_ALPHA = 0.3;
  private readonly STEPPED_HIGHLIGHT_ALPHA = 0.22;
  private readonly STEPPED_SHADE_ALPHA = 0.14;
  private highlightGradient: FillGradient | null = null;
  private shadeGradient: FillGradient | null = null;
  // Script tag state (story 7.5): null = "non assigné" (mockup .ptag.none)
  private showScriptLabel: boolean;
  private scriptLabelText: string | null = null;
  private scriptTagPill: Graphics | null = null;

  constructor(
    player: Player,
    screenWidth: number,
    screenHeight: number,
    callbacks: PlayerCallbacks,
    options: PlayerSpriteOptions = {}
  ) {
    this.player = player;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.callbacks = callbacks;
    this.radius = computePlayerRadius(computePitchRect(screenWidth, screenHeight));

    this.container = new Container();
    this.container.eventMode = options.interactive === false ? 'none' : 'static';
    this.container.cursor = options.interactive === false ? 'default' : 'pointer';
    this.showScriptLabel = options.showScriptLabel === true;

    // Ombre au sol (ellipse floue sous le cercle)
    this.groundShadow = new Graphics();
    this.drawGroundShadow();
    this.container.addChild(this.groundShadow);

    // Gradients d'habillage (espace local normalisé au cercle, v8 radial)
    if (CANVAS_2D_SUPPORTED) {
      this.highlightGradient = new FillGradient({
        type: 'radial',
        center: { x: 0.32, y: 0.26 },
        innerRadius: 0,
        outerCenter: { x: 0.32, y: 0.26 },
        outerRadius: 0.5,
        colorStops: [
          { offset: 0, color: 'rgba(255, 255, 255, 0.38)' },
          { offset: 0.45, color: 'rgba(255, 255, 255, 0)' },
          { offset: 1, color: 'rgba(255, 255, 255, 0)' },
        ],
        textureSpace: 'local',
      });
      this.shadeGradient = new FillGradient({
        type: 'radial',
        center: { x: 0.5, y: 1.35 },
        innerRadius: 0,
        outerCenter: { x: 0.5, y: 1.35 },
        outerRadius: 0.65,
        colorStops: [
          { offset: 0, color: 'rgba(0, 0, 0, 0.25)' },
          { offset: 1, color: 'rgba(0, 0, 0, 0)' },
        ],
        textureSpace: 'local',
      });
    }

    // Cercle du joueur
    this.circle = new Graphics();
    this.drawCircle(false);
    this.container.addChild(this.circle);

    // Numéro du joueur
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: Math.max(10, this.radius * 0.7),
      fontWeight: '800',
      fill: 0xffffff,
      dropShadow: {
        color: 0x000000,
        alpha: this.NUMBER_SHADOW_ALPHA,
        blur: 2,
        distance: 1,
        angle: Math.PI / 2,
      },
    });
    this.numberText = new Text({ text: player.number.toString(), style });
    this.numberText.anchor.set(0.5);
    this.container.addChild(this.numberText);

    // Indicateur de script assigné
    this.scriptIndicator = new Graphics();
    this.container.addChild(this.scriptIndicator);
    this.updateScriptIndicator();

    // Tag du script sous le cercle (story 7.5, mockup .ptag)
    if (this.showScriptLabel) {
      this.scriptTagPill = new Graphics();
      this.scriptTag = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'Arial',
          fontSize: Math.max(8, this.radius * 0.55),
          fontWeight: '600',
          fill: 0xffffff,
          dropShadow: {
            color: 0x000000,
            alpha: 0.35,
            blur: 2,
            distance: 1,
            angle: Math.PI / 2,
          },
        }),
      });
      this.scriptTag.anchor.set(0.5, 0);
      this.container.addChild(this.scriptTagPill);
      this.container.addChild(this.scriptTag);
      this.layoutScriptTag();
    }

    // Positionner
    this.updatePosition();

    // Events
    this.setupEvents();

    // Script initial
    if (player.assignedScriptId) {
      this.setScript(player.assignedScriptId);
    }
  }

  private drawGroundShadow(): void {
    this.groundShadow.clear();
    // Ellipse posée sous le cercle (mockup .player::before)
    this.groundShadow.ellipse(
      0,
      this.radius * 1.05,
      this.radius * this.SHADOW_WIDTH_RATIO,
      this.radius * this.SHADOW_HEIGHT_RATIO
    );
    this.groundShadow.fill({ color: 0x000000, alpha: this.SHADOW_ALPHA });
  }

  private drawCircle(selected: boolean): void {
    this.circle.clear();

    const color = this.player.teamId === 'home' ? this.homeColor : this.awayColor;

    // Cercle principal
    this.circle.circle(0, 0, this.radius);
    this.circle.fill({ color });

    // Lumière en haut à gauche + ombre interne en bas
    // (mockup .pnum radial-gradient + inset 0 -4px 8px), clippées au cercle.
    // Sans canvas 2D (jsdom), substituts translucides en deux pas.
    if (this.highlightGradient && this.shadeGradient) {
      this.circle.circle(0, 0, this.radius);
      this.circle.fill({ fill: this.highlightGradient });
      this.circle.circle(0, 0, this.radius);
      this.circle.fill({ fill: this.shadeGradient });
    } else {
      this.circle.circle(-this.radius * 0.18, -this.radius * 0.24, this.radius * 0.65);
      this.circle.fill({ color: 0xffffff, alpha: this.STEPPED_HIGHLIGHT_ALPHA });
      this.circle.circle(0, this.radius * 0.35, this.radius * 0.85);
      this.circle.fill({ color: 0x000000, alpha: this.STEPPED_SHADE_ALPHA });
    }

    // Bordure (plus épaisse si sélectionné) — comportement de sélection inchangé
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

  /**
   * Team customization (story 7.4): recolor this side live. The fill is
   * redrawn with the current selection/hover ring state.
   */
  setTeamColors(home: number, away: number): void {
    if (home === this.homeColor && away === this.awayColor) return;
    this.homeColor = home;
    this.awayColor = away;
    this.drawCircle(this.isSelected || this.isHovered);
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
   * Script tag (story 7.5): the assigned script's name under the circle;
   * null renders the italic "non assigné" tag (mockup .ptag.none).
   */
  setScriptLabel(label: string | null): void {
    if (!this.showScriptLabel || !this.scriptTag) return;
    if (label === this.scriptLabelText) return;
    this.scriptLabelText = label;
    this.layoutScriptTag();
  }

  /** (Re)draw the tag pill + text for the current label and radius */
  private layoutScriptTag(): void {
    if (!this.scriptTag || !this.scriptTagPill) return;

    const assigned = this.scriptLabelText !== null && this.scriptLabelText !== '';
    const fontSize = Math.max(8, this.radius * 0.55);
    const style = this.scriptTag.style as TextStyle;
    style.fontSize = fontSize;
    style.fontStyle = assigned ? 'normal' : 'italic';

    this.scriptTag.text = assigned ? this.scriptLabelText! : 'non assigné';
    this.scriptTag.alpha = assigned ? 1 : 0.62;
    const tagY = this.radius + fontSize + 3;
    this.scriptTag.position.set(0, tagY);

    // Pill behind the assigned name only (mockup .ptag dark capsule)
    this.scriptTagPill.clear();
    if (assigned) {
      const width = this.scriptTag.width + 14;
      const height = fontSize + 8;
      this.scriptTagPill.roundRect(-width / 2, tagY - 3, width, height, height / 2);
      this.scriptTagPill.fill({ color: 0x0a140e, alpha: 0.55 });
    }
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
    this.drawGroundShadow();
    this.drawCircle(this.isHovered || this.isSelected);
    this.updateScriptIndicator();
    if (this.showScriptLabel) {
      this.layoutScriptTag();
    }
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
    this.highlightGradient?.destroy();
    this.shadeGradient?.destroy();
    this.container.destroy({ children: true });
  }
}
