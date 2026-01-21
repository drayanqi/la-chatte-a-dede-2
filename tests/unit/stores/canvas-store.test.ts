/**
 * Canvas Store Unit Tests
 *
 * Tests the Zustand store that manages canvas state:
 * - Playback state (isPlaying, currentFrame, totalFrames)
 * - Player selection and hover
 * - Tactic and simulation state
 *
 * @see Epic 3: Canvas interaction state management
 * @priority P0
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '@/stores/canvasStore';
import type { PlayerFrameState } from '@/types';

describe('Canvas Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useCanvasStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      // GIVEN: Fresh store
      const state = useCanvasStore.getState();

      // THEN: All values should be at defaults
      expect(state.isPlaying).toBe(false);
      expect(state.currentFrame).toBe(0);
      expect(state.totalFrames).toBe(0);
      expect(state.selectedPlayerId).toBeNull();
      expect(state.hoveredPlayerId).toBeNull();
      expect(state.tacticLoaded).toBe(false);
      expect(state.simulationReady).toBe(false);
      expect(state.playerStates).toEqual([]);
    });
  });

  describe('Player Selection', () => {
    it('should set selected player', () => {
      // GIVEN: Initial state with no selection
      const store = useCanvasStore.getState();
      expect(store.selectedPlayerId).toBeNull();

      // WHEN: Selecting a player
      store.setSelectedPlayer('player-1');

      // THEN: Player should be selected
      expect(useCanvasStore.getState().selectedPlayerId).toBe('player-1');
    });

    it('should clear selected player with null', () => {
      // GIVEN: A selected player
      const store = useCanvasStore.getState();
      store.setSelectedPlayer('player-1');

      // WHEN: Clearing selection
      store.setSelectedPlayer(null);

      // THEN: Selection should be cleared
      expect(useCanvasStore.getState().selectedPlayerId).toBeNull();
    });

    it('should change selection to different player', () => {
      // GIVEN: A selected player
      const store = useCanvasStore.getState();
      store.setSelectedPlayer('player-1');

      // WHEN: Selecting another player
      store.setSelectedPlayer('player-2');

      // THEN: New player should be selected
      expect(useCanvasStore.getState().selectedPlayerId).toBe('player-2');
    });
  });

  describe('Player Hover', () => {
    it('should set hovered player', () => {
      // GIVEN: No hover
      const store = useCanvasStore.getState();

      // WHEN: Hovering over player
      store.setHoveredPlayer('player-3');

      // THEN: Player should be hovered
      expect(useCanvasStore.getState().hoveredPlayerId).toBe('player-3');
    });

    it('should clear hovered player', () => {
      // GIVEN: Hovering a player
      const store = useCanvasStore.getState();
      store.setHoveredPlayer('player-3');

      // WHEN: Mouse leaves player
      store.setHoveredPlayer(null);

      // THEN: Hover should be cleared
      expect(useCanvasStore.getState().hoveredPlayerId).toBeNull();
    });

    it('should not affect selection when hovering', () => {
      // GIVEN: Selected player
      const store = useCanvasStore.getState();
      store.setSelectedPlayer('player-1');

      // WHEN: Hovering over different player
      store.setHoveredPlayer('player-2');

      // THEN: Selection should remain unchanged
      expect(useCanvasStore.getState().selectedPlayerId).toBe('player-1');
      expect(useCanvasStore.getState().hoveredPlayerId).toBe('player-2');
    });
  });

  describe('Playback State', () => {
    it('should update playback state', () => {
      // GIVEN: Initial stopped state
      const store = useCanvasStore.getState();

      // WHEN: Starting playback at frame 10 of 100
      store.updatePlaybackState(true, 10, 100);

      // THEN: All playback values should update
      const state = useCanvasStore.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.currentFrame).toBe(10);
      expect(state.totalFrames).toBe(100);
    });

    it('should pause playback', () => {
      // GIVEN: Playing state
      const store = useCanvasStore.getState();
      store.updatePlaybackState(true, 50, 100);

      // WHEN: Pausing
      store.updatePlaybackState(false, 50, 100);

      // THEN: Should be paused at same frame
      const state = useCanvasStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.currentFrame).toBe(50);
    });

    it('should advance frames during playback', () => {
      // GIVEN: Playing at frame 0
      const store = useCanvasStore.getState();
      store.updatePlaybackState(true, 0, 100);

      // WHEN: Frame advances
      store.updatePlaybackState(true, 1, 100);
      store.updatePlaybackState(true, 2, 100);

      // THEN: Current frame should update
      expect(useCanvasStore.getState().currentFrame).toBe(2);
    });

    it('should handle reaching end of simulation', () => {
      // GIVEN: Playing near end
      const store = useCanvasStore.getState();
      store.updatePlaybackState(true, 98, 100);

      // WHEN: Reaching last frame
      store.updatePlaybackState(false, 99, 100);

      // THEN: Should stop at last frame
      const state = useCanvasStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.currentFrame).toBe(99);
    });
  });

  describe('Player States', () => {
    it('should update player states', () => {
      // GIVEN: Initial empty states
      const store = useCanvasStore.getState();
      expect(store.playerStates).toEqual([]);

      // WHEN: Updating with frame states
      const frameStates: PlayerFrameState[] = [
        {
          playerId: 'player-1',
          position: { x: 10, y: 20 },
          velocity: { vx: 1, vy: 0 },
          state: 'moving',
        },
        {
          playerId: 'player-2',
          position: { x: 30, y: 40 },
          velocity: { vx: 0, vy: 0 },
          state: 'idle',
        },
      ];
      store.updatePlayerStates(frameStates);

      // THEN: States should be stored
      expect(useCanvasStore.getState().playerStates).toEqual(frameStates);
      expect(useCanvasStore.getState().playerStates).toHaveLength(2);
    });

    it('should replace previous states completely', () => {
      // GIVEN: Previous states
      const store = useCanvasStore.getState();
      store.updatePlayerStates([
        { playerId: 'player-1', position: { x: 0, y: 0 }, velocity: { vx: 0, vy: 0 }, state: 'idle' },
      ]);

      // WHEN: Updating with new states
      const newStates: PlayerFrameState[] = [
        { playerId: 'player-2', position: { x: 50, y: 50 }, velocity: { vx: 2, vy: 2 }, state: 'action' },
      ];
      store.updatePlayerStates(newStates);

      // THEN: Old states should be replaced
      const states = useCanvasStore.getState().playerStates;
      expect(states).toHaveLength(1);
      expect(states[0].playerId).toBe('player-2');
    });

    it('should handle empty states array', () => {
      // GIVEN: Existing states
      const store = useCanvasStore.getState();
      store.updatePlayerStates([
        { playerId: 'player-1', position: { x: 0, y: 0 }, velocity: { vx: 0, vy: 0 }, state: 'idle' },
      ]);

      // WHEN: Clearing states
      store.updatePlayerStates([]);

      // THEN: States should be empty
      expect(useCanvasStore.getState().playerStates).toEqual([]);
    });
  });

  describe('Tactic and Simulation State', () => {
    it('should set tactic loaded state', () => {
      // GIVEN: No tactic loaded
      const store = useCanvasStore.getState();
      expect(store.tacticLoaded).toBe(false);

      // WHEN: Loading tactic
      store.setTacticLoaded(true);

      // THEN: Tactic should be marked as loaded
      expect(useCanvasStore.getState().tacticLoaded).toBe(true);
    });

    it('should set simulation ready state', () => {
      // GIVEN: Simulation not ready
      const store = useCanvasStore.getState();
      expect(store.simulationReady).toBe(false);

      // WHEN: Simulation becomes ready
      store.setSimulationReady(true);

      // THEN: Simulation should be ready
      expect(useCanvasStore.getState().simulationReady).toBe(true);
    });

    it('should allow clearing tactic loaded state', () => {
      // GIVEN: Tactic loaded
      const store = useCanvasStore.getState();
      store.setTacticLoaded(true);

      // WHEN: Unloading tactic
      store.setTacticLoaded(false);

      // THEN: Tactic should not be loaded
      expect(useCanvasStore.getState().tacticLoaded).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      // GIVEN: Modified state
      const store = useCanvasStore.getState();
      store.setSelectedPlayer('player-1');
      store.setHoveredPlayer('player-2');
      store.updatePlaybackState(true, 50, 100);
      store.setTacticLoaded(true);
      store.setSimulationReady(true);
      store.updatePlayerStates([
        { playerId: 'player-1', position: { x: 0, y: 0 }, velocity: { vx: 0, vy: 0 }, state: 'idle' },
      ]);

      // WHEN: Resetting
      store.reset();

      // THEN: All values should return to initial
      const state = useCanvasStore.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.currentFrame).toBe(0);
      expect(state.totalFrames).toBe(0);
      expect(state.selectedPlayerId).toBeNull();
      expect(state.hoveredPlayerId).toBeNull();
      expect(state.tacticLoaded).toBe(false);
      expect(state.simulationReady).toBe(false);
      expect(state.playerStates).toEqual([]);
    });
  });

  describe('State Independence', () => {
    it('should allow multiple state updates without interference', () => {
      // GIVEN: Fresh store
      const store = useCanvasStore.getState();

      // WHEN: Making multiple independent updates
      store.setSelectedPlayer('player-1');
      store.updatePlaybackState(true, 25, 50);
      store.setTacticLoaded(true);

      // THEN: All values should be set correctly
      const state = useCanvasStore.getState();
      expect(state.selectedPlayerId).toBe('player-1');
      expect(state.isPlaying).toBe(true);
      expect(state.currentFrame).toBe(25);
      expect(state.totalFrames).toBe(50);
      expect(state.tacticLoaded).toBe(true);
    });
  });
});
