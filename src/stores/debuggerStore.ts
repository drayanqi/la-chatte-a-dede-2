/**
 * Debugger Store - État du debugger
 * PROPRIÉTAIRE: Winston (Software Architect)
 */

import { create } from 'zustand';
import type { Breakpoint, WatchedVariable, CallStackFrame } from '@/types';

interface DebuggerState {
  // Mode debug
  isDebugging: boolean;
  isPaused: boolean;

  // Navigation
  currentFrame: number;
  currentScriptId: string | null;
  currentLine: number | null;

  // Breakpoints
  breakpoints: Breakpoint[];

  // Variables surveillées
  watchedVariables: WatchedVariable[];

  // Call stack
  callStack: CallStackFrame[];

  // Console output
  consoleOutput: Array<{
    type: 'log' | 'warn' | 'error';
    message: string;
    timestamp: Date;
  }>;
}

interface DebuggerActions {
  // Mode debug
  startDebugging: () => void;
  stopDebugging: () => void;
  pauseExecution: () => void;
  resumeExecution: () => void;

  // Breakpoints
  addBreakpoint: (scriptId: string, line: number) => void;
  removeBreakpoint: (id: string) => void;
  toggleBreakpoint: (scriptId: string, line: number) => void;
  clearAllBreakpoints: () => void;

  // Variables
  addWatchedVariable: (name: string, expression: string) => void;
  removeWatchedVariable: (id: string) => void;
  updateWatchedValues: (values: Record<string, unknown>) => void;

  // Call stack
  updateCallStack: (stack: CallStackFrame[]) => void;

  // Console
  logToConsole: (type: 'log' | 'warn' | 'error', message: string) => void;
  clearConsole: () => void;

  // Navigation
  setCurrentLocation: (scriptId: string, line: number) => void;
  stepFrame: (direction: 'forward' | 'backward') => void;

  // Reset
  reset: () => void;
}

const initialState: DebuggerState = {
  isDebugging: false,
  isPaused: false,
  currentFrame: 0,
  currentScriptId: null,
  currentLine: null,
  breakpoints: [],
  watchedVariables: [],
  callStack: [],
  consoleOutput: [],
};

export const useDebuggerStore = create<DebuggerState & DebuggerActions>(
  (set, get) => ({
    ...initialState,

    startDebugging: () => set({ isDebugging: true, isPaused: false }),

    stopDebugging: () =>
      set({
        isDebugging: false,
        isPaused: false,
        callStack: [],
        currentScriptId: null,
        currentLine: null,
      }),

    pauseExecution: () => set({ isPaused: true }),

    resumeExecution: () => set({ isPaused: false }),

    addBreakpoint: (scriptId, line) =>
      set((state) => ({
        breakpoints: [
          ...state.breakpoints,
          {
            id: `bp-${Date.now()}`,
            scriptId,
            line,
            enabled: true,
          },
        ],
      })),

    removeBreakpoint: (id) =>
      set((state) => ({
        breakpoints: state.breakpoints.filter((bp) => bp.id !== id),
      })),

    toggleBreakpoint: (scriptId, line) =>
      set((state) => {
        const existing = state.breakpoints.find(
          (bp) => bp.scriptId === scriptId && bp.line === line
        );

        if (existing) {
          return {
            breakpoints: state.breakpoints.map((bp) =>
              bp.id === existing.id ? { ...bp, enabled: !bp.enabled } : bp
            ),
          };
        }

        return {
          breakpoints: [
            ...state.breakpoints,
            {
              id: `bp-${Date.now()}`,
              scriptId,
              line,
              enabled: true,
            },
          ],
        };
      }),

    clearAllBreakpoints: () => set({ breakpoints: [] }),

    addWatchedVariable: (name, expression) =>
      set((state) => ({
        watchedVariables: [
          ...state.watchedVariables,
          {
            id: `watch-${Date.now()}`,
            name,
            expression,
            value: undefined,
          },
        ],
      })),

    removeWatchedVariable: (id) =>
      set((state) => ({
        watchedVariables: state.watchedVariables.filter((v) => v.id !== id),
      })),

    updateWatchedValues: (values) =>
      set((state) => ({
        watchedVariables: state.watchedVariables.map((v) => ({
          ...v,
          value: values[v.expression],
        })),
      })),

    updateCallStack: (stack) => set({ callStack: stack }),

    logToConsole: (type, message) =>
      set((state) => ({
        consoleOutput: [
          ...state.consoleOutput,
          { type, message, timestamp: new Date() },
        ],
      })),

    clearConsole: () => set({ consoleOutput: [] }),

    setCurrentLocation: (scriptId, line) =>
      set({ currentScriptId: scriptId, currentLine: line }),

    stepFrame: (direction) =>
      set((state) => ({
        currentFrame:
          direction === 'forward'
            ? state.currentFrame + 1
            : Math.max(0, state.currentFrame - 1),
      })),

    reset: () => set(initialState),
  })
);
