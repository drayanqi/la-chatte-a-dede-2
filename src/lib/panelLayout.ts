/**
 * panelLayout - Workspace panel layout persistence
 * OWNER: Dev Team
 *
 * Single persistence entry point for the collapsible/resizable workspace
 * panels (AI Scripts left, Debugger right). One device-level localStorage
 * key (`panel_layout`, snake_case like `last_active_tactic_id`) stores
 * widths and collapsed flags. Missing, corrupt or invalid data silently
 * falls back to defaults; stored widths are re-clamped on load because the
 * viewport may have shrunk since they were saved.
 *
 * @see Feature: Collapsible & Resizable Workspace Panels
 */

export interface PanelLayout {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

/** Which workspace panel a width/collapse action targets */
export type PanelSide = 'left' | 'right';

/** localStorage key remembering the layout across sessions */
export const PANEL_LAYOUT_KEY = 'panel_layout';

export const DEFAULT_LEFT_WIDTH = 280;
export const DEFAULT_RIGHT_WIDTH = 300;
export const MIN_LEFT_WIDTH = 180;
export const MIN_RIGHT_WIDTH = 220;

/** A panel can take at most half of the current viewport width */
export const MAX_VIEWPORT_RATIO = 0.5;

/** The canvas (center panel) never shrinks below this width */
export const MIN_CENTER_WIDTH = 320;

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  leftWidth: DEFAULT_LEFT_WIDTH,
  rightWidth: DEFAULT_RIGHT_WIDTH,
  leftCollapsed: false,
  rightCollapsed: false,
};

const MIN_WIDTHS: Record<PanelSide, number> = {
  left: MIN_LEFT_WIDTH,
  right: MIN_RIGHT_WIDTH,
};

/**
 * Clamp a panel width to [per-side minimum, 50% of the viewport].
 * If the viewport is so narrow that max < min, 50% of the viewport wins.
 */
export const clampPanelWidth = (
  width: number,
  side: PanelSide,
  viewportWidth: number
): number => {
  // Degenerate viewport (hidden iframe, prerender): floor at the min only
  if (viewportWidth <= 0) {
    return Math.max(width, MIN_WIDTHS[side]);
  }

  const maxWidth = Math.floor(viewportWidth * MAX_VIEWPORT_RATIO);
  return Math.min(Math.max(width, MIN_WIDTHS[side]), maxWidth);
};

/** Re-clamp every width of a layout against the given viewport width */
export const clampLayoutToViewport = (
  layout: PanelLayout,
  viewportWidth: number
): PanelLayout => ({
  leftWidth: clampPanelWidth(layout.leftWidth, 'left', viewportWidth),
  rightWidth: clampPanelWidth(layout.rightWidth, 'right', viewportWidth),
  leftCollapsed: layout.leftCollapsed,
  rightCollapsed: layout.rightCollapsed,
});

/** Shape + type validation for anything parsed out of localStorage */
const isValidLayout = (value: unknown): value is PanelLayout => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const layout = value as Record<string, unknown>;

  return (
    typeof layout.leftWidth === 'number' &&
    Number.isFinite(layout.leftWidth) &&
    typeof layout.rightWidth === 'number' &&
    Number.isFinite(layout.rightWidth) &&
    typeof layout.leftCollapsed === 'boolean' &&
    typeof layout.rightCollapsed === 'boolean'
  );
};

/**
 * Load the stored layout, falling back silently to defaults when the key
 * is absent, unparsable or malformed. Widths are clamped against the
 * current viewport. Reading never writes: `panel_layout` stays absent
 * until the first user change.
 */
export const loadPanelLayout = (): PanelLayout => {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);

    if (raw === null) {
      return { ...DEFAULT_PANEL_LAYOUT };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isValidLayout(parsed)) {
      return { ...DEFAULT_PANEL_LAYOUT };
    }

    return clampLayoutToViewport(parsed, window.innerWidth);
  } catch {
    // Unparsable JSON or inaccessible storage: defaults, no console crash
    return { ...DEFAULT_PANEL_LAYOUT };
  }
};

/**
 * Persist the layout. Never throws (private-mode quota, etc.): if the
 * write fails the layout simply is not restored next session.
 */
export const savePanelLayout = (layout: PanelLayout): void => {
  try {
    localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable: ignore
  }
};
