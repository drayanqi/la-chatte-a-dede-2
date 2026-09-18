/**
 * QueueStatusBanner Component Unit Tests
 *
 * Tests the ranked matchmaking feedback states (story 4.1):
 * - Waiting banner: "Searching for opponent..." with a working Cancel
 * - Matched banner: "Match found!" with a dismiss
 * - Timeout banner: the AC #3 message with a dismiss
 * - Error banner: the error message with a dismiss
 * - Idle renders nothing
 *
 * @see Epic 4: Ranked Competition & Leaderboard
 * @see Story 4.1: Ranked Queue & Matchmaking (Task 8)
 * @priority P0
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueStatusBanner } from '@/components/layout/QueueStatusBanner';
import type { MatchmakingPhase } from '@/stores/matchmakingStore';

const renderBanner = (
  overrides: Partial<Parameters<typeof QueueStatusBanner>[0]> = {}
) => {
  const props = {
    status: 'idle' as MatchmakingPhase,
    error: null,
    onCancel: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };
  render(<QueueStatusBanner {...props} />);
  return props;
};

describe('QueueStatusBanner Component', () => {
  it('renders nothing when idle', () => {
    renderBanner();

    expect(screen.queryByTestId('queue-searching-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-matched-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-timeout-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-error-banner')).not.toBeInTheDocument();
  });

  it('shows the searching banner with a working cancel while queued', () => {
    const { onCancel } = renderBanner({ status: 'waiting' });

    const banner = screen.getByTestId('queue-searching-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Searching for opponent...');

    fireEvent.click(screen.getByTestId('queue-cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the searching banner while joining (same affordances)', () => {
    renderBanner({ status: 'joining' });

    expect(screen.getByTestId('queue-searching-banner')).toHaveTextContent(
      'Searching for opponent...'
    );
  });

  it('shows the matched banner with a working dismiss', () => {
    const { onDismiss } = renderBanner({ status: 'matched' });

    expect(screen.getByTestId('queue-matched-banner')).toHaveTextContent('Match found!');

    fireEvent.click(screen.getByTestId('queue-dismiss-button'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows the timeout banner with the exact AC #3 message', () => {
    renderBanner({ status: 'timeout' });

    const banner = screen.getByTestId('queue-timeout-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('No opponent found, try again later');
  });

  it('shows the error message with a working dismiss on failure', () => {
    const { onDismiss } = renderBanner({ status: 'error', error: 'Tactic lineup is incomplete' });

    expect(screen.getByTestId('queue-error-message')).toHaveTextContent(
      'Tactic lineup is incomplete'
    );

    fireEvent.click(screen.getByTestId('queue-dismiss-button'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic error message when the store has none', () => {
    renderBanner({ status: 'error', error: null });

    expect(screen.getByTestId('queue-error-message')).toHaveTextContent(
      'Something went wrong. Please try again.'
    );
  });
});
