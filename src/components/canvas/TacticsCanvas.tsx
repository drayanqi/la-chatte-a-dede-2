/**
 * TacticsCanvas - Wrapper React pour le moteur PixiJS
 * PROPRIÉTAIRE: Cloud Dragonborn (Game Architect)
 *
 * Ce composant encapsule le moteur de jeu PixiJS dans React.
 * React gère le lifecycle, PixiJS gère le rendu.
 */

import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Game } from './engine';
import { PLAYER_HOME_COLOR, PLAYER_AWAY_COLOR } from './engine/Player';
import { hexToTeamColor } from '@/lib/teamColors';
import type {
  TacticData,
  Position,
  PlayerFrameState,
  SimulationResult,
  MatchFrame,
  TeamId,
} from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TacticsCanvasProps {
  /** Callback quand un joueur est sélectionné */
  onPlayerSelected?: (
    playerId: string,
    teamId: 'home' | 'away',
    position: Position,
    scriptId: string | null
  ) => void;

  /** Callback quand un joueur est survolé */
  onPlayerHovered?: (playerId: string | null, position: Position | null) => void;

  /** Callback quand la frame change pendant le replay */
  onFrameChanged?: (
    currentFrame: number,
    totalFrames: number,
    states: PlayerFrameState[],
    ball: Position,
    playing: boolean
  ) => void;

  /** Callback quand un but est marqué dans les frames chargées */
  onGoalScored?: (team: TeamId, scorerSlot: number) => void;

  /** Callback quand la simulation est terminée */
  onSimulationComplete?: (result: SimulationResult) => void;

  /** Callback after a script is actually assigned in the engine */
  onScriptAssigned?: (playerId: string, scriptId: string) => void;

  /** Callback when a player drag-move completes (auto-save trigger) */
  onPlayerMoved?: (playerId: string, position: Position) => void;

  /** Callback when a drag session's first movement occurs (story 7.5) */
  onPlayerDragStart?: () => void;

  /** Callback when the selection is cleared by clicking empty pitch */
  onPlayerDeselected?: () => void;
}

export interface TacticsCanvasHandle {
  /** Charger une tactique */
  loadTactic: (tactic: TacticData) => void;

  /** Charger des frames de replay (story 3.7) */
  loadFrames: (frames: MatchFrame[]) => void;

  /** Assigner un script à un joueur */
  assignScript: (playerId: string, scriptId: string) => void;

  /** Detach a deleted script from every player referencing it */
  detachScript: (scriptId: string) => void;

  /** Lancer la simulation */
  runSimulation: () => Promise<SimulationResult>;

  /** Aller à une frame spécifique */
  seekFrame: (frameIndex: number) => void;

  /** Lecture */
  play: () => void;

  /** Pause */
  pause: () => void;

  /** Avancer/reculer d'une frame */
  step: (direction: 'forward' | 'backward') => void;

  /** Tester si un joueur est sous les coordonnées données */
  hitTestPlayer: (screenX: number, screenY: number) => string | null;

  /** Read the tactic's current state (positions + assigned scripts) */
  getTactic: () => TacticData | null;

  /** Mirror the persistent selection onto the sprites (null clears it) */
  setSelectedPlayer: (playerId: string | null) => void;

  /**
   * Team customization (story 7.4): recolor both sides live. Hex strings
   * from the API (#rrggbb); undefined falls back to the UX constants.
   */
  setTeamColors: (homeHex: string | undefined, awayHex: string | undefined) => void;

  /** Script tags under edit-mode players (story 7.5): playerId -> name | null */
  setScriptLabels: (labels: Record<string, string | null>) => void;

  /** Remove the script of ONE player via the picker (story 7.5) */
  detachPlayerScript: (playerId: string) => void;
}

// ============================================================================
// COMPOSANT
// ============================================================================

export const TacticsCanvas = forwardRef<TacticsCanvasHandle, TacticsCanvasProps>(
    (
        {
          onPlayerSelected,
          onPlayerHovered,
          onFrameChanged,
          onGoalScored,
          onSimulationComplete,
          onScriptAssigned,
          onPlayerMoved,
          onPlayerDragStart,
          onPlayerDeselected,
        },
      ref
    ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Game | null>(null);

    // Sprite census for E2E tests: the canvas DOM carries what the engine
    // actually built (10 players + visible ball). Republished after init so
    // a loadFrames call that queued behind initialization stays accurate.
    const publishMatchCensus = useCallback(() => {
      const info = gameRef.current?.getMatchSpriteInfo();
      if (containerRef.current && info) {
        containerRef.current.setAttribute('data-match-players', String(info.players));
        containerRef.current.setAttribute('data-match-ball', String(info.ballVisible));
      }
    }, []);

    // Initialisation du moteur
    useEffect(() => {
      if (!containerRef.current) return;

      let isCleanedUp = false;
      let resizeObserver: ResizeObserver | null = null;

      const game = new Game({
        onPlayerSelected: (id, team, pos, script) => {
          onPlayerSelected?.(id, team, pos, script);
        },
        onPlayerHovered: (id, pos) => {
          onPlayerHovered?.(id, pos);
        },
        onFrameChanged: (frame, total, states, ball, playing) => {
          onFrameChanged?.(frame, total, states, ball, playing);
        },
        onGoalScored: (team, scorerSlot) => {
          onGoalScored?.(team, scorerSlot);
        },
        onSimulationComplete: (result) => {
          onSimulationComplete?.(result);
        },
        onScriptAssigned: (playerId, scriptId) => {
          onScriptAssigned?.(playerId, scriptId);
        },
        onPlayerMoved: (playerId, position) => {
          onPlayerMoved?.(playerId, position);
        },
        onPlayerDragStart: () => {
          onPlayerDragStart?.();
        },
        onPlayerDeselected: () => {
          onPlayerDeselected?.();
        },
      });

      gameRef.current = game;

      // Initialize async but handle cleanup race condition
      game.init(containerRef.current!).then(() => {
        if (isCleanedUp) {
          // Component was unmounted before init completed
          game.destroy();
          return;
        }

        // Frames queued before init completed were flushed inside init —
        // republish the census so the DOM reflects what was actually built
        publishMatchCensus();

        // Setup resize observer after successful init
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            game.resize(width, height);
          }
        });

        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }
      }).catch((error) => {
        console.error('Failed to initialize game:', error);
      });

      return () => {
        isCleanedUp = true;
        resizeObserver?.disconnect();
        game.destroy();
        gameRef.current = null;
      };
    }, [publishMatchCensus]);

    // Exposer l'API impérative
    useImperativeHandle(ref, () => ({
      loadTactic: (tactic: TacticData) => {
        gameRef.current?.loadTactic(tactic);
        publishMatchCensus();
      },
      loadFrames: (frames: MatchFrame[]) => {
        gameRef.current?.loadFrames(frames);
        publishMatchCensus();
      },
      assignScript: (playerId: string, scriptId: string) => {
        gameRef.current?.assignScript(playerId, scriptId);
      },
      detachScript: (scriptId: string) => {
        gameRef.current?.detachScript(scriptId);
      },
      runSimulation: async () => {
        if (!gameRef.current) {
          throw new Error('Game not initialized');
        }
        return gameRef.current.runSimulation();
      },
      seekFrame: (frameIndex: number) => {
        gameRef.current?.seekFrame(frameIndex);
      },
      play: () => {
        gameRef.current?.play();
      },
      pause: () => {
        gameRef.current?.pause();
      },
      step: (direction: 'forward' | 'backward') => {
        gameRef.current?.step(direction);
      },
      hitTestPlayer: (screenX: number, screenY: number) => {
        return gameRef.current?.hitTestPlayer(screenX, screenY) ?? null;
      },
      getTactic: () => {
        return gameRef.current?.getTactic() ?? null;
      },
      setSelectedPlayer: (playerId: string | null) => {
        gameRef.current?.setSelectedPlayer(playerId);
        // Census seam (E2E): the engine's selection drives the Pixi ring,
        // which has no DOM — republish it as an attribute alongside
        // data-match-players
        containerRef.current?.setAttribute('data-selected-player', playerId ?? '');
      },
      setTeamColors: (homeHex: string | undefined, awayHex: string | undefined) => {
        gameRef.current?.setTeamColors(
          hexToTeamColor(homeHex, PLAYER_HOME_COLOR),
          hexToTeamColor(awayHex, PLAYER_AWAY_COLOR)
        );
      },
      setScriptLabels: (labels: Record<string, string | null>) => {
        gameRef.current?.setScriptLabels(labels);
      },
      detachPlayerScript: (playerId: string) => {
        gameRef.current?.detachPlayerScript(playerId);
      },
    }));

    // Gestion du drag & drop
    // (story 7.5: script assignment moved to the on-pitch picker — the
    // HTML5 drag-and-drop path is gone; player drag-moves are handled by
    // the engine's pointer events)

    return (
      <div
        ref={containerRef}
        data-testid="field-canvas"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />
    );
  }
);

TacticsCanvas.displayName = 'TacticsCanvas';
