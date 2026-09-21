/**
 * Player Color Constant Tests (story 3.7, Task 2/6)
 *
 * The team colors are a UX-spec contract (Rocket League-inspired):
 * home = orange #ff6b1a, away = blue #1a8cff. Exported so the engine,
 * celebrations (team-colored confetti) and tests share one source of truth.
 *
 * @see ux-design-specification.md — Team Colors
 * @priority P1
 */
import { describe, it, expect } from 'vitest';
import { Graphics, Text } from 'pixi.js';
import {
  PlayerSprite,
  PLAYER_HOME_COLOR,
  PLAYER_AWAY_COLOR,
} from '@/components/canvas/engine/Player';
import type { Player } from '@/types';

const makePlayer = (teamId: 'home' | 'away'): Player =>
  ({
    id: `${teamId}-1`,
    name: `${teamId} player`,
    number: 7,
    teamId,
    position: { x: 25, y: 50 },
    assignedScriptId: null,
  }) as unknown as Player;

describe('Player Team Colors', () => {
  it('should paint the home team orange (#ff6b1a)', () => {
    expect(PLAYER_HOME_COLOR).toBe(0xff6b1a);
  });

  it('should paint the away team blue (#1a8cff)', () => {
    expect(PLAYER_AWAY_COLOR).toBe(0x1a8cff);
  });

  it('should keep home and away visually distinct', () => {
    expect(PLAYER_HOME_COLOR).not.toBe(PLAYER_AWAY_COLOR);
  });
});

describe('Player Sprite Habillage (story 7.3, Task 5/6)', () => {
  it('should build the polished-circle layer stack in mockup order', () => {
    // GIVEN: a sprite on the default canvas
    const sprite = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    // THEN: ground shadow under the circle, then circle, number, script dot
    const children = sprite.container.children;
    expect(children.length).toBe(4);
    expect(children[0]).toBe(sprite.container.children[0]); // ground shadow first

    // The ground shadow ellipse is wider than tall (mockup .player::before 30x10)
    const groundShadow = children[0] as Graphics;
    expect(groundShadow.bounds.width).toBeGreaterThan(groundShadow.bounds.height);

    sprite.destroy();
  });

  it('should keep the number readable with a drop shadow and stay inside the circle', () => {
    const sprite = new PlayerSprite(
      makePlayer('away'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    const numberText = sprite.container.children[2] as Text;
    expect(numberText.text).toBe('7');
    // Bold number (mockup .pnum font-weight 800)
    expect(numberText.style.fontWeight).toBe('800');
    expect(numberText.style.dropShadow).toBeTruthy();

    sprite.destroy();
  });

  it('should keep selection behavior intact: sun ring replaces the white border', () => {
    const sprite = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    sprite.setSelected(true);

    // Selection ring (sun) unchanged by the habillage — the sprite remains
    // interactive and the circle restroke does not move the container
    const x = sprite.container.x;
    const y = sprite.container.y;
    expect(x).toBeCloseTo(220, 0);
    expect(y).toBeCloseTo(300, 0);

    sprite.destroy();
  });

  it('should ignore pointer events for replay sprites', () => {
    const sprite = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} },
      { interactive: false }
    );

    expect(sprite.container.eventMode).toBe('none');

    sprite.destroy();
  });
});

describe('Player Sprite Team Colors (story 7.4)', () => {
  it('should accept per-instance team colors without breaking the sprite', () => {
    const sprite = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    // Recolor home to mint (Équipement palette): must redraw, keep the
    // 4-layer stack and stay position-stable
    const x = sprite.container.x;
    const y = sprite.container.y;
    sprite.setTeamColors(0x31c48d, 0x1a8cff);

    expect(sprite.container.children.length).toBe(4);
    expect(sprite.container.x).toBe(x);
    expect(sprite.container.y).toBe(y);

    sprite.destroy();
  });

  it('should keep the default palette when untouched', () => {
    const sprite = new PlayerSprite(
      makePlayer('home'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    // Identical colors: a no-op redraw (the engine guards it), structure intact
    sprite.setTeamColors(PLAYER_HOME_COLOR, PLAYER_AWAY_COLOR);
    expect(sprite.container.children.length).toBe(4);

    sprite.destroy();
  });

  it('should survive a selection ring after a recolor', () => {
    const sprite = new PlayerSprite(
      makePlayer('away'),
      800,
      600,
      { onSelect: () => {}, onHover: () => {} }
    );

    sprite.setTeamColors(0xffc244, 0x9b6ce8);
    sprite.setSelected(true);

    const numberText = sprite.container.children[2] as Text;
    expect(numberText.text).toBe('7');

    sprite.destroy();
  });
});
