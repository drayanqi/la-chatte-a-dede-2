/**
 * Editor Store Unit Tests
 *
 * Tests the Zustand store that manages editor state:
 * - Script CRUD operations (add, update, delete)
 * - Active script navigation
 * - Save state tracking
 * - Syntax error tracking
 *
 * @see Epic 2: AI Development Workspace
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '@/stores/editorStore';
import type { Script } from '@/types';

describe('Editor Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useEditorStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have default scripts loaded', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: Should have default demo scripts
      expect(state.scripts.size).toBeGreaterThan(0);
    });

    it('should have no active script initially', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: No script should be open
      expect(state.activeScriptId).toBeNull();
    });

    it('should have no unsaved changes initially', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: No unsaved changes
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should have no syntax errors initially', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: No syntax errors
      expect(state.syntaxErrors).toEqual([]);
    });
  });

  describe('Script CRUD - Add', () => {
    it('should add a new script', () => {
      // GIVEN: Initial state
      const store = useEditorStore.getState();
      const initialCount = store.scripts.size;

      // WHEN: Adding a new script
      const newScript: Script = {
        id: 'test-script-1',
        name: 'Test AI',
        code: 'function update() { return { move: { x: 0, y: 0 } }; }',
        language: 'javascript',
        lastModified: new Date(),
      };
      store.addScript(newScript);

      // THEN: Script should be added
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(initialCount + 1);
      expect(state.scripts.get('test-script-1')).toEqual(newScript);
    });

    it('should overwrite script with same id', () => {
      // GIVEN: Existing script
      const store = useEditorStore.getState();
      const script1: Script = {
        id: 'duplicate-id',
        name: 'Original',
        code: 'original code',
        language: 'javascript',
        lastModified: new Date(),
      };
      store.addScript(script1);

      // WHEN: Adding script with same id
      const script2: Script = {
        id: 'duplicate-id',
        name: 'Updated',
        code: 'updated code',
        language: 'javascript',
        lastModified: new Date(),
      };
      store.addScript(script2);

      // THEN: Script should be replaced
      const state = useEditorStore.getState();
      expect(state.scripts.get('duplicate-id')?.name).toBe('Updated');
      expect(state.scripts.get('duplicate-id')?.code).toBe('updated code');
    });
  });

  describe('Script CRUD - Update', () => {
    it('should update script code', () => {
      // GIVEN: Existing script
      const store = useEditorStore.getState();
      const script: Script = {
        id: 'update-test',
        name: 'Update Test',
        code: 'original code',
        language: 'javascript',
        lastModified: new Date('2024-01-01'),
      };
      store.addScript(script);

      // WHEN: Updating code
      store.updateScript('update-test', 'new code');

      // THEN: Code should be updated
      const updated = useEditorStore.getState().scripts.get('update-test');
      expect(updated?.code).toBe('new code');
    });

    it('should update lastModified timestamp on code change', () => {
      // GIVEN: Existing script with old timestamp
      const store = useEditorStore.getState();
      const oldDate = new Date('2024-01-01');
      const script: Script = {
        id: 'timestamp-test',
        name: 'Timestamp Test',
        code: 'original',
        language: 'javascript',
        lastModified: oldDate,
      };
      store.addScript(script);

      // WHEN: Updating code
      store.updateScript('timestamp-test', 'new code');

      // THEN: Timestamp should be newer
      const updated = useEditorStore.getState().scripts.get('timestamp-test');
      expect(updated?.lastModified.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should mark hasUnsavedChanges on code update', () => {
      // GIVEN: Existing script
      const store = useEditorStore.getState();
      store.addScript({
        id: 'unsaved-test',
        name: 'Unsaved Test',
        code: 'original',
        language: 'javascript',
        lastModified: new Date(),
      });
      expect(store.hasUnsavedChanges).toBe(false);

      // WHEN: Updating code
      store.updateScript('unsaved-test', 'changed code');

      // THEN: Should have unsaved changes
      expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('should not update non-existent script', () => {
      // GIVEN: Initial state
      const store = useEditorStore.getState();
      const initialScripts = new Map(store.scripts);

      // WHEN: Updating non-existent script
      store.updateScript('non-existent', 'new code');

      // THEN: State should remain unchanged
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(initialScripts.size);
    });
  });

  describe('Script CRUD - Delete', () => {
    it('should delete script', () => {
      // GIVEN: Script to delete
      const store = useEditorStore.getState();
      store.addScript({
        id: 'delete-me',
        name: 'Delete Me',
        code: 'to be deleted',
        language: 'javascript',
        lastModified: new Date(),
      });
      // Re-get state after mutation
      expect(useEditorStore.getState().scripts.has('delete-me')).toBe(true);

      // WHEN: Deleting script
      useEditorStore.getState().deleteScript('delete-me');

      // THEN: Script should be removed
      expect(useEditorStore.getState().scripts.has('delete-me')).toBe(false);
    });

    it('should clear activeScriptId when deleting active script', () => {
      // GIVEN: Active script
      useEditorStore.getState().addScript({
        id: 'active-delete',
        name: 'Active Delete',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      useEditorStore.getState().openScript('active-delete');
      expect(useEditorStore.getState().activeScriptId).toBe('active-delete');

      // WHEN: Deleting active script
      useEditorStore.getState().deleteScript('active-delete');

      // THEN: Active script should be cleared
      expect(useEditorStore.getState().activeScriptId).toBeNull();
    });

    it('should NOT clear activeScriptId when deleting different script', () => {
      // GIVEN: Two scripts, one active
      const store = useEditorStore.getState();
      store.addScript({
        id: 'script-a',
        name: 'Script A',
        code: 'code a',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.addScript({
        id: 'script-b',
        name: 'Script B',
        code: 'code b',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('script-a');

      // WHEN: Deleting non-active script
      store.deleteScript('script-b');

      // THEN: Active script should remain
      expect(useEditorStore.getState().activeScriptId).toBe('script-a');
    });

    it('should handle deleting non-existent script gracefully', () => {
      // GIVEN: Initial state
      const store = useEditorStore.getState();
      const initialCount = store.scripts.size;

      // WHEN: Deleting non-existent script
      store.deleteScript('non-existent-id');

      // THEN: No error, state unchanged
      expect(useEditorStore.getState().scripts.size).toBe(initialCount);
    });
  });

  describe('Script Navigation', () => {
    it('should open script by id', () => {
      // GIVEN: Script exists
      const store = useEditorStore.getState();
      store.addScript({
        id: 'open-test',
        name: 'Open Test',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      // WHEN: Opening script
      store.openScript('open-test');

      // THEN: Script should be active
      expect(useEditorStore.getState().activeScriptId).toBe('open-test');
    });

    it('should switch between scripts', () => {
      // GIVEN: Multiple scripts
      const store = useEditorStore.getState();
      store.addScript({
        id: 'script-1',
        name: 'Script 1',
        code: 'code 1',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.addScript({
        id: 'script-2',
        name: 'Script 2',
        code: 'code 2',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('script-1');

      // WHEN: Switching to different script
      store.openScript('script-2');

      // THEN: New script should be active
      expect(useEditorStore.getState().activeScriptId).toBe('script-2');
    });

    it('should close active script', () => {
      // GIVEN: Active script
      const store = useEditorStore.getState();
      store.addScript({
        id: 'close-test',
        name: 'Close Test',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('close-test');

      // WHEN: Closing script
      store.closeScript();

      // THEN: No active script
      expect(useEditorStore.getState().activeScriptId).toBeNull();
    });
  });

  describe('Save State', () => {
    it('should mark as saved', () => {
      // GIVEN: Unsaved changes
      useEditorStore.getState().addScript({
        id: 'save-test',
        name: 'Save Test',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      useEditorStore.getState().updateScript('save-test', 'modified code');
      expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);

      // WHEN: Marking as saved
      useEditorStore.getState().markSaved();

      // THEN: No unsaved changes
      expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('should mark as unsaved', () => {
      // GIVEN: Saved state
      const store = useEditorStore.getState();
      expect(store.hasUnsavedChanges).toBe(false);

      // WHEN: Marking as unsaved
      store.markUnsaved();

      // THEN: Has unsaved changes
      expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('Syntax Errors', () => {
    it('should set syntax errors', () => {
      // GIVEN: Initial state
      const store = useEditorStore.getState();

      // WHEN: Setting errors
      const errors = [
        { scriptId: 'script-1', line: 5, message: 'Unexpected token' },
        { scriptId: 'script-1', line: 10, message: 'Missing semicolon' },
      ];
      store.setSyntaxErrors(errors);

      // THEN: Errors should be set
      expect(useEditorStore.getState().syntaxErrors).toEqual(errors);
      expect(useEditorStore.getState().syntaxErrors).toHaveLength(2);
    });

    it('should clear syntax errors with empty array', () => {
      // GIVEN: Existing errors
      const store = useEditorStore.getState();
      store.setSyntaxErrors([{ scriptId: 'script-1', line: 1, message: 'Error' }]);

      // WHEN: Clearing errors
      store.setSyntaxErrors([]);

      // THEN: No errors
      expect(useEditorStore.getState().syntaxErrors).toEqual([]);
    });

    it('should replace errors completely', () => {
      // GIVEN: Initial errors
      const store = useEditorStore.getState();
      store.setSyntaxErrors([{ scriptId: 'script-1', line: 1, message: 'Old error' }]);

      // WHEN: Setting new errors
      store.setSyntaxErrors([{ scriptId: 'script-2', line: 2, message: 'New error' }]);

      // THEN: Only new errors exist
      const errors = useEditorStore.getState().syntaxErrors;
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('New error');
    });
  });

  describe('Reset', () => {
    it('should reset to initial state with default scripts', () => {
      // GIVEN: Modified state
      const store = useEditorStore.getState();
      store.addScript({
        id: 'custom-script',
        name: 'Custom',
        code: 'custom code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('custom-script');
      store.markUnsaved();
      store.setSyntaxErrors([{ scriptId: 'custom-script', line: 1, message: 'Error' }]);

      // WHEN: Resetting
      store.reset();

      // THEN: State should be reset
      const state = useEditorStore.getState();
      expect(state.activeScriptId).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.syntaxErrors).toEqual([]);
      // Custom script should be gone, only defaults remain
      expect(state.scripts.has('custom-script')).toBe(false);
    });
  });
});
