/**
 * Keyboard Guard Unit Tests (story 3.9, Task 4)
 *
 * isTypingContext is the shared editing-surface guard behind every playback
 * shortcut (Space from 3.8, arrow navigation from 3.9): keystrokes that
 * belong to Monaco, an input or any editable element must never be hijacked.
 *
 * @priority P0
 */
import { describe, it, expect } from 'vitest';
import { isTypingContext } from '@/lib/keyboard';

/** Build a keydown-like event carrying the given target */
const eventOn = (target: HTMLElement | null, key = 'ArrowRight'): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target ?? document.body });
  return event;
};

describe('isTypingContext', () => {
  it('should be false for a plain body target (free focus)', () => {
    expect(isTypingContext(eventOn(document.body))).toBe(false);
    expect(isTypingContext(eventOn(document.createElement('div')))).toBe(false);
    expect(isTypingContext(eventOn(document.createElement('span')))).toBe(false);
  });

  it('should be true for a textarea target (older Monaco hidden input)', () => {
    expect(isTypingContext(eventOn(document.createElement('textarea')))).toBe(true);
  });

  it('should be true for an input or select target', () => {
    expect(isTypingContext(eventOn(document.createElement('input')))).toBe(true);
    expect(isTypingContext(eventOn(document.createElement('select')))).toBe(true);
  });

  it('should be true inside the Monaco editor surface (native-edit-context)', () => {
    // Monaco 0.55 edits through a native-edit-context div (no textarea, not
    // contentEditable) nested inside .monaco-editor
    const surface = document.createElement('div');
    surface.className = 'native-edit-context';
    const editor = document.createElement('div');
    editor.className = 'monaco-editor';
    editor.appendChild(surface);
    expect(isTypingContext(eventOn(surface))).toBe(true);
  });

  it('should be true for a contentEditable target', () => {
    const editable = document.createElement('div');
    // jsdom does not reflect the contenteditable attribute onto
    // isContentEditable — simulate the browser's editable-element contract
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingContext(eventOn(editable))).toBe(true);
  });

  it('should be false when the target is missing (not a known surface)', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(event, 'target', { value: null });
    expect(isTypingContext(event)).toBe(false);
  });
});
