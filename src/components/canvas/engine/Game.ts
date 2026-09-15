/**
 * Game Engine - Moteur principal du Canvas
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 */

import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js';
import { Field } from './Field';
import { PlayerSprite, PLAYER_HOME_COLOR, PLAYER_AWAY_COLOR } from './Player';
import { BallSprite } from './Ball';
import { computePitchRect, screenToPercent } from './fieldGeometry';
import { teamIdFromMatchTeam, matchPlayerKey } from '@/lib/teamMapping';
import { normalizeMatchFrames } from '@/lib/matchFrames';
import type {
  Player,
  TacticData,
  Position,
  PlayerFrameState,
  SimulationResult,
  MatchFrame,
  MatchFrameEvent,
  TeamId,
} from '@/types';

export interface GameConfig {
  width: number;
  height: number;
  backgroundColor: number;
}

export interface GameCallbacks {
  onPlayerSelected: (playerId: string, teamId: 'home' | 'away', position: Position, scriptId: string | null) => void;
  onPlayerHovered: (playerId: string | null, position: Position | null) => void;
  /** Fired for every applied frame; `playing` mirrors the engine playback state */
  onFrameChanged: (
    frame: number,
    total: number,
    states: PlayerFrameState[],
    ball: Position,
    playing: boolean
  ) => void;
  onSimulationComplete: (result: SimulationResult) => void;
  /** Fired when a frame carries a goal event (celebration + score update) */
  onGoalScored?: (team: TeamId, scorerSlot: number) => void;
  /** Fired after a script assignment completes (drag & drop onto a player) */
  onScriptAssigned?: (playerId: string, scriptId: string) => void;
  /** Fired when a player drag-move completes (pointerup ends the move) */
  onPlayerMoved?: (playerId: string, position: Position) => void;
  /** Fired when the selection is cleared by clicking empty pitch */
  onPlayerDeselected?: () => void;
}

const DEFAULT_CONFIG: GameConfig = {
  width: 800,
  height: 600,
    backgroundColor: 0x111a24, // Off-field letterbox (Epic 5.1)
};

export class Game {
  private app: Application;
  private field: Field | null = null;
  private players: Map<string, PlayerSprite> = new Map();
  private ballSprite: BallSprite | null = null;
  private gameContainer: Container;
  private celebrationLayer: Container;
  private flashOverlay: Graphics;
  private confettiContainer: Container;
  private callbacks: GameCallbacks;
  private isInitialized: boolean = false;

  // État de lecture — driven by the loaded match frames (story 3.7)
  private matchFrames: MatchFrame[] = [];
  private currentFrame: number = 0;
  private isPlaying: boolean = false;
  private playbackSpeed: number = 1;

  // Frames queued before initialization completes
  private pendingTactic: TacticData | null = null;
  private pendingFrames: MatchFrame[] | null = null;

  // Goal celebration — last frame whose goal already fired (dedup)
  private lastCelebratedFrame: number = -1;
  private celebrationElapsed: number = 0;
  private celebrationActive: boolean = false;
  private confettiParticles: { graphic: Graphics; vx: number; vy: number; spin: number }[] = [];

  // Goal celebration tuning
  private readonly GOAL_FLASH_TICKS = 18; // ~300ms at 60fps
  private readonly GOAL_FLASH_MAX_ALPHA = 0.85;
  private readonly CONFETTI_PARTICLES = 40; // UX spec: 30-50
  private readonly CONFETTI_GOLD = 0xffd700;
  private readonly CONFETTI_LIFETIME_TICKS = 90; // ~1.5s
  private readonly CONFETTI_FADE_TICKS = 27; // last 30% of life
  private readonly CONFETTI_GRAVITY = 0.12;

  // Identity of the currently loaded tactic (for getTactic read-back)
  private currentTacticId: string = '';
  private currentTacticName: string = '';

  // Active player drag (pointerdown selects, pointermove moves, pointerup commits)
  private draggingPlayerId: string | null = null;
  private dragStartPosition: Position | null = null;
  private dragMoved: boolean = false;

  // Persistently selected player (mirrors canvasStore.selectedPlayerId)
  private selectedPlayerId: string | null = null;

  constructor(callbacks: GameCallbacks, config: Partial<GameConfig> = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    this.callbacks = callbacks;
    this.app = new Application();
    this.gameContainer = new Container();
    this.celebrationLayer = new Container();
    this.celebrationLayer.eventMode = 'none';
    this.flashOverlay = new Graphics();
    this.flashOverlay.eventMode = 'none';
    this.confettiContainer = new Container();
    this.confettiContainer.eventMode = 'none';
    this.celebrationLayer.addChild(this.flashOverlay);
    this.celebrationLayer.addChild(this.confettiContainer);
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

    // Stage-level pointer tracking for player drag-moves (auto-save on move end)
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', this.onStagePointerDown);
    this.app.stage.on('pointermove', this.onStagePointerMove);
    this.app.stage.on('pointerup', this.onStagePointerUp);
    this.app.stage.on('pointerupoutside', this.onStagePointerUp);

    // Create the field
    this.field = new Field(this.app.screen.width, this.app.screen.height);
    this.gameContainer.addChild(this.field.container);

    // Démarrer la game loop
    this.app.ticker.add(this.gameLoop.bind(this));

    // Mark as initialized
    this.isInitialized = true;

    // Celebration layer sits on top of everything (re-asserted on restack)
    this.gameContainer.addChild(this.celebrationLayer);

    // Load the pending data (last-request-wins: only one queue can be set)
    if (this.pendingTactic) {
      this.loadTacticInternal(this.pendingTactic);
      this.pendingTactic = null;
    }
    if (this.pendingFrames) {
      this.loadFramesInternal(this.pendingFrames);
      this.pendingFrames = null;
    }
  }

  private gameLoop(ticker: { deltaTime: number; deltaMS: number }): void {
    if (this.celebrationActive) {
      this.updateCelebration(ticker.deltaTime);
    }

    if (this.isPlaying && this.matchFrames.length > 0) {
      // Time-based advance (story 3.8): deltaMS/1000 seconds × 60 fps.
      // Never assume the ticker runs at exactly 60fps — a slower or faster
      // render rate must not change the playback speed.
      this.currentFrame += this.playbackSpeed * ((ticker.deltaMS / 1000) * 60);

      if (this.currentFrame >= this.matchFrames.length) {
        // Loop off: stop at the last frame; the final score stays on screen
        this.currentFrame = this.matchFrames.length - 1;
        this.isPlaying = false;
      }

      this.applyFrame(Math.floor(this.currentFrame));
    }
  }

  /**
   * Push one loaded match frame onto the sprites: O(10) player updates plus
   * the ball for the < 16ms seek budget (interface-contract.md). Emits the
   * onFrameChanged contract (with ball) — the states are fresh snapshots so
   * consumers (React stores) may retain them safely.
   */
  private applyFrame(frameIndex: number): void {
    const frame = this.matchFrames[frameIndex];
    if (!frame) return;

    const states: PlayerFrameState[] = [];
    for (const framePlayer of frame.players) {
      const key = matchPlayerKey(framePlayer.team, framePlayer.slot);
      const sprite = this.players.get(key);
      if (sprite) {
        const state: PlayerFrameState = {
          playerId: key,
          position: { x: framePlayer.x, y: framePlayer.y },
          velocity: { vx: 0, vy: 0 },
          state: framePlayer.state,
        };
        sprite.updateFromState(state);
        states.push(state);
      }
    }

    this.ballSprite?.updateFromFrame(frame.ball);

    this.handleFrameEvents(frameIndex, frame.events);

    this.callbacks.onFrameChanged(
      frameIndex,
      this.matchFrames.length,
      states,
      frame.ball,
      this.isPlaying
    );
  }

  /**
   * Fire the goal events of one frame: onGoalScored for EVERY goal event
   * (the score counts them all), celebration visuals once per frame —
   * deduped across re-applies (playback loop, step, seek).
   */
  private handleFrameEvents(frameIndex: number, events: MatchFrameEvent[]): void {
    const isFirstApply = frameIndex !== this.lastCelebratedFrame;
    for (const event of events) {
      if (event.type !== 'goal') continue;
      const teamId = teamIdFromMatchTeam(event.team);
      if (isFirstApply) {
        this.triggerCelebration(teamId);
      }
      this.callbacks.onGoalScored?.(teamId, event.scorerSlot);
    }
    if (isFirstApply) {
      this.lastCelebratedFrame = frameIndex;
    }
  }

  // ==========================================================================
  // Goal celebration (story 3.7, Task 5): white flash + team-colored confetti
  // Runs on its own ticker lifecycle — nothing is allocated per frame.
  // ==========================================================================

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private triggerCelebration(teamId: TeamId): void {
    // prefers-reduced-motion: visuals skipped entirely, score still updates
    if (this.prefersReducedMotion()) return;

    this.celebrationActive = true;
    this.celebrationElapsed = 0;

    // White flash overlay (pulses over ~300ms in updateCelebration).
    // The fill alpha stays 1 — the pulse rides on the container alpha
    // (updateCelebration); a 0 fill alpha would bake transparency into the
    // geometry and the pulse would multiply it into invisibility.
    const screen = this.app.screen;
    this.flashOverlay.clear();
    this.flashOverlay.rect(0, 0, screen.width, screen.height);
    this.flashOverlay.fill({ color: 0xffffff, alpha: 1 });

    // Confetti burst: team color of the scorer + gold (UX Celebration Colors)
    const teamColor = teamId === 'home' ? PLAYER_HOME_COLOR : PLAYER_AWAY_COLOR;
    const centerX = screen.width / 2;
    const centerY = screen.height / 3;

    for (let i = 0; i < this.CONFETTI_PARTICLES; i++) {
      const graphic = new Graphics();
      const size = 3 + Math.random() * 3;
      graphic.rect(-size / 2, -size / 2, size, size);
      const color = Math.random() < 0.6 ? teamColor : this.CONFETTI_GOLD;
      graphic.fill({ color });

      // Upward fan burst around the top-center of the pitch
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.9);
      const speed = 3 + Math.random() * 5;

      graphic.x = centerX + (Math.random() - 0.5) * screen.width * 0.3;
      graphic.y = centerY;
      this.confettiParticles.push({
        graphic,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 0.3,
      });
      this.confettiContainer.addChild(graphic);
    }
  }

  private updateCelebration(deltaTime: number): void {
    this.celebrationElapsed += deltaTime;

    // Flash pulse: quick rise, quick fall over ~300ms
    const flashT = Math.min(1, this.celebrationElapsed / this.GOAL_FLASH_TICKS);
    this.flashOverlay.alpha = Math.sin(flashT * Math.PI) * this.GOAL_FLASH_MAX_ALPHA;

    // Confetti physics: gravity + fade over ~1.5s
    const fadeStart = this.CONFETTI_LIFETIME_TICKS - this.CONFETTI_FADE_TICKS;
    const fadeT = Math.max(
      0,
      Math.min(1, (this.celebrationElapsed - fadeStart) / this.CONFETTI_FADE_TICKS)
    );
    this.confettiContainer.alpha = 1 - fadeT;

    for (const particle of this.confettiParticles) {
      particle.vy += this.CONFETTI_GRAVITY;
      particle.graphic.x += particle.vx;
      particle.graphic.y += particle.vy;
      particle.graphic.rotation += particle.spin;
    }

    if (this.celebrationElapsed >= this.CONFETTI_LIFETIME_TICKS) {
      this.resetCelebration();
    }
  }

  private resetCelebration(): void {
    this.celebrationActive = false;
    this.celebrationElapsed = 0;
    this.flashOverlay.clear();
    this.flashOverlay.alpha = 1;
    this.confettiContainer.alpha = 1;
    this.confettiContainer.removeChildren().forEach((child) => child.destroy());
    this.confettiParticles = [];
  }

  loadTactic(tactic: TacticData): void {
    if (!this.isInitialized) {
      // Queue the tactic to load after initialization. Last-request-wins:
      // frames queued earlier are dropped in favor of the tactic.
      this.pendingTactic = tactic;
      this.pendingFrames = null;
      return;
    }
    this.loadTacticInternal(tactic);
  }

  /**
   * Load match replay frames (story 3.7). Creates the 10 match player
   * sprites + the ball, resets playback, and renders frame 0. Guarded by
   * the pendingFrames queue like loadTactic (deferred-work pattern).
   */
  loadFrames(frames: MatchFrame[]): void {
    // Engine frames carry y in field units (0-50); the canvas renders
    // percent coords. Normalize once here so every consumer (sprites,
    // timeline callbacks, debug panel) sees pitch percents.
    const normalized = normalizeMatchFrames(frames);
    if (!this.isInitialized) {
      // Queue the frames to load after initialization. Last-request-wins:
      // a tactic queued earlier is dropped in favor of the frames.
      this.pendingFrames = normalized;
      this.pendingTactic = null;
      return;
    }
    this.loadFramesInternal(normalized);
  }

  private loadFramesInternal(frames: MatchFrame[]): void {
    const firstFrame: MatchFrame | undefined = frames[0];
    if (!firstFrame) return;

    // Validate the payload shape once at load — frames arrive from the API
    // or the test hook. A malformed payload must not tear the engine down
    // mid-load nor crash the score derivation during a React render.
    for (const frame of frames) {
      if (
        !Array.isArray(frame.players) ||
        frame.players.length === 0 ||
        !frame.ball ||
        !Array.isArray(frame.events)
      ) {
        console.warn('Game.loadFrames: malformed frame payload ignored');
        return;
      }
    }

    // Drop the editing tactic sprites: the replay owns the pitch now
    this.destroyAllPlayerSprites();
    this.createMatchPlayers(firstFrame);
    this.ensureBallSprite();
    this.ballSprite?.setVisible(true);
    this.restackLayers();

    this.matchFrames = frames;
    this.lastCelebratedFrame = -1;
    this.resetCelebration();
    this.currentFrame = 0;
    // Autoplay (story 3.8, AC #1): playback starts from frame 0 immediately.
    // Loop off — gameLoop clamps at the last frame and stops there.
    this.isPlaying = true;

    this.applyFrame(0);
  }

  /** Create the 10 replay sprites (5 challenger + 5 opponent) + scratch states */
  private createMatchPlayers(firstFrame: MatchFrame): void {
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    for (const framePlayer of firstFrame.players) {
      const key = matchPlayerKey(framePlayer.team, framePlayer.slot);
      const sprite = new PlayerSprite(
        {
          id: key,
          name: `Slot ${framePlayer.slot}`,
          teamId: teamIdFromMatchTeam(framePlayer.team),
          number: framePlayer.slot,
          position: { x: framePlayer.x, y: framePlayer.y },
          assignedScriptId: null,
        },
        screenWidth,
        screenHeight,
        // Replay sprites are non-editable: no selection, no hover, no drag
        { onSelect: () => {}, onHover: () => {} },
        { interactive: false }
      );
      this.players.set(key, sprite);
      this.gameContainer.addChild(sprite.container);
    }
  }

  private ensureBallSprite(): void {
    if (!this.ballSprite) {
      this.ballSprite = new BallSprite(this.app.screen.width, this.app.screen.height);
      this.ballSprite.setVisible(false);
    }
  }

  /** Destroy every player sprite (tactic or match) */
  private destroyAllPlayerSprites(): void {
    for (const player of this.players.values()) {
      player.destroy();
    }
    this.players.clear();

    // A destroyed drag target must not leave a stale drag session behind
    this.draggingPlayerId = null;
    this.dragStartPosition = null;
    this.dragMoved = false;

    // A destroyed selection must not leave a stale ring behind
    this.selectedPlayerId = null;
  }

  /**
   * Re-assert z-order: field at the bottom, players above it, ball above the
   * players (clearly distinguishable), celebration layer on top.
   */
  private restackLayers(): void {
    if (this.field) {
      this.gameContainer.addChild(this.field.container);
    }
    for (const sprite of this.players.values()) {
      this.gameContainer.addChild(sprite.container);
    }
    if (this.ballSprite) {
      this.gameContainer.addChild(this.ballSprite.container);
    }
    this.gameContainer.addChild(this.celebrationLayer);
  }

  private loadTacticInternal(tactic: TacticData): void {
    // Remove the old players (tactic OR match sprites)
    this.destroyAllPlayerSprites();

    // The replay is over: hide the ball and drop the loaded frames
    this.ballSprite?.setVisible(false);
    this.matchFrames = [];
    this.lastCelebratedFrame = -1;
    this.resetCelebration();

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
            // Pointerdown on a player starts a drag-move (AC #3)
            this.draggingPlayerId = id;
            this.dragStartPosition = { ...this.players.get(id)!.getPosition() };
            this.dragMoved = false;
            this.players.get(id)?.setDragging(true);

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

    // Reset playback
    this.currentFrame = 0;
    this.isPlaying = false;
    this.restackLayers();
  }

  /**
   * Clicking empty pitch clears the selection. A pointerdown on a player
   * bubbles here too — the hit-test keeps that click selection-only.
   */
  private onStagePointerDown = (event: FederatedPointerEvent): void => {
    if (this.selectedPlayerId === null) return;

    if (this.hitTestPlayer(event.global.x, event.global.y) === null) {
      this.setSelectedPlayer(null);
      this.callbacks.onPlayerDeselected?.();
    }
  };

  /** Track a drag in progress: move the player in percent coordinates, clamped to its half */
  private onStagePointerMove = (event: FederatedPointerEvent): void => {
    if (!this.draggingPlayerId) return;
    const player = this.players.get(this.draggingPlayerId);
    if (!player) {
      this.draggingPlayerId = null;
      return;
    }

    const pitch = computePitchRect(this.app.screen.width, this.app.screen.height);
    const percent = screenToPercent(pitch, event.global.x, event.global.y);

    // Home players hold the left half (kickoff invariant), y spans full height
    const maxX = player.getTeamId() === 'home' ? 50 : 100;
    const clamped: Position = {
      x: Math.max(0, Math.min(maxX, percent.x)),
      y: Math.max(0, Math.min(100, percent.y)),
    };

    const previous = player.getPosition();
    if (clamped.x !== previous.x || clamped.y !== previous.y) {
      player.setPosition(clamped);
      this.dragMoved = true;
    }
  };

  /** A move ends on pointerup: fire the move-end event so the edit auto-saves */
  private onStagePointerUp = (): void => {
    if (!this.draggingPlayerId) return;

    const playerId = this.draggingPlayerId;
    const player = this.players.get(playerId);
    const moved = this.dragMoved;
    const startedAt = this.dragStartPosition;

    this.draggingPlayerId = null;
    this.dragStartPosition = null;
    this.dragMoved = false;
    player?.setDragging(false);

    // A click without movement is a selection, not a move — no auto-save
    if (player && moved && startedAt) {
      this.callbacks.onPlayerMoved?.(playerId, player.getPosition());
    }
  };

  assignScript(playerId: string, scriptId: string): void {
    // Replay mode: the pitch is read-only. A script drop here must not
    // mutate the replay sprites — onScriptAssigned would auto-save replay
    // positions onto the active tactic.
    if (this.matchFrames.length > 0) return;
    const player = this.players.get(playerId);
    if (player) {
      player.setScript(scriptId);
      this.callbacks.onScriptAssigned?.(playerId, scriptId);
    }
  }

  /**
   * Mirror the persistent selection (canvasStore.selectedPlayerId) onto the
   * sprites: exactly the selected player keeps its ring.
   */
  setSelectedPlayer(playerId: string | null): void {
    this.selectedPlayerId = playerId;
    for (const [id, sprite] of this.players) {
      sprite.setSelected(id === playerId);
    }
  }

  /**
   * Detach a deleted script from every player referencing it.
   * Silent: unlike assignScript, it does not fire onScriptAssigned.
   */
  detachScript(scriptId: string): void {
    for (const player of this.players.values()) {
      if (player.getScriptId() === scriptId) {
        player.setScript(null);
      }
    }

    // Deletion before engine init finished: the pending tactic must not
    // re-inject the deleted script when it loads.
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
    // Play at the end of playback restarts from frame 0 (rewatch without
    // reload) — loop-off leaves currentFrame clamped at the last frame
    if (this.matchFrames.length > 0 && this.currentFrame >= this.matchFrames.length - 1) {
      this.currentFrame = 0;
    }
    this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
  }

  step(direction: 'forward' | 'backward'): void {
    this.isPlaying = false;
    if (this.matchFrames.length === 0) return;
    // Time-based playback (story 3.8) leaves currentFrame fractional when
    // paused (e.g. 149.6): floor FIRST, or the +/-1 lands on a fractional
    // index that applyFrame cannot resolve (no sprite update, no emit)
    this.currentFrame = Math.floor(this.currentFrame);
    if (direction === 'forward' && this.currentFrame < this.matchFrames.length - 1) {
      this.currentFrame++;
    } else if (direction === 'backward' && this.currentFrame > 0) {
      this.currentFrame--;
    }
    this.applyFrame(this.currentFrame);
  }

  seekFrame(frameIndex: number): void {
    if (this.matchFrames.length === 0) return;
    this.currentFrame = Math.max(0, Math.min(frameIndex, this.matchFrames.length - 1));
    this.applyFrame(this.currentFrame);
  }

  /**
   * Deprecated canned simulation (story ≤ 3.6, retired in 3.8): playback is
   * frame-driven via loadFrames(). Kept as a no-op so the public
   * TacticsCanvasHandle API stays stable — returns an empty result without
   * touching sprites or playback, and never fires onSimulationComplete.
   *
   * @deprecated Feed match frames via loadFrames() instead.
   */
  async runSimulation(): Promise<SimulationResult> {
    console.warn('Game.runSimulation is deprecated: feed match frames via loadFrames() instead.');
    return { frames: [], duration: 0, errors: [] };
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

    this.ballSprite?.updateScreenSize(width, height);

    // Mid-celebration: re-fit the flash to the resized screen. The pulse
    // rides on the container alpha — only the geometry needs a refresh.
    if (this.celebrationActive) {
      this.flashOverlay.clear();
      this.flashOverlay.rect(0, 0, width, height);
      this.flashOverlay.fill({ color: 0xffffff, alpha: 1 });
    }
  }

  /**
   * Sprite census for test hooks: how many match players exist and whether
   * the ball sprite is visible. Cheap introspection, no rendering cost.
   */
  getMatchSpriteInfo(): { players: number; ballVisible: boolean } {
    return {
      players: this.players.size,
      ballVisible: this.ballSprite?.container.visible ?? false,
    };
  }

  destroy(): void {
    try {
      this.resetCelebration();
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
