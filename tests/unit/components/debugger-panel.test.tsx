/**
 * DebuggerPanel Component Unit Tests
 *
 * Tests the selection-driven Watch list:
 * - Nothing selected: all roster players shown with live state
 * - A player selected: only that player is shown
 * - Live frame states join onto roster entries by engine player id
 * - Selected player missing from roster shows the empty state
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see spec-player-selection-debugger-filter.md
 * @priority P1
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebuggerPanel } from '@/components/debugger/DebuggerPanel';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTacticsStore } from '@/stores/tacticsStore';
import type { TacticConfig, PlayerFrameState } from '@/types';

const makeTactic = (slots: number[]): TacticConfig =>
  ({
    id: 'tactic-1',
    name: 'Tactic 1',
    isSystem: false,
    players: slots.map((slot) => ({
      playerSlot: slot,
      positionX: 10 * slot,
      positionY: 5 * slot,
      scriptId: null,
    })),
  }) as unknown as TacticConfig;

const seedTactics = (tactic: TacticConfig | null) => {
  useTacticsStore.setState({
    tactics: tactic ? [tactic] : [],
    activeTacticId: tactic ? tactic.id : null,
    tacticsError: null,
  });
};

const seedCanvas = (
  selectedPlayerId: string | null,
  playerStates: PlayerFrameState[] = []
) => {
  useCanvasStore.setState({ selectedPlayerId, playerStates });
};

const frameState = (playerId: string, x: number, y: number): PlayerFrameState => ({
  playerId,
  position: { x, y },
  velocity: { vx: 0, vy: 0 },
  state: 'moving',
});

describe('DebuggerPanel — Watch list', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
    useTacticsStore.getState().reset();
  });

  it('shows every roster player when nothing is selected', () => {
    // GIVEN: A loaded tactic with 5 players and no selection
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas(null);

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: All five players are listed
    expect(screen.getByTestId('debug-watch-list')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-0')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-1')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-2')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-3')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-row-home-4')).toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-title')).toHaveTextContent(
      'tous les joueurs'
    );
  });

  it('shows only the selected player when one is selected', () => {
    // GIVEN: A loaded tactic and a selected player
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas('home-1');

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Only that player's row is rendered
    expect(screen.getByTestId('debug-watch-row-home-1')).toBeInTheDocument();
    expect(screen.queryByTestId('debug-watch-row-home-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('debug-watch-row-home-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('debug-watch-title')).toHaveTextContent('P2');
  });

  it('joins live frame states onto roster entries by player id', () => {
    // GIVEN: Live states only for home-0 and home-2
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas(null, [
      frameState('home-0', 12.34, 5.67),
      frameState('home-2', 40, 50),
    ]);

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: Positioned rows show live values, others show the placeholder
    expect(screen.getByTestId('debug-watch-row-home-0')).toHaveTextContent(
      '(12.3, 5.7)'
    );
    expect(screen.getByTestId('debug-watch-row-home-2')).toHaveTextContent(
      '(40.0, 50.0)'
    );
    expect(screen.getByTestId('debug-watch-row-home-1')).toHaveTextContent('—');
  });

  it('shows the empty state when no tactic is loaded', () => {
    // GIVEN: No tactic and no selection
    seedTactics(null);
    seedCanvas(null);

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The empty state is displayed
    expect(screen.getByTestId('debug-watch-empty')).toBeInTheDocument();
  });

  it('shows the empty state when the selected player is not on the roster', () => {
    // GIVEN: A tactic without a matching selected id
    seedTactics(makeTactic([1, 2, 3, 4, 5]));
    seedCanvas('away-3');

    // WHEN: Rendering the panel
    render(<DebuggerPanel />);

    // THEN: The empty state is displayed instead of a row
    expect(screen.getByTestId('debug-watch-empty')).toBeInTheDocument();
  });
});
