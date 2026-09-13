/**
 * AppShell - Main layout with 3 panels
 * OWNER: Dev Team
 */

import { useRef, useCallback, useEffect } from 'react';
import { TacticsCanvas, TacticsCanvasHandle } from '../canvas';
import { ScriptsPanel } from '../editor/ScriptsPanel';
import { DebuggerPanel } from '../debugger/DebuggerPanel';
import { TabBar } from '../tactics';
import { Header } from './Header';
import { Timeline } from './Timeline';
import { PanelDivider } from './PanelDivider';
import { useCanvasStore, useEditorStore, useTacticsStore } from '@/stores';
import { useAuthStore } from '@/stores/authStore';
import { usePanelLayout } from '@/hooks/usePanelLayout';
import { tacticConfigToTacticData, tacticDataToPlayerConfigs } from '@/lib/tacticBridge';

export const AppShell: React.FC = () => {
  const canvasRef = useRef<TacticsCanvasHandle>(null);

  // Collapsible/resizable workspace panels (persisted in localStorage)
  const {
    layout,
    resizeLeft,
    resizeRight,
    toggleLeft,
    toggleRight,
    resetSide,
    commit,
  } = usePanelLayout();

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

  const fetchTactics = useTacticsStore((state) => state.fetchTactics);
  const activeTacticId = useTacticsStore((state) => state.activeTacticId);
  const activeTactic = useTacticsStore((state) =>
    state.activeTacticId
      ? state.tactics.find((tactic) => tactic.id === state.activeTacticId) ?? null
      : null
  );

  // Track which tactic id is currently loaded in the canvas
  const loadedTacticIdRef = useRef<string | null>(null);

  // Lineup gating: all 5 slots must have a script assigned
  const lineupComplete = activeTactic
    ? activeTactic.players.every((player) => player.scriptId !== null)
    : false;

  // Fetch user scripts when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchScripts();
    }
  }, [isAuthenticated, fetchScripts]);

  // Fetch saved tactics when authenticated; always keep at least one
  // (story 3.2 AC #6: a user without tactics gets a default one auto-created)
  useEffect(() => {
    if (!isAuthenticated) return;

    void (async () => {
      await fetchTactics();

      const {
        tactics,
        activeTacticId: fetchedActiveId,
        selectTactic,
        createTactic,
      } = useTacticsStore.getState();
      const userTactics = tactics.filter((tactic) => !tactic.isSystem);

      if (userTactics.length === 0) {
        await createTactic();
        return;
      }

      // Keep the remembered selection, else fall back to the first tactic
      const target =
        userTactics.find((tactic) => tactic.id === fetchedActiveId) ?? userTactics[0] ?? null;

      if (target) {
        selectTactic(target.id);
      }
    })();
  }, [isAuthenticated, fetchTactics]);

  // Load the active tactic into the canvas whenever it changes (tab switch,
  // creation, deletion promotion, hydration)
  useEffect(() => {
    if (!activeTacticId || loadedTacticIdRef.current === activeTacticId) return;

    const { tactics } = useTacticsStore.getState();
    const target = tactics.find((tactic) => tactic.id === activeTacticId);
    if (!target) return;

    loadedTacticIdRef.current = activeTacticId;
    canvasRef.current?.loadTactic(tacticConfigToTacticData(target));
    setTacticLoaded(true);
  }, [activeTacticId, setTacticLoaded]);

  // Canvas callbacks
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

  // Auto-save (story 3.2): a script assignment is an action completion —
  // read the engine state back and persist it immediately.
  const handleScriptAssigned = useCallback(() => {
    const { activeTacticId: currentActiveId, updateTactic } = useTacticsStore.getState();

    if (!isAuthenticated || !currentActiveId) return; // no tactic behind the field yet

    const engineTactic = canvasRef.current?.getTactic();
    if (!engineTactic || engineTactic.id !== currentActiveId) return;

    void updateTactic(currentActiveId, undefined, tacticDataToPlayerConfigs(engineTactic));
  }, [isAuthenticated]);

  const handleScriptDropped = useCallback(
    (playerId: string, scriptId: string) => {
      console.log(`Script ${scriptId} assigned to player ${playerId}`);
    },
    []
  );

  // After a script deletion: detach player references. The database already
  // nulls tactic_player.script_id (FK nullOnDelete) — we only re-sync local
  // state (engine + tactics cache).
  const handleScriptDeleted = useCallback((scriptId: string) => {
    useTacticsStore.getState().detachScriptFromPlayers(scriptId);
    canvasRef.current?.detachScript(scriptId);
  }, []);

  // Start Match hand-off (story 3.5 replaces this handler with the real call)
  const handleStartPractice = useCallback(() => {
    if (!activeTactic) return;
    console.log('Start practice with tactic:', activeTactic);
  }, [activeTactic]);

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

  return (
    <div style={styles.container}>
      {/* Header */}
      <Header
        lineupComplete={lineupComplete}
        onStartPractice={handleStartPractice}
      />

      {/* Tactic tabs (between header and field) */}
      <TabBar />

      {/* Main content */}
      <div style={styles.main}>
        {/* Scripts Panel (gauche): resizable, collapsible to a thin strip */}
        {layout.leftCollapsed ? (
          <button
            type="button"
            data-testid="panel-strip-left"
            aria-expanded={false}
            aria-controls="left-panel"
            onClick={toggleLeft}
            title="AI Scripts"
            style={styles.collapsedStripLeft}
          >
            <span style={styles.collapsedStripLabel}>AI Scripts</span>
            <span style={styles.collapsedStripArrow}>{'›'}</span>
          </button>
        ) : (
          <>
            <div
              id="left-panel"
              data-testid="left-panel"
              style={{ ...styles.leftPanel, width: `${layout.leftWidth}px` }}
            >
              <ScriptsPanel onScriptDeleted={handleScriptDeleted} />
            </div>
            <PanelDivider
              side="left"
              width={layout.leftWidth}
              onResize={resizeLeft}
              onCommit={commit}
              onReset={() => resetSide('left')}
              onToggle={toggleLeft}
            />
          </>
        )}

        {/* Canvas (centre) */}
        <div style={styles.centerPanel}>
          <TacticsCanvas
            ref={canvasRef}
            onPlayerSelected={handlePlayerSelected}
            onPlayerHovered={handlePlayerHovered}
            onFrameChanged={handleFrameChanged}
            onSimulationComplete={handleSimulationComplete}
            onScriptDropped={handleScriptDropped}
            onScriptAssigned={handleScriptAssigned}
          />
        </div>

        {/* Debugger Panel (droite): resizable, collapsible to a thin strip */}
        {layout.rightCollapsed ? (
          <button
            type="button"
            data-testid="panel-strip-right"
            aria-expanded={false}
            aria-controls="right-panel"
            onClick={toggleRight}
            title="Debugger"
            style={styles.collapsedStripRight}
          >
            <span style={styles.collapsedStripLabel}>Debugger</span>
            <span style={styles.collapsedStripArrow}>{'‹'}</span>
          </button>
        ) : (
          <>
            <PanelDivider
              side="right"
              width={layout.rightWidth}
              onResize={resizeRight}
              onCommit={commit}
              onReset={() => resetSide('right')}
              onToggle={toggleRight}
            />
            <div
              id="right-panel"
              data-testid="right-panel"
              style={{ ...styles.rightPanel, width: `${layout.rightWidth}px` }}
            >
              <DebuggerPanel />
            </div>
          </>
        )}
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

const collapsedStripStyle: React.CSSProperties = {
  width: '28px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  padding: 0,
  paddingTop: '12px',
  backgroundColor: '#252526',
  border: 'none',
  cursor: 'pointer',
  overflow: 'hidden',
  userSelect: 'none',
  color: 'inherit',
  fontFamily: 'inherit',
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
    flexShrink: 0,
    borderRight: '1px solid #3c3c3c',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  centerPanel: {
    flex: 1,
    minWidth: '320px',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  rightPanel: {
    flexShrink: 0,
    borderLeft: '1px solid #3c3c3c',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  collapsedStripLeft: {
    ...collapsedStripStyle,
    borderRight: '1px solid #3c3c3c',
  },
  collapsedStripRight: {
    ...collapsedStripStyle,
    borderLeft: '1px solid #3c3c3c',
  },
  collapsedStripLabel: {
    writingMode: 'vertical-rl',
    fontSize: '12px',
    color: '#cccccc',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
  },
  collapsedStripArrow: {
    fontSize: '10px',
    color: '#9d9d9d',
  },
};
