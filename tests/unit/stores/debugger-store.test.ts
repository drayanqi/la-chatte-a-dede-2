/**
 * Debugger Store Unit Tests
 *
 * Tests the Zustand store that manages debugger state:
 * - Debug mode and pause state
 * - Breakpoint management (add, remove, toggle)
 * - Watched variables
 * - Call stack tracking
 * - Console output
 *
 * @see Epic 4: AI Debugger
 * @priority P1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDebuggerStore } from '@/stores/debuggerStore';

describe('Debugger Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDebuggerStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      // GIVEN: Fresh store
      const state = useDebuggerStore.getState();

      // THEN: All values should be at defaults
      expect(state.isDebugging).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentFrame).toBe(0);
      expect(state.currentScriptId).toBeNull();
      expect(state.currentLine).toBeNull();
      expect(state.breakpoints).toEqual([]);
      expect(state.watchedVariables).toEqual([]);
      expect(state.callStack).toEqual([]);
      expect(state.consoleOutput).toEqual([]);
    });
  });

  describe('Debug Mode', () => {
    it('should start debugging', () => {
      // GIVEN: Not debugging
      const store = useDebuggerStore.getState();
      expect(store.isDebugging).toBe(false);

      // WHEN: Starting debug
      store.startDebugging();

      // THEN: Should be debugging and not paused
      const state = useDebuggerStore.getState();
      expect(state.isDebugging).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('should stop debugging and clear state', () => {
      // GIVEN: Debugging with state
      const store = useDebuggerStore.getState();
      store.startDebugging();
      store.pauseExecution();
      store.setCurrentLocation('script-1', 10);
      store.updateCallStack([{ functionName: 'update', scriptId: 'script-1', line: 10, column: 0 }]);

      // WHEN: Stopping debug
      store.stopDebugging();

      // THEN: Debug state should be cleared
      const state = useDebuggerStore.getState();
      expect(state.isDebugging).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.callStack).toEqual([]);
      expect(state.currentScriptId).toBeNull();
      expect(state.currentLine).toBeNull();
    });

    it('should pause execution', () => {
      // GIVEN: Debugging
      const store = useDebuggerStore.getState();
      store.startDebugging();

      // WHEN: Pausing
      store.pauseExecution();

      // THEN: Should be paused
      expect(useDebuggerStore.getState().isPaused).toBe(true);
    });

    it('should resume execution', () => {
      // GIVEN: Paused debugging
      const store = useDebuggerStore.getState();
      store.startDebugging();
      store.pauseExecution();

      // WHEN: Resuming
      store.resumeExecution();

      // THEN: Should not be paused
      expect(useDebuggerStore.getState().isPaused).toBe(false);
    });
  });

  describe('Breakpoints', () => {
    it('should add breakpoint', () => {
      // GIVEN: No breakpoints
      const store = useDebuggerStore.getState();

      // WHEN: Adding breakpoint
      store.addBreakpoint('script-1', 10);

      // THEN: Breakpoint should exist
      const state = useDebuggerStore.getState();
      expect(state.breakpoints).toHaveLength(1);
      expect(state.breakpoints[0].scriptId).toBe('script-1');
      expect(state.breakpoints[0].line).toBe(10);
      expect(state.breakpoints[0].enabled).toBe(true);
    });

    it('should generate unique breakpoint id', async () => {
      // GIVEN: No breakpoints
      const store = useDebuggerStore.getState();

      // WHEN: Adding multiple breakpoints with delay to ensure unique timestamps
      store.addBreakpoint('script-1', 10);
      await new Promise((resolve) => setTimeout(resolve, 2)); // Wait 2ms for unique timestamp
      store.addBreakpoint('script-1', 20);

      // THEN: Each should have unique id
      const state = useDebuggerStore.getState();
      expect(state.breakpoints[0].id).not.toBe(state.breakpoints[1].id);
    });

    it('should remove breakpoint by id', () => {
      // GIVEN: Existing breakpoint
      const store = useDebuggerStore.getState();
      store.addBreakpoint('script-1', 10);
      const bpId = useDebuggerStore.getState().breakpoints[0].id;

      // WHEN: Removing by id
      store.removeBreakpoint(bpId);

      // THEN: Breakpoint should be gone
      expect(useDebuggerStore.getState().breakpoints).toHaveLength(0);
    });

    it('should toggle breakpoint - add when not exists', () => {
      // GIVEN: No breakpoints
      const store = useDebuggerStore.getState();

      // WHEN: Toggling non-existent breakpoint
      store.toggleBreakpoint('script-1', 15);

      // THEN: Breakpoint should be added
      const state = useDebuggerStore.getState();
      expect(state.breakpoints).toHaveLength(1);
      expect(state.breakpoints[0].line).toBe(15);
      expect(state.breakpoints[0].enabled).toBe(true);
    });

    it('should toggle breakpoint - disable when exists', () => {
      // GIVEN: Existing enabled breakpoint
      const store = useDebuggerStore.getState();
      store.addBreakpoint('script-1', 15);
      expect(useDebuggerStore.getState().breakpoints[0].enabled).toBe(true);

      // WHEN: Toggling same location
      store.toggleBreakpoint('script-1', 15);

      // THEN: Breakpoint should be disabled
      expect(useDebuggerStore.getState().breakpoints[0].enabled).toBe(false);
    });

    it('should toggle breakpoint - enable when disabled', () => {
      // GIVEN: Disabled breakpoint
      const store = useDebuggerStore.getState();
      store.addBreakpoint('script-1', 15);
      store.toggleBreakpoint('script-1', 15); // Disable

      // WHEN: Toggling again
      store.toggleBreakpoint('script-1', 15);

      // THEN: Breakpoint should be enabled
      expect(useDebuggerStore.getState().breakpoints[0].enabled).toBe(true);
    });

    it('should clear all breakpoints', () => {
      // GIVEN: Multiple breakpoints
      const store = useDebuggerStore.getState();
      store.addBreakpoint('script-1', 10);
      store.addBreakpoint('script-1', 20);
      store.addBreakpoint('script-2', 5);

      // WHEN: Clearing all
      store.clearAllBreakpoints();

      // THEN: No breakpoints
      expect(useDebuggerStore.getState().breakpoints).toEqual([]);
    });
  });

  describe('Watched Variables', () => {
    it('should add watched variable', () => {
      // GIVEN: No watched variables
      const store = useDebuggerStore.getState();

      // WHEN: Adding watch
      store.addWatchedVariable('ball position', 'ball.position');

      // THEN: Variable should be watched
      const state = useDebuggerStore.getState();
      expect(state.watchedVariables).toHaveLength(1);
      expect(state.watchedVariables[0].name).toBe('ball position');
      expect(state.watchedVariables[0].expression).toBe('ball.position');
      expect(state.watchedVariables[0].value).toBeUndefined();
    });

    it('should remove watched variable', () => {
      // GIVEN: Watched variable
      const store = useDebuggerStore.getState();
      store.addWatchedVariable('test', 'test.value');
      const watchId = useDebuggerStore.getState().watchedVariables[0].id;

      // WHEN: Removing
      store.removeWatchedVariable(watchId);

      // THEN: Variable should be gone
      expect(useDebuggerStore.getState().watchedVariables).toHaveLength(0);
    });

    it('should update watched variable values', () => {
      // GIVEN: Multiple watched variables
      const store = useDebuggerStore.getState();
      store.addWatchedVariable('position', 'player.position');
      store.addWatchedVariable('velocity', 'player.velocity');

      // WHEN: Updating values
      store.updateWatchedValues({
        'player.position': { x: 10, y: 20 },
        'player.velocity': { vx: 1, vy: 0 },
      });

      // THEN: Values should be updated
      const state = useDebuggerStore.getState();
      expect(state.watchedVariables[0].value).toEqual({ x: 10, y: 20 });
      expect(state.watchedVariables[1].value).toEqual({ vx: 1, vy: 0 });
    });

    it('should handle partial value updates', () => {
      // GIVEN: Watched variables
      const store = useDebuggerStore.getState();
      store.addWatchedVariable('pos', 'pos');
      store.addWatchedVariable('vel', 'vel');

      // WHEN: Updating only one value
      store.updateWatchedValues({ 'pos': 42 });

      // THEN: Only matching variable updated
      const state = useDebuggerStore.getState();
      expect(state.watchedVariables[0].value).toBe(42);
      expect(state.watchedVariables[1].value).toBeUndefined();
    });
  });

  describe('Call Stack', () => {
    it('should update call stack', () => {
      // GIVEN: Empty call stack
      const store = useDebuggerStore.getState();

      // WHEN: Updating stack
      const stack = [
        { functionName: 'update', scriptId: 'script-1', line: 10, column: 5 },
        { functionName: 'calculateMove', scriptId: 'script-1', line: 25, column: 3 },
      ];
      store.updateCallStack(stack);

      // THEN: Stack should be set
      expect(useDebuggerStore.getState().callStack).toEqual(stack);
    });

    it('should replace call stack completely', () => {
      // GIVEN: Existing stack
      const store = useDebuggerStore.getState();
      store.updateCallStack([{ functionName: 'old', scriptId: 's1', line: 1, column: 0 }]);

      // WHEN: Updating with new stack
      store.updateCallStack([{ functionName: 'new', scriptId: 's2', line: 2, column: 0 }]);

      // THEN: Old stack replaced
      const stack = useDebuggerStore.getState().callStack;
      expect(stack).toHaveLength(1);
      expect(stack[0].functionName).toBe('new');
    });
  });

  describe('Console Output', () => {
    it('should log to console', () => {
      // GIVEN: Empty console
      const store = useDebuggerStore.getState();

      // WHEN: Logging message
      store.logToConsole('log', 'Hello world');

      // THEN: Message should appear
      const output = useDebuggerStore.getState().consoleOutput;
      expect(output).toHaveLength(1);
      expect(output[0].type).toBe('log');
      expect(output[0].message).toBe('Hello world');
      expect(output[0].timestamp).toBeInstanceOf(Date);
    });

    it('should log different message types', () => {
      // GIVEN: Empty console
      const store = useDebuggerStore.getState();

      // WHEN: Logging different types
      store.logToConsole('log', 'Info message');
      store.logToConsole('warn', 'Warning message');
      store.logToConsole('error', 'Error message');

      // THEN: All types should be logged
      const output = useDebuggerStore.getState().consoleOutput;
      expect(output).toHaveLength(3);
      expect(output[0].type).toBe('log');
      expect(output[1].type).toBe('warn');
      expect(output[2].type).toBe('error');
    });

    it('should preserve message order', () => {
      // GIVEN: Console with messages
      const store = useDebuggerStore.getState();
      store.logToConsole('log', 'First');
      store.logToConsole('log', 'Second');
      store.logToConsole('log', 'Third');

      // THEN: Order should be preserved
      const output = useDebuggerStore.getState().consoleOutput;
      expect(output[0].message).toBe('First');
      expect(output[1].message).toBe('Second');
      expect(output[2].message).toBe('Third');
    });

    it('should clear console', () => {
      // GIVEN: Console with messages
      const store = useDebuggerStore.getState();
      store.logToConsole('log', 'Message 1');
      store.logToConsole('log', 'Message 2');

      // WHEN: Clearing
      store.clearConsole();

      // THEN: Console should be empty
      expect(useDebuggerStore.getState().consoleOutput).toEqual([]);
    });
  });

  describe('Navigation', () => {
    it('should set current location', () => {
      // GIVEN: No location
      const store = useDebuggerStore.getState();

      // WHEN: Setting location
      store.setCurrentLocation('script-1', 42);

      // THEN: Location should be set
      const state = useDebuggerStore.getState();
      expect(state.currentScriptId).toBe('script-1');
      expect(state.currentLine).toBe(42);
    });

    it('should step frame forward', () => {
      // GIVEN: At frame 5
      const store = useDebuggerStore.getState();
      store.updateCallStack([]); // Just to have some state
      useDebuggerStore.setState({ currentFrame: 5 });

      // WHEN: Stepping forward
      store.stepFrame('forward');

      // THEN: Should be at frame 6
      expect(useDebuggerStore.getState().currentFrame).toBe(6);
    });

    it('should step frame backward', () => {
      // GIVEN: At frame 5
      const store = useDebuggerStore.getState();
      useDebuggerStore.setState({ currentFrame: 5 });

      // WHEN: Stepping backward
      store.stepFrame('backward');

      // THEN: Should be at frame 4
      expect(useDebuggerStore.getState().currentFrame).toBe(4);
    });

    it('should not step below frame 0', () => {
      // GIVEN: At frame 0
      const store = useDebuggerStore.getState();
      expect(store.currentFrame).toBe(0);

      // WHEN: Stepping backward
      store.stepFrame('backward');

      // THEN: Should stay at 0
      expect(useDebuggerStore.getState().currentFrame).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      // GIVEN: Modified state
      const store = useDebuggerStore.getState();
      store.startDebugging();
      store.pauseExecution();
      store.addBreakpoint('script-1', 10);
      store.addWatchedVariable('test', 'test');
      store.updateCallStack([{ functionName: 'test', scriptId: 's1', line: 1, column: 0 }]);
      store.logToConsole('log', 'test message');
      store.setCurrentLocation('script-1', 10);
      useDebuggerStore.setState({ currentFrame: 50 });

      // WHEN: Resetting
      store.reset();

      // THEN: All should be initial
      const state = useDebuggerStore.getState();
      expect(state.isDebugging).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.currentFrame).toBe(0);
      expect(state.currentScriptId).toBeNull();
      expect(state.currentLine).toBeNull();
      expect(state.breakpoints).toEqual([]);
      expect(state.watchedVariables).toEqual([]);
      expect(state.callStack).toEqual([]);
      expect(state.consoleOutput).toEqual([]);
    });
  });
});
