/**
 * useAutoSave - Hook to auto-save script changes
 * OWNER: Dev Team
 *
 * Implements two auto-save strategies:
 * 1. Debounced save: Save 2 seconds after last change
 * 2. Periodic save: Save every 30 seconds if there are unsaved changes
 *
 * @see Story 2.3: Save AI File Changes
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** The active script ID to save */
  activeScriptId: string | null;
  /** Function to save the script */
  saveScript: (id: string) => Promise<boolean>;
  /** Debounce delay in ms (default: 2000) */
  debounceMs?: number;
  /** Periodic save interval in ms (default: 30000) */
  intervalMs?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook that auto-saves script changes using debounce and periodic strategies.
 */
export const useAutoSave = ({
  hasUnsavedChanges,
  isSaving,
  activeScriptId,
  saveScript,
  debounceMs = 2000,
  intervalMs = 30000,
  enabled = true,
}: UseAutoSaveOptions): void => {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(Date.now());

  const performSave = useCallback(async () => {
    if (!activeScriptId || isSaving || !hasUnsavedChanges) {
      return;
    }
    await saveScript(activeScriptId);
    lastSaveTimeRef.current = Date.now();
  }, [activeScriptId, isSaving, hasUnsavedChanges, saveScript]);

  // Debounced save: Save 2 seconds after last change
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges || !activeScriptId) {
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, hasUnsavedChanges, activeScriptId, debounceMs, performSave]);

  // Periodic save: Save every 30 seconds if there are unsaved changes
  useEffect(() => {
    if (!enabled) {
      return;
    }

    intervalTimerRef.current = setInterval(() => {
      if (hasUnsavedChanges && !isSaving && activeScriptId) {
        performSave();
      }
    }, intervalMs);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [enabled, intervalMs, hasUnsavedChanges, isSaving, activeScriptId, performSave]);

  // Clear timers on manual save (when hasUnsavedChanges becomes false)
  useEffect(() => {
    if (!hasUnsavedChanges) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [hasUnsavedChanges]);
};
