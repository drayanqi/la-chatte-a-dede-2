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
      // GIVEN: Empty store
      const store = useEditorStore.getState();
      expect(store.scripts.size).toBe(0);

      // WHEN: Deleting non-existent script
      store.deleteScript('non-existent-id');

      // THEN: No error, state unchanged
      expect(useEditorStore.getState().scripts.size).toBe(0);
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
});
