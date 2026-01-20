/**
 * DebuggerPanel - Panel de debug avec variables, breakpoints, console
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

import { useDebuggerStore, useCanvasStore } from '@/stores';

export const DebuggerPanel: React.FC = () => {
  const {
    isDebugging,
    breakpoints,
    watchedVariables,
    consoleOutput,
    startDebugging,
    stopDebugging,
  } = useDebuggerStore();

  const { selectedPlayerId, playerStates } = useCanvasStore();

  const selectedPlayerState = playerStates.find(
    (p) => p.playerId === selectedPlayerId
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Debugger</h3>
        <button
          style={isDebugging ? styles.stopButton : styles.startButton}
          onClick={isDebugging ? stopDebugging : startDebugging}
        >
          {isDebugging ? '⏹ Stop' : '🐛 Debug'}
        </button>
      </div>

      {/* Player info */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Joueur sélectionné</h4>
        {selectedPlayerId ? (
          <div style={styles.playerInfo}>
            <div style={styles.infoRow}>
              <span style={styles.label}>ID:</span>
              <span style={styles.value}>{selectedPlayerId}</span>
            </div>
            {selectedPlayerState && (
              <>
                <div style={styles.infoRow}>
                  <span style={styles.label}>Position:</span>
                  <span style={styles.value}>
                    ({selectedPlayerState.position.x.toFixed(1)},{' '}
                    {selectedPlayerState.position.y.toFixed(1)})
                  </span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.label}>État:</span>
                  <span style={styles.value}>{selectedPlayerState.state}</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={styles.noSelection}>Aucun joueur sélectionné</div>
        )}
      </div>

      {/* Breakpoints */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          Breakpoints ({breakpoints.length})
        </h4>
        {breakpoints.length > 0 ? (
          <div style={styles.list}>
            {breakpoints.map((bp) => (
              <div key={bp.id} style={styles.listItem}>
                <span
                  style={{
                    ...styles.breakpointDot,
                    opacity: bp.enabled ? 1 : 0.3,
                  }}
                >
                  🔴
                </span>
                <span style={styles.breakpointInfo}>
                  {bp.scriptId}:{bp.line}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.noItems}>Aucun breakpoint</div>
        )}
      </div>

      {/* Watch */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Watch</h4>
        {watchedVariables.length > 0 ? (
          <div style={styles.list}>
            {watchedVariables.map((v) => (
              <div key={v.id} style={styles.listItem}>
                <span style={styles.watchName}>{v.name}:</span>
                <span style={styles.watchValue}>
                  {JSON.stringify(v.value) ?? 'undefined'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.noItems}>Ajoutez des variables à surveiller</div>
        )}
      </div>

      {/* Console */}
      <div style={styles.consoleSection}>
        <h4 style={styles.sectionTitle}>Console</h4>
        <div style={styles.console}>
          {consoleOutput.length > 0 ? (
            consoleOutput.map((log, i) => (
              <div
                key={i}
                style={{
                  ...styles.consoleLine,
                  color:
                    log.type === 'error'
                      ? '#f14c4c'
                      : log.type === 'warn'
                      ? '#cca700'
                      : '#cccccc',
                }}
              >
                [{log.type}] {log.message}
              </div>
            ))
          ) : (
            <div style={styles.consoleEmpty}>Console vide</div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  startButton: {
    padding: '4px 12px',
    backgroundColor: '#2ea043',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  stopButton: {
    padding: '4px 12px',
    backgroundColor: '#da3633',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
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
  playerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoRow: {
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
  },
  label: {
    color: '#888888',
    minWidth: '60px',
  },
  value: {
    color: '#cccccc',
    fontFamily: 'monospace',
  },
  noSelection: {
    fontSize: '12px',
    color: '#666666',
    fontStyle: 'italic',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  breakpointDot: {
    fontSize: '10px',
  },
  breakpointInfo: {
    color: '#cccccc',
    fontFamily: 'monospace',
  },
  watchName: {
    color: '#9cdcfe',
    fontFamily: 'monospace',
  },
  watchValue: {
    color: '#ce9178',
    fontFamily: 'monospace',
  },
  noItems: {
    fontSize: '12px',
    color: '#666666',
    fontStyle: 'italic',
  },
  consoleSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px',
    overflow: 'hidden',
  },
  console: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: '4px',
    padding: '8px',
    fontFamily: 'monospace',
    fontSize: '11px',
    overflow: 'auto',
  },
  consoleLine: {
    padding: '2px 0',
  },
  consoleEmpty: {
    color: '#666666',
    fontStyle: 'italic',
  },
};
