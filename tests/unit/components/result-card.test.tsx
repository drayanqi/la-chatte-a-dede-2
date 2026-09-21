/**
 * ResultCard Component Unit Tests (story 7.6)
 *
 * The shared V/D card shown after a settled match:
 * - Challenger-perspective outcome (Victoire / Défaite / Match nul)
 * - Score in mono + elo delta pill (+ mint / − corail, hidden on practice)
 * - Revoir le match / Retour au stade actions
 *
 * @see Story 7.6: Play Page
 * @priority P0
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultCard } from '@/components/play/ResultCard';
import type { MatchResult } from '@/types';

const makeMatch = (overrides: Partial<MatchResult> = {}): MatchResult =>
  ({
    id: 'match-1',
    mode: 'ranked',
    status: 'completed',
    scoreChallenger: 3,
    scoreOpponent: 1,
    result: 'challenger_win',
    pointsChallenger: 18,
    pointsOpponent: -18,
    challengerName: 'Pelo',
    opponentName: 'Gégé FC',
    challengerTacticName: 'Les Roulants',
    opponentTacticName: 'Gégé FC',
    durationFrames: 10800,
    createdAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  }) as unknown as MatchResult;

const renderCard = (match: MatchResult) =>
  render(<ResultCard match={match} onWatchReplay={() => {}} onClose={() => {}} />);

describe('ResultCard', () => {
  it('renders a win as Victoire with the score and the elo pill', () => {
    renderCard(makeMatch());

    expect(screen.getByTestId('result-card')).toBeInTheDocument();
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Victoire');
    expect(screen.getByTestId('result-disc')).toHaveTextContent('V');
    expect(screen.getByTestId('result-score')).toHaveTextContent('3 – 1');
    expect(screen.getByTestId('result-my-team')).toHaveTextContent('Les Roulants');
    expect(screen.getByTestId('result-opponent')).toHaveTextContent('Gégé FC');
    expect(screen.getByTestId('result-points')).toHaveTextContent('+18 elo');
  });

  it('renders a loss as Défaite with a negative pill', () => {
    renderCard(makeMatch({ result: 'opponent_win', pointsChallenger: -12 }));

    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Défaite');
    expect(screen.getByTestId('result-disc')).toHaveTextContent('D');
    expect(screen.getByTestId('result-points')).toHaveTextContent('-12 elo');
  });

  it('renders a draw as Match nul', () => {
    renderCard(makeMatch({ result: 'draw', pointsChallenger: 0 }));

    expect(screen.getByTestId('result-outcome')).toHaveTextContent('Match nul');
    expect(screen.getByTestId('result-disc')).toHaveTextContent('N');
    // The elo did not move: no pill
    expect(screen.queryByTestId('result-points')).not.toBeInTheDocument();
  });

  it('hides the elo pill on practice matches (no ranked points)', () => {
    renderCard(
      makeMatch({
        mode: 'practice',
        pointsChallenger: null,
        pointsOpponent: null,
        opponentName: 'Easy Bot',
        opponentTacticName: null,
      })
    );

    expect(screen.queryByTestId('result-points')).not.toBeInTheDocument();
    expect(screen.getByTestId('result-opponent')).toHaveTextContent('Easy Bot');
  });

  it('renders nothing while the match has no settled outcome', () => {
    const { container } = renderCard(makeMatch({ result: null, status: 'failed' }));

    expect(container).toBeEmptyDOMElement();
  });

  it('wires the watch-replay and close actions', () => {
    const onWatchReplay = vi.fn();
    const onClose = vi.fn();
    render(
      <ResultCard match={makeMatch()} onWatchReplay={onWatchReplay} onClose={onClose} />
    );

    fireEvent.click(screen.getByTestId('result-watch-replay-button'));
    fireEvent.click(screen.getByTestId('result-close-button'));

    expect(onWatchReplay).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
