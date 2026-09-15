/**
 * Playback Shortcut Unit Tests (story 3.8, Task 5)
 *
 * shouldTogglePlayback decides whether a keydown event toggles replay
 * play/pause (AC #3: Space toggles). Extracted as a pure function so the
 * Monaco editor exclusion is testable without Monaco itself: editing
 * keystrokes must never touch playback.
 *
 * @priority P0
 */
import { describe, it, expect } from 'vitest';
import { shouldTogglePlayback } from '@/lib/playbackShortcuts';

/** Build a keydown-like event carrying the given target */
const eventOn = (target: HTMLElement | null, key = ' '): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target ?? document.body });
  return event;
};

describe('shouldTogglePlayback', () => {
  it('should toggle on Space from non-editable targets', () => {
    expect(shouldTogglePlayback(eventOn(document.body))).toBe(true);
    expect(shouldTogglePlayback(eventOn(document.createElement('div')))).toBe(true);
    expect(shouldTogglePlayback(eventOn(document.createElement('span')))).toBe(true);
  });

  it('should not toggle on Space over buttons and links (native activation)', () => {
    // A focused control must keep its native Space activation: hijacking it
    // makes the control unreachable by keyboard (accessibility)
    expect(shouldTogglePlayback(eventOn(document.createElement('button')))).toBe(false);
    expect(shouldTogglePlayback(eventOn(document.createElement('a')))).toBe(false);
    const roleButton = document.createElement('div');
    roleButton.setAttribute('role', 'button');
    expect(shouldTogglePlayback(eventOn(roleButton))).toBe(false);
  });

  it('should not toggle on reserved modifier chords (Ctrl/Alt/Meta+Space)', () => {
    const modifiers = ['ctrlKey', 'altKey', 'metaKey'] as const;
    for (const modifier of modifiers) {
      const event = new KeyboardEvent('keydown', { key: ' ', [modifier]: true });
      Object.defineProperty(event, 'target', { value: document.body });
      expect(shouldTogglePlayback(event)).toBe(false);
    }
  });

  it('should ignore Space while the Monaco editor surface has focus', () => {
    // Monaco 0.55 edits through a native-edit-context div (no textarea, not
    // contentEditable) nested inside .monaco-editor
    const surface = document.createElement('div');
    surface.className = 'native-edit-context';
    const editor = document.createElement('div');
    editor.className = 'monaco-editor';
    editor.appendChild(surface);
    expect(shouldTogglePlayback(eventOn(surface))).toBe(false);

    // Older Monaco versions edit through a hidden textarea — covered too
    expect(shouldTogglePlayback(eventOn(document.createElement('textarea')))).toBe(false);
  });

  it('should ignore Space while an input or select has focus', () => {
    expect(shouldTogglePlayback(eventOn(document.createElement('input')))).toBe(false);
    expect(shouldTogglePlayback(eventOn(document.createElement('select')))).toBe(false);
  });

  it('should ignore Space while a contentEditable element has focus', () => {
    const editable = document.createElement('div');
    // jsdom does not reflect the contenteditable attribute onto
    // isContentEditable — simulate the browser's editable-element contract
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(shouldTogglePlayback(eventOn(editable))).toBe(false);
  });

  it('should ignore keys other than Space', () => {
    expect(shouldTogglePlayback(eventOn(document.body, 'Enter'))).toBe(false);
    expect(shouldTogglePlayback(eventOn(document.body, 'a'))).toBe(false);
    expect(shouldTogglePlayback(eventOn(document.body, 'ArrowLeft'))).toBe(false);
    expect(shouldTogglePlayback(eventOn(document.body, 'Escape'))).toBe(false);
  });

  it('should ignore Space when the target is missing', () => {
    const event = new KeyboardEvent('keydown', { key: ' ' });
    Object.defineProperty(event, 'target', { value: null });
    expect(shouldTogglePlayback(event)).toBe(false);
  });
});
