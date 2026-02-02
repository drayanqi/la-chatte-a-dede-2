/**
 * Editor Store Unit Tests
 *
 * Tests the Zustand store that manages editor state:
 * - Script fetching from API
 * - Script CRUD operations (add, update, delete)
 * - Active script navigation
 * - Save state tracking
 * - Syntax error tracking
 *
 * @see Epic 1: User Authentication & Onboarding
 * @see Story 1.4: Starter AI Template Provisioning
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useEditorStore } from '@/stores/editorStore';
import type { Script } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Editor Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useEditorStore.getState().reset();
    // Clear all mocks
    vi.clearAllMocks();
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty scripts Map initially', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: Scripts should be empty (loaded from API now)
      expect(state.scripts.size).toBe(0);
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

    it('should not be loading scripts initially', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: Should not be loading
      expect(state.isLoadingScripts).toBe(false);
    });

    it('should have no scripts error initially', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: Should have no error
      expect(state.scriptsError).toBeNull();
    });
  });

  describe('Fetch Scripts', () => {
    it('should fetch scripts successfully', async () => {
      // GIVEN: Authenticated user with token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const mockScripts = [
        {
          id: 'script-1',
          name: 'StarterAI.js',
          code: 'function update() {}',
          language: 'javascript',
          updated_at: '2026-01-25T12:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockScripts,
      });

      // WHEN: Fetching scripts
      await useEditorStore.getState().fetchScripts();

      // THEN: Scripts should be loaded
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(1);
      expect(state.scripts.get('script-1')?.name).toBe('StarterAI.js');
      expect(state.isLoadingScripts).toBe(false);
      expect(state.scriptsError).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      // GIVEN: Authenticated user with token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      // Use a promise that we control to check loading state
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      // WHEN: Starting fetch
      const fetchScriptsPromise = useEditorStore.getState().fetchScripts();

      // THEN: Should be loading
      expect(useEditorStore.getState().isLoadingScripts).toBe(true);

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: async () => [],
      });

      await fetchScriptsPromise;

      // THEN: Should no longer be loading
      expect(useEditorStore.getState().isLoadingScripts).toBe(false);
    });

    it('should handle fetch error gracefully', async () => {
      // GIVEN: Authenticated user with token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      // WHEN: Fetching scripts fails
      await useEditorStore.getState().fetchScripts();

      // THEN: Should have error state
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Unauthorized');
      expect(state.isLoadingScripts).toBe(false);
    });

    it('should handle network error gracefully', async () => {
      // GIVEN: Authenticated user with token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Network fails
      await useEditorStore.getState().fetchScripts();

      // THEN: Should have error state
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Failed to load scripts. Please try again.');
      expect(state.isLoadingScripts).toBe(false);
    });

    it('should not fetch without auth token', async () => {
      // GIVEN: No auth token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      // WHEN: Trying to fetch scripts
      await useEditorStore.getState().fetchScripts();

      // THEN: Should have error and not call fetch
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Script CRUD - Add', () => {
    it('should add a new script', () => {
      // GIVEN: Empty store
      const store = useEditorStore.getState();
      expect(store.scripts.size).toBe(0);

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
      expect(state.scripts.size).toBe(1);
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
      // GIVEN: Empty store
      const store = useEditorStore.getState();
      expect(store.scripts.size).toBe(0);

      // WHEN: Updating non-existent script
      store.updateScript('non-existent', 'new code');

      // THEN: State should remain unchanged
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(0);
    });
  });

  describe('Script CRUD - Delete', () => {
    it('should delete script via API', async () => {
      // GIVEN: Authenticated user with script to delete
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'delete-me',
        name: 'Delete Me',
        code: 'to be deleted',
        language: 'javascript',
        lastModified: new Date(),
      });
      expect(useEditorStore.getState().scripts.has('delete-me')).toBe(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });

      // WHEN: Deleting script
      const result = await useEditorStore.getState().deleteScript('delete-me');

      // THEN: Script should be removed
      expect(result).toBe(true);
      expect(useEditorStore.getState().scripts.has('delete-me')).toBe(false);
      expect(useEditorStore.getState().isDeleting).toBe(false);
    });

    it('should call DELETE API endpoint', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'api-delete-test',
        name: 'API Delete.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });

      // WHEN: Deleting
      await useEditorStore.getState().deleteScript('api-delete-test');

      // THEN: Correct API call made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scripts/api-delete-test'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should set isDeleting during deletion', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'deleting-state-test',
        name: 'Deleting.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      // WHEN: Starting deletion
      const deletePromise = useEditorStore.getState().deleteScript('deleting-state-test');

      // THEN: Should be deleting
      expect(useEditorStore.getState().isDeleting).toBe(true);

      // Resolve
      resolvePromise!({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });
      await deletePromise;

      // THEN: Should no longer be deleting
      expect(useEditorStore.getState().isDeleting).toBe(false);
    });

    it('should select another script when deleting active script', async () => {
      // GIVEN: Authenticated user with two scripts, one active
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'active-delete',
        name: 'Active Delete',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.addScript({
        id: 'other-script',
        name: 'Other Script',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('active-delete');
      expect(useEditorStore.getState().activeScriptId).toBe('active-delete');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });

      // WHEN: Deleting active script
      await useEditorStore.getState().deleteScript('active-delete');

      // THEN: Should select another script
      expect(useEditorStore.getState().activeScriptId).toBe('other-script');
    });

    it('should clear activeScriptId when deleting last script', async () => {
      // GIVEN: Authenticated user with only one script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'only-script',
        name: 'Only Script',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('only-script');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });

      // WHEN: Deleting the only script
      await useEditorStore.getState().deleteScript('only-script');

      // THEN: Active script should be null
      expect(useEditorStore.getState().activeScriptId).toBeNull();
    });

    it('should NOT clear activeScriptId when deleting different script', async () => {
      // GIVEN: Authenticated user with two scripts, one active
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });

      // WHEN: Deleting non-active script
      await useEditorStore.getState().deleteScript('script-b');

      // THEN: Active script should remain
      expect(useEditorStore.getState().activeScriptId).toBe('script-a');
    });

    it('should handle delete error gracefully', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'error-delete-test',
        name: 'Error.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Script not found' }),
      });

      // WHEN: Delete fails
      const result = await useEditorStore.getState().deleteScript('error-delete-test');

      // THEN: Should have error state and script should still exist
      expect(result).toBe(false);
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Script not found');
      expect(state.isDeleting).toBe(false);
      expect(state.scripts.has('error-delete-test')).toBe(true);
    });

    it('should handle network error during deletion', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'network-delete-test',
        name: 'Network.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Network fails
      const result = await useEditorStore.getState().deleteScript('network-delete-test');

      // THEN: Should have error state
      expect(result).toBe(false);
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Failed to delete script. Please try again.');
      expect(state.isDeleting).toBe(false);
    });

    it('should not delete without auth token', async () => {
      // GIVEN: No auth token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const store = useEditorStore.getState();
      store.addScript({
        id: 'no-auth-delete-test',
        name: 'NoAuth.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      // WHEN: Trying to delete
      const result = await useEditorStore.getState().deleteScript('no-auth-delete-test');

      // THEN: Should fail and not call fetch
      expect(result).toBe(false);
      expect(useEditorStore.getState().scriptsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not delete non-existent script', async () => {
      // GIVEN: Authenticated user but no script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      // WHEN: Trying to delete non-existent script
      const result = await useEditorStore.getState().deleteScript('non-existent');

      // THEN: Should fail
      expect(result).toBe(false);
      expect(useEditorStore.getState().scriptsError).toBe('Script not found');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should prevent concurrent deletions', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'concurrent-delete-test',
        name: 'Concurrent.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolveFirst: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Start first deletion
      const first = useEditorStore.getState().deleteScript('concurrent-delete-test');

      // WHEN: Trying to delete again while first is pending
      const second = await useEditorStore.getState().deleteScript('concurrent-delete-test');

      // THEN: Second should return false immediately
      expect(second).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveFirst!({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });
      await first;
    });

    it('should clear unsaved changes when deleting active script', async () => {
      // GIVEN: Authenticated user with unsaved changes on active script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'unsaved-delete-test',
        name: 'Unsaved.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.openScript('unsaved-delete-test');
      store.updateScript('unsaved-delete-test', 'modified code');
      expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Script deleted successfully' }),
      });

      // WHEN: Deleting active script
      await useEditorStore.getState().deleteScript('unsaved-delete-test');

      // THEN: Unsaved changes should be cleared
      expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
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

  describe('Error Handling', () => {
    it('should clear scripts error', async () => {
      // GIVEN: Store with error
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      await useEditorStore.getState().fetchScripts();
      expect(useEditorStore.getState().scriptsError).not.toBeNull();

      // WHEN: Clearing error
      useEditorStore.getState().clearScriptsError();

      // THEN: Error should be cleared
      expect(useEditorStore.getState().scriptsError).toBeNull();
    });
  });

  describe('Create Script', () => {
    it('should create script successfully via API', async () => {
      // GIVEN: Authenticated user
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const newScriptFromApi = {
        id: 'new-script-123',
        name: 'NewAI.js',
        code: '// AI Script: NewAI.js\nfunction update(me, ball) {}',
        language: 'javascript',
        updated_at: '2026-01-26T12:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => newScriptFromApi,
      });

      // WHEN: Creating a script
      await useEditorStore.getState().createScript('NewAI.js');

      // THEN: Script should be added to Map
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(1);
      expect(state.scripts.get('new-script-123')?.name).toBe('NewAI.js');
    });

    it('should open created script in editor automatically', async () => {
      // GIVEN: Authenticated user
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'auto-open-id',
          name: 'AutoOpen.js',
          code: 'code',
          language: 'javascript',
          updated_at: '2026-01-26T12:00:00Z',
        }),
      });

      // WHEN: Creating a script
      await useEditorStore.getState().createScript('AutoOpen.js');

      // THEN: Created script should be active
      expect(useEditorStore.getState().activeScriptId).toBe('auto-open-id');
    });

    it('should set loading state during creation', async () => {
      // GIVEN: Authenticated user
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      // WHEN: Starting creation
      const createPromise = useEditorStore.getState().createScript('Loading.js');

      // THEN: Should be creating
      expect(useEditorStore.getState().isCreatingScript).toBe(true);

      // Resolve
      resolvePromise!({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'loading-id',
          name: 'Loading.js',
          code: '',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await createPromise;

      // THEN: Should no longer be creating
      expect(useEditorStore.getState().isCreatingScript).toBe(false);
    });

    it('should handle creation error gracefully', async () => {
      // GIVEN: Authenticated user
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Validation failed' }),
      });

      // WHEN: Creation fails
      await useEditorStore.getState().createScript('Error.js');

      // THEN: Should have error state
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Validation failed');
      expect(state.isCreatingScript).toBe(false);
    });

    it('should handle network error during creation', async () => {
      // GIVEN: Authenticated user
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Network fails
      await useEditorStore.getState().createScript('Network.js');

      // THEN: Should have error state
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Failed to create script. Please try again.');
      expect(state.isCreatingScript).toBe(false);
    });

    it('should not create without auth token', async () => {
      // GIVEN: No auth token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      // WHEN: Trying to create script
      await useEditorStore.getState().createScript('NoAuth.js');

      // THEN: Should have error and not call fetch
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send correct API request with custom code', async () => {
      // GIVEN: Authenticated user
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'custom-id',
          name: 'Custom.js',
          code: 'custom code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Creating script with custom code
      await useEditorStore.getState().createScript('Custom.js', 'custom code');

      // THEN: Should send correct request
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scripts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: expect.stringContaining('Custom.js'),
        })
      );
    });

    it('should prevent concurrent script creation', async () => {
      // GIVEN: Authenticated user and creation already in progress
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      let resolveFirst: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Start first creation
      const first = useEditorStore.getState().createScript('First.js');

      // WHEN: Trying to create second while first is pending
      await useEditorStore.getState().createScript('Second.js');

      // THEN: Second should be rejected and first should still be in progress
      expect(useEditorStore.getState().isCreatingScript).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only first call made

      // Cleanup
      resolveFirst!({
        ok: true,
        status: 201,
        json: async () => ({ id: 'first-id', name: 'First.js', code: '', language: 'javascript', updated_at: new Date().toISOString() }),
      });
      await first;
    });
  });

  describe('Save Script', () => {
    it('should save script successfully via API', async () => {
      // GIVEN: Authenticated user with existing script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'save-test-id',
        name: 'SaveTest.js',
        code: 'updated code',
        language: 'javascript',
        lastModified: new Date('2024-01-01'),
      });
      store.markUnsaved();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'save-test-id',
          name: 'SaveTest.js',
          code: 'updated code',
          language: 'javascript',
          updated_at: '2026-02-01T12:00:00Z',
        }),
      });

      // WHEN: Saving the script
      const result = await useEditorStore.getState().saveScript('save-test-id');

      // THEN: Save should succeed
      expect(result).toBe(true);
      const state = useEditorStore.getState();
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.saveStatus).toBe('saved');
      expect(state.isSaving).toBe(false);
    });

    it('should send PUT request with correct payload', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'payload-test',
        name: 'Payload.js',
        code: 'test code content',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'payload-test',
          name: 'Payload.js',
          code: 'test code content',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Saving
      await useEditorStore.getState().saveScript('payload-test');

      // THEN: Correct API call made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scripts/payload-test'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({ code: 'test code content', name: 'Payload.js' }),
        })
      );
    });

    it('should set isSaving during save request', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'saving-state-test',
        name: 'SavingState.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      // WHEN: Starting save
      const savePromise = useEditorStore.getState().saveScript('saving-state-test');

      // THEN: Should be saving
      expect(useEditorStore.getState().isSaving).toBe(true);
      expect(useEditorStore.getState().saveStatus).toBe('saving');

      // Resolve
      resolvePromise!({
        ok: true,
        json: async () => ({
          id: 'saving-state-test',
          name: 'SavingState.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await savePromise;

      // THEN: Should no longer be saving
      expect(useEditorStore.getState().isSaving).toBe(false);
    });

    it('should handle save error and preserve code', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'error-test',
        name: 'Error.js',
        code: 'preserved code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.markUnsaved();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Server error' }),
      });

      // WHEN: Save fails
      const result = await useEditorStore.getState().saveScript('error-test');

      // THEN: Should have error state and preserve code
      expect(result).toBe(false);
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Server error');
      expect(state.saveStatus).toBe('error');
      expect(state.isSaving).toBe(false);
      // Code should be preserved
      expect(state.scripts.get('error-test')?.code).toBe('preserved code');
    });

    it('should handle network error during save', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'network-error-test',
        name: 'Network.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Network fails
      const result = await useEditorStore.getState().saveScript('network-error-test');

      // THEN: Should have error state
      expect(result).toBe(false);
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Failed to save script. Please try again.');
      expect(state.saveStatus).toBe('error');
    });

    it('should not save without auth token', async () => {
      // GIVEN: No auth token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const store = useEditorStore.getState();
      store.addScript({
        id: 'no-auth-test',
        name: 'NoAuth.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      // WHEN: Trying to save
      const result = await useEditorStore.getState().saveScript('no-auth-test');

      // THEN: Should fail and not call fetch
      expect(result).toBe(false);
      expect(useEditorStore.getState().scriptsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not save non-existent script', async () => {
      // GIVEN: Authenticated user but no script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      // WHEN: Trying to save non-existent script
      const result = await useEditorStore.getState().saveScript('non-existent');

      // THEN: Should fail
      expect(result).toBe(false);
      expect(useEditorStore.getState().scriptsError).toBe('Script not found');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should prevent concurrent saves', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'concurrent-test',
        name: 'Concurrent.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolveFirst: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Start first save
      const first = useEditorStore.getState().saveScript('concurrent-test');

      // WHEN: Trying to save again while first is pending
      const second = await useEditorStore.getState().saveScript('concurrent-test');

      // THEN: Second should return false immediately
      expect(second).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveFirst!({
        ok: true,
        json: async () => ({
          id: 'concurrent-test',
          name: 'Concurrent.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await first;
    });

    it('should update lastModified from server response', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'timestamp-test',
        name: 'Timestamp.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date('2024-01-01'),
      });

      const serverTimestamp = '2026-02-01T15:30:00Z';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'timestamp-test',
          name: 'Timestamp.js',
          code: 'code',
          language: 'javascript',
          updated_at: serverTimestamp,
        }),
      });

      // WHEN: Saving
      await useEditorStore.getState().saveScript('timestamp-test');

      // THEN: lastModified should be updated from server
      const script = useEditorStore.getState().scripts.get('timestamp-test');
      expect(script?.lastModified.toISOString()).toBe(serverTimestamp);
    });
  });

  describe('Save Status', () => {
    it('should have initial idle save status', () => {
      // GIVEN: Fresh store
      const state = useEditorStore.getState();

      // THEN: Save status should be idle
      expect(state.saveStatus).toBe('idle');
      expect(state.isSaving).toBe(false);
    });

    it('should set save status via setSaveStatus', () => {
      // GIVEN: Initial state
      const store = useEditorStore.getState();

      // WHEN: Setting save status
      store.setSaveStatus('saved');

      // THEN: Status should be updated
      expect(useEditorStore.getState().saveStatus).toBe('saved');
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', async () => {
      // GIVEN: Modified state
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'script-1', name: 'Test', code: '', language: 'javascript', updated_at: new Date().toISOString() }],
      });
      await useEditorStore.getState().fetchScripts();
      useEditorStore.getState().openScript('script-1');
      useEditorStore.getState().markUnsaved();
      useEditorStore.getState().setSyntaxErrors([{ scriptId: 'script-1', line: 1, message: 'Error' }]);

      // WHEN: Resetting
      useEditorStore.getState().reset();

      // THEN: State should be reset
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(0);
      expect(state.activeScriptId).toBeNull();
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.syntaxErrors).toEqual([]);
      expect(state.isLoadingScripts).toBe(false);
      expect(state.scriptsError).toBeNull();
    });
  });

  describe('Rename Script', () => {
    it('should rename script successfully via API', async () => {
      // GIVEN: Authenticated user with existing script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'rename-test-id',
        name: 'OldName.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date('2024-01-01'),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'rename-test-id',
          name: 'NewName.js',
          code: 'code',
          language: 'javascript',
          updated_at: '2026-02-02T12:00:00Z',
        }),
      });

      // WHEN: Renaming the script
      const result = await useEditorStore.getState().renameScript('rename-test-id', 'NewName.js');

      // THEN: Rename should succeed
      expect(result).toBe(true);
      const state = useEditorStore.getState();
      expect(state.scripts.get('rename-test-id')?.name).toBe('NewName.js');
      expect(state.isRenaming).toBe(false);
      expect(state.scriptsError).toBeNull();
    });

    it('should send PUT request with correct payload', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'payload-rename-test',
        name: 'Old.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'payload-rename-test',
          name: 'New.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Renaming
      await useEditorStore.getState().renameScript('payload-rename-test', 'New.js');

      // THEN: Correct API call made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scripts/payload-rename-test'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({ name: 'New.js' }),
        })
      );
    });

    it('should skip API call when name is unchanged', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'same-name-test',
        name: 'Same.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      // WHEN: Renaming with same name
      const result = await useEditorStore.getState().renameScript('same-name-test', 'Same.js');

      // THEN: Should succeed without API call
      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should set isRenaming during rename request', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'renaming-state-test',
        name: 'Old.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      // WHEN: Starting rename
      const renamePromise = useEditorStore.getState().renameScript('renaming-state-test', 'New.js');

      // THEN: Should be renaming
      expect(useEditorStore.getState().isRenaming).toBe(true);

      // Resolve
      resolvePromise!({
        ok: true,
        json: async () => ({
          id: 'renaming-state-test',
          name: 'New.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await renamePromise;

      // THEN: Should no longer be renaming
      expect(useEditorStore.getState().isRenaming).toBe(false);
    });

    it('should handle rename error gracefully', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'error-rename-test',
        name: 'Old.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Name already exists' }),
      });

      // WHEN: Rename fails
      const result = await useEditorStore.getState().renameScript('error-rename-test', 'Existing.js');

      // THEN: Should have error state
      expect(result).toBe(false);
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Name already exists');
      expect(state.isRenaming).toBe(false);
      // Name should be unchanged
      expect(state.scripts.get('error-rename-test')?.name).toBe('Old.js');
    });

    it('should handle network error during rename', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'network-rename-test',
        name: 'Old.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Network fails
      const result = await useEditorStore.getState().renameScript('network-rename-test', 'New.js');

      // THEN: Should have error state
      expect(result).toBe(false);
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Failed to rename script. Please try again.');
      expect(state.isRenaming).toBe(false);
    });

    it('should not rename without auth token', async () => {
      // GIVEN: No auth token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const store = useEditorStore.getState();
      store.addScript({
        id: 'no-auth-rename-test',
        name: 'NoAuth.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      // WHEN: Trying to rename
      const result = await useEditorStore.getState().renameScript('no-auth-rename-test', 'New.js');

      // THEN: Should fail and not call fetch
      expect(result).toBe(false);
      expect(useEditorStore.getState().scriptsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not rename non-existent script', async () => {
      // GIVEN: Authenticated user but no script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      // WHEN: Trying to rename non-existent script
      const result = await useEditorStore.getState().renameScript('non-existent', 'New.js');

      // THEN: Should fail
      expect(result).toBe(false);
      expect(useEditorStore.getState().scriptsError).toBe('Script not found');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should prevent concurrent renames', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'concurrent-rename-test',
        name: 'Original.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolveFirst: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Start first rename
      const first = useEditorStore.getState().renameScript('concurrent-rename-test', 'First.js');

      // WHEN: Trying to rename again while first is pending
      const second = await useEditorStore.getState().renameScript('concurrent-rename-test', 'Second.js');

      // THEN: Second should return false immediately
      expect(second).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveFirst!({
        ok: true,
        json: async () => ({
          id: 'concurrent-rename-test',
          name: 'First.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await first;
    });

    it('should update lastModified from server response', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'timestamp-rename-test',
        name: 'Old.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date('2024-01-01'),
      });

      const serverTimestamp = '2026-02-02T15:30:00Z';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'timestamp-rename-test',
          name: 'New.js',
          code: 'code',
          language: 'javascript',
          updated_at: serverTimestamp,
        }),
      });

      // WHEN: Renaming
      await useEditorStore.getState().renameScript('timestamp-rename-test', 'New.js');

      // THEN: lastModified should be updated from server
      const script = useEditorStore.getState().scripts.get('timestamp-rename-test');
      expect(script?.lastModified.toISOString()).toBe(serverTimestamp);
    });
  });

  describe('Duplicate Script', () => {
    it('should duplicate script successfully via API', async () => {
      // GIVEN: Authenticated user with existing script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'original-id',
        name: 'Original.js',
        code: 'original code',
        language: 'javascript',
        lastModified: new Date('2024-01-01'),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'duplicate-id',
          name: 'Copy of Original.js',
          code: 'original code',
          language: 'javascript',
          updated_at: '2026-02-02T12:00:00Z',
        }),
      });

      // WHEN: Duplicating the script
      const newId = await useEditorStore.getState().duplicateScript('original-id');

      // THEN: Duplicate should be created
      expect(newId).toBe('duplicate-id');
      const state = useEditorStore.getState();
      expect(state.scripts.size).toBe(2);
      expect(state.scripts.get('duplicate-id')?.name).toBe('Copy of Original.js');
      expect(state.scripts.get('duplicate-id')?.code).toBe('original code');
      expect(state.isDuplicating).toBe(false);
      expect(state.scriptsError).toBeNull();
    });

    it('should send POST request with correct payload', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'payload-dup-test',
        name: 'Payload.js',
        code: 'test code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'new-payload-id',
          name: 'Copy of Payload.js',
          code: 'test code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Duplicating
      await useEditorStore.getState().duplicateScript('payload-dup-test');

      // THEN: Correct API call made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scripts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: expect.stringContaining('Copy of Payload.js'),
        })
      );

      // Check that code is copied correctly
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.code).toBe('test code');
      expect(callBody.language).toBe('javascript');
    });

    it('should generate unique name when Copy of already exists', async () => {
      // GIVEN: Authenticated user with script and existing copy
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'original-id',
        name: 'Test.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.addScript({
        id: 'copy-1-id',
        name: 'Copy of Test.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'copy-2-id',
          name: 'Copy of Test (2).js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Duplicating
      await useEditorStore.getState().duplicateScript('original-id');

      // THEN: Should request with incremented name
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('Copy of Test (2).js');
    });

    it('should auto-open duplicated script', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'auto-open-original',
        name: 'AutoOpen.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'auto-open-copy',
          name: 'Copy of AutoOpen.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Duplicating
      await useEditorStore.getState().duplicateScript('auto-open-original');

      // THEN: Duplicated script should be active
      expect(useEditorStore.getState().activeScriptId).toBe('auto-open-copy');
    });

    it('should set isDuplicating during duplication', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'dup-state-test',
        name: 'DupState.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      // WHEN: Starting duplication
      const dupPromise = useEditorStore.getState().duplicateScript('dup-state-test');

      // THEN: Should be duplicating
      expect(useEditorStore.getState().isDuplicating).toBe(true);

      // Resolve
      resolvePromise!({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'new-dup-id',
          name: 'Copy of DupState.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await dupPromise;

      // THEN: Should no longer be duplicating
      expect(useEditorStore.getState().isDuplicating).toBe(false);
    });

    it('should keep original script unchanged after duplication', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const originalDate = new Date('2024-01-01');
      const store = useEditorStore.getState();
      store.addScript({
        id: 'unchanged-original',
        name: 'Unchanged.js',
        code: 'original code',
        language: 'javascript',
        lastModified: originalDate,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'new-copy',
          name: 'Copy of Unchanged.js',
          code: 'original code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Duplicating
      await useEditorStore.getState().duplicateScript('unchanged-original');

      // THEN: Original should be unchanged
      const original = useEditorStore.getState().scripts.get('unchanged-original');
      expect(original?.name).toBe('Unchanged.js');
      expect(original?.code).toBe('original code');
      expect(original?.lastModified.getTime()).toBe(originalDate.getTime());
    });

    it('should handle duplication error gracefully', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'error-dup-test',
        name: 'Error.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Quota exceeded' }),
      });

      // WHEN: Duplication fails
      const result = await useEditorStore.getState().duplicateScript('error-dup-test');

      // THEN: Should return null and have error state
      expect(result).toBeNull();
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Quota exceeded');
      expect(state.isDuplicating).toBe(false);
      // Original still exists
      expect(state.scripts.has('error-dup-test')).toBe(true);
    });

    it('should handle network error during duplication', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'network-dup-test',
        name: 'Network.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // WHEN: Network fails
      const result = await useEditorStore.getState().duplicateScript('network-dup-test');

      // THEN: Should have error state
      expect(result).toBeNull();
      const state = useEditorStore.getState();
      expect(state.scriptsError).toBe('Failed to duplicate script. Please try again.');
      expect(state.isDuplicating).toBe(false);
    });

    it('should not duplicate without auth token', async () => {
      // GIVEN: No auth token
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const store = useEditorStore.getState();
      store.addScript({
        id: 'no-auth-dup-test',
        name: 'NoAuth.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      // WHEN: Trying to duplicate
      const result = await useEditorStore.getState().duplicateScript('no-auth-dup-test');

      // THEN: Should fail and not call fetch
      expect(result).toBeNull();
      expect(useEditorStore.getState().scriptsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not duplicate non-existent script', async () => {
      // GIVEN: Authenticated user but no script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      // WHEN: Trying to duplicate non-existent script
      const result = await useEditorStore.getState().duplicateScript('non-existent');

      // THEN: Should fail
      expect(result).toBeNull();
      expect(useEditorStore.getState().scriptsError).toBe('Script not found');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should prevent concurrent duplications', async () => {
      // GIVEN: Authenticated user with script
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'concurrent-dup-test',
        name: 'Concurrent.js',
        code: 'code',
        language: 'javascript',
        lastModified: new Date(),
      });

      let resolveFirst: (value: unknown) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      mockFetch.mockReturnValueOnce(firstPromise);

      // Start first duplication
      const first = useEditorStore.getState().duplicateScript('concurrent-dup-test');

      // WHEN: Trying to duplicate again while first is pending
      const second = await useEditorStore.getState().duplicateScript('concurrent-dup-test');

      // THEN: Second should return null immediately
      expect(second).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cleanup
      resolveFirst!({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'concurrent-copy',
          name: 'Copy of Concurrent.js',
          code: 'code',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });
      await first;
    });

    it('should place duplicated script at top of list', async () => {
      // GIVEN: Authenticated user with multiple scripts
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      const store = useEditorStore.getState();
      store.addScript({
        id: 'script-1',
        name: 'First.js',
        code: 'code 1',
        language: 'javascript',
        lastModified: new Date(),
      });
      store.addScript({
        id: 'script-2',
        name: 'Second.js',
        code: 'code 2',
        language: 'javascript',
        lastModified: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'new-copy',
          name: 'Copy of Second.js',
          code: 'code 2',
          language: 'javascript',
          updated_at: new Date().toISOString(),
        }),
      });

      // WHEN: Duplicating
      await useEditorStore.getState().duplicateScript('script-2');

      // THEN: New script should be at top of list
      const scriptIds = Array.from(useEditorStore.getState().scripts.keys());
      expect(scriptIds[0]).toBe('new-copy');
    });
  });
});
