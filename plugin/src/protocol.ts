// The panel <-> worker contract, declared once: src/panel-main.ts and src/worker.ts both read it.
import type { Snapshot } from './timer'

export type { Snapshot }

/** Storage key holding the whole PomodoroStore (timer + daily counts). */
export const STORE_KEY = 'pomodoro'
/** The panel's contribution id. */
export const PANEL_ID = 'pomodoro'
/** Panel event the worker posts after every change (and at midnight). */
export const STATE_EVENT = 'pomodoro.state'

declare module 'orca' {
  interface PluginRequests {
    'pomodoro.get': { output: Snapshot }
    /** Starts a fresh pomodoro (of `minutes`, when given) or resumes a paused one. */
    'pomodoro.start': { input: { minutes?: number }; output: Snapshot }
    'pomodoro.pause': { output: Snapshot }
    'pomodoro.toggle': { output: Snapshot }
    'pomodoro.reset': { output: Snapshot }
    /** Changes the length while idle or finished. */
    'pomodoro.setMinutes': { input: { minutes: number }; output: Snapshot }
    'pomodoro.resetDay': { output: Snapshot }
  }
  interface PluginPanelEvents {
    'pomodoro.state': Snapshot
  }
}
