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
import type {
  TacticData,
  Position,
  PlayerFrameState,
  SimulationResult,
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
    states: PlayerFrameState[]
  ) => void;

  /** Callback quand la simulation est terminée */
  onSimulationComplete?: (result: SimulationResult) => void;

  /** Callback quand un script est déposé sur un joueur */
  onScriptDropped?: (playerId: string, scriptId: string) => void;
}

export interface TacticsCanvasHandle {
  /** Charger une tactique */
  loadTactic: (tactic: TacticData) => void;

  /** Assigner un script à un joueur */
  assignScript: (playerId: string, scriptId: string) => void;

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
      onSimulationComplete,
      onScriptDropped,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Game | null>(null);

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
        onFrameChanged: (frame, total, states) => {
          onFrameChanged?.(frame, total, states);
        },
        onSimulationComplete: (result) => {
          onSimulationComplete?.(result);
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
    }, []);

    // Exposer l'API impérative
    useImperativeHandle(ref, () => ({
      loadTactic: (tactic: TacticData) => {
        gameRef.current?.loadTactic(tactic);
      },
      assignScript: (playerId: string, scriptId: string) => {
        gameRef.current?.assignScript(playerId, scriptId);
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
    }));

    // Gestion du drag & drop
    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();

        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));

          if (data.type === 'script' && containerRef.current && gameRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const playerId = gameRef.current.hitTestPlayer(x, y);

            if (playerId) {
              gameRef.current.assignScript(playerId, data.scriptId);
              onScriptDropped?.(playerId, data.scriptId);
            }
          }
        } catch {
          // Ignorer les drops invalides
        }
      },
      [onScriptDropped]
    );

    return (
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
