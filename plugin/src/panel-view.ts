// What the panel draws for a snapshot, and the small controller between the DOM and the worker.
// Pure and DOM-free so `orca plugin test` can run it in Node.
import {
  clampMinutes,
  formatClock,
  localDateKey,
  MINUTE,
  normalizeStore,
  reconcile,
  snapshot,
  type Snapshot,
  type TimerStatus
} from './timer.ts'

export type Face = 'focused' | 'sleeping' | 'happy'

export type PanelView = {
  status: TimerStatus
  face: Face
  clock: string
  /** Time left as a fraction of the pomodoro, 0..1: the ring's length. */
  ring: number
  primaryLabel: 'Iniciar' | 'Pausar' | 'Continuar'
  primaryAction: 'start' | 'pause' | 'resume'
  caption: string
  minutes: number
  canEditMinutes: boolean
  canReset: boolean
  todayCount: number
  todayLabel: string
}

/** Builds the view for `now` on the panel's own clock, so the countdown moves between posts. */
export function panelView(snap: Snapshot, now: number): PanelView {
  const running = snap.status === 'running'
  const left = running && snap.endsAt !== null ? Math.max(0, snap.endsAt - now) : snap.remainingMs
  const duration = Math.max(1, snap.durationMs)
  // The worker's snapshot may predate midnight: a new day starts at zero.
  const todayCount = localDateKey(now) === snap.today ? snap.todayCount : 0
  const face: Face = running ? 'focused' : snap.status === 'finished' ? 'happy' : 'sleeping'
  const captions: Record<TimerStatus, string> = {
    running: 'Focando… você consegue!',
    paused: 'Pausado. Tirando um cochilo…',
    finished: 'Pomodoro concluído! Hora de uma pausa.',
    idle: 'Zzz… pronto para focar?'
  }
  return {
    status: snap.status,
    face,
    clock: formatClock(snap.status === 'finished' ? 0 : left),
    ring: snap.status === 'finished' ? 1 : Math.min(1, Math.max(0, left / duration)),
    primaryLabel: running ? 'Pausar' : snap.status === 'paused' ? 'Continuar' : 'Iniciar',
    primaryAction: running ? 'pause' : snap.status === 'paused' ? 'resume' : 'start',
    caption: captions[snap.status],
    minutes: Math.round(snap.durationMs / MINUTE),
    canEditMinutes: snap.status === 'idle' || snap.status === 'finished',
    canReset: snap.status !== 'idle',
    todayCount,
    todayLabel: `Hoje: ${todayCount} 🍅`
  }
}

/** A snapshot from what storage holds, for when the worker cannot answer. Display only. */
export function snapshotFromStorage(raw: unknown, now: number): Snapshot {
  return snapshot(reconcile(normalizeStore(raw), now).store, now)
}

type Requests = {
  'pomodoro.get': undefined
  'pomodoro.start': { minutes?: number }
  'pomodoro.pause': undefined
  'pomodoro.reset': undefined
  'pomodoro.setMinutes': { minutes: number }
  'pomodoro.resetDay': undefined
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
  /** Iniciar / Pausar / Continuar; `minutes` is what the input holds. */
  primary(minutes: number): Promise<void>
  reset(): Promise<void>
  setMinutes(minutes: number): Promise<void>
  resetDay(): Promise<void>
  view(): PanelView | null
}

export function createPanelController(
  bridge: PanelBridge,
  onChange: (view: PanelView) => void,
  onError: (message: string) => void = () => {}
): PanelController {
  let current: Snapshot | null = null

  function show(snap: Snapshot): void {
    // Ignore an older snapshot arriving after a newer one.
    if (current && snap.at < current.at) return
    current = snap
    onChange(panelView(snap, bridge.now()))
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
      return ask('pomodoro.start', { minutes: clampMinutes(minutes) })
    },
    reset: () => ask('pomodoro.reset'),
    setMinutes: (minutes) => ask('pomodoro.setMinutes', { minutes: clampMinutes(minutes) }),
    resetDay: () => ask('pomodoro.resetDay'),
    view: () => (current ? panelView(current, bridge.now()) : null)
  }
}
