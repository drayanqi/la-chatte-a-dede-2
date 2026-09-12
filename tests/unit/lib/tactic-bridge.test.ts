/**
 * TacticBridge Unit Tests
 *
 * Tests the API↔engine tactic conversion, focused on the left-half
 * normalization invariant: home players always hold x in [0, 50]
 * (kickoff positions, home defends the left goal), mirrored across the
 * halfway line and clamped, in both load and save directions.
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Spec: Home players on the left half — tactic positions are kickoff positions
 * @priority P0
 */
import { describe, it, expect } from 'vitest';
import { tacticConfigToTacticData, tacticDataToPlayerConfigs } from '@/lib/tacticBridge';
import type { TacticConfig, TacticData } from '@/types';

const makeConfig = (positionX: number, positionY = 25): TacticConfig => ({
  id: 'tactic-1',
  name: 'Tactic 1',
  isSystem: false,
  players: [{ playerSlot: 1, positionX, positionY, scriptId: null }],
});

const makeTactic = (x: number, y: number): TacticData => ({
  id: 'tactic-1',
  name: 'Tactic 1',
  players: [
    {
      id: 'home-0',
      name: 'GK',
      teamId: 'home',
      number: 1,
      position: { x, y },
      assignedScriptId: null,
    },
  ],
  ball: { x: 50, y: 50 },
  scripts: {},
});

describe('TacticBridge', () => {
  describe('left-half normalization on load (tacticConfigToTacticData)', () => {
    it('should mirror a right-half x across the halfway line', () => {
      // GIVEN: A legacy tactic with a player parked in the opponent's half
      // WHEN: Loading it into the engine
      const data = tacticConfigToTacticData(makeConfig(60));

      // THEN: The player renders mirrored at x=40 (100 - 60)
      expect(data.players[0].position.x).toBe(40);
    });

    it('should keep an already-left position unchanged', () => {
      // GIVEN: A tactic player already in the left half
      // WHEN: Loading it into the engine
      const data = tacticConfigToTacticData(makeConfig(40));

      // THEN: The position passes through untouched
      expect(data.players[0].position.x).toBe(40);
    });

    it('should be idempotent: normalizing an already-normalized value twice is stable', () => {
      // GIVEN: A legacy tactic with a right-half player
      const data = tacticConfigToTacticData(makeConfig(60));
      const healed = tacticDataToPlayerConfigs(data);

      // WHEN: The healed values are loaded and saved again
      const dataAgain = tacticConfigToTacticData({
        ...makeConfig(0),
        players: healed,
      });
      const healedAgain = tacticDataToPlayerConfigs(dataAgain);

      // THEN: The second pass changes nothing
      expect(dataAgain.players[0].position.x).toBe(40);
      expect(healedAgain[0].positionX).toBe(40);
    });

    it('should keep x=50 exactly on the halfway line', () => {
      // GIVEN: A tactic player on the halfway line
      // WHEN: Loading it into the engine
      const data = tacticConfigToTacticData(makeConfig(50));

      // THEN: x stays 50 (no mirror at the boundary)
      expect(data.players[0].position.x).toBe(50);
    });

    it('should clamp a mirrored out-of-range value to 0', () => {
      // GIVEN: An out-of-range API value at x=120
      // WHEN: Loading it into the engine
      const data = tacticConfigToTacticData(makeConfig(120));

      // THEN: Mirroring gives -20, clamped to 0
      expect(data.players[0].position.x).toBe(0);
    });
  });

  describe('left-half normalization on save (tacticDataToPlayerConfigs)', () => {
    it('should mirror a right-half engine x across the halfway line', () => {
      // GIVEN: An engine player parked in the opponent's half
      // WHEN: Saving it to the API payload
      const slots = tacticDataToPlayerConfigs(makeTactic(60, 50));

      // THEN: The payload holds the mirrored x=40 (100 - 60)
      expect(slots[0].positionX).toBe(40);
    });

    it('should be idempotent: saving an already-normalized value twice is stable', () => {
      // GIVEN: An engine player already in the left half
      const slots = tacticDataToPlayerConfigs(makeTactic(40, 50));

      // WHEN: The saved value is loaded and saved again
      const slotsAgain = tacticDataToPlayerConfigs(
        tacticConfigToTacticData({ ...makeConfig(0), players: slots })
      );

      // THEN: The second pass changes nothing
      expect(slotsAgain[0].positionX).toBe(40);
    });

    it('should keep x=50 exactly on the halfway line', () => {
      // GIVEN: An engine player on the halfway line
      // WHEN: Saving it to the API payload
      const slots = tacticDataToPlayerConfigs(makeTactic(50, 50));

      // THEN: x stays 50 (no mirror at the boundary)
      expect(slots[0].positionX).toBe(50);
    });

    it('should clamp a mirrored out-of-range value to 0', () => {
      // GIVEN: An out-of-range engine value at x=120
      // WHEN: Saving it to the API payload
      const slots = tacticDataToPlayerConfigs(makeTactic(120, 50));

      // THEN: Mirroring gives -20, clamped to 0
      expect(slots[0].positionX).toBe(0);
    });
  });

  describe('y scaling unchanged', () => {
    it('should scale API y by ×2 on load', () => {
      // GIVEN: A tactic player at API y=15
      // WHEN: Loading it into the engine
      const data = tacticConfigToTacticData(makeConfig(40, 15));

      // THEN: Engine y is 30 (full-field percent units)
      expect(data.players[0].position.y).toBe(30);
    });

    it('should scale engine y by ÷2 on save', () => {
      // GIVEN: An engine player at y=30
      // WHEN: Saving it to the API payload
      const slots = tacticDataToPlayerConfigs(makeTactic(40, 30));

      // THEN: API y is 15 (half-field units)
      expect(slots[0].positionY).toBe(15);
    });
  });
});
