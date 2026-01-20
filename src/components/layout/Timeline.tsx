/**
 * Timeline - Contrôles de lecture et barre de progression
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

interface TimelineProps {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: (direction: 'forward' | 'backward') => void;
  onSeek: (frame: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  isPlaying,
  currentFrame,
  totalFrames,
  onPlay,
  onPause,
  onStep,
  onSeek,
}) => {
  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  const formatTime = (frames: number): string => {
    const seconds = frames / 60;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const frame = Math.floor(percent * totalFrames);
    onSeek(frame);
  };

  return (
    <div style={styles.container}>
      {/* Contrôles */}
      <div style={styles.controls}>
        <button
          style={styles.controlButton}
          onClick={() => onStep('backward')}
          disabled={currentFrame === 0}
        >
          ⏮
        </button>

        <button
          style={styles.playButton}
          onClick={isPlaying ? onPause : onPlay}
          disabled={totalFrames === 0}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          style={styles.controlButton}
          onClick={() => onStep('forward')}
          disabled={currentFrame >= totalFrames - 1}
        >
          ⏭
        </button>
      </div>

      {/* Time display */}
      <div style={styles.timeDisplay}>
        <span>{formatTime(currentFrame)}</span>
        <span style={styles.timeSeparator}>/</span>
        <span style={styles.totalTime}>{formatTime(totalFrames)}</span>
      </div>

      {/* Progress bar */}
      <div style={styles.progressContainer} onClick={handleSeek}>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
          <div
            style={{
              ...styles.progressHandle,
              left: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* Frame counter */}
      <div style={styles.frameCounter}>
        Frame: {currentFrame} / {totalFrames}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    height: '48px',
    padding: '0 16px',
    backgroundColor: '#2d2d2d',
    borderTop: '1px solid #3c3c3c',
    gap: '16px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  controlButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: '#cccccc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  playButton: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
  },
  timeDisplay: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#cccccc',
  },
  timeSeparator: {
    margin: '0 4px',
    color: '#666666',
  },
  totalTime: {
    color: '#888888',
  },
  progressContainer: {
    flex: 1,
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  progressTrack: {
    position: 'relative',
    width: '100%',
    height: '4px',
    backgroundColor: '#3c3c3c',
    borderRadius: '2px',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#0e639c',
    borderRadius: '2px',
  },
  progressHandle: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  frameCounter: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#666666',
    minWidth: '120px',
    textAlign: 'right',
  },
};
