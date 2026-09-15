/**
 * Playback keyboard shortcuts (story 3.8, AC #3).
 *
 * Pure helpers so the Space play/pause toggle is testable without Monaco:
 * the editor captures Space in its hidden textarea, so a toggle must never
 * fire while an editable element has focus.
 */

/** Whether the event target swallows keystrokes (editor inputs, Monaco) */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  // Monaco edits through an in-editor input surface (a hidden textarea on
  // some versions, a native-edit-context div on 0.55+): any keystroke that
  // originates inside the editor belongs to the editor — never hijack it.
  if (target.closest('.monaco-editor')) return true;

  return (
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/**
 * True when the keydown event should toggle replay play/pause: Space on a
 * non-editable, non-activatable target. Buttons and links keep their native
 * Space activation (keyboard accessibility) — only "free" focus toggles
 * playback. Reserved modifier chords (Ctrl/Alt/Meta+Space) belong to the OS,
 * assistive tech or future editor shortcuts — never hijack them. An unknown
 * target could be an editor surface — never hijack it.
 */
export function shouldTogglePlayback(event: KeyboardEvent): boolean {
  if (event.key !== ' ' && event.key !== 'Spacebar') return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (!(event.target instanceof HTMLElement)) return false;

  const target = event.target;
  const isActivatableControl =
    target.tagName === 'BUTTON' ||
    target.tagName === 'A' ||
    target.getAttribute('role') === 'button';
  if (isActivatableControl) return false;

  return !isEditableTarget(target);
}
