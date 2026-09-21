/**
 * Teambar Component Unit Tests (story 7.5)
 *
 * Tests the floating team capsule that replaces the old tab bar:
 * - One pill per user tactic (system tactics filtered out), status dot
 * - "+ Nouvelle équipe" opens the creation modal (name + create)
 * - Caret menu: Renommer (inline, Enter/blur commit, Escape cancel),
 *   Dupliquer ("X (copie)" POST with the same lineup), Supprimer (confirm
 *   dialog, neighbor promotion, last-tactic recreation)
 * - Status pill + ready toggle + Test vs Bot gating (Epic 4 v2 semantics)
 *
 * @see Story 7.5: Teams Page
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Teambar } from '@/components/teams/Teambar';
import { useTacticsStore } from '@/stores/tacticsStore';
import type { TacticConfig } from '@/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const makeTactic = (overrides: Partial<Record<string, unknown>> = {}): TacticConfig =>
  ({
    id: 'tactic-1',
    name: 'Tactic 1',
    isSystem: false,
    players: [],
    isReady: false,
    elo: 1000,
    wins: 0,
    losses: 0,
    ...overrides,
  }) as unknown as TacticConfig;

const seedStore = (tactics: TacticConfig[], activeTacticId: string | null = null) => {
  useTacticsStore.setState({
    tactics,
    activeTacticId,
    isLoadingTactics: false,
    isSavingTactic: false,
    isDeletingTactic: false,
    lastSavedTacticId: null,
    lastSavedAt: null,
    tacticsError: null,
    pendingUpdate: null,
  });
};

const renderBar = (props: Partial<Parameters<typeof Teambar>[0]> = {}) =>
  render(<Teambar lineupComplete={false} isSimulating={false} onStartPractice={() => {}} {...props} />);

/** Open the caret menu of the first tactic pill */
const openMenu = () => {
  fireEvent.click(screen.getAllByTestId('team-caret')[0]!);
  expect(screen.getByTestId('team-menu')).toBeInTheDocument();
};

describe('Teambar Component', () => {
  beforeEach(() => {
    useTacticsStore.getState().reset();
    vi.clearAllMocks();
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  it('should render one pill per user tactic and mark the active one', () => {
    seedStore(
      [
        makeTactic(),
        makeTactic({ id: 'tactic-2', name: 'Defense' }),
        makeTactic({ id: 'system-1', name: 'System', isSystem: true }),
      ],
      'tactic-2'
    );

    renderBar();

    const pills = screen.getAllByTestId('tactic-tab');
    expect(pills).toHaveLength(2); // system tactic filtered out
    expect(screen.getByText('Tactic 1')).toBeInTheDocument();
    expect(screen.getByText('Defense')).toBeInTheDocument();
    expect(screen.getByText('Defense').closest('[data-testid="tactic-tab"]')).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  it('should show the ready state on the pill dot', () => {
    seedStore(
      [
        makeTactic({ isReady: true }),
        makeTactic({ id: 'draft-1', name: 'Draft', isReady: false }),
      ],
      'tactic-1'
    );

    renderBar();

    expect(screen.getAllByTestId('team-dot')[0]).toHaveAttribute('data-ready', 'true');
    expect(screen.getAllByTestId('team-dot')[1]).toHaveAttribute('data-ready', 'false');
  });

  it('should switch the active tactic when clicking a pill', () => {
    seedStore([makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })], 'tactic-1');

    renderBar();

    fireEvent.click(screen.getByText('Defense'));

    expect(useTacticsStore.getState().activeTacticId).toBe('tactic-2');
  });

  // ------------------------------------------------------------------
  // Creation modal (mockup s-newteam)
  // ------------------------------------------------------------------

  it('should open the new-team modal and create via the store', async () => {
    seedStore([]);
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => makeTactic({ id: 'created', name: 'Les Bleus' }),
    });

    renderBar();

    expect(screen.queryByTestId('new-team-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('new-team-button'));
    expect(screen.getByTestId('new-team-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('new-team-name-input'), {
      target: { value: 'Les Bleus' },
    });
    fireEvent.click(screen.getByTestId('new-team-create-button'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    // The store seeds the default 5-slot formation on creation
    const [, createInit] = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes('/tactics') && init?.method === 'POST'
    )!;
    const createBody = JSON.parse(createInit.body);
    expect(createBody.name).toBe('Les Bleus');
    expect(createBody.players).toHaveLength(5);
    await waitFor(() => {
      expect(screen.queryByTestId('new-team-modal')).not.toBeInTheDocument();
    });
  });

  it('should close the new-team modal on Escape and on Annuler without POSTing', () => {
    seedStore([]);

    renderBar();

    fireEvent.click(screen.getByTestId('new-team-button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('new-team-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('new-team-button'));
    fireEvent.click(screen.getByTestId('new-team-cancel-button'));
    expect(screen.queryByTestId('new-team-modal')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Caret menu: rename
  // ------------------------------------------------------------------

  it('should rename through the caret menu with Enter commit', async () => {
    seedStore([makeTactic()], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTactic({ name: 'Attacking' }),
    });

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-rename'));

    const input = screen.getByTestId('team-rename-input') as HTMLInputElement;
    expect(input.value).toBe('Tactic 1');

    fireEvent.change(input, { target: { value: 'Attacking' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Attacking' }),
        })
      );
    });
    expect(screen.queryByTestId('team-rename-input')).not.toBeInTheDocument();
  });

  it('should commit rename on blur', async () => {
    seedStore([makeTactic()], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTactic({ name: 'Attacking' }),
    });

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-rename'));
    const input = screen.getByTestId('team-rename-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Attacking' } });
    fireEvent.blur(input);

    // The blur commit is deferred (~100ms) so menu clicks can fire first
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/tactics/tactic-1'),
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ name: 'Attacking' }),
          })
        );
      },
      { timeout: 3000 }
    );
    expect(screen.queryByTestId('team-rename-input')).not.toBeInTheDocument();
  });

  it('should cancel rename on Escape without calling the API', () => {
    seedStore([makeTactic()], 'tactic-1');

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-rename'));
    const input = screen.getByTestId('team-rename-input');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByTestId('team-rename-input')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(useTacticsStore.getState().tactics[0]?.name).toBe('Tactic 1');
  });

  // ------------------------------------------------------------------
  // Caret menu: duplicate
  // ------------------------------------------------------------------

  it('should duplicate through the caret menu with a "(copie)" name and the same lineup', async () => {
    const lineup = [
      { playerSlot: 1 as const, positionX: 8, positionY: 25, scriptId: 's1' },
      { playerSlot: 2 as const, positionX: 25, positionY: 15, scriptId: 's2' },
    ];
    seedStore([makeTactic({ players: lineup })], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => makeTactic({ id: 'copy-1', name: 'Tactic 1 (copie)' }),
    });

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-duplicate'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics'),
        expect.objectContaining({ method: 'POST' })
      );
    });
    // Wire format is snake_case; the copy keeps the source lineup
    const [, duplicateInit] = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes('/tactics') && init?.method === 'POST'
    )!;
    const duplicateBody = JSON.parse(duplicateInit.body);
    expect(duplicateBody.name).toBe('Tactic 1 (copie)');
    expect(duplicateBody.players).toEqual([
      { player_slot: 1, position_x: 8, position_y: 25, script_id: 's1' },
      { player_slot: 2, position_x: 25, position_y: 15, script_id: 's2' },
    ]);
    await waitFor(() => {
      expect(useTacticsStore.getState().activeTacticId).toBe('copy-1');
    });
  });

  // ------------------------------------------------------------------
  // Caret menu: delete
  // ------------------------------------------------------------------

  it('should delete after confirmation and promote a neighbor', async () => {
    seedStore([makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-delete'));
    expect(screen.getByTestId('delete-tactic-confirm-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-tactic-confirm-button'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    await waitFor(() => {
      expect(useTacticsStore.getState().activeTacticId).toBe('tactic-2');
    });
    expect(screen.queryByTestId('delete-tactic-confirm-dialog')).not.toBeInTheDocument();
  });

  it('should delete the last tactic and let the store recreate a default one', async () => {
    seedStore([makeTactic()], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => makeTactic({ id: 'recreated-1', name: 'Tactic 1' }),
      });

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-delete'));
    fireEvent.click(screen.getByTestId('delete-tactic-confirm-button'));

    await waitFor(() => {
      const state = useTacticsStore.getState();
      expect(state.tactics).toHaveLength(1);
      expect(state.tactics[0]?.id).toBe('recreated-1');
      expect(state.activeTacticId).toBe('recreated-1');
    });
    expect(screen.getByText('Tactic 1')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-tactic-confirm-dialog')).not.toBeInTheDocument();
  });

  it('should close the delete confirm dialog on Escape without deleting', () => {
    seedStore([makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })], 'tactic-1');

    renderBar();

    openMenu();
    fireEvent.click(screen.getByTestId('team-delete'));
    expect(screen.getByTestId('delete-tactic-confirm-dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('delete-tactic-confirm-dialog')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should close the caret menu on Escape', () => {
    seedStore([makeTactic()], 'tactic-1');

    renderBar();

    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('team-menu')).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Saved indicator + error
  // ------------------------------------------------------------------

  it('should show the saved indicator on the last saved pill', () => {
    vi.useFakeTimers();
    try {
      seedStore([makeTactic()], 'tactic-1');
      useTacticsStore.setState({ lastSavedTacticId: 'tactic-1', lastSavedAt: Date.now() });

      renderBar();
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(screen.getByTestId('saved-indicator')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('saved-indicator')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should display the store error when present', () => {
    seedStore([]);
    useTacticsStore.setState({ tacticsError: 'Not authenticated' });

    renderBar();

    expect(screen.getByTestId('tactics-error')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // Status pill + ready toggle + Test vs Bot (Epic 4 v2 semantics)
  // ------------------------------------------------------------------

  const completeLineup = [
    { playerSlot: 1 as const, positionX: 8, positionY: 25, scriptId: 's1' },
    { playerSlot: 2 as const, positionX: 25, positionY: 15, scriptId: 's2' },
    { playerSlot: 3 as const, positionX: 25, positionY: 35, scriptId: 's3' },
    { playerSlot: 4 as const, positionX: 40, positionY: 15, scriptId: 's4' },
    { playerSlot: 5 as const, positionX: 40, positionY: 35, scriptId: 's5' },
  ];

  it('should fold the status into the ready toggle label (no duplicate badges)', () => {
    seedStore(
      [
        makeTactic({ isReady: true, players: completeLineup }),
        makeTactic({ id: 'draft-1', name: 'Draft', isReady: false }),
      ],
      'tactic-1'
    );

    renderBar();

    const readyToggle = screen.getByTestId('ready-toggle');
    expect(readyToggle).toHaveAttribute('data-status', 'ready');
    expect(readyToggle).toHaveTextContent('Prêt');

    fireEvent.click(screen.getByText('Draft'));
    const draftToggle = screen.getByTestId('ready-toggle');
    expect(draftToggle).toHaveAttribute('data-status', 'draft');
    expect(draftToggle).toHaveTextContent('Prêt pour le match');
    expect(screen.queryByTestId('team-status-pill')).not.toBeInTheDocument();
  });

  it('should toggle ready through the update pipeline with a PUT is_ready body', async () => {
    seedStore(
      [makeTactic({ players: completeLineup, isReady: false, elo: 1000, wins: 0, losses: 0 })],
      'tactic-1'
    );
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeTactic({ players: completeLineup, isReady: true }),
    });

    renderBar({ lineupComplete: true });

    fireEvent.click(screen.getByTestId('ready-toggle'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ is_ready: true }),
        })
      );
    });
    await waitFor(() => {
      expect(useTacticsStore.getState().tactics[0].isReady).toBe(true);
    });
  });

  it('should show the elo and W-L record on ready pills only', () => {
    seedStore(
      [
        makeTactic({
          id: 'ready-1',
          name: 'Fighter',
          isReady: true,
          elo: 1043,
          wins: 2,
          losses: 1,
          players: completeLineup,
        }),
        makeTactic({ id: 'idle-1', name: 'Idle', isReady: false }),
      ],
      'ready-1'
    );

    renderBar();

    const record = screen.getByTestId('tactic-record');
    expect(record).toBeInTheDocument();
    expect(record).toHaveTextContent('1043 · 2-1');
    // The not-ready pill has a dot but no record
    expect(screen.queryByText('Idle')?.closest('[data-testid="tactic-tab"]')).not.toHaveTextContent(
      '1043'
    );
  });

  it('should disable the ready toggle when the lineup is incomplete', () => {
    seedStore(
      [
        makeTactic({
          players: completeLineup.slice(0, 3),
          isReady: false,
        }),
      ],
      'tactic-1'
    );

    renderBar({ lineupComplete: false });

    const toggle = screen.getByTestId('ready-toggle');
    expect(toggle).toBeDisabled();

    // Clicking a disabled toggle fires nothing
    fireEvent.click(toggle);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should keep a ready team un-readyable when its lineup breaks', () => {
    seedStore(
      [
        makeTactic({
          players: completeLineup.slice(0, 3),
          isReady: true,
        }),
      ],
      'tactic-1'
    );

    renderBar({ lineupComplete: false });

    // The team is ready but a script was detached: un-readying must stay possible
    const toggle = screen.getByTestId('ready-toggle');
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveTextContent('Prêt');
  });

  it('should mark the toggle as pressed when the tactic is ready', () => {
    seedStore(
      [
        makeTactic({
          players: completeLineup,
          isReady: true,
          elo: 1000,
          wins: 0,
          losses: 0,
        }),
      ],
      'tactic-1'
    );

    renderBar({ lineupComplete: true });

    expect(screen.getByTestId('ready-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('should disable Test vs Bot when the lineup is incomplete or simulating', () => {
    seedStore([makeTactic()], 'tactic-1');
    const onStartPractice = vi.fn();

    const { rerender } = renderBar({ lineupComplete: false, onStartPractice });
    expect(screen.getByTestId('test-vs-bot-button')).toBeDisabled();

    rerender(<Teambar lineupComplete={true} isSimulating={false} onStartPractice={onStartPractice} />);
    expect(screen.getByTestId('test-vs-bot-button')).toBeEnabled();
    fireEvent.click(screen.getByTestId('test-vs-bot-button'));
    expect(onStartPractice).toHaveBeenCalledTimes(1);

    rerender(<Teambar lineupComplete={true} isSimulating={true} onStartPractice={onStartPractice} />);
    expect(screen.getByTestId('test-vs-bot-button')).toBeDisabled();
  });
});
