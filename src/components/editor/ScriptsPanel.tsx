/**
 * ScriptsPanel - Liste des scripts et éditeur Monaco
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

import { useCallback } from 'react';
import { useEditorStore } from '@/stores';
import type { Script } from '@/types';

export const ScriptsPanel: React.FC = () => {
  const { scripts, activeScriptId, openScript } = useEditorStore();

  const handleDragStart = useCallback(
    (e: React.DragEvent, script: Script) => {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({
          type: 'script',
          scriptId: script.id,
        })
      );
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Scripts IA</h3>
        <button style={styles.addButton}>+</button>
      </div>

      <div style={styles.scriptList}>
        {Array.from(scripts.values()).map((script) => (
          <div
            key={script.id}
            style={{
              ...styles.scriptItem,
              ...(activeScriptId === script.id ? styles.scriptItemActive : {}),
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, script)}
            onClick={() => openScript(script.id)}
          >
            <span style={styles.scriptIcon}>📜</span>
            <div style={styles.scriptInfo}>
              <span style={styles.scriptName}>{script.name}</span>
              <span style={styles.scriptLang}>{script.language}</span>
            </div>
            <span style={styles.dragHandle}>⋮⋮</span>
          </div>
        ))}
      </div>

      <div style={styles.editorPlaceholder}>
        {activeScriptId ? (
          <div style={styles.editorContent}>
            <div style={styles.editorHeader}>
              <span>{scripts.get(activeScriptId)?.name}</span>
            </div>
            <pre style={styles.codePreview}>
              {scripts.get(activeScriptId)?.code}
            </pre>
            <div style={styles.editorNote}>
              Monaco Editor sera intégré ici
            </div>
          </div>
        ) : (
          <div style={styles.noSelection}>
            Sélectionnez un script ou glissez-le sur un joueur
          </div>
        )}
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
  addButton: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  scriptList: {
    flex: '0 0 auto',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  scriptItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    cursor: 'grab',
    borderBottom: '1px solid #2d2d2d',
    transition: 'background-color 0.15s',
  },
  scriptItemActive: {
    backgroundColor: '#37373d',
  },
  scriptIcon: {
    fontSize: '16px',
    marginRight: '8px',
  },
  scriptInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  scriptName: {
    fontSize: '13px',
    color: '#ffffff',
  },
  scriptLang: {
    fontSize: '11px',
    color: '#888888',
  },
  dragHandle: {
    color: '#666666',
    fontSize: '12px',
    cursor: 'grab',
  },
  editorPlaceholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid #3c3c3c',
    overflow: 'hidden',
  },
  editorContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  editorHeader: {
    padding: '8px 16px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
    fontSize: '12px',
    color: '#cccccc',
  },
  codePreview: {
    flex: 1,
    margin: 0,
    padding: '16px',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#d4d4d4',
    backgroundColor: '#1e1e1e',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
  editorNote: {
    padding: '8px 16px',
    backgroundColor: '#2d2d2d',
    fontSize: '11px',
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noSelection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666666',
    fontSize: '13px',
    padding: '16px',
    textAlign: 'center',
  },
};
