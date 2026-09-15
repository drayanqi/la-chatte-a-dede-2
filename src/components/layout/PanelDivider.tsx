/**
 * PanelDivider - Draggable divider between the canvas and a workspace panel
 * OWNER: Dev Team
 *
 * 6px vertical hit area with a col-resize cursor and hover highlight.
 * Dragging reports the panel's next width live via onResize (per
 * pointer-move, past a small jitter threshold) and persists once via
 * onCommit on pointer-up — plain clicks and double-clicks never resize
 * or persist. Pointercancel and unmount restore the global userSelect.
 * The chevron button toggles collapse and never starts a drag or resets
 * (stopPropagation on pointer-down and double-click); double-clicking
 * the divider body resets the panel width.
 */

import { useEffect, useRef, useState } from 'react';

/** Pointer movement (px) before a down/move sequence counts as a drag */
const DRAG_THRESHOLD = 3;

export interface PanelDividerProps {
  /** Which workspace panel this divider sits next to */
  side: 'left' | 'right';
  /** Current width of the panel being resized (drag start reference) */
  width: number;
  /** Called live during the drag with the panel's next width */
  onResize: (width: number) => void;
  /** Called once on pointer-up to persist the layout */
  onCommit: () => void;
  /** Double-click on the divider body: reset the panel width */
  onReset: () => void;
  /** Chevron button click: collapse/expand the panel */
  onToggle: () => void;
}

export const PanelDivider: React.FC<PanelDividerProps> = ({
  side,
  width,
  onResize,
  onCommit,
  onReset,
  onToggle,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; startWidth: number } | null>(null);
  const movedRef = useRef(false);

  // Never leak the global userSelect when unmounting mid-drag
  useEffect(
    () => () => {
      document.body.style.userSelect = '';
    },
    []
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Inactive/synthetic pointer: element-local events still drive the drag
    }
    movedRef.current = false;
    dragStartRef.current = { x: event.clientX, startWidth: width };
    setIsDragging(true);
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    // Micro-jitter (plain clicks, double-clicks) must not resize
    if (!movedRef.current && Math.abs(event.clientX - dragStart.x) < DRAG_THRESHOLD) {
      return;
    }
    movedRef.current = true;

    // Left divider: +Δ widens the panel; right divider: +Δ narrows it
    const direction = side === 'left' ? 1 : -1;
    onResize(dragStart.startWidth + (event.clientX - dragStart.x) * direction);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;

    dragStartRef.current = null;
    setIsDragging(false);
    document.body.style.userSelect = '';

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // A click with no movement changed nothing; don't materialize the key
    if (movedRef.current) {
      onCommit();
    }
  };

  const handleChevronPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    // Never let the chevron start a resize drag
    event.stopPropagation();
  };

  const handleChevronDoubleClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    // A double-click on the chevron must not reset the panel width
    event.stopPropagation();
  };

  const panelLabel = side === 'left' ? 'AI Scripts' : 'Debugger';

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize AI Scripts panel' : 'Resize Debugger panel'}
      data-testid={`panel-divider-${side}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={onReset}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...styles.divider,
        backgroundColor: isDragging ? '#0a84ff' : isHovered ? '#3c3c3c' : 'transparent',
      }}
    >
      <button
        type="button"
        data-testid={`panel-divider-${side}-toggle`}
        aria-label={`Collapse ${panelLabel} panel`}
        aria-expanded={true}
        aria-controls={side === 'left' ? 'left-panel' : 'right-panel'}
        onPointerDown={handleChevronPointerDown}
        onDoubleClick={handleChevronDoubleClick}
        onClick={onToggle}
        style={styles.chevron}
      >
        {side === 'left' ? '‹' : '›'}
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  divider: {
    width: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'col-resize',
    flexShrink: 0,
    touchAction: 'none',
  },
  chevron: {
    background: 'none',
    border: 'none',
    color: '#9d9d9d',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '12px 7px',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
};
