/**
 * Timeline Component Unit Tests (story 7.7)
 *
 * The broadcast timeline: speed cycling (0.5x/1x/2x/4x → engine),
 * frame-step buttons (±1 tick, not start/end jumps), clickable sun goal
 * ticks (seek), ARIA slider surface and the mono frame counter. Scrubbing
 * (pointer drag) stays covered by the e2e suite (story 3.9 traversal).
 *
 * @see Story 7.7: Match View — Broadcast Replay
 * @priority P1
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from '@/components/layout/Timeline';

const baseProps = {
  isPlaying: false,
  currentFrame: 5,
  totalFrames: 10800,
  goalTicks: [{ tick: 2520, team: 'challenger' as const }],
  onSpeedChange: vi.fn(),
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onSeek: vi.fn(),
  onStep: vi.fn(),
};

describe('Timeline (broadcast, story 7.7)', () => {
  it('cycles the playback speed 1x → 2x → 4x → 0.5x → 1x into the engine', () => {
    const onSpeedChange = vi.fn();
    render(<Timeline {...baseProps} onSpeedChange={onSpeedChange} />);

    const button = screen.getByTestId('speed-button');
    expect(button).toHaveTextContent('1×');

    fireEvent.click(button);
    expect(onSpeedChange).toHaveBeenLastCalledWith(2);
    expect(button).toHaveTextContent('2×');

    fireEvent.click(button);
    expect(onSpeedChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(button);
    expect(onSpeedChange).toHaveBeenLastCalledWith(0.5);

    // The cycle wraps back to 1x
    fireEvent.click(button);
    expect(onSpeedChange).toHaveBeenLastCalledWith(1);
    expect(button).toHaveTextContent('1×');
  });

  it('steps one frame per click with the step buttons (not start/end jumps)', () => {
    const onStep = vi.fn();
    render(<Timeline {...baseProps} onStep={onStep} />);

    fireEvent.click(screen.getByTestId('step-back-button'));
    expect(onStep).toHaveBeenCalledWith('backward');

    fireEvent.click(screen.getByTestId('step-forward-button'));
    expect(onStep).toHaveBeenCalledWith('forward');
    // No seek-to-bounds: the buttons never jump to 0 or the last frame
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('disables the step buttons at the bounds', () => {
    const { rerender } = render(<Timeline {...baseProps} currentFrame={0} />);

    expect(screen.getByTestId('step-back-button')).toBeDisabled();
    expect(screen.getByTestId('step-forward-button')).toBeEnabled();

    rerender(<Timeline {...baseProps} currentFrame={10799} />);
    expect(screen.getByTestId('step-back-button')).toBeEnabled();
    expect(screen.getByTestId('step-forward-button')).toBeDisabled();
  });

  it('seeks to the goal frame when a sun tick is clicked', () => {
    const onSeek = vi.fn();
    render(<Timeline {...baseProps} onSeek={onSeek} />);

    const marker = screen.getByTestId('goal-marker-0');
    expect(marker).toBeEnabled();
    fireEvent.click(marker);
    expect(onSeek).toHaveBeenCalledWith(2520);
  });

  it('shows the elapsed time and the mono frame counter', () => {
    render(<Timeline {...baseProps} />);

    expect(screen.getByTestId('timeline-time-display')).toHaveTextContent('00:00 / 03:00');
    expect(screen.getByTestId('frame-counter')).toHaveTextContent('Frame: 5 / 10800');
  });

  it('toggles between play and pause labels', () => {
    const onPlay = vi.fn();
    const { rerender } = render(<Timeline {...baseProps} isPlaying={false} onPlay={onPlay} />);

    const button = screen.getByTestId('play-pause-button');
    expect(button).toHaveTextContent('▶');
    fireEvent.click(button);
    expect(onPlay).toHaveBeenCalledTimes(1);

    rerender(<Timeline {...baseProps} isPlaying={true} />);
    expect(screen.getByTestId('play-pause-button')).toHaveTextContent('⏸');
  });
});
