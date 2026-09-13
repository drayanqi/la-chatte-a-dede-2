/**
 * TabBar Component Unit Tests
 *
 * Tests the tactic tab bar (story 3.2):
 * - Renders one tab per user tactic (system tactics filtered out)
 * - "+" creates a tactic via the store
 * - Double-click rename: Enter or blur commits, Escape cancels
 * - Delete affordance: visible even on the last tactic (deleting it recreates
 *   a default), confirm dialog, neighbor promotion
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.2: Tactic Tabs & Auto-Saved Lineups
 * @priority P0
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TabBar } from '@/components/tactics/TabBar';
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
  });
};

describe('TabBar Component', () => {
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

  it('should render one tab per user tactic and mark the active one', () => {
    seedStore(
      [
        makeTactic(),
        makeTactic({ id: 'tactic-2', name: 'Defense' }),
        makeTactic({ id: 'system-1', name: 'System', isSystem: true }),
      ],
      'tactic-2'
    );

    render(<TabBar />);

    const tabs = screen.getAllByTestId('tactic-tab');
    expect(tabs).toHaveLength(2); // system tactic filtered out
    expect(screen.getByText('Tactic 1')).toBeInTheDocument();
    expect(screen.getByText('Defense')).toBeInTheDocument();
    expect(screen.getByText('Defense').closest('[data-testid="tactic-tab"]')).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByText('Tactic 1').closest('[data-testid="tactic-tab"]')).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('should show a hint and the + button when there is no tactic', () => {
    seedStore([]);

    render(<TabBar />);

    expect(screen.getByTestId('new-tactic-button')).toBeInTheDocument();
    expect(screen.getByText('Create your first tactic')).toBeInTheDocument();
  });

  it('should call createTactic when + is clicked', async () => {
    seedStore([]);
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => makeTactic({ id: 'created' }),
    });

    render(<TabBar />);

    fireEvent.click(screen.getByTestId('new-tactic-button'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('should switch the active tactic when clicking a tab', () => {
    seedStore([makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })], 'tactic-1');

    render(<TabBar />);

    fireEvent.click(screen.getByText('Defense'));

    expect(useTacticsStore.getState().activeTacticId).toBe('tactic-2');
  });

  it('should rename on double-click + Enter', async () => {
    seedStore([makeTactic()], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTactic({ name: 'Attacking' }),
    });

    render(<TabBar />);

    fireEvent.doubleClick(screen.getByText('Tactic 1'));

    const input = screen.getByTestId('tab-rename-input') as HTMLInputElement;
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
    expect(screen.queryByTestId('tab-rename-input')).not.toBeInTheDocument();
  });

  it('should commit rename on blur', async () => {
    seedStore([makeTactic()], 'tactic-1');
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeTactic({ name: 'Attacking' }),
    });

    render(<TabBar />);

    fireEvent.doubleClick(screen.getByText('Tactic 1'));
    const input = screen.getByTestId('tab-rename-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Attacking' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tactics/tactic-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Attacking' }),
        })
      );
    });
    expect(screen.queryByTestId('tab-rename-input')).not.toBeInTheDocument();
  });

  it('should cancel rename on Escape without calling the API', () => {
    seedStore([makeTactic()], 'tactic-1');

    render(<TabBar />);

    fireEvent.doubleClick(screen.getByText('Tactic 1'));
    const input = screen.getByTestId('tab-rename-input');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByTestId('tab-rename-input')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(useTacticsStore.getState().tactics[0]?.name).toBe('Tactic 1');
  });

  it('should show the delete affordance even on the last tactic (deleting it recreates a default)', () => {
    seedStore([makeTactic()], 'tactic-1');

    render(<TabBar />);

    expect(screen.getByTestId('delete-tactic-button')).toBeInTheDocument();
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

    render(<TabBar />);

    fireEvent.click(screen.getByTestId('delete-tactic-button'));
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

  it('should show the delete affordance on the active tab only', () => {
    seedStore(
      [makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })],
      'tactic-2'
    );

    render(<TabBar />);

    expect(screen.getByTestId('delete-tactic-button')).toBeInTheDocument();
  });

  it('should delete after confirmation and promote a neighbor', async () => {
    seedStore(
      [makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })],
      'tactic-1'
    );
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-token');
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    render(<TabBar />);

    fireEvent.click(screen.getByTestId('delete-tactic-button'));
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

  it('should close the confirm dialog on Escape without deleting', () => {
    seedStore([makeTactic(), makeTactic({ id: 'tactic-2', name: 'Defense' })], 'tactic-1');

    render(<TabBar />);

    fireEvent.click(screen.getByTestId('delete-tactic-button'));
    expect(screen.getByTestId('delete-tactic-confirm-dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('delete-tactic-confirm-dialog')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should show the saved indicator on the last saved tab', () => {
    vi.useFakeTimers();
    try {
      seedStore([makeTactic()], 'tactic-1');
      useTacticsStore.setState({ lastSavedTacticId: 'tactic-1', lastSavedAt: Date.now() });

      render(<TabBar />);
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

    render(<TabBar />);

    expect(screen.getByTestId('tactics-error')).toBeInTheDocument();
  });
});
