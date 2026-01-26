/**
 * AppShell - Main layout with 3 panels
 * OWNER: Dev Team
 */

import { useRef, useCallback, useEffect } from 'react';
import { TacticsCanvas, TacticsCanvasHandle } from '../canvas';
import { ScriptsPanel } from '../editor/ScriptsPanel';
import { DebuggerPanel } from '../debugger/DebuggerPanel';
import { Header } from './Header';
import { Timeline } from './Timeline';
import { useCanvasStore, useEditorStore } from '@/stores';
import { useAuthStore } from '@/stores/authStore';
import type { TacticData, Player } from '@/types';

// Tactique de démo
const createDemoTactic = (): TacticData => {
  const players: Player[] = [];

  // Équipe Home (gauche)
  const homePositions = [
    { x: 10, y: 50, number: 1, name: 'Gardien' },
    { x: 25, y: 30, number: 2, name: 'Défenseur G' },
    { x: 25, y: 70, number: 3, name: 'Défenseur D' },
    { x: 45, y: 40, number: 7, name: 'Milieu' },
    { x: 45, y: 60, number: 9, name: 'Attaquant' },
  ];

  // Équipe Away (droite)
  const awayPositions = [
    { x: 90, y: 50, number: 1, name: 'Gardien' },
    { x: 75, y: 30, number: 2, name: 'Défenseur G' },
    { x: 75, y: 70, number: 3, name: 'Défenseur D' },
    { x: 55, y: 40, number: 7, name: 'Milieu' },
    { x: 55, y: 60, number: 9, name: 'Attaquant' },
  ];

  homePositions.forEach((p, i) => {
    players.push({
      id: `home-${i}`,
      name: p.name,
      teamId: 'home',
      number: p.number,
      position: { x: p.x, y: p.y },
      assignedScriptId: null,
    });
  });

  awayPositions.forEach((p, i) => {
    players.push({
      id: `away-${i}`,
      name: p.name,
      teamId: 'away',
      number: p.number,
      position: { x: p.x, y: p.y },
      assignedScriptId: null,
    });
  });

  return {
    id: 'demo-tactic',
    name: 'Tactique Démo 5v5',
    players,
    ball: { x: 50, y: 50 },
    scripts: {},
  };
};

export const AppShell: React.FC = () => {
  const canvasRef = useRef<TacticsCanvasHandle>(null);

  const {
    setSelectedPlayer,
    setHoveredPlayer,
    updatePlaybackState,
    setTacticLoaded,
    setSimulationReady,
    isPlaying,
    currentFrame,
    totalFrames,
  } = useCanvasStore();

  const { isAuthenticated } = useAuthStore();
  const { fetchScripts } = useEditorStore();

  // Load demo tactic on mount
  useEffect(() => {
    const demoTactic = createDemoTactic();
    canvasRef.current?.loadTactic(demoTactic);
    setTacticLoaded(true);
  }, [setTacticLoaded]);

  // Fetch user scripts when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchScripts();
    }
  }, [isAuthenticated, fetchScripts]);

  // Callbacks du Canvas
  const handlePlayerSelected = useCallback(
    (playerId: string, teamId: 'home' | 'away') => {
      setSelectedPlayer(playerId);
    },
    [setSelectedPlayer]
  );

  const handlePlayerHovered = useCallback(
    (playerId: string | null) => {
      setHoveredPlayer(playerId);
    },
    [setHoveredPlayer]
  );

  const handleFrameChanged = useCallback(
    (frame: number, total: number) => {
      updatePlaybackState(isPlaying, frame, total);
    },
    [updatePlaybackState, isPlaying]
  );

  const handleSimulationComplete = useCallback(() => {
    setSimulationReady(true);
  }, [setSimulationReady]);

  const handleScriptDropped = useCallback(
    (playerId: string, scriptId: string) => {
      console.log(`Script ${scriptId} assigné au joueur ${playerId}`);
    },
    []
  );

  // Contrôles de lecture
  const handlePlay = useCallback(() => {
    canvasRef.current?.play();
    updatePlaybackState(true, currentFrame, totalFrames);
  }, [updatePlaybackState, currentFrame, totalFrames]);

  const handlePause = useCallback(() => {
    canvasRef.current?.pause();
    updatePlaybackState(false, currentFrame, totalFrames);
  }, [updatePlaybackState, currentFrame, totalFrames]);

  const handleStep = useCallback(
    (direction: 'forward' | 'backward') => {
      canvasRef.current?.step(direction);
    },
    []
  );

  const handleSeek = useCallback((frame: number) => {
    canvasRef.current?.seekFrame(frame);
  }, []);

  const handleRunSimulation = useCallback(async () => {
    await canvasRef.current?.runSimulation();
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <Header onRunSimulation={handleRunSimulation} />

      {/* Main content */}
      <div style={styles.main}>
        {/* Scripts Panel (gauche) */}
        <div style={styles.leftPanel}>
          <ScriptsPanel />
        </div>

        {/* Canvas (centre) */}
        <div style={styles.centerPanel}>
          <TacticsCanvas
            ref={canvasRef}
            onPlayerSelected={handlePlayerSelected}
            onPlayerHovered={handlePlayerHovered}
            onFrameChanged={handleFrameChanged}
            onSimulationComplete={handleSimulationComplete}
            onScriptDropped={handleScriptDropped}
          />
        </div>

        {/* Debugger Panel (droite) */}
        <div style={styles.rightPanel}>
          <DebuggerPanel />
        </div>
      </div>

      {/* Timeline */}
      <Timeline
        isPlaying={isPlaying}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        onPlay={handlePlay}
        onPause={handlePause}
        onStep={handleStep}
        onSeek={handleSeek}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    width: '280px',
    borderRight: '1px solid #3c3c3c',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  centerPanel: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  rightPanel: {
    width: '300px',
    borderLeft: '1px solid #3c3c3c',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};
