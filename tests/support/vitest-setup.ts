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

// Mock canvas context (needed for PixiJS)
HTMLCanvasElement.prototype.getContext = (() => {
  return null;
}) as any;

// Global test timeout
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
