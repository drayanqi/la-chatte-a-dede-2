/**
 * Vitest Global Setup
 *
 * This file runs before all unit tests.
 * Configure global mocks, test utilities, and cleanup here.
 */
import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver (needed for Monaco Editor)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia (needed for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Pixi's text metrics reference these 2d globals for feature detection —
// jsdom does not define them without the `canvas` package
(globalThis as Record<string, unknown>).CanvasRenderingContext2D ??= class {};
(globalThis as Record<string, unknown>).Path2D ??= class {};

// Mock canvas context (needed for PixiJS). 2d contexts (text measurement in
// CanvasTextMetrics) get a minimal measuring stub; WebGL contexts stay null
// so renderer init paths behave exactly as before.
HTMLCanvasElement.prototype.getContext = ((type: string) => {
  if (type !== '2d') return null;

  const gradient = { addColorStop: () => {} };
  const context = {
    canvas: null as HTMLCanvasElement | null,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    direction: 'ltr',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    measureText: (text: string) => ({
      width: text.length * 7,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 7,
    }),
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    rect: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
  };
  context.canvas = document.createElement('canvas');
  return context;
}) as any;

// Global test timeout
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
