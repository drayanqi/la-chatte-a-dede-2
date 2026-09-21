/**
 * Player Sprite Script Tag Tests (story 7.5)
 *
 * Edit-mode sprites carry a script name tag under the circle (mockup
 * .ptag): assigned names get a dark capsule pill, unassigned players show
 * the italic muted "non assigné" tag. Replay sprites have no tag layer.
 *
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import { Graphics, Text } from 'pixi.js';
import { PlayerSprite } from '@/components/canvas/engine/Player';
import type { Player } from '@/types';

const makePlayer = (teamId: 'home' | 'away'): Player =>
  ({
    id: `${teamId}-1`,
    name: `${teamId} player`,
    number: 9,
    teamId,
    position: { x: 25, y: 50 },
    assignedScriptId: null,
  }) as unknown as Player;

const makeSprite = () =>
  new PlayerSprite(makePlayer('home'), 800, 600, { onSelect: () => {}, onHover: () => {} }, {
    showScriptLabel: true,
  });

describe('Player Sprite Script Tag (story 7.5)', () => {
  it('should render the tag layers only when showScriptLabel is on', () => {
    // Edit sprite: 4 layers + pill + tag text
    const edit = makeSprite();
    expect(edit.container.children.length).toBe(6);
    edit.destroy();

    // Replay sprite (default): no tag layers, the 7.3 contract holds
    const replay = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );
    expect(replay.container.children.length).toBe(4);
    replay.destroy();
  });

  it('should show the italic "non assigné" tag when no script is assigned', () => {
    const sprite = makeSprite();

    const tag = sprite.container.children[5] as Text;
    expect(tag.text).toBe('non assigné');
    expect(tag.style.fontStyle).toBe('italic');
    expect(tag.alpha).toBeLessThan(1);

    // No pill behind the placeholder (cleared graphics have empty bounds)
    const pill = sprite.container.children[4] as Graphics;
    expect(pill.bounds.width).toBeLessThanOrEqual(0);

    sprite.destroy();
  });

  it('should show the assigned script name in a dark pill', () => {
    const sprite = makeSprite();

    sprite.setScriptLabel('pivot.js');

    const tag = sprite.container.children[5] as Text;
    expect(tag.text).toBe('pivot.js');
    expect(tag.style.fontStyle).toBe('normal');
    expect(tag.alpha).toBe(1);

    // The capsule pill wraps the text
    const pill = sprite.container.children[4] as Graphics;
    expect(pill.bounds.width).toBeGreaterThan(tag.width);
    expect(pill.bounds.height).toBeGreaterThan(tag.height);

    sprite.destroy();
  });

  it('should fall back to "non assigné" when a script is detached', () => {
    const sprite = makeSprite();

    sprite.setScriptLabel('pivot.js');
    sprite.setScriptLabel(null);

    const tag = sprite.container.children[5] as Text;
    expect(tag.text).toBe('non assigné');
    expect(tag.style.fontStyle).toBe('italic');

    const pill = sprite.container.children[4] as Graphics;
    expect(pill.bounds.width).toBeLessThanOrEqual(0);

    sprite.destroy();
  });

  it('should ignore label updates on replay sprites', () => {
    const sprite = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    // Must not throw — replay sprites simply have no tag layer
    sprite.setScriptLabel('pivot.js');

    sprite.destroy();
  });

  it('should keep the tag position below the circle after a resize', () => {
    const sprite = makeSprite();

    sprite.updateScreenSize(1200, 800);

    const tag = sprite.container.children[5] as Text;
    // The circle center is at y=0 within the container; the tag sits under it
    expect(tag.y).toBeGreaterThan(0);

    sprite.destroy();
  });
});
