/**
 * PanelDivider - Draggable divider between two workspace panels (story 7.5)
 * OWNER: Dev Team
 *
 * 6px vertical hit area with a col-resize cursor and hover highlight.
 * Dragging reports the panel's next width live via onResize (per
 * pointer-move, past a small jitter threshold) and persists once via
 * onCommit on pointer-up — plain clicks and double-clicks never resize
 * or persist. Pointercancel and unmount restore the global userSelect.
 * Double-clicking the divider body resets the panel width. The 7.5
 * floating layout has no collapse affordance (chevron removed); colors
 * follow the La Ronde tokens.
 */

import { useEffect, useRef, useState } from 'react';

/** Pointer movement (px) before a down/move sequence counts as a drag */
const DRAG_THRESHOLD = 3;

export interface PanelDividerProps {
  /**
   * Drag direction semantics: 'left' = the panel sits LEFT of the divider
   * (its right edge follows the cursor: +Δ widens), 'right' = the panel
   * sits RIGHT of the divider (its left edge follows the cursor: +Δ
   * narrows).
   */
  side: 'left' | 'right';
  /** Current width of the panel being resized (drag start reference) */
  width: number;
  /** Called live during the drag with the panel's next width */
  onResize: (width: number) => void;
  /** Called once on pointer-up to persist the layout */
  onCommit: () => void;
  /** Double-click on the divider body: reset the panel width */
  onReset: () => void;
  /** Accessible label (which panel this divider resizes) */
  label: string;
  /** Unique testid suffix (defaults to the side) */
  id?: string;
}

export const PanelDivider: React.FC<PanelDividerProps> = ({
  side,
  width,
  onResize,
  onCommit,
  onReset,
  label,
  id,
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

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-testid={`panel-divider-${id ?? side}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={onReset}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...styles.divider,
        backgroundColor: isDragging ? 'var(--corail)' : isHovered ? 'var(--line)' : 'transparent',
      }}
    />
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
    borderRadius: '3px',
  },
};
