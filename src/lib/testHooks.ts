/**
 * Test hooks shared between the app and the E2E specs (story 3.7).
 *
 * TEST_LOAD_FRAMES_EVENT: window CustomEvent that injects match frames into
 * the running app (AppShell) — the test-only bridge for the frame pipeline
 * until story 3.8 wires real replay loading.
 *
 * Kept dependency-free so Playwright specs can import the name without
 * pulling the Pixi canvas (and its assets) into the Node context.
 */

export const TEST_LOAD_FRAMES_EVENT = 'lachatadede:test-load-frames';
