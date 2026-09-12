/**
 * Game Engine - Moteur principal du Canvas
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Application, Container } from 'pixi.js';
import { Field } from './Field';
import { PlayerSprite } from './Player';
import type { Player, TacticData, Position, PlayerFrameState, SimulationResult } from '@/types';

export interface GameConfig {
  width: number;
  height: number;
  backgroundColor: number;
}

export interface GameCallbacks {
  onPlayerSelected: (playerId: string, teamId: 'home' | 'away', position: Position, scriptId: string | null) => void;
  onPlayerHovered: (playerId: string | null, position: Position | null) => void;
  onFrameChanged: (frame: number, total: number, states: PlayerFrameState[]) => void;
  onSimulationComplete: (result: SimulationResult) => void;
  /** Fired after a script assignment completes (drag & drop onto a player) */
  onScriptAssigned?: (playerId: string, scriptId: string) => void;
}

const DEFAULT_CONFIG: GameConfig = {
  width: 800,
  height: 600,
    backgroundColor: 0x111a24, // Letterbox hors-jeu (Epic 5.1)
};

export class Game {
  private app: Application;
  private field: Field | null = null;
  private players: Map<string, PlayerSprite> = new Map();
  private gameContainer: Container;
  private callbacks: GameCallbacks;
  private isInitialized: boolean = false;

  // État de simulation
  private simulationFrames: PlayerFrameState[][] = [];
  private currentFrame: number = 0;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 1;

  // Pending tactic to load after initialization
  private pendingTactic: TacticData | null = null;

  // Identity of the currently loaded tactic (for getTactic read-back)
  private currentTacticId: string = '';
  private currentTacticName: string = '';

  constructor(callbacks: GameCallbacks, config: Partial<GameConfig> = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    this.callbacks = callbacks;
    this.app = new Application();
    this.gameContainer = new Container();
  }

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      width: DEFAULT_CONFIG.width,
      height: DEFAULT_CONFIG.height,
      backgroundColor: DEFAULT_CONFIG.backgroundColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(this.app.canvas);
    this.app.stage.addChild(this.gameContainer);

    // Create the field
    this.field = new Field(this.app.screen.width, this.app.screen.height);
    this.gameContainer.addChild(this.field.container);

    // Démarrer la game loop
    this.app.ticker.add(this.gameLoop.bind(this));

    // Mark as initialized
    this.isInitialized = true;

    // Load any pending tactic
    if (this.pendingTactic) {
      this.loadTacticInternal(this.pendingTactic);
      this.pendingTactic = null;
    }
  }

  private gameLoop(ticker: { deltaTime: number }): void {
    if (this.isPlaying && this.simulationFrames.length > 0) {
      // Avancer les frames selon la vitesse de lecture
      this.currentFrame += this.playbackSpeed * (ticker.deltaTime / 60);

      if (this.currentFrame >= this.simulationFrames.length) {
        this.currentFrame = this.simulationFrames.length - 1;
        this.isPlaying = false;
      }

      this.applyFrame(Math.floor(this.currentFrame));
    }
  }

  private applyFrame(frameIndex: number): void {
    const frame = this.simulationFrames[frameIndex];
    if (!frame) return;

    for (const state of frame) {
      const player = this.players.get(state.playerId);
      if (player) {
        player.updateFromState(state);
      }
    }

    this.callbacks.onFrameChanged(
      frameIndex,
      this.simulationFrames.length,
      frame
    );
  }

  loadTactic(tactic: TacticData): void {
    if (!this.isInitialized) {
      // Queue the tactic to load after initialization
      this.pendingTactic = tactic;
      return;
    }
    this.loadTacticInternal(tactic);
  }

  private loadTacticInternal(tactic: TacticData): void {
    // Remove the old players
    for (const player of this.players.values()) {
      player.destroy();
    }
    this.players.clear();

    // Remember the tactic identity for read-back
    this.currentTacticId = tactic.id;
    this.currentTacticName = tactic.name;

    // Create the new players
    for (const playerData of tactic.players) {
      const sprite = new PlayerSprite(
        playerData,
        this.app.screen.width,
        this.app.screen.height,
        {
          onSelect: (id) => {
            const p = tactic.players.find(pl => pl.id === id);
            if (p) {
              this.callbacks.onPlayerSelected(id, p.teamId, p.position, p.assignedScriptId);
            }
          },
          onHover: (id, pos) => {
            this.callbacks.onPlayerHovered(id, pos);
          },
        }
      );
      this.players.set(playerData.id, sprite);
      this.gameContainer.addChild(sprite.container);
    }

    // Reset simulation
    this.simulationFrames = [];
    this.currentFrame = 0;
    this.isPlaying = false;
  }

  assignScript(playerId: string, scriptId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.setScript(scriptId);
      this.callbacks.onScriptAssigned?.(playerId, scriptId);
    }
  }

  /**
   * Détacher un script supprimé de tous les joueurs qui le référencent.
   * Silencieux : contrairement à assignScript, ne déclenche pas onScriptAssigned.
   */
  detachScript(scriptId: string): void {
    for (const player of this.players.values()) {
      if (player.getScriptId() === scriptId) {
        player.setScript(null);
      }
    }

    // Suppression avant la fin de l'init moteur : la tactique en attente ne
    // doit pas réinjecter le script supprimé lors du chargement.
    if (this.pendingTactic) {
      this.pendingTactic = {
        ...this.pendingTactic,
        players: this.pendingTactic.players.map((player) =>
          player.assignedScriptId === scriptId ? { ...player, assignedScriptId: null } : player
        ),
      };
    }
  }

  /**
   * Read back the current tactic state (players' positions and assigned
   * scripts) from the engine. Returns null when nothing is loaded.
   */
  getTactic(): TacticData | null {
    if (this.players.size === 0) {
      return null;
    }

    const players: Player[] = [];
    for (const [id, sprite] of this.players) {
      players.push({
        id,
        name: sprite.getName(),
        teamId: sprite.getTeamId(),
        number: sprite.getNumber(),
        position: sprite.getPosition(),
        assignedScriptId: sprite.getScriptId(),
      });
    }

    return {
      id: this.currentTacticId,
      name: this.currentTacticName,
      players,
      ball: { x: 50, y: 50 },
      scripts: {},
    };
  }

  hitTestPlayer(screenX: number, screenY: number): string | null {
    for (const [id, player] of this.players) {
      if (player.containsPoint(screenX, screenY)) {
        return id;
      }
    }
    return null;
  }

  // Contrôles de lecture
  play(): void {
    this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
  }

  step(direction: 'forward' | 'backward'): void {
    this.isPlaying = false;
    if (direction === 'forward' && this.currentFrame < this.simulationFrames.length - 1) {
      this.currentFrame++;
    } else if (direction === 'backward' && this.currentFrame > 0) {
      this.currentFrame--;
    }
    this.applyFrame(this.currentFrame);
  }

  seekFrame(frameIndex: number): void {
    this.currentFrame = Math.max(0, Math.min(frameIndex, this.simulationFrames.length - 1));
    this.applyFrame(this.currentFrame);
  }

  async runSimulation(): Promise<SimulationResult> {
    // TODO: Implémenter la vraie simulation avec les scripts IA
    // Pour l'instant, génère une simulation factice

    const frames: PlayerFrameState[][] = [];
    const totalFrames = 300; // 5 secondes à 60fps

    for (let f = 0; f < totalFrames; f++) {
      const frameStates: PlayerFrameState[] = [];

      for (const [id, player] of this.players) {
        const basePos = player.getPosition();
        // Simple demo movement
        frameStates.push({
          playerId: id,
          position: {
            x: basePos.x + Math.sin(f / 30) * 2,
            y: basePos.y + Math.cos(f / 30) * 2,
          },
          velocity: { vx: 0, vy: 0 },
          state: 'moving',
        });
      }

      frames.push(frameStates);
    }

    this.simulationFrames = frames;
    this.currentFrame = 0;

    const result: SimulationResult = {
      frames,
      duration: totalFrames / 60,
      errors: [],
    };

    this.callbacks.onSimulationComplete(result);
    return result;
  }

  resize(width: number, height: number): void {
    if (!this.isInitialized || !this.app.renderer) {
      return;
    }
    this.app.renderer.resize(width, height);
    this.field?.resize(width, height);

    for (const player of this.players.values()) {
      player.updateScreenSize(width, height);
    }
  }

  destroy(): void {
    try {
      this.field?.dispose();
      // Check if app was properly initialized before destroying
      if (this.app && this.app.renderer) {
        this.app.destroy(true, { children: true });
      }
    } catch (error) {
      console.warn('Error destroying game:', error);
    }
  }
}
