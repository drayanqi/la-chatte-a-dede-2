/**
 * Time Format - tick <-> mm:ss mapping for the timeline scrubber (story 3.9)
 *
 * The engine runs at 60 fps (game-rules.md): 60 ticks = 1 second. Pure
 * function, no store, no component — display concern only.
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

/** Format a playback tick as `mm:ss` (60 ticks = 1 second) */
export function formatTime(tick: number): string {
  const safeTick = Math.max(0, Math.floor(tick));
  const seconds = safeTick / 60;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
