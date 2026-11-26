// The Pomodoro worker owns the timer. Its state lives in orca.storage as wall-clock facts
// (endsAt / pausedRemainingMs), so a worker reload or an Orca restart picks up exactly where it
// was and still counts and notifies a pomodoro that ended while Orca was closed, once.
//
// With a status bar item and `main`, Orca keeps this worker running while the plugin is enabled.
import type { OrcaWorkerApi } from 'orca/worker'
import { PANEL_ID, STATE_EVENT, STORE_KEY } from './protocol.ts'
import { openPanelWithCli } from './open-panel.ts'
import {
  clampMinutes,
  countOn,
  DEFAULT_MINUTES,
  FINISHED_LINGER_MS,
  localDateKey,
  nextLocalMidnight,
  normalizeStore,
  notificationBody,
  pause,
  reconcile,
  reset,
  resetDay,
  setMinutes,
  snapshot,
  start,
  statusBarView,
  toggle,
  type PomodoroStore,
  type Snapshot,
  type StatusBarView
} from './timer.ts'

export const STATUS_ITEM_ID = 'pomodoro'

/** Swappable clock and panel opener, so tests can drive time without sleeping. */
export const env = {
  now: (): number => Date.now(),
  openPanel: (orca: OrcaWorkerApi): Promise<void> => openPanelWithCli(orca, PANEL_ID)
}

type Mutation = (store: PomodoroStore, now: number) => PomodoroStore

let stopCurrent: (() => void) | null = null

export default function activate(orca: OrcaWorkerApi): void {
  let disposed = false
  let cache: PomodoroStore | null = null
  let lastWritten = ''
  let lastBar = ''
  let ticker: ReturnType<typeof setInterval> | null = null
  let endTimer: ReturnType<typeof setTimeout> | null = null
  let midnightTimer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<unknown> = Promise.resolve()

  /** One operation at a time, so a tick and a click never both count the same pomodoro. */
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = queue.then(fn, fn)
    queue = next.catch(() => undefined)
    return next
  }

  async function focusMinutes(): Promise<number> {
    try {
      return clampMinutes(await orca.settings.get('focusMinutes'), DEFAULT_MINUTES)
    } catch {
      return DEFAULT_MINUTES
    }
  }

  async function load(): Promise<PomodoroStore> {
    const raw = await orca.storage.get(STORE_KEY)
    return normalizeStore(raw, await focusMinutes())
  }

  async function save(store: PomodoroStore): Promise<void> {
    const json = JSON.stringify(store)
    if (json === lastWritten) return
    lastWritten = json
    await orca.storage.set(STORE_KEY, store as never)
  }

  /** Reads, catches up with the clock, applies `mutate`, writes, then tells everyone. */
  function apply(mutate?: Mutation): Promise<Snapshot> {
    return serial(async () => {
      const now = env.now()
      const loaded = await load()
      const caught = reconcile(loaded, now)
      let store = caught.store
      if (mutate) store = mutate(store, now)
      if (caught.changed || store !== loaded) await save(store)
      cache = store
      if (caught.completed) await notifyDone(store, loaded.timer.endsAt ?? now)
      const snap = snapshot(store, now)
      publish(snap)
      schedule(store, now)
      return snap
    })
  }

  async function notifyDone(after: PomodoroStore, endedAt: number): Promise<void> {
    const endedOn = localDateKey(endedAt)
    const count = countOn(after, endedOn)
    orca.log(`pomodoro finished (${endedOn}: ${count})`)
    try {
      await orca.host.call('notifications.show', {
        title: 'Pomodoro concluído 🍅',
        body: notificationBody(count)
      })
    } catch (error) {
      orca.log(`notification failed: ${(error as Error).message}`)
    }
  }

  function publish(snap: Snapshot): void {
    updateStatusBar(statusBarView(snap))
    try {
      orca.panels.post(STATE_EVENT, snap)
    } catch (error) {
      orca.log(`post failed: ${(error as Error).message}`)
    }
  }

  function updateStatusBar(view: StatusBarView): void {
    const key = JSON.stringify(view)
    if (key === lastBar) return
    lastBar = key
    orca.host
      .call('statusBar.update', { id: STATUS_ITEM_ID, ...view, visible: true })
      .catch((error: Error) => {
        lastBar = ''
        orca.log(`statusBar.update failed: ${error.message}`)
      })
  }

  function clearTimers(): void {
    if (ticker) clearInterval(ticker)
    if (endTimer) clearTimeout(endTimer)
    if (midnightTimer) clearTimeout(midnightTimer)
    ticker = endTimer = midnightTimer = null
  }

  /** Ticks once a second only while running; otherwise wakes only for the next real change. */
  function schedule(store: PomodoroStore, now: number): void {
    if (disposed) return
    clearTimers()
    const { timer } = store
    if (timer.status === 'running' && timer.endsAt !== null) {
      ticker = setInterval(tick, 1000)
      endTimer = setTimeout(() => void apply(), Math.max(0, timer.endsAt - now) + 20)
    } else if (timer.status === 'finished' && timer.finishedAt !== null) {
      endTimer = setTimeout(
        () => void apply(),
        Math.max(0, timer.finishedAt + FINISHED_LINGER_MS - now) + 20
      )
    }
    // The day's count changes at local midnight even when nothing runs.
    midnightTimer = setTimeout(() => void apply(), nextLocalMidnight(now) - now + 1000)
  }

  function tick(): void {
    if (!cache) return
    const now = env.now()
    if (cache.timer.status === 'running' && (cache.timer.endsAt ?? 0) <= now) {
      void apply()
      return
    }
    updateStatusBar(statusBarView(snapshot(cache, now)))
  }

  const run = (mutate?: Mutation) => () => apply(mutate)

  // Panel requests.
  orca.panels.handle('pomodoro.get', run())
  orca.panels.handle('pomodoro.start', ({ minutes }) =>
    apply((s, now) => start(s, now, minutes === undefined ? undefined : clampMinutes(minutes)))
  )
  orca.panels.handle('pomodoro.pause', run(pause))
  orca.panels.handle('pomodoro.toggle', run(toggle))
  orca.panels.handle('pomodoro.reset', run((s) => reset(s)))
  orca.panels.handle('pomodoro.setMinutes', ({ minutes }) =>
    apply((s) => setMinutes(s, clampMinutes(minutes)))
  )
  orca.panels.handle('pomodoro.resetDay', run(resetDay))

  // Palette commands (and the status bar item / keybinding).
  orca.commands.register('pomodoro.toggle', async () => {
    const snap = await apply(toggle)
    return snap.status === 'running' ? 'Pomodoro em foco 🍅' : 'Pomodoro pausado'
  })
  orca.commands.register('pomodoro.reset', async () => {
    await apply((s) => reset(s))
    return 'Timer resetado'
  })
  orca.commands.register('pomodoro.resetDay', async () => {
    await apply(resetDay)
    return 'Contagem de hoje zerada'
  })
  orca.commands.register('pomodoro.focus25', async () => {
    await apply((s, now) => start(s, now, 25))
    return 'Foco de 25 min iniciado 🍅'
  })
  orca.commands.register('pomodoro.focus50', async () => {
    await apply((s, now) => start(s, now, 50))
    return 'Foco de 50 min iniciado 🍅'
  })
  orca.commands.register('pomodoro.open', async () => {
    try {
      await env.openPanel(orca)
    } catch (error) {
      orca.log(`open panel failed: ${(error as Error).message}`)
      return `Não consegui abrir o painel: ${(error as Error).message}`
    }
    return undefined
  })

  // The person changed the default length in Settings: apply it if nothing is counting.
  const settingsSub = orca.settings.onDidChange(({ key }) => {
    if (key !== 'focusMinutes') return
    void focusMinutes().then((m) => apply((s) => setMinutes(s, m)))
  })
  // Someone else wrote the store (another worker generation): redraw from it.
  const storageSub = orca.storage.onDidChange(({ key }) => {
    if (key !== STORE_KEY) return
    void orca.storage.get(STORE_KEY).then((raw) => {
      if (JSON.stringify(raw) === lastWritten) return
      lastWritten = ''
      void apply()
    })
  })

  // Catch up now: a pomodoro that ended while Orca was closed is counted and notified here.
  void apply()

  stopCurrent = () => {
    disposed = true
    clearTimers()
    settingsSub.dispose()
    storageSub.dispose()
  }
}

export async function deactivate(): Promise<void> {
  stopCurrent?.()
  stopCurrent = null
}
