/**
 * SaveIndicator - Visual indicator for save status
 * OWNER: Dev Team
 *
 * Shows the current save status: saving, saved, or error.
 * "Saved" indicator auto-hides after 2 seconds.
 *
 * @see Story 2.3: Save AI File Changes
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores';

export const SaveIndicator: React.FC = () => {
  const { saveStatus, setSaveStatus, hasUnsavedChanges, scriptsError } =
    useEditorStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide "saved" indicator after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      timerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [saveStatus, setSaveStatus]);

  // Don't show anything if idle and no unsaved changes
  if (saveStatus === 'idle' && !hasUnsavedChanges) {
    return null;
  }

  // Show unsaved indicator
  if (saveStatus === 'idle' && hasUnsavedChanges) {
    return (
      <span data-testid="save-indicator" style={styles.unsaved}>
        Unsaved
      </span>
    );
  }

  if (saveStatus === 'saving') {
    return (
      <span
        data-testid="save-indicator"
        style={styles.saving}
      >
        <span data-testid="save-indicator-saving">Saving...</span>
      </span>
    );
  }

  if (saveStatus === 'saved') {
    return (
      <span
        data-testid="save-indicator"
        style={styles.saved}
      >
        <span data-testid="save-indicator-saved">Saved</span>
      </span>
    );
  }

  if (saveStatus === 'error') {
    return (
      <span
        data-testid="save-indicator"
        style={styles.error}
        title={scriptsError || 'Save failed'}
      >
        <span data-testid="save-indicator-error">Save failed</span>
      </span>
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  unsaved: {
    fontSize: '12px',
    color: '#888888',
    marginLeft: '8px',
    fontStyle: 'italic',
  },
  saving: {
    fontSize: '12px',
    color: '#888888',
    marginLeft: '8px',
  },
  saved: {
    fontSize: '12px',
    color: '#4ec9b0',
    marginLeft: '8px',
    animation: 'fadeIn 0.2s ease-in-out',
  },
  error: {
    fontSize: '12px',
    color: '#f14c4c',
    marginLeft: '8px',
    cursor: 'help',
  },
};
