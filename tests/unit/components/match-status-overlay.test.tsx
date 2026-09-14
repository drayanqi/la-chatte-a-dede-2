/**
 * MatchStatusOverlay Component Unit Tests
 *
 * Tests the practice match feedback states (story 3.5):
 * - Simulating overlay while the request is in flight
 * - Result banner with the final score and a Watch Replay button
 * - Error message with a Retry button after a failure
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.5: Practice Match Trigger (Task 7)
 * @priority P0
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchStatusOverlay } from '@/components/layout/MatchStatusOverlay';
import type { MatchResult } from '@/types';

const completedMatch: MatchResult = {
  id: 'match-1',
  mode: 'practice',
  status: 'completed',
  scoreChallenger: 2,
  scoreOpponent: 1,
  result: 'challenger_win',
  durationFrames: 10800,
  createdAt: '2026-09-14T10:00:00Z',
};

const renderOverlay = (
  overrides: Partial<Parameters<typeof MatchStatusOverlay>[0]> = {}
) => {
  const props = {
    isSimulating: false,
    match: null,
    error: null,
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<MatchStatusOverlay {...props} />);
  return props;
};

describe('MatchStatusOverlay Component', () => {
  it('renders nothing when idle', () => {
    renderOverlay();

    expect(screen.queryByTestId('simulating-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('match-result-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('match-error-message')).not.toBeInTheDocument();
  });

  it('shows the simulating overlay while the simulation runs', () => {
    renderOverlay({ isSimulating: true });

    const overlay = screen.getByTestId('simulating-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent('Simulating...');

    // No result banner and no error while simulating
    expect(screen.queryByTestId('match-result-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('match-error-message')).not.toBeInTheDocument();
  });

  it('shows the result banner with the final score and watch replay', () => {
    renderOverlay({ match: completedMatch });

    const banner = screen.getByTestId('match-result-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByTestId('match-result-score')).toHaveTextContent('You 2 — 1 Easy Bot');

    expect(screen.getByTestId('watch-replay-button')).toBeInTheDocument();
  });

  it('shows the error message with a working retry button on failure', () => {
    const { onRetry } = renderOverlay({ error: 'Simulation failed' });

    expect(screen.getByTestId('match-error-message')).toHaveTextContent('Simulation failed');

    const retry = screen.getByTestId('retry-match-button');
    expect(retry).toBeInTheDocument();

    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('prioritizes the simulating overlay over stale result and error state', () => {
    renderOverlay({ isSimulating: true, match: completedMatch, error: 'stale' });

    expect(screen.getByTestId('simulating-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('match-result-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('match-error-message')).not.toBeInTheDocument();
  });
});
