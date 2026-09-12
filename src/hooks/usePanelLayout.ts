/**
 * usePanelLayout - React state for the workspace panel layout
 * OWNER: Dev Team
 *
 * Wraps the panelLayout lib. Live drag updates only mutate state (never
 * per pointer-move frame disk writes); `commit()` persists on pointer-up.
 * Collapse toggles and double-click resets persist immediately. A ref
 * mirror keeps sequential event handlers reading fresh values.
 *
 * @see Feature: Collapsible & Resizable Workspace Panels
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  MIN_CENTER_WIDTH,
  MIN_LEFT_WIDTH,
  MIN_RIGHT_WIDTH,
  clampLayoutToViewport,
  clampPanelWidth,
  loadPanelLayout,
  savePanelLayout,
  type PanelLayout,
  type PanelSide,
} from '@/lib/panelLayout';

/** Horizontal hit area of one divider */
const DIVIDER_WIDTH = 6;

/** Width of a collapsed panel strip */
const COLLAPSED_STRIP_WIDTH = 28;

/** Rendered horizontal footprint of one side of the main row */
const sideFootprint = (collapsed: boolean, width: number): number =>
  collapsed ? COLLAPSED_STRIP_WIDTH : width + DIVIDER_WIDTH;

/**
 * Clamp a width for a live drag. On top of the usual per-side clamp, the
 * result is tightened so the canvas never shrinks below
 * MIN_CENTER_WIDTH while the other side keeps its current footprint.
 * (Load-time clamping deliberately stays at the pure 50vw contract.)
 */
const clampDragWidth = (
  width: number,
  side: PanelSide,
  layout: PanelLayout
): number => {
  const clamped = clampPanelWidth(width, side, window.innerWidth);
  const min = side === 'left' ? MIN_LEFT_WIDTH : MIN_RIGHT_WIDTH;
  const otherSide: PanelSide = side === 'left' ? 'right' : 'left';
  const otherCollapsed =
    otherSide === 'left' ? layout.leftCollapsed : layout.rightCollapsed;
  const otherWidth = otherSide === 'left' ? layout.leftWidth : layout.rightWidth;
  const available =
    window.innerWidth -
    MIN_CENTER_WIDTH -
    sideFootprint(otherCollapsed, otherWidth) -
    DIVIDER_WIDTH;

  return Math.max(Math.min(clamped, Math.max(available, 0)), min);
};

export interface UsePanelLayoutResult {
  /** Current layout (widths already clamped) */
  layout: PanelLayout;
  /** Live left-panel resize during a drag; does NOT persist */
  resizeLeft: (width: number) => void;
  /** Live right-panel resize during a drag; does NOT persist */
  resizeRight: (width: number) => void;
  /** Toggle the left panel collapse; persists immediately */
  toggleLeft: () => void;
  /** Toggle the right panel collapse; persists immediately */
  toggleRight: () => void;
  /** Reset one side's width to its default; persists immediately */
  resetSide: (side: PanelSide) => void;
  /** Persist the current layout (call on drag end / pointer-up) */
  commit: () => void;
}

export const usePanelLayout = (): UsePanelLayoutResult => {
  const [layout, setLayout] = useState<PanelLayout>(() => loadPanelLayout());

  // Mirror of the latest state so event handlers never read a stale closure
  const layoutRef = useRef<PanelLayout>(layout);

  const applyLayout = useCallback((next: PanelLayout) => {
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const persistLayout = useCallback(
    (next: PanelLayout) => {
      applyLayout(next);
      savePanelLayout(next);
    },
    [applyLayout]
  );

  const resizeLeft = useCallback(
    (width: number) => {
      applyLayout({
        ...layoutRef.current,
        leftWidth: clampDragWidth(width, 'left', layoutRef.current),
      });
    },
    [applyLayout]
  );

  const resizeRight = useCallback(
    (width: number) => {
      applyLayout({
        ...layoutRef.current,
        rightWidth: clampDragWidth(width, 'right', layoutRef.current),
      });
    },
    [applyLayout]
  );

  const toggleLeft = useCallback(() => {
    persistLayout({
      ...layoutRef.current,
      leftCollapsed: !layoutRef.current.leftCollapsed,
    });
  }, [persistLayout]);

  const toggleRight = useCallback(() => {
    persistLayout({
      ...layoutRef.current,
      rightCollapsed: !layoutRef.current.rightCollapsed,
    });
  }, [persistLayout]);

  const resetSide = useCallback(
    (side: PanelSide) => {
      if (side === 'left') {
        persistLayout({
          ...layoutRef.current,
          leftWidth: clampPanelWidth(DEFAULT_LEFT_WIDTH, 'left', window.innerWidth),
        });
      } else {
        persistLayout({
          ...layoutRef.current,
          rightWidth: clampPanelWidth(DEFAULT_RIGHT_WIDTH, 'right', window.innerWidth),
        });
      }
    },
    [persistLayout]
  );

  const commit = useCallback(() => {
    savePanelLayout(layoutRef.current);
  }, []);

  // Rigid (flexShrink: 0) panels must follow the viewport when the window
  // shrinks, otherwise they overflow the row until the next reload
  useEffect(() => {
    const handleResize = () => {
      applyLayout(clampLayoutToViewport(layoutRef.current, window.innerWidth));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applyLayout]);

  return {
    layout,
    resizeLeft,
    resizeRight,
    toggleLeft,
    toggleRight,
    resetSide,
    commit,
  };
};
