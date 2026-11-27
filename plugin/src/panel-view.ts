// What the panel draws for a snapshot, and the small controller between the DOM and the worker.
// Pure and DOM-free so `orca plugin test` can run it in Node.
import {
  clampMinutes,
  formatClock,
  localDateKey,
  LONG_BREAK_MINUTES,
  MINUTE,
  normalizeStore,
  reconcile,
  SHORT_BREAK_MINUTES,
  snapshot,
  type Snapshot,
  type TimerStatus
} from './timer.ts'

export type Face = 'focused' | 'sleeping' | 'happy'

/** The lengths the person can pick for a break. */
export const BREAK_CHOICES = [SHORT_BREAK_MINUTES, LONG_BREAK_MINUTES] as const

export type PanelView = {
  status: TimerStatus
  /** A pomodoro or a break: the card turns green while resting. */
  kind: 'focus' | 'break'
  face: Face
  clock: string
  /** Time left as a fraction of the pomodoro, 0..1: the ring's length. */
  ring: number
  primaryLabel: 'Start' | 'Pause' | 'Resume' | 'Take break'
  primaryAction: 'start' | 'pause' | 'resume' | 'break'
  /** The short status beside the dot: Focus / Break / Paused / Break paused / Done / Break over / Ready. */
  statusLabel: string
  /** True right after a pomodoro: the card proposes a break (Take break, 5 or 15 min, Skip). */
  offerBreak: boolean
  /** The break length picked in the card (the suggestion until the person picks another). */
  breakMinutes: number
  /** True when the clock shows hours (h:mm:ss), which the card draws smaller. */
  hours: boolean
  minutes: number
  canEditMinutes: boolean
  canReset: boolean
  todayCount: number
  todayLabel: string
  /** False at zero: today's count cannot go negative. */
  canDecrement: boolean
}

/** Builds the view for `now` on the panel's own clock, so the countdown moves between posts. */
export function panelView(snap: Snapshot, now: number, pickedBreak?: number): PanelView {
  const resting = snap.kind === 'break'
  const offerBreak = snap.status === 'finished' && !resting
  const running = snap.status === 'running'
  const left = running && snap.endsAt !== null ? Math.max(0, snap.endsAt - now) : snap.remainingMs
  const duration = Math.max(1, snap.durationMs)
  // The worker's snapshot may predate midnight: a new day starts at zero.
  const todayCount = localDateKey(now) === snap.today ? snap.todayCount : 0
  const face: Face =
    running && !resting ? 'focused' : snap.status === 'finished' ? 'happy' : 'sleeping'
  const labels: Record<TimerStatus, string> = resting
    ? { running: 'Break', paused: 'Break paused', finished: 'Break over', idle: 'Ready' }
    : { running: 'Focus', paused: 'Paused', finished: 'Done', idle: 'Ready' }
  const clock = formatClock(snap.status === 'finished' ? 0 : left)
  return {
    status: snap.status,
    kind: snap.kind,
    face,
    clock,
    hours: clock.length > 5,
    ring: snap.status === 'finished' ? 1 : Math.min(1, Math.max(0, left / duration)),
    primaryLabel: running
      ? 'Pause'
      : snap.status === 'paused'
        ? 'Resume'
        : offerBreak
          ? 'Take break'
          : 'Start',
    primaryAction: running
      ? 'pause'
      : snap.status === 'paused'
        ? 'resume'
        : offerBreak
          ? 'break'
          : 'start',
    statusLabel: labels[snap.status],
    offerBreak,
    breakMinutes: pickedBreak ?? snap.suggestedBreakMinutes,
    // The input is always the pomodoro length, also while a break runs.
    minutes: Math.round(snap.focusMs / MINUTE),
    canEditMinutes: snap.status === 'idle' || snap.status === 'finished',
    canReset: snap.status !== 'idle',
    todayCount,
    todayLabel: `Today: ${todayCount} 🍅`,
    canDecrement: todayCount > 0
  }
}

/** A snapshot from what storage holds, for when the worker cannot answer. Display only. */
export function snapshotFromStorage(raw: unknown, now: number): Snapshot {
  return snapshot(reconcile(normalizeStore(raw), now).store, now)
}

type Requests = {
  'pomodoro.get': undefined
  'pomodoro.start': { minutes?: number }
  'pomodoro.startBreak': { minutes: number }
  'pomodoro.pause': undefined
  'pomodoro.reset': undefined
  'pomodoro.setMinutes': { minutes: number }
  'pomodoro.resetDay': undefined
  'pomodoro.adjustCount': { delta: -1 | 1 }
}

/** What the controller needs from Orca; the real panel passes `orca.plugin` / `orca.storage`. */
export type PanelBridge = {
  request<K extends keyof Requests>(name: K, input?: Requests[K]): Promise<Snapshot>
  readStore(): Promise<unknown>
  now(): number
}

export type PanelController = {
  readonly snapshot: Snapshot | null
  /** Loads the first snapshot (asking the worker, else reading storage). */
  refresh(): Promise<void>
  /** A snapshot the worker posted. */
  receive(snap: Snapshot): void
  /** Start / Pause / Resume / Take break; `minutes` is what the input holds. */
  primary(minutes: number): Promise<void>
  /** Picks the break length (5 or 15) offered after a pomodoro. */
  chooseBreak(minutes: number): void
  /** Skip: skips the offered break and starts the next pomodoro. */
  skipBreak(minutes: number): Promise<void>
  reset(): Promise<void>
  setMinutes(minutes: number): Promise<void>
  resetDay(): Promise<void>
  /** The − / + buttons: corrects today's count by `delta` (-1 or 1). */
  adjustCount(delta: number): Promise<void>
  view(): PanelView | null
}

export function createPanelController(
  bridge: PanelBridge,
  onChange: (view: PanelView) => void,
  onError: (message: string) => void = () => {}
): PanelController {
  let current: Snapshot | null = null
  /** The person's break pick; forgotten when a new pomodoro finishes so the suggestion returns. */
  let pickedBreak: number | undefined

  function show(snap: Snapshot): void {
    // Ignore an older snapshot arriving after a newer one.
    if (current && snap.at < current.at) return
    if (snap.finishedAt !== current?.finishedAt || snap.status !== 'finished') pickedBreak = undefined
    current = snap
    onChange(panelView(snap, bridge.now(), pickedBreak))
  }

  async function ask<K extends keyof Requests>(name: K, input?: Requests[K]): Promise<void> {
    try {
      show(await bridge.request(name, input))
    } catch (error) {
      onError((error as Error).message || String(error))
    }
  }

  return {
    get snapshot() {
      return current
    },
    async refresh() {
      try {
        show(await bridge.request('pomodoro.get'))
      } catch (error) {
        try {
          show(snapshotFromStorage(await bridge.readStore(), bridge.now()))
        } catch {
          onError((error as Error).message || String(error))
        }
      }
    },
    receive: show,
    async primary(minutes) {
      const status = current?.status ?? 'idle'
      if (status === 'running') return ask('pomodoro.pause')
      if (status === 'paused') return ask('pomodoro.start', {})
      if (current && panelView(current, bridge.now()).offerBreak) {
        return ask('pomodoro.startBreak', {
          minutes: pickedBreak ?? current.suggestedBreakMinutes
        })
      }
      return ask('pomodoro.start', { minutes: clampMinutes(minutes) })
    },
    chooseBreak(minutes) {
      pickedBreak = minutes
      if (current) onChange(panelView(current, bridge.now(), pickedBreak))
    },
    skipBreak: (minutes) => ask('pomodoro.start', { minutes: clampMinutes(minutes) }),
    reset: () => ask('pomodoro.reset'),
    setMinutes: (minutes) => ask('pomodoro.setMinutes', { minutes: clampMinutes(minutes) }),
    resetDay: () => ask('pomodoro.resetDay'),
    adjustCount: (delta) => ask('pomodoro.adjustCount', { delta: delta < 0 ? -1 : 1 }),
    view: () => (current ? panelView(current, bridge.now(), pickedBreak) : null)
  }
}
