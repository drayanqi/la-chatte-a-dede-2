/**
 * useUnsavedChangesWarning - Hook to warn users about unsaved changes
 * OWNER: Dev Team
 *
 * Shows browser's native "Leave page?" dialog when there are unsaved changes.
 *
 * @see Story 2.3: Save AI File Changes
 */

import { useEffect } from 'react';

/**
 * Hook that shows a browser warning when user tries to leave with unsaved changes.
 * @param hasUnsavedChanges - Whether there are unsaved changes
 */
export const useUnsavedChangesWarning = (hasUnsavedChanges: boolean): void => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Standard way to trigger the browser's "Leave page?" dialog
        e.preventDefault();
        // For older browsers
        e.returnValue = '';
        return '';
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
};
