/**
 * DebuggerPanel - Watch list (selection-driven) + replay log display
 * OWNER: Winston (Software Architect)
 *
 * Story 3.10: the Epic-2 debugger scaffolding (start/stop debugging,
 * breakpoints, fake console) is gone — there is no execution backend yet
 * (breakpoints return in a future epic). Logs come from the replay frames
 * (story 3.4 contract), windowed around the playhead so scrubbing always
 * shows the entries around the current tick. The Watch section stays:
 * story 3.11 builds on the selected-player info.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore, useTacticsStore, useMatchStore } from '@/stores';
import { rosterFromTactic, type RosterEntry } from '@/lib/tacticBridge';
import {
  matchPlayerKey,
  matchPlayerFromKey,
  teamIdFromMatchTeam,
} from '@/lib/teamMapping';
import {
  filterLogsByPlayer,
  logsAroundTick,
  LOG_LEVEL_COLORS,
  LOG_TEAM_COLORS,
  type ReplayLogEntry,
} from '@/lib/replayLogs';
import type { PlayerFrameState } from '@/types';

/** Scroll delta (px) above which a scroll event counts as a user scroll */
const SCROLL_FOLLOW_THRESHOLD = 2;

export const DebuggerPanel: React.FC = () => {
  const { selectedPlayerId, playerStates, currentFrame, logFilterPlayerId, setLogFilter } =
    useCanvasStore();
  const replayLogs = useMatchStore((state) => state.replayLogs);
  const replayFrames = useMatchStore((state) => state.replayFrames);
  const hasReplay = replayFrames.length > 0;

  const activeTactic = useTacticsStore((state) =>
    state.activeTacticId
      ? state.tactics.find((tactic) => tactic.id === state.activeTacticId) ?? null
      : null
  );

  // In replay mode the pitch shows the 10 match players whose ids ARE
  // matchPlayerKey composites — the Watch roster is built from the loaded
  // frames so a pitch/chip selection and the live frame states join
  // natively. Edit mode keeps the tactic roster (home-N vocabulary).
  const matchRoster = useMemo<RosterEntry[]>(() => {
    const firstFrame = replayFrames[0];
    if (!firstFrame) return [];
    return firstFrame.players
      .map((framePlayer) => ({
        id: matchPlayerKey(framePlayer.team, framePlayer.slot),
        name: framePlayer.team,
        number: framePlayer.slot,
        teamId: teamIdFromMatchTeam(framePlayer.team),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [replayFrames]);

  const roster = hasReplay ? matchRoster : rosterFromTactic(activeTactic);

  const stateByPlayerId = useMemo(() => {
    const map = new Map<string, PlayerFrameState>();
    for (const state of playerStates) {
      map.set(state.playerId, state);
    }
    return map;
  }, [playerStates]);

  // Selection IS the filter: nothing selected → all players, one → that player only
  const visiblePlayers = selectedPlayerId
    ? roster.filter((player) => player.id === selectedPlayerId)
    : roster;

  const selectedEntry = roster.find((player) => player.id === selectedPlayerId);

  // Log filter (story 3.11): a pitch selection (or a chip click) narrows the
  // stream to one player. The label derives from the canonical composite —
  // the filter id is never string-parsed here.
  const filterParts = logFilterPlayerId ? matchPlayerFromKey(logFilterPlayerId) : null;

  // Windowed log display (AC #3): the extracted log set is computed once per
  // replay load (memoized in matchStore); the player filter applies FIRST,
  // then the ±1s slice around the playhead is derived — both from
  // canvasStore.currentFrame, so scrubbing keeps the filter for free.
  const filteredLogs = useMemo(
    () => filterLogsByPlayer(replayLogs, logFilterPlayerId),
    [replayLogs, logFilterPlayerId]
  );

  const windowedLogs = useMemo(
    () => logsAroundTick(filteredLogs, currentFrame),
    [filteredLogs, currentFrame]
  );

  // Chip click (Task 4): a log entry selects its player on the pitch —
  // highlight AND filter, one click both ways
  const handleChipClick = (entry: ReplayLogEntry) => {
    const playerId = matchPlayerKey(entry.team, entry.slot);
    useCanvasStore.getState().setSelectedPlayer(playerId);
    setLogFilter(playerId);
  };

  // Auto-follow (standard console UX): on playhead moves the list scrolls to
  // keep the current-tick window in view; a manual scroll breaks the follow
  // until the user clicks the "Follow replay" pill.
  const [following, setFollowing] = useState(true);
  const [followedReplayLogs, setFollowedReplayLogs] = useState(replayLogs);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastAutoScrollTopRef = useRef(0);
  const lastScrollHeightRef = useRef(0);

  // A new replay starts followed again — a scroll in a previous replay must
  // not leave the next one unfollowed (stale follow state). Render-phase
  // adjustment per https://react.dev/learn/you-might-not-need-an-effect
  if (followedReplayLogs !== replayLogs) {
    setFollowedReplayLogs(replayLogs);
    setFollowing(true);
  }

  useEffect(() => {
    if (!following || windowedLogs.length === 0) return;
    const container = listRef.current;
    if (!container) return;

    // Anchor on the first entry at-or-after the playhead (the window tail
    // when every entry is older)
    let anchorIndex = windowedLogs.findIndex((entry) => entry.tick >= currentFrame);
    if (anchorIndex < 0) anchorIndex = windowedLogs.length - 1;
    const anchorEntry = windowedLogs[anchorIndex];
    if (!anchorEntry) return;
    const anchor = container.querySelector(
      `[data-testid="debug-log-entry-${anchorEntry.index}"]`
    );
    if (!anchor) return;

    const maxScroll = container.scrollHeight - container.clientHeight;
    const targetTop = Math.max(
      0,
      Math.min((anchor as HTMLElement).offsetTop - container.clientHeight / 3, maxScroll)
    );
    lastAutoScrollTopRef.current = targetTop;
    lastScrollHeightRef.current = container.scrollHeight;
    container.scrollTop = targetTop;
  }, [following, windowedLogs, currentFrame]);

  const handleLogScroll = () => {
    if (!following) return;
    const container = listRef.current;
    if (!container) return;
    // A shrinking list (window slid into a quiet zone) makes the browser
    // clamp scrollTop and fire a scroll event — that is not a user scroll,
    // unless the position is away from the clamp boundaries
    if (container.scrollHeight < lastScrollHeightRef.current) {
      const clamped =
        container.scrollTop === 0 ||
        container.scrollTop === container.scrollHeight - container.clientHeight;
      lastScrollHeightRef.current = container.scrollHeight;
      if (clamped) return;
    }
    if (Math.abs(container.scrollTop - lastAutoScrollTopRef.current) > SCROLL_FOLLOW_THRESHOLD) {
      setFollowing(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Debugger</h3>
      </div>

      {/* Watch: player states, filtered by the pitch selection */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle} data-testid="debug-watch-title">
          {selectedEntry
            ? `Watch — P${selectedEntry.number} ${selectedEntry.name}`
            : 'Watch (tous les joueurs)'}
        </h4>
        {visiblePlayers.length > 0 ? (
          <div style={styles.list} data-testid="debug-watch-list">
            {visiblePlayers.map((player) => {
              const live = stateByPlayerId.get(player.id);
              return (
                <div
                  key={player.id}
                  style={styles.watchRow}
                  data-testid={`debug-watch-row-${player.id}`}
                >
                  <span
                    style={{
                      ...styles.teamDot,
                      backgroundColor:
                        player.teamId === 'home' ? '#ff6b1a' : '#1a8cff',
                    }}
                  />
                  <span style={styles.watchName}>
                    P{player.number} {player.name}
                  </span>
                  <span style={styles.watchValue}>
                    {live
                      ? `(${live.position.x.toFixed(1)}, ${live.position.y.toFixed(1)})`
                      : '—'}
                  </span>
                  <span style={styles.watchState}>{live?.state ?? '—'}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.noItems} data-testid="debug-watch-empty">
            Aucun joueur à afficher
          </div>
        )}
      </div>

      {/* Replay logs (story 3.10): always visible once a replay is loaded —
          no manual "start debugging" step (Task 3) */}
      <div style={styles.logSection} data-testid="debug-log-panel">
        <div style={styles.logHeader}>
          <h4 style={styles.sectionTitle}>Replay logs</h4>
          <div style={styles.logHeaderControls}>
            {filterParts && (
              <span
                style={styles.filterIndicator}
                data-testid="debug-filter-indicator"
                role="status"
              >
                Showing P{filterParts.slot} ({filterParts.team}) only
              </span>
            )}
            {filterParts && (
              <button
                type="button"
                style={styles.followPill}
                data-testid="debug-show-all-button"
                onClick={() => setLogFilter(null)}
              >
                Show All
              </button>
            )}
            {!following && (
              <button
                type="button"
                style={styles.followPill}
                data-testid="debug-follow-pill"
                onClick={() => setFollowing(true)}
              >
                Follow replay
              </button>
            )}
          </div>
        </div>
        <div
          ref={listRef}
          style={styles.logList}
          data-testid="debug-log-list"
          onScroll={handleLogScroll}
        >
          {windowedLogs.length > 0 ? (
            windowedLogs.map((entry) => (
              <div
                key={entry.index}
                style={styles.logEntry}
                data-testid={`debug-log-entry-${entry.index}`}
              >
                <span style={styles.logTick} data-tick={entry.tick}>
                  #{entry.tick}
                </span>
                {entry.slot > 0 ? (
                  <button
                    type="button"
                    style={{
                      ...styles.logPlayerChip,
                      backgroundColor: LOG_TEAM_COLORS[entry.team],
                      cursor: 'pointer',
                    }}
                    data-testid={`debug-log-entry-${entry.index}-player-chip`}
                    title={`Filter logs to P${entry.slot} (${entry.team})`}
                    aria-pressed={logFilterPlayerId === matchPlayerKey(entry.team, entry.slot)}
                    onClick={() => handleChipClick(entry)}
                  >
                    P{entry.slot}
                  </button>
                ) : (
                  // Engine system warnings (e.g. LOG_CAP) carry the sentinel
                  // slot 0 — they come from no player, so no player chip
                  <span style={styles.logSystemBadge}>SYS</span>
                )}
                {(entry.level === 'warn' || entry.level === 'error') && (
                  <span
                    style={{
                      ...styles.logTypeBadge,
                      color: LOG_LEVEL_COLORS[entry.level],
                      borderColor: LOG_LEVEL_COLORS[entry.level],
                    }}
                  >
                    {entry.type}
                  </span>
                )}
                <span
                  style={{ ...styles.logMessage, color: LOG_LEVEL_COLORS[entry.level] }}
                  title={entry.message}
                >
                  {entry.message}
                </span>
              </div>
            ))
          ) : (
            <div style={styles.logEmpty} data-testid="debug-log-empty">
              {replayLogs.length === 0
                ? hasReplay
                  ? 'This AI never logged'
                  : 'No replay loaded'
                : filterParts
                  ? // Story 3.11: distinct from the plain quiet-window state —
                    // the selected player has logs, just none in ±1s
                  `No logs from P${filterParts.slot} within ±1s`
                  : 'No logs this tick (showing ±1s)'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LOG_FONT = "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace";

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#252526',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #3c3c3c',
  },
  title: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: '#cccccc',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid #3c3c3c',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '11px',
    fontWeight: 600,
    color: '#888888',
    textTransform: 'uppercase',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  watchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  teamDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  watchName: {
    color: '#9cdcfe',
    fontFamily: 'monospace',
    minWidth: '90px',
  },
  watchValue: {
    color: '#ce9178',
    fontFamily: 'monospace',
    flex: 1,
  },
  watchState: {
    color: '#888888',
    fontFamily: 'monospace',
  },
  noItems: {
    fontSize: '12px',
    color: '#666666',
    fontStyle: 'italic',
  },
  logSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px',
    overflow: 'hidden',
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    marginBottom: '8px',
  },
  logHeaderControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  filterIndicator: {
    color: '#fbbf24',
    fontSize: '11px',
    fontFamily: LOG_FONT,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  followPill: {
    padding: '2px 10px',
    backgroundColor: 'transparent',
    color: '#9cdcfe',
    border: '1px solid #9cdcfe',
    borderRadius: '999px',
    cursor: 'pointer',
    fontSize: '11px',
    fontFamily: LOG_FONT,
  },
  logList: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: '4px',
    padding: '8px',
    overflow: 'auto',
    position: 'relative',
  },
  logEntry: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    padding: '2px 0',
    fontFamily: LOG_FONT,
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  logTick: {
    color: '#666666',
    flexShrink: 0,
    minWidth: '44px',
    textAlign: 'right',
  },
  logPlayerChip: {
    color: '#1e1e1e',
    border: 'none',
    borderRadius: '2px',
    padding: '0 4px',
    fontSize: '11px',
    fontFamily: LOG_FONT,
    flexShrink: 0,
    fontWeight: 600,
  },
  logTypeBadge: {
    border: '1px solid',
    borderRadius: '2px',
    padding: '0 3px',
    fontSize: '10px',
    flexShrink: 0,
  },
  logSystemBadge: {
    color: '#888888',
    border: '1px solid #888888',
    borderRadius: '2px',
    padding: '0 3px',
    fontSize: '10px',
    flexShrink: 0,
  },
  logMessage: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logEmpty: {
    color: '#666666',
    fontStyle: 'italic',
    fontSize: '12px',
  },
};
