/**
 * Panel Layout Unit Tests
 *
 * Tests the workspace panel layout persistence lib against every row of
 * the feature's I/O & Edge-Case Matrix:
 * - Fresh workspace (no key): defaults, and the key stays absent
 * - Roundtrip save/load (reload after resize)
 * - Width clamping on load (below per-side minimums, above 50vw)
 * - Corrupt/invalid storage: silent fallback to defaults
 * - savePanelLayout: writes under `panel_layout`, never throws
 *
 * @see Feature: Collapsible & Resizable Workspace Panels
 * @priority P0
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PANEL_LAYOUT,
  PANEL_LAYOUT_KEY,
  clampPanelWidth,
  loadPanelLayout,
  savePanelLayout,
} from '@/lib/panelLayout';

/** In-memory localStorage so save -> load roundtrips actually work */
const makeLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
  };
};

type LocalStorageMock = ReturnType<typeof makeLocalStorageMock>;

let localStorageMock: LocalStorageMock;

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    writable: true,
    configurable: true,
  });
};

const setStoredRaw = (raw: string | null) => {
  localStorageMock.getItem.mockReturnValueOnce(raw);
};

describe('panelLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = makeLocalStorageMock();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    // jsdom default viewport; tests override explicitly when clamping matters
    setViewportWidth(1024);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setViewportWidth(1024);
  });

  describe('loadPanelLayout', () => {
    it('should return defaults on a fresh workspace (no key in localStorage)', () => {
      setStoredRaw(null);

      expect(loadPanelLayout()).toEqual({
        leftWidth: 280,
        rightWidth: 300,
        leftCollapsed: false,
        rightCollapsed: false,
      });
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
    });

    it('should not write the key when loading (absent until first change)', () => {
      setStoredRaw(null);

      loadPanelLayout();

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should restore a stored layout after a save (roundtrip)', () => {
      const layout = {
        leftWidth: 412,
        rightWidth: 300,
        leftCollapsed: false,
        rightCollapsed: true,
      };

      savePanelLayout(layout);
      // Roundtrip reads back through the mock's backing store
      expect(loadPanelLayout()).toEqual(layout);

      // Sanity: stored under the snake_case key as JSON
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        PANEL_LAYOUT_KEY,
        JSON.stringify(layout)
      );
    });

    it('should restore widths matching the I/O matrix reload row', () => {
      setViewportWidth(1600);
      setStoredRaw(
        JSON.stringify({
          leftWidth: 412,
          rightWidth: 300,
          leftCollapsed: false,
          rightCollapsed: false,
        })
      );

      const layout = loadPanelLayout();

      expect(layout.leftWidth).toBe(412);
      expect(layout.rightWidth).toBe(300);
      expect(layout.leftCollapsed).toBe(false);
    });

    it('should clamp a stored width below the per-side minimum on load', () => {
      setViewportWidth(1600);
      setStoredRaw(
        JSON.stringify({
          leftWidth: 100,
          rightWidth: 50,
          leftCollapsed: false,
          rightCollapsed: false,
        })
      );

      const layout = loadPanelLayout();

      expect(layout.leftWidth).toBe(180);
      expect(layout.rightWidth).toBe(220);
    });

    it('should clamp a stored width above 50vw on load (silent clamp)', () => {
      // Stored leftWidth: 900, viewport 1200px -> clamped to 600px (50vw)
      setViewportWidth(1200);
      setStoredRaw(
        JSON.stringify({
          leftWidth: 900,
          rightWidth: 900,
          leftCollapsed: false,
          rightCollapsed: false,
        })
      );

      const layout = loadPanelLayout();

      expect(layout.leftWidth).toBe(600);
      expect(layout.rightWidth).toBe(600);
    });

    it('should fall back to defaults on corrupt storage ("{oops")', () => {
      setStoredRaw('{oops');

      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
    });

    it('should fall back to defaults when the stored value is not an object', () => {
      setStoredRaw(JSON.stringify([280, 300]));

      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);

      setStoredRaw('null');
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);

      setStoredRaw('42');
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);

      setStoredRaw('"layout"');
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
    });

    it('should fall back to defaults when fields have the wrong types', () => {
      setStoredRaw(
        JSON.stringify({
          leftWidth: '400',
          rightWidth: 300,
          leftCollapsed: false,
          rightCollapsed: false,
        })
      );
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);

      setStoredRaw(
        JSON.stringify({
          leftWidth: 400,
          rightWidth: 300,
          leftCollapsed: 'yes',
          rightCollapsed: false,
        })
      );
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);

      setStoredRaw(
        JSON.stringify({
          leftWidth: 400,
          rightWidth: Number.POSITIVE_INFINITY,
          leftCollapsed: false,
          rightCollapsed: false,
        })
      );
      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
    });

    it('should fall back to defaults when localStorage access throws', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('storage unavailable');
      });

      expect(loadPanelLayout()).toEqual(DEFAULT_PANEL_LAYOUT);
    });
  });

  describe('savePanelLayout', () => {
    it('should persist the layout as JSON under the snake_case key', () => {
      const layout = {
        leftWidth: 412,
        rightWidth: 300,
        leftCollapsed: false,
        rightCollapsed: true,
      };

      savePanelLayout(layout);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'panel_layout',
        JSON.stringify(layout)
      );
    });

    it('should not throw when the storage write fails (private mode)', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() =>
        savePanelLayout({
          leftWidth: 400,
          rightWidth: 300,
          leftCollapsed: false,
          rightCollapsed: false,
        })
      ).not.toThrow();
    });
  });

  describe('clampPanelWidth', () => {
    it('should pass through widths inside the allowed range', () => {
      setViewportWidth(1600);

      expect(clampPanelWidth(412, 'left', 1600)).toBe(412);
      expect(clampPanelWidth(300, 'right', 1600)).toBe(300);
    });

    it('should clamp the left panel to [180, 50vw]', () => {
      expect(clampPanelWidth(100, 'left', 1600)).toBe(180);
      expect(clampPanelWidth(900, 'left', 1600)).toBe(800);
      expect(clampPanelWidth(180, 'left', 1600)).toBe(180);
      expect(clampPanelWidth(800, 'left', 1600)).toBe(800);
    });

    it('should clamp the right panel to [220, 50vw]', () => {
      expect(clampPanelWidth(150, 'right', 1600)).toBe(220);
      expect(clampPanelWidth(900, 'right', 1600)).toBe(800);
      expect(clampPanelWidth(220, 'right', 1600)).toBe(220);
    });

    it('should cap at 50vw when the viewport is narrower than twice the minimum', () => {
      // 50vw = 150 < min 180: the max wins
      expect(clampPanelWidth(400, 'left', 300)).toBe(150);
      // 50vw = 160 < min 220: the max wins
      expect(clampPanelWidth(400, 'right', 320)).toBe(160);
    });
  });
});
