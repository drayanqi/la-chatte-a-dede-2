/**
 * Tactics Store Unit Tests
 *
 * Tests the Zustand store that manages tactic state:
 * - Tactics fetching from API
 * - Tactic creation (POST) with slot payload serialization
 * - Tactic updates (PUT) with partial payloads
 * - Active tactic selection
 * - Error and loading states
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.1: Tactics Data Model & API (Task 7/8)
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTacticsStore } from '@/stores/tacticsStore';
import type { TacticConfig, TacticPlayerConfig } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTacticFromApi = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'tactic-1',
  name: '1-2-2 Formation',
  isSystem: false,
  players: [
    { playerSlot: 1, positionX: 50.0, positionY: 45.0, scriptId: 'script-1' },
    { playerSlot: 2, positionX: 25.0, positionY: 30.0, scriptId: null },
  ],
  ...overrides,
});

const makeSlots = (): TacticPlayerConfig[] => [
  { playerSlot: 1, positionX: 50, positionY: 45, scriptId: 'script-1' },
  { playerSlot: 2, positionX: 25, positionY: 30, scriptId: null },
];

describe('Tactics Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTacticsStore.getState().reset();
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
    it('should have empty tactics list initially', () => {
      const state = useTacticsStore.getState();

      expect(state.tactics).toEqual([]);
    });

    it('should have no active tactic initially', () => {
      const state = useTacticsStore.getState();

      expect(state.activeTacticId).toBeNull();
    });

    it('should not be loading or saving initially', () => {
      const state = useTacticsStore.getState();

      expect(state.isLoadingTactics).toBe(false);
      expect(state.isSavingTactic).toBe(false);
    });

    it('should have no error initially', () => {
      const state = useTacticsStore.getState();

      expect(state.tacticsError).toBeNull();
    });
  });

  describe('Fetch Tactics', () => {
    it('should fetch tactics successfully with camelCase mapping', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockTacticFromApi()],
      });

      await useTacticsStore.getState().fetchTactics();

      const state = useTacticsStore.getState();
      expect(state.tactics).toHaveLength(1);
      expect(state.tactics[0]).toEqual({
        id: 'tactic-1',
        name: '1-2-2 Formation',
        isSystem: false,
        players: [
          { playerSlot: 1, positionX: 50.0, positionY: 45.0, scriptId: 'script-1' },
          { playerSlot: 2, positionX: 25.0, positionY: 30.0, scriptId: null },
        ],
      } satisfies TacticConfig);
      expect(state.isLoadingTactics).toBe(false);
      expect(state.tacticsError).toBeNull();
    });

    it('should call the tactics endpoint with auth headers', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await useTacticsStore.getState().fetchTactics();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('should set loading state during fetch', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      const fetchPromiseStore = useTacticsStore.getState().fetchTactics();

      expect(useTacticsStore.getState().isLoadingTactics).toBe(true);

      resolvePromise!({
        ok: true,
        json: async () => [],
      });
      await fetchPromiseStore;

      expect(useTacticsStore.getState().isLoadingTactics).toBe(false);
    });

    it('should handle fetch error gracefully', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await useTacticsStore.getState().fetchTactics();

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Unauthorized');
      expect(state.isLoadingTactics).toBe(false);
    });

    it('should handle network error gracefully', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useTacticsStore.getState().fetchTactics();

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Failed to load tactics. Please try again.');
      expect(state.isLoadingTactics).toBe(false);
    });

    it('should not fetch without auth token', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await useTacticsStore.getState().fetchTactics();

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Save Tactic', () => {
    it('should create a tactic via POST with snake_case slot payload', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'new-tactic' }),
      });

      await useTacticsStore.getState().saveTactic('My Tactic', makeSlots());

      const state = useTacticsStore.getState();
      expect(state.tactics).toHaveLength(1);
      expect(state.tactics[0]?.id).toBe('new-tactic');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'My Tactic',
            players: [
              { player_slot: 1, position_x: 50, position_y: 45, script_id: 'script-1' },
              { player_slot: 2, position_x: 25, position_y: 30, script_id: null },
            ],
          }),
        }),
      );
    });

    it('should set activeTacticId to the created tactic', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'created-id' }),
      });

      await useTacticsStore.getState().saveTactic('New', makeSlots());

      expect(useTacticsStore.getState().activeTacticId).toBe('created-id');
    });

    it('should set saving state during creation', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(fetchPromise);

      const savePromise = useTacticsStore.getState().saveTactic('Loading', makeSlots());

      expect(useTacticsStore.getState().isSavingTactic).toBe(true);

      resolvePromise!({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'slow' }),
      });
      await savePromise;

      expect(useTacticsStore.getState().isSavingTactic).toBe(false);
    });

    it('should handle save error gracefully', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Validation failed' }),
      });

      await useTacticsStore.getState().saveTactic('Bad', makeSlots());

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Validation failed');
      expect(state.isSavingTactic).toBe(false);
      expect(state.tactics).toHaveLength(0);
    });

    it('should handle network error during save', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useTacticsStore.getState().saveTactic('Network', makeSlots());

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Failed to save tactic. Please try again.');
      expect(state.isSavingTactic).toBe(false);
    });

    it('should not save without auth token', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await useTacticsStore.getState().saveTactic('NoAuth', makeSlots());

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Update Tactic', () => {
    it('should update name only via PUT', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ name: 'Renamed' }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', 'Renamed');

      const state = useTacticsStore.getState();
      expect(state.tactics[0]?.name).toBe('Renamed');
      expect(state.tactics[0]?.players).toHaveLength(2);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Renamed' }),
        }),
      );
    });

    it('should update slots only via PUT', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      const newSlots: TacticPlayerConfig[] = [
        { playerSlot: 1, positionX: 10, positionY: 20, scriptId: 'script-9' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          mockTacticFromApi({
            players: [{ playerSlot: 1, positionX: 10.0, positionY: 20.0, scriptId: 'script-9' }],
          }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', undefined, newSlots);

      const state = useTacticsStore.getState();
      expect(state.tactics[0]?.players).toEqual([
        { playerSlot: 1, positionX: 10.0, positionY: 20.0, scriptId: 'script-9' },
      ]);
      expect(state.tactics[0]?.name).toBe('1-2-2 Formation');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            players: [
              { player_slot: 1, position_x: 10, position_y: 20, script_id: 'script-9' },
            ],
          }),
        }),
      );
    });

    it('should replace the tactic in the list on update', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [
          mockTacticFromApi() as unknown as TacticConfig,
          mockTacticFromApi({ id: 'tactic-2', name: 'Other' }) as unknown as TacticConfig,
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ name: 'Updated' }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', 'Updated');

      const state = useTacticsStore.getState();
      expect(state.tactics).toHaveLength(2);
      expect(state.tactics[0]?.name).toBe('Updated');
      expect(state.tactics[1]?.name).toBe('Other');
    });

    it('should set the saved feedback on successful update', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ name: 'Updated' }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', 'Updated');

      const state = useTacticsStore.getState();
      expect(state.lastSavedTacticId).toBe('tactic-1');
      expect(state.lastSavedAt).not.toBeNull();
    });

    it('should handle update error gracefully', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Not allowed' }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', 'Hacked');

      const state = useTacticsStore.getState();
      expect(state.tacticsError).toBe('Not allowed');
      expect(state.tactics[0]?.name).toBe('1-2-2 Formation');
      expect(state.isSavingTactic).toBe(false);
    });

    it('should not update without auth token', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await useTacticsStore.getState().updateTactic('tactic-1', 'X');

      expect(useTacticsStore.getState().tacticsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Tactic Selection', () => {
    it('should select a tactic by id', () => {
      useTacticsStore.setState({
        tactics: [{ id: 'tactic-42', name: 'T', isSystem: false, players: [] }],
      });

      useTacticsStore.getState().selectTactic('tactic-42');

      expect(useTacticsStore.getState().activeTacticId).toBe('tactic-42');
    });

    it('should ignore an id that is not in the tactics list', () => {
      useTacticsStore.setState({
        tactics: [{ id: 'tactic-42', name: 'T', isSystem: false, players: [] }],
        activeTacticId: 'tactic-42',
      });

      useTacticsStore.getState().selectTactic('tactic-unknown');

      expect(useTacticsStore.getState().activeTacticId).toBe('tactic-42');
    });

    it('should clear selection with null', () => {
      useTacticsStore.getState().selectTactic('tactic-42');
      useTacticsStore.getState().selectTactic(null);

      expect(useTacticsStore.getState().activeTacticId).toBeNull();
    });

    it('should remember the selection for the next session', () => {
      useTacticsStore.setState({
        tactics: [{ id: 'tactic-42', name: 'T', isSystem: false, players: [] }],
      });

      useTacticsStore.getState().selectTactic('tactic-42');

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'last_active_tactic_id',
        'tactic-42'
      );

      useTacticsStore.getState().selectTactic(null);

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('last_active_tactic_id');
    });

    it('should restore the remembered selection after a fresh fetch', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) =>
        key === 'last_active_tactic_id' ? 'tactic-1' : 'test-token'
      );

      useTacticsStore.setState({
        tactics: [
          mockTacticFromApi() as unknown as TacticConfig,
          mockTacticFromApi({ id: 'tactic-2', name: 'Other' }) as unknown as TacticConfig,
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          mockTacticFromApi(),
          mockTacticFromApi({ id: 'tactic-2', name: 'Other' }),
        ],
      });

      await useTacticsStore.getState().fetchTactics();

      expect(useTacticsStore.getState().activeTacticId).toBe('tactic-1');
    });
  });

  describe('Detach Deleted Script From Players', () => {
    const tacticWithScript = (id: string, scriptId: string | null): TacticConfig => ({
      id,
      name: `Tactic ${id}`,
      isSystem: false,
      players: [
        { playerSlot: 1, positionX: 8, positionY: 25, scriptId },
        { playerSlot: 2, positionX: 25, positionY: 15, scriptId: 'script-other' },
      ],
    });

    it('should null the script reference in every tactic holding it', () => {
      useTacticsStore.setState({
        tactics: [
          tacticWithScript('tactic-1', 'script-deleted'),
          tacticWithScript('tactic-2', 'script-deleted'),
        ],
      });

      useTacticsStore.getState().detachScriptFromPlayers('script-deleted');

      const { tactics } = useTacticsStore.getState();
      for (const tactic of tactics) {
        expect(tactic.players[0].scriptId).toBeNull();
        expect(tactic.players[1].scriptId).toBe('script-other');
      }
    });

    it('should only touch slots referencing the deleted script', () => {
      const untouched = tacticWithScript('tactic-1', 'script-keep');
      useTacticsStore.setState({ tactics: [untouched] });

      useTacticsStore.getState().detachScriptFromPlayers('script-deleted');

      expect(useTacticsStore.getState().tactics[0]).toBe(untouched);
      expect(useTacticsStore.getState().tactics[0].players[0].scriptId).toBe('script-keep');
    });

    it('should be a no-op when no player references the deleted script', () => {
      const before = [tacticWithScript('tactic-1', 'script-keep')];
      useTacticsStore.setState({ tactics: before });

      useTacticsStore.getState().detachScriptFromPlayers('script-deleted');

      expect(useTacticsStore.getState().tactics[0].players[0].scriptId).toBe('script-keep');
      expect(useTacticsStore.getState().tactics[0].players[1].scriptId).toBe('script-other');
    });
  });

  describe('Create Tactic (+ button, story 3.2)', () => {
    it('should POST the default formation with an auto-generated name', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'created-1', name: 'Tactic 1' }),
      });

      const created = await useTacticsStore.getState().createTactic();

      expect(created?.id).toBe('created-1');
      expect(created?.name).toBe('Tactic 1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Tactic 1',
            players: [
              { player_slot: 1, position_x: 8, position_y: 25, script_id: null },
              { player_slot: 2, position_x: 25, position_y: 15, script_id: null },
              { player_slot: 3, position_x: 25, position_y: 35, script_id: null },
              { player_slot: 4, position_x: 40, position_y: 15, script_id: null },
              { player_slot: 5, position_x: 40, position_y: 35, script_id: null },
            ],
          }),
        }),
      );
    });

    it('should name the new tactic after the existing count', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'created-2', name: 'Tactic 2' }),
      });

      await useTacticsStore.getState().createTactic();

      const body = JSON.parse(
        (mockFetch.mock.calls[0]?.[1] as RequestInit).body as string
      ) as { name: string };
      expect(body.name).toBe('Tactic 2');
    });

    it('should append the tactic, activate it and set the saved feedback', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'created-3', name: 'Tactic 1' }),
      });

      await useTacticsStore.getState().createTactic();

      const state = useTacticsStore.getState();
      expect(state.tactics).toHaveLength(1);
      expect(state.activeTacticId).toBe('created-3');
      expect(state.lastSavedTacticId).toBe('created-3');
      expect(state.lastSavedAt).not.toBeNull();
      expect(state.isSavingTactic).toBe(false);
    });

    it('should not create twice concurrently (in-flight guard)', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      let resolvePromise: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const first = useTacticsStore.getState().createTactic();
      const second = useTacticsStore.getState().createTactic();

      resolvePromise!({
        ok: true,
        status: 201,
        json: async () => mockTacticFromApi({ id: 'created-4' }),
      });

      await Promise.all([first, second]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle create error gracefully', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Validation failed' }),
      });

      const created = await useTacticsStore.getState().createTactic();

      expect(created).toBeNull();
      expect(useTacticsStore.getState().tacticsError).toBe('Validation failed');
      expect(useTacticsStore.getState().activeTacticId).toBeNull();
    });

    it('should not create without auth token', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await useTacticsStore.getState().createTactic();

      expect(useTacticsStore.getState().tacticsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Delete Tactic (story 3.2)', () => {
    it('should DELETE the tactic and remove it from the list', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [
          mockTacticFromApi() as unknown as TacticConfig,
          mockTacticFromApi({ id: 'tactic-2', name: 'Other' }) as unknown as TacticConfig,
        ],
        activeTacticId: 'tactic-2',
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      const deleted = await useTacticsStore.getState().deleteTactic('tactic-2');

      expect(deleted).toBe(true);
      expect(useTacticsStore.getState().tactics).toHaveLength(1);
      expect(useTacticsStore.getState().tactics[0]?.id).toBe('tactic-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-2'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should promote a neighbor when deleting the active tactic', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [
          mockTacticFromApi() as unknown as TacticConfig,
          mockTacticFromApi({ id: 'tactic-2', name: 'Other' }) as unknown as TacticConfig,
        ],
        activeTacticId: 'tactic-1',
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await useTacticsStore.getState().deleteTactic('tactic-1');

      const state = useTacticsStore.getState();
      expect(state.activeTacticId).toBe('tactic-2');
    });

    it('should keep the selection when deleting a non-active tactic', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [
          mockTacticFromApi() as unknown as TacticConfig,
          mockTacticFromApi({ id: 'tactic-2', name: 'Other' }) as unknown as TacticConfig,
        ],
        activeTacticId: 'tactic-1',
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      await useTacticsStore.getState().deleteTactic('tactic-2');

      expect(useTacticsStore.getState().activeTacticId).toBe('tactic-1');
    });

    it('should recreate a default tactic when deleting the last one', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
        activeTacticId: 'tactic-1',
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockTacticFromApi({ id: 'recreated-1', name: 'Tactic 1' }),
        });
      await useTacticsStore.getState().deleteTactic('tactic-1');

      const state = useTacticsStore.getState();
      expect(state.tactics).toHaveLength(1);
      expect(state.tactics[0]?.id).toBe('recreated-1');
      expect(state.activeTacticId).toBe('recreated-1');
      expect(state.isDeletingTactic).toBe(false);
      expect(state.isSavingTactic).toBe(false);

      // The recreation is a default-formation POST named "Tactic 1"
      const createCall = mockFetch.mock.calls[1];
      expect(createCall?.[0]).toEqual(expect.stringContaining('/tactics'));
      expect((createCall?.[1] as RequestInit).method).toBe('POST');
      expect(JSON.parse((createCall?.[1] as RequestInit).body as string).name).toBe('Tactic 1');
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'last_active_tactic_id',
        'recreated-1'
      );
    });

    it('should handle delete error gracefully', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Tactic not found' }),
      });

      const deleted = await useTacticsStore.getState().deleteTactic('tactic-1');

      expect(deleted).toBe(false);
      expect(useTacticsStore.getState().tacticsError).toBe('Tactic not found');
      expect(useTacticsStore.getState().tactics).toHaveLength(1);
    });

    it('should not delete without auth token', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await useTacticsStore.getState().deleteTactic('tactic-1');

      expect(useTacticsStore.getState().tacticsError).toBe('Not authenticated');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should clear tactics error', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      await useTacticsStore.getState().fetchTactics();
      expect(useTacticsStore.getState().tacticsError).not.toBeNull();

      useTacticsStore.getState().clearTacticsError();

      expect(useTacticsStore.getState().tacticsError).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockTacticFromApi()],
      });
      await useTacticsStore.getState().fetchTactics();
      useTacticsStore.getState().selectTactic('tactic-1');

      useTacticsStore.getState().reset();

      const state = useTacticsStore.getState();
      expect(state.tactics).toEqual([]);
      expect(state.activeTacticId).toBeNull();
      expect(state.isLoadingTactics).toBe(false);
      expect(state.isSavingTactic).toBe(false);
      expect(state.tacticsError).toBeNull();
    });
  });

  describe('Queued saves & script tombstones (code review 2026-09-13)', () => {
    it('should queue an update issued while a save is in flight and run it after', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      let resolveFirst: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          mockTacticFromApi({
            players: [{ playerSlot: 1, positionX: 30.0, positionY: 20.0, scriptId: 'script-9' }],
          }),
      });

      const first = useTacticsStore.getState().updateTactic('tactic-1', 'First');
      const second = useTacticsStore.getState().updateTactic('tactic-1', undefined, [
        { playerSlot: 1, positionX: 30, positionY: 20, scriptId: 'script-9' },
      ]);
      await second; // resolves immediately: queued, not dropped

      resolveFirst!({ ok: true, json: async () => mockTacticFromApi({ name: 'First' }) });
      await first;

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      const secondCall = mockFetch.mock.calls[1];
      expect(JSON.parse((secondCall?.[1] as RequestInit).body as string)).toEqual({
        players: [{ player_slot: 1, position_x: 30, position_y: 20, script_id: 'script-9' }],
      });
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(false));
    });

    it('should persist a rename queued behind an in-flight slots PUT', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      let resolveFirst: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ name: 'Renamed' }),
      });

      const first = useTacticsStore.getState().updateTactic('tactic-1', undefined, makeSlots());
      // Same tactic: the rename queues behind the in-flight slots PUT
      const second = useTacticsStore.getState().updateTactic('tactic-1', 'Renamed');
      await second;

      resolveFirst!({ ok: true, json: async () => mockTacticFromApi() });
      await first;

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
      // First PUT carried the slots edit, the trailing PUT carries the rename
      expect(JSON.parse((mockFetch.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
        players: [
          { player_slot: 1, position_x: 50, position_y: 45, script_id: 'script-1' },
          { player_slot: 2, position_x: 25, position_y: 30, script_id: null },
        ],
      });
      expect(JSON.parse((mockFetch.mock.calls[1]?.[1] as RequestInit).body as string)).toEqual({
        name: 'Renamed',
      });
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(false));
      const finalTactic = useTacticsStore.getState().tactics[0];
      expect(finalTactic?.name).toBe('Renamed');
      expect(finalTactic?.players).toHaveLength(2);
    });

    it('should merge multiple queued edits for the same tactic into one trailing PUT', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      let resolveFirst: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ name: 'Renamed' }),
      });

      const first = useTacticsStore.getState().updateTactic('tactic-1', undefined, makeSlots());
      // Two edits queue while the PUT is in flight: they merge (latest-wins)
      await useTacticsStore.getState().updateTactic('tactic-1', undefined, [
        { playerSlot: 1, positionX: 10, positionY: 20, scriptId: null },
      ]);
      await useTacticsStore.getState().updateTactic('tactic-1', 'Renamed');

      resolveFirst!({ ok: true, json: async () => mockTacticFromApi() });
      await first;

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
      expect(JSON.parse((mockFetch.mock.calls[1]?.[1] as RequestInit).body as string)).toEqual({
        name: 'Renamed',
        players: [{ player_slot: 1, position_x: 10, position_y: 20, script_id: null }],
      });
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(false));
    });

    it('should merge a ready toggle queued behind an in-flight slots PUT', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      let resolveFirst: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ isReady: true }),
      });

      const first = useTacticsStore.getState().updateTactic('tactic-1', undefined, makeSlots());
      // The ready toggle queues behind the in-flight slots PUT (same
      // latest-wins pipeline as renames, Epic 4 v2)
      const second = useTacticsStore.getState().updateTactic('tactic-1', undefined, undefined, true);
      await second;

      resolveFirst!({ ok: true, json: async () => mockTacticFromApi() });
      await first;

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
      // First PUT carried the slots edit, the trailing PUT the ready flag
      expect(JSON.parse((mockFetch.mock.calls[1]?.[1] as RequestInit).body as string)).toEqual({
        is_ready: true,
      });
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(false));
      expect(useTacticsStore.getState().tactics[0]?.isReady).toBe(true);
    });

    it('should not resurrect a deleted script from a stale PUT response', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      let resolvePut: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePut = resolve;
        })
      );

      const put = useTacticsStore.getState().updateTactic('tactic-1', undefined, makeSlots());

      // The script is deleted (and detached) while the PUT is in flight
      useTacticsStore.getState().detachScriptFromPlayers('script-1');

      resolvePut!({
        ok: true,
        json: async () => mockTacticFromApi(), // stale body still carries scriptId 'script-1'
      });
      await put;

      const players = useTacticsStore.getState().tactics[0]?.players ?? [];
      for (const player of players) {
        expect(player.scriptId).not.toBe('script-1');
      }
    });

    it('should queue the default recreation behind an in-flight save when deleting the last tactic', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
        activeTacticId: 'tactic-1',
      });

      let resolveSave: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve;
        })
      );
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => mockTacticFromApi({ id: 'recreated-1', name: 'Tactic 1' }),
        });

      const save = useTacticsStore.getState().updateTactic('tactic-1', 'In-flight');
      const deleted = await useTacticsStore.getState().deleteTactic('tactic-1');

      expect(deleted).toBe(true);
      expect(useTacticsStore.getState().tactics).toHaveLength(0); // recreate still queued

      resolveSave!({ ok: true, json: async () => mockTacticFromApi({ name: 'In-flight' }) });
      await save;

      await vi.waitFor(() => expect(useTacticsStore.getState().tactics).toHaveLength(1));
      expect(useTacticsStore.getState().tactics[0]?.id).toBe('recreated-1');
      expect(useTacticsStore.getState().activeTacticId).toBe('recreated-1');
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(false));
    });

    it('should filter system tactics out of the fetched list', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          mockTacticFromApi(),
          mockTacticFromApi({ id: 'system-1', name: 'System', isSystem: true }),
        ],
      });

      await useTacticsStore.getState().fetchTactics();

      expect(useTacticsStore.getState().tactics).toHaveLength(1);
      expect(useTacticsStore.getState().tactics[0]?.id).toBe('tactic-1');
    });
  });

  describe('Team Customization (story 7.4)', () => {
    it('should send the customization fields on PUT and merge the response', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          mockTacticFromApi({
            colorPrimary: '#31c48d',
            colorSecondary: '#4aa8e8',
            crest: '🦊',
          }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', undefined, undefined, undefined, {
        colorPrimary: '#31c48d',
        colorSecondary: '#4aa8e8',
        crest: '🦊',
      });

      const state = useTacticsStore.getState();
      expect(state.tactics[0]?.colorPrimary).toBe('#31c48d');
      expect(state.tactics[0]?.colorSecondary).toBe('#4aa8e8');
      expect(state.tactics[0]?.crest).toBe('🦊');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            color_primary: '#31c48d',
            color_secondary: '#4aa8e8',
            crest: '🦊',
          }),
        }),
      );
    });

    it('should keep absent customization keys out of the PUT body (has() semantics)', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi({ crest: null }),
      });

      await useTacticsStore.getState().updateTactic('tactic-1', undefined, undefined, undefined, {
        crest: null,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ crest: null }),
        }),
      );
    });

    it('should queue the customization and drain it to the next PUT', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');

      useTacticsStore.setState({
        tactics: [mockTacticFromApi() as unknown as TacticConfig],
      });

      // Hold the first PUT in flight
      let resolvePut: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePut = resolve;
        })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTacticFromApi(),
      });

      const first = useTacticsStore.getState().updateTactic('tactic-1', 'Renamed');
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(true));

      const second = useTacticsStore.getState().updateTactic(
        'tactic-1',
        undefined,
        undefined,
        undefined,
        { colorPrimary: '#ffc244' }
      );

      // The first PUT runs; the second queues as a fresh pending update
      // carrying only its customization
      expect(useTacticsStore.getState().pendingUpdate).toEqual({
        id: 'tactic-1',
        name: undefined,
        slots: undefined,
        isReady: undefined,
        customization: { colorPrimary: '#ffc244' },
      });

      resolvePut!({ ok: true, json: async () => mockTacticFromApi({ name: 'Renamed' }) });
      await first;
      await vi.waitFor(() => expect(useTacticsStore.getState().isSavingTactic).toBe(false));
      await second;

      // The drained pending update carries the customization to the second PUT
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('/tactics/tactic-1'),
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ color_primary: '#ffc244' }),
          }),
        );
      });
    });
  });
});
