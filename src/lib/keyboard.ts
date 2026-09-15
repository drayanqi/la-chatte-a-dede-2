/**
 * Shared keyboard guard (story 3.9).
 *
 * Single editing-surface check behind every playback shortcut: Space
 * play/pause (story 3.8) and arrow-key navigation (story 3.9) both decide
 * "does this keystroke belong to the user's typing?" with this helper.
 * Pure function over the event target so it is testable without Monaco.
 */

/**
 * True when the event target swallows keystrokes (editor inputs, Monaco).
 * Monaco edits through an in-editor input surface (a hidden textarea on
 * some versions, a native-edit-context div on 0.55+): any keystroke that
 * originates inside the editor belongs to the editor — never hijack it.
 */
export function isTypingContext(event: KeyboardEvent): boolean {
  if (!(event.target instanceof HTMLElement)) return false;

  const target = event.target;
  if (target.closest('.monaco-editor')) return true;

  // Boolean(): jsdom's isContentEditable can be undefined on some elements
  // (e.g. body) — the guard must return a proper boolean
  return Boolean(
    target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
  );
}
