/**
 * TeamsPage - The atelier (story 7.2, full workspace since 7.8): teambar,
 * scripts, code, terrain.
 *
 * (Story 7.5 layout: Scripts | Code | Terrain flex, floating rounded
 * panels. Scripts and Code keep their mockup defaults (255px / 430px) but
 * stay resizable via PanelDivider; the widths persist in localStorage.
 * Script assignment happens via the on-pitch picker. Replay watching left
 * for the dedicated /match/:id broadcast view in 7.7. 7.8 absorbed the
 * AppShell here and retired it.)
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TacticsCanvas, TacticsCanvasHandle } from '@/components/canvas';
import { ScriptsPanel, CodePanel } from '@/components/editor';
import { Teambar } from '@/components/teams/Teambar';
import { ScriptPicker } from '@/components/teams/ScriptPicker';
import { Appbar, PanelDivider } from '@/components/layout';
import {
  useCanvasStore,
  useEditorStore,
  useMatchStore,
  useTacticsStore,
} from '@/stores';
import { useAuthStore } from '@/stores/authStore';
import { tacticConfigToTacticData, tacticDataToPlayerConfigs } from '@/lib/tacticBridge';
import { computePickerPosition } from '@/lib/pickerPosition';
import type { Position, TeamId } from '@/types';

/** Script assignment counts + labels helper: engine player id for a slot */
const enginePlayerIdForSlot = (slot: number): string => `home-${slot - 1}`;

// Panel resize bounds (story 7.5): mockup defaults, user-adjustable.
// The pitch never drops below MIN — the caps shrink on narrow viewports.
const TEAMS_PANELS_KEY = 'teams_panel_layout';
const DEFAULT_SCRIPTS_WIDTH = 255;
const DEFAULT_CODE_WIDTH = 430;
const MIN_SCRIPTS_WIDTH = 200;
const MIN_CODE_WIDTH = 320;
const ABS_MAX_SCRIPTS_WIDTH = 480;
const ABS_MAX_CODE_WIDTH = 820;
/** The pitch (flex) never shrinks below this width */
const MIN_PITCH_WIDTH = 320;
/** 8px gaps around each divider and panel */
const LAYOUT_CHROME_WIDTH = 40;

const clampWidth = (width: number, min: number, max: number): number =>
  Math.min(Math.max(Math.round(width), min), Math.max(min, max));

const loadTeamsPanelWidths = (): { scripts: number; code: number } => {
  try {
    const raw = localStorage.getItem(TEAMS_PANELS_KEY);
    if (!raw) {
      return { scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH };
    }
    const parsed = JSON.parse(raw) as { scripts?: unknown; code?: unknown };
    const viewport = typeof window === 'undefined' ? 1440 : window.innerWidth;
    const maxScripts = viewport - DEFAULT_CODE_WIDTH - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH;
    const maxCode = viewport - DEFAULT_SCRIPTS_WIDTH - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH;
    return {
      scripts: clampWidth(
        typeof parsed.scripts === 'number' ? parsed.scripts : DEFAULT_SCRIPTS_WIDTH,
        MIN_SCRIPTS_WIDTH,
        Math.min(ABS_MAX_SCRIPTS_WIDTH, maxScripts)
      ),
      code: clampWidth(
        typeof parsed.code === 'number' ? parsed.code : DEFAULT_CODE_WIDTH,
        MIN_CODE_WIDTH,
        Math.min(ABS_MAX_CODE_WIDTH, maxCode)
      ),
    };
  } catch {
    return { scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH };
  }
};

/** Engine match length (3 min at 60 fps) — the frames-estimate chip */
const ESTIMATED_FRAMES = 10800;

export const TeamsPage: React.FC = () => {
  const canvasRef = useRef<TacticsCanvasHandle>(null);
  const pitchPanelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Script picker state (story 7.5): the selected edit-mode player and the
  // frozen picker placement (viewport coords); its current script is derived
  // from the tactic
  const [pickerPlayer, setPickerPlayer] = useState<{
    id: string;
    number: number;
    x: number;
    y: number;
  } | null>(null);

  // Resizable panel widths (story 7.5): mockup defaults, persisted per device
  const [{ scripts: scriptsWidth, code: codeWidth }, setPanelWidths] = useState(loadTeamsPanelWidths);

  // Latest widths for the drag-end commit (onCommit carries no payload)
  const panelWidthsRef = useRef({ scripts: scriptsWidth, code: codeWidth });
  useEffect(() => {
    panelWidthsRef.current = { scripts: scriptsWidth, code: codeWidth };
  }, [scriptsWidth, codeWidth]);

  const persistPanelWidths = useCallback((next: { scripts: number; code: number }) => {
    try {
      localStorage.setItem(TEAMS_PANELS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the resize still applies for this session
    }
  }, []);

  // Live clamp during a drag: the other panel keeps its current width and
  // the pitch keeps its minimum
  const clampScriptsWidth = useCallback(
    (width: number) =>
      clampWidth(
        width,
        MIN_SCRIPTS_WIDTH,
        Math.min(
          ABS_MAX_SCRIPTS_WIDTH,
          window.innerWidth - codeWidth - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH
        )
      ),
    [codeWidth]
  );

  const clampCodeWidth = useCallback(
    (width: number) =>
      clampWidth(
        width,
        MIN_CODE_WIDTH,
        Math.min(
          ABS_MAX_CODE_WIDTH,
          window.innerWidth - scriptsWidth - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH
        )
      ),
    [scriptsWidth]
  );

  const resizeScripts = useCallback(
    (width: number) => setPanelWidths(({ code }) => ({ code, scripts: clampScriptsWidth(width) })),
    [clampScriptsWidth]
  );

  const resizeCode = useCallback(
    (width: number) => setPanelWidths(({ scripts }) => ({ scripts, code: clampCodeWidth(width) })),
    [clampCodeWidth]
  );

  // Re-clamp persisted widths when the window resizes (contract inherited
  // from the retired usePanelLayout): a wide layout shrunk into a narrow
  // viewport must never clip the pitch. Scripts clamps first, then code
  // against the already-clamped scripts width.
  useEffect(() => {
    const reClamp = () => {
      setPanelWidths(({ scripts, code }) => {
        const nextScripts = clampWidth(
          scripts,
          MIN_SCRIPTS_WIDTH,
          Math.min(
            ABS_MAX_SCRIPTS_WIDTH,
            window.innerWidth - code - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH
          )
        );
        const nextCode = clampWidth(
          code,
          MIN_CODE_WIDTH,
          Math.min(
            ABS_MAX_CODE_WIDTH,
            window.innerWidth - nextScripts - MIN_PITCH_WIDTH - LAYOUT_CHROME_WIDTH
          )
        );
        return { scripts: nextScripts, code: nextCode };
      });
    };
    window.addEventListener('resize', reClamp);
    return () => window.removeEventListener('resize', reClamp);
  }, []);

  const handleScriptsResizeCommit = useCallback(() => {
    persistPanelWidths(panelWidthsRef.current);
  }, [persistPanelWidths]);

  const handleCodeResizeCommit = useCallback(() => {
    persistPanelWidths(panelWidthsRef.current);
  }, [persistPanelWidths]);

  const resetPanelWidths = useCallback(() => {
    setPanelWidths({ scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH });
    persistPanelWidths({ scripts: DEFAULT_SCRIPTS_WIDTH, code: DEFAULT_CODE_WIDTH });
  }, [persistPanelWidths]);

  const {
    selectedPlayerId,
    setSelectedPlayer,
    setHoveredPlayer,
    setTacticLoaded,
  } = useCanvasStore();

  const { isAuthenticated } = useAuthStore();
  const { fetchScripts } = useEditorStore();

  // Match state (story 3.5): the practice trigger and the newest completed
  // match (the "watch last match" chip)
  const {
    isSimulating,
    matchError,
    startPracticeMatch,
    latestMatch,
    fetchLatestMatch,
  } = useMatchStore();

  const fetchTactics = useTacticsStore((state) => state.fetchTactics);
  const activeTacticId = useTacticsStore((state) => state.activeTacticId);
  const activeTactic = useTacticsStore((state) =>
    state.activeTacticId
      ? state.tactics.find((tactic) => tactic.id === state.activeTacticId) ?? null
      : null
  );

  // Track which tactic id is currently loaded in the canvas
  const loadedTacticIdRef = useRef<string | null>(null);

  // The canvas engine dies with this component (route switch away and
  // back, StrictMode double-mount): a fresh engine instance must reload
  // the active tactic even though the id did not change. Declared BEFORE
  // the load effect so each remount pass clears the dedupe guard first.
  useEffect(() => {
    loadedTacticIdRef.current = null;
  }, []);

  // Lineup gating: all 5 slots must exist and have a script assigned
  const lineupComplete = activeTactic
    ? activeTactic.players.length === 5 &&
      activeTactic.players.every((player) => player.scriptId !== null)
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
        tacticsError,
      } = useTacticsStore.getState();

      // Fetch failed: do not decide anything from an empty list (a spurious
      // default tactic would be POSTed on every reload until the fetch works)
      if (tacticsError) return;

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
    setSelectedPlayer(null);
    canvasRef.current?.loadTactic(tacticConfigToTacticData(target));
    setTacticLoaded(true);
  }, [activeTacticId, setTacticLoaded, setSelectedPlayer]);

  // "Watch last match" (story 3.8, AC #4): resolve the newest completed
  // match once when authenticated so the subtle entry can appear
  useEffect(() => {
    if (isAuthenticated) {
      void fetchLatestMatch();
    }
  }, [isAuthenticated, fetchLatestMatch]);

  // Mirror the persistent selection into the engine so exactly the selected
  // player keeps its ring (single source of truth: the store)
  useEffect(() => {
    canvasRef.current?.setSelectedPlayer(selectedPlayerId);
  }, [selectedPlayerId]);

  // Canvas callbacks

  /**
   * Pitch click (story 7.5): edit mode only — select the player and open
   * the script picker. Replay-mode filter semantics live on the /match/:id
   * viewer since the 7.7 cutover. The engine never decides semantics — it
   * only reports the click.
   */
  const handlePlayerSelected = useCallback(
    (playerId: string, _teamId: TeamId, position: Position, _scriptId: string | null) => {
      // The placement is frozen at selection time (viewport coords, clamped
      // to the pitch panel) — refs are read here, in an event handler, never
      // during render. Engine ids: home-{n}.
      const slot = Number(playerId.split('-')[1]);
      const rect = pitchPanelRef.current?.getBoundingClientRect();
      const placement = rect
        ? computePickerPosition(position.x, position.y, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          })
        : null;

      useCanvasStore.getState().setSelectedPlayer(playerId);
      if (placement) {
        setPickerPlayer({
          id: playerId,
          number: Number.isNaN(slot) ? 0 : slot + 1,
          x: placement.x,
          y: placement.y,
        });
      } else {
        setPickerPlayer(null);
      }
    },
    []
  );

  const handlePlayerDeselected = useCallback(() => {
    useCanvasStore.getState().setSelectedPlayer(null);
    setPickerPlayer(null);
  }, []);

  // A drag that actually moves the player hides the picker (story 7.5): the
  // pointerdown opened it before the engine could tell tap from drag.
  // The selection ring stays — it is the drag's positional feedback.
  const handlePlayerDragStart = useCallback(() => {
    setPickerPlayer(null);
  }, []);

  const handlePlayerHovered = useCallback(
    (playerId: string | null) => {
      setHoveredPlayer(playerId);
    },
    [setHoveredPlayer]
  );

  // Live team recolor (story 7.4): an Équipement save updates the active
  // tactic in place — no reload, the players and goals repaint immediately
  // (redundant calls are no-ops: the engine skips same-color repaints)
  useEffect(() => {
    if (!activeTactic) return;
    canvasRef.current?.setTeamColors(activeTactic.colorPrimary, activeTactic.colorSecondary);
  }, [activeTactic]);

  // Script tags (story 7.5): engine player id -> assigned script name.
  // Recomputed when the lineup or the script list changes (renames included).
  const editorScripts = useEditorStore((state) => state.scripts);
  const syntaxErrors = useEditorStore((state) => state.syntaxErrors);
  useEffect(() => {
    if (!activeTactic) return;

    const labels: Record<string, string | null> = {};
    for (const slot of activeTactic.players) {
      labels[enginePlayerIdForSlot(slot.playerSlot)] = slot.scriptId
        ? editorScripts.get(slot.scriptId)?.name ?? null
        : null;
    }
    canvasRef.current?.setScriptLabels(labels);
  }, [activeTactic, editorScripts]);

  // Watch last match (story 3.8, AC #4 — 7.5: lands in the /match/:id viewer)
  const handleWatchLastMatch = useCallback(() => {
    if (!latestMatch) return;
    navigate(`/match/${latestMatch.id}`);
  }, [latestMatch, navigate]);

  // Auto-save (story 3.2): a discrete action completion — script assignment
  // or player move-end — reads the engine state back and persists it
  // immediately. Discrete actions only; never mid-drag.
  const persistActiveTacticFromEngine = useCallback(() => {
    const { activeTacticId: currentActiveId, updateTactic } = useTacticsStore.getState();

    if (!isAuthenticated || !currentActiveId) return; // no tactic behind the field yet

    const engineTactic = canvasRef.current?.getTactic();
    if (!engineTactic || engineTactic.id !== currentActiveId) return;

    void updateTactic(currentActiveId, undefined, tacticDataToPlayerConfigs(engineTactic));
  }, [isAuthenticated]);

  const handleScriptAssigned = useCallback(() => {
    persistActiveTacticFromEngine();
  }, [persistActiveTacticFromEngine]);

  const handlePlayerMoved = useCallback(() => {
    persistActiveTacticFromEngine();
  }, [persistActiveTacticFromEngine]);

  // After a script deletion: detach player references. The database already
  // nulls tactic_player.script_id (FK nullOnDelete) — we only re-sync local
  // state (engine + tactics cache).
  const handleScriptDeleted = useCallback((scriptId: string) => {
    useTacticsStore.getState().detachScriptFromPlayers(scriptId);
    canvasRef.current?.detachScript(scriptId);
  }, []);

  // Practice match start/retry (story 3.5, handoff story 7.5): the match
  // runs synchronously, then the route moves to the /match/:id viewer.
  // A failure stays on the page (error banner + retry).

  const handleStartPractice = useCallback(() => {
    if (!activeTactic || !lineupComplete || isSimulating) return;

    void (async () => {
      await startPracticeMatch(activeTactic.id);
      const { lastMatch, matchError } = useMatchStore.getState();
      if (lastMatch && lastMatch.status === 'completed' && !matchError) {
        navigate(`/match/${lastMatch.id}`);
      }
    })();
  }, [activeTactic, lineupComplete, isSimulating, startPracticeMatch, navigate]);

  const handleRetryMatch = useCallback(() => {
    // Same guards as start: a lineup that became incomplete must not fire a
    // doomed request.
    if (!activeTactic || !lineupComplete || isSimulating) return;

    void (async () => {
      await startPracticeMatch(activeTactic.id);
      const { lastMatch, matchError } = useMatchStore.getState();
      if (lastMatch && lastMatch.status === 'completed' && !matchError) {
        navigate(`/match/${lastMatch.id}`);
      }
    })();
  }, [activeTactic, lineupComplete, isSimulating, startPracticeMatch, navigate]);


  return (
    <div style={styles.container}>
      {/* Appbar (La Ronde, story 7.1) */}
      <Appbar />

      {/* Teambar (story 7.5): pills + caret menu + status + Test vs Bot */}
      <Teambar
        lineupComplete={lineupComplete}
        isSimulating={isSimulating}
        onStartPractice={handleStartPractice}
      />

      {/* Main content: Scripts | Code | Terrain flex (story 7.5, resizable) */}
      <div style={styles.main}>
        <div data-testid="left-panel" style={{ ...styles.leftPanel, width: `${scriptsWidth}px` }}>
          <ScriptsPanel onScriptDeleted={handleScriptDeleted} />
        </div>

        <PanelDivider
          side="left"
          id="scripts"
          width={scriptsWidth}
          onResize={resizeScripts}
          onCommit={handleScriptsResizeCommit}
          onReset={resetPanelWidths}
          label="Resize scripts panel"
        />

        <div data-testid="code-panel-shell" style={{ ...styles.codePanel, width: `${codeWidth}px` }}>
          <CodePanel />
        </div>

        <PanelDivider
          side="left"
          id="code"
          width={codeWidth}
          onResize={resizeCode}
          onCommit={handleCodeResizeCommit}
          onReset={resetPanelWidths}
          label="Resize code panel"
        />

        {/* Terrain (droite) */}
        <div data-testid="pitch-panel" ref={pitchPanelRef} style={styles.centerPanel}>
          <TacticsCanvas
            ref={canvasRef}
            onPlayerSelected={handlePlayerSelected}
            onPlayerHovered={handlePlayerHovered}
            onScriptAssigned={handleScriptAssigned}
            onPlayerMoved={handlePlayerMoved}
            onPlayerDragStart={handlePlayerDragStart}
            onPlayerDeselected={handlePlayerDeselected}
          />

          {/* Watch last match (story 3.8, AC #4, 7.5: /match/:id handoff) */}
          {latestMatch && (
            <button
              type="button"
              data-testid="watch-last-match-button"
              onClick={handleWatchLastMatch}
              aria-label="Watch the replay of the most recent completed match"
              style={styles.replayCornerButton}
            >
              ▶ Watch last match
            </button>
          )}

          {/* Practice match feedback (story 3.5): simulating veil pinned to
              the pitch, error banner with retry. Success navigates to the
              /match/:id viewer, so no result state lives here (the replay
              entry is the watch-last-match chip). */}
          {isSimulating && (
            <div style={styles.veilBackdrop} data-testid="simulating-overlay">
              <div style={styles.veilPanel}>
                <span style={styles.veilSpinner} aria-hidden="true" />
                <span style={styles.veilTitle}>Simulating...</span>
                <span style={styles.veilHint}>Your AI is playing against the Easy Bot</span>
                <span style={styles.veilChip}>
                  ≈ {ESTIMATED_FRAMES.toLocaleString('en-US')} frames · a few seconds
                </span>
              </div>
            </div>
          )}
          {matchError && !isSimulating && (
            <div style={styles.statusToast} data-testid="match-error-banner">
              <span style={styles.errorText} data-testid="match-error-message">
                {matchError}
              </span>
              <button
                type="button"
                style={styles.statusButton}
                data-testid="retry-match-button"
                onClick={handleRetryMatch}
              >
                Retry
              </button>
            </div>
          )}

          {/* Script picker (story 7.5): edit mode only, at the frozen
              placement captured when the player was selected. Gated on the
              live selection: a tactic switch clears it through
              the store without a cascading local-state reset. */}
          {pickerPlayer && selectedPlayerId === pickerPlayer.id
            ? (() => {
                const currentScriptId =
                  activeTactic?.players.find(
                    (slot) => enginePlayerIdForSlot(slot.playerSlot) === pickerPlayer.id
                  )?.scriptId ?? null;

                const pickerScripts = Array.from(editorScripts.values()).map((script) => ({
                  id: script.id,
                  name: script.name,
                  status: (syntaxErrors.some((error) => error.scriptId === script.id)
                    ? 'err'
                    : 'ok') as 'ok' | 'err',
                  usage: activeTactic
                    ? activeTactic.players.filter((slot) => slot.scriptId === script.id).length
                    : 0,
                }));

                return (
                  <ScriptPicker
                    playerNumber={pickerPlayer.number}
                    x={pickerPlayer.x}
                    y={pickerPlayer.y}
                    scripts={pickerScripts}
                    currentScriptId={currentScriptId}
                    onAssign={(scriptId) => {
                      canvasRef.current?.assignScript(pickerPlayer.id, scriptId);
                    }}
                    onRemove={() => {
                      canvasRef.current?.detachPlayerScript(pickerPlayer.id);
                      persistActiveTacticFromEngine();
                    }}
                    onClose={handlePlayerDeselected}
                  />
                );
              })()
            : null}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    color: 'var(--ink)',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    padding: '8px',
    gap: '2px',
    minHeight: 0,
  },
  leftPanel: {
    flexShrink: 0,
    borderRadius: 'var(--r)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow)',
    backgroundColor: 'var(--panel)',
  },
  codePanel: {
    flexShrink: 0,
    borderRadius: 'var(--r)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow)',
    backgroundColor: 'var(--panel)',
  },
  centerPanel: {
    flex: 1,
    minWidth: '320px',
    overflow: 'hidden',
    borderRadius: 'var(--r)',
    boxShadow: 'var(--shadow)',
    position: 'relative',
  },
  replayCornerButton: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    padding: '7px 13px',
    backgroundColor: 'rgba(10, 20, 14, 0.6)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '11px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    zIndex: 10,
    userSelect: 'none',
    backdropFilter: 'blur(4px)',
  },
  veilBackdrop: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 20, 14, 0.55)',
    zIndex: 30,
    cursor: 'wait',
    backdropFilter: 'blur(3px)',
  },
  veilPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 32px',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-modal, 24px)',
    boxShadow: 'var(--shadow-lg)',
  },
  veilSpinner: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.25)',
    borderTopColor: 'var(--mint)',
    animation: 'lachatadede-spin 0.9s linear infinite',
  },
  veilTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--ink)',
  },
  veilHint: {
    fontSize: '12px',
    color: 'var(--muted)',
  },
  veilChip: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--ink)',
    background: 'var(--panel2)',
    border: '1px solid var(--line)',
    borderRadius: '999px',
    padding: '4px 12px',
  },
  statusToast: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 20px',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-btn, 13px)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 30,
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--corail)',
  },
  statusButton: {
    padding: '8px 16px',
    backgroundColor: 'var(--corail)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--r-btn, 13px)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
};
