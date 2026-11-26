// Pure Pomodoro timer logic shared by the worker and the panel. No I/O, no clocks: every
// function takes `now` (ms since epoch) so tests can drive time and a restart can reconcile.
//
// The timer is stored as wall-clock facts (`endsAt`, `pausedRemainingMs`), never as a tick
// counter, so a worker reload or an Orca restart computes the right remaining time.

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export type Timer = {
  status: TimerStatus
  /** Length of the current (or next) pomodoro. */
  durationMs: number
  /** While running: when it ends. */
  endsAt: number | null
  /** While paused: what was left when it paused. */
  pausedRemainingMs: number | null
  /** While finished: when it finished (its `endsAt`). */
  finishedAt: number | null
}

/** Everything the worker keeps under one storage key, so each change is one atomic write. */
export type PomodoroStore = {
  version: 1
  timer: Timer
  /** Pomodoros done, by local date `YYYY-MM-DD`. */
  counts: Record<string, number>
}

/** What the panel and the status bar draw. */
export type Snapshot = {
  status: TimerStatus
  durationMs: number
  remainingMs: number
  endsAt: number | null
  finishedAt: number | null
  today: string
  todayCount: number
  /** The worker's clock when it made this snapshot. */
  at: number
}

export const MINUTE = 60_000
export const DEFAULT_MINUTES = 25
export const MIN_MINUTES = 1
export const MAX_MINUTES = 180
/** How long the "just finished" celebration lasts before the pet goes back to sleep. */
export const FINISHED_LINGER_MS = 10 * MINUTE
/** Days of counts kept; older dates are dropped on write. */
export const KEEP_DAYS = 60

export function clampMinutes(value: unknown, fallback = DEFAULT_MINUTES): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)))
}

/** Local calendar date of `ms` as `YYYY-MM-DD`; rolls over at local midnight. */
export function localDateKey(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Next local midnight after `ms`. */
export function nextLocalMidnight(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime()
}

export function idleTimer(durationMs: number): Timer {
  return { status: 'idle', durationMs, endsAt: null, pausedRemainingMs: null, finishedAt: null }
}

export function emptyStore(minutes = DEFAULT_MINUTES): PomodoroStore {
  return { version: 1, timer: idleTimer(clampMinutes(minutes) * MINUTE), counts: {} }
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Accepts whatever storage held (null, an old or hand-edited value) and returns a sane store. */
export function normalizeStore(raw: unknown, minutes = DEFAULT_MINUTES): PomodoroStore {
  const fresh = emptyStore(minutes)
  if (!raw || typeof raw !== 'object') return fresh
  const r = raw as Record<string, unknown>
  const counts: Record<string, number> = {}
  if (r.counts && typeof r.counts === 'object') {
    for (const [k, v] of Object.entries(r.counts as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isNum(v) && v > 0) counts[k] = Math.floor(v)
    }
  }
  const t = (r.timer && typeof r.timer === 'object' ? r.timer : {}) as Record<string, unknown>
  const durationMs = isNum(t.durationMs) && t.durationMs >= MINUTE ? t.durationMs : fresh.timer.durationMs
  let timer: Timer = idleTimer(durationMs)
  if (t.status === 'running' && isNum(t.endsAt)) {
    timer = { ...timer, status: 'running', endsAt: t.endsAt }
  } else if (t.status === 'paused' && isNum(t.pausedRemainingMs) && t.pausedRemainingMs > 0) {
    timer = { ...timer, status: 'paused', pausedRemainingMs: t.pausedRemainingMs }
  } else if (t.status === 'finished' && isNum(t.finishedAt)) {
    timer = { ...timer, status: 'finished', finishedAt: t.finishedAt }
  }
  return { version: 1, timer, counts }
}

export function remainingMs(timer: Timer, now: number): number {
  switch (timer.status) {
    case 'running':
      return Math.max(0, (timer.endsAt ?? now) - now)
    case 'paused':
      return Math.max(0, timer.pausedRemainingMs ?? 0)
    case 'finished':
      return 0
    default:
      return timer.durationMs
  }
}

export function countOn(store: PomodoroStore, date: string): number {
  return store.counts[date] ?? 0
}

function pruneCounts(counts: Record<string, number>, now: number): Record<string, number> {
  const oldest = localDateKey(now - KEEP_DAYS * 24 * 60 * MINUTE)
  const kept: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) if (k >= oldest) kept[k] = v
  return kept
}

export type Reconciled = {
  store: PomodoroStore
  /** True when a running pomodoro reached its end in this call: count it and notify once. */
  completed: boolean
  /** True when anything changed and the store must be written back. */
  changed: boolean
}

/**
 * Brings the store up to `now`: a running timer whose `endsAt` passed becomes `finished` and is
 * counted once, on the local date it ended (even if Orca was closed then); a finished timer older
 * than the linger window goes back to idle.
 */
export function reconcile(store: PomodoroStore, now: number): Reconciled {
  const { timer } = store
  if (timer.status === 'running' && timer.endsAt !== null && timer.endsAt <= now) {
    const day = localDateKey(timer.endsAt)
    const counts = pruneCounts({ ...store.counts, [day]: countOn(store, day) + 1 }, now)
    const finishedAt = timer.endsAt
    const next: Timer =
      now - finishedAt > FINISHED_LINGER_MS
        ? idleTimer(timer.durationMs)
        : { ...idleTimer(timer.durationMs), status: 'finished', finishedAt }
    return { store: { ...store, timer: next, counts }, completed: true, changed: true }
  }
  if (timer.status === 'finished' && (timer.finishedAt ?? 0) + FINISHED_LINGER_MS <= now) {
    return { store: { ...store, timer: idleTimer(timer.durationMs) }, completed: false, changed: true }
  }
  return { store, completed: false, changed: false }
}

/** Starts a fresh pomodoro (optionally of a new length) or resumes a paused one. */
export function start(store: PomodoroStore, now: number, minutes?: number): PomodoroStore {
  const { timer } = store
  if (timer.status === 'running' && minutes === undefined) return store
  if (timer.status === 'paused' && minutes === undefined) {
    const left = timer.pausedRemainingMs ?? timer.durationMs
    return {
      ...store,
      timer: { ...idleTimer(timer.durationMs), status: 'running', endsAt: now + left }
    }
  }
  const durationMs = minutes === undefined ? timer.durationMs : clampMinutes(minutes) * MINUTE
  return {
    ...store,
    timer: { ...idleTimer(durationMs), status: 'running', endsAt: now + durationMs }
  }
}

export function pause(store: PomodoroStore, now: number): PomodoroStore {
  const { timer } = store
  if (timer.status !== 'running') return store
  const left = remainingMs(timer, now)
  if (left <= 0) return store
  return { ...store, timer: { ...idleTimer(timer.durationMs), status: 'paused', pausedRemainingMs: left } }
}

/** Iniciar/Pausar: running pauses, anything else starts (or resumes). */
export function toggle(store: PomodoroStore, now: number): PomodoroStore {
  return store.timer.status === 'running' ? pause(store, now) : start(store, now)
}

/** Back to idle with the full length (optionally a new one); the day's count is untouched. */
export function reset(store: PomodoroStore, minutes?: number): PomodoroStore {
  const durationMs = minutes === undefined ? store.timer.durationMs : clampMinutes(minutes) * MINUTE
  return { ...store, timer: idleTimer(durationMs) }
}

/** Changes the length while nothing is counting down; ignored while running or paused. */
export function setMinutes(store: PomodoroStore, minutes: number): PomodoroStore {
  const { status } = store.timer
  if (status === 'running' || status === 'paused') return store
  return reset(store, minutes)
}

/** Zerar dia: today's count back to zero. */
export function resetDay(store: PomodoroStore, now: number): PomodoroStore {
  const counts = { ...store.counts }
  delete counts[localDateKey(now)]
  return { ...store, counts }
}

export function snapshot(store: PomodoroStore, now: number): Snapshot {
  const today = localDateKey(now)
  return {
    status: store.timer.status,
    durationMs: store.timer.durationMs,
    remainingMs: remainingMs(store.timer, now),
    endsAt: store.timer.endsAt,
    finishedAt: store.timer.finishedAt,
    today,
    todayCount: countOn(store, today),
    at: now
  }
}

/** `18:42`; hours appear only past 59:59 (`1:05:00`). Rounds up so 0.4 s left still reads 00:01. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`
}

export type StatusBarView = {
  text: string
  tone: 'neutral' | 'accent' | 'success'
  tooltip: string
}

export function statusBarView(snap: Snapshot): StatusBarView {
  const n = snap.todayCount
  const done = `${n} ${n === 1 ? 'pomodoro concluído' : 'pomodoros concluídos'} hoje`
  const hint = 'Clique para abrir o Pomodoro.'
  switch (snap.status) {
    case 'running':
      return {
        text: `🍅 ${formatClock(snap.remainingMs)} · ${n}`,
        tone: 'accent',
        tooltip: `Pomodoro em foco: faltam ${formatClock(snap.remainingMs)}. ${done}. ${hint}`
      }
    case 'paused':
      return {
        text: `🍅 ⏸ ${formatClock(snap.remainingMs)} · ${n}`,
        tone: 'neutral',
        tooltip: `Pomodoro pausado com ${formatClock(snap.remainingMs)} restantes. ${done}. ${hint}`
      }
    case 'finished':
      return {
        text: `🍅 Pronto! · ${n}`,
        tone: 'success',
        tooltip: `Pomodoro concluído! ${done}. ${hint}`
      }
    default:
      return {
        text: `🍅 ${formatClock(snap.durationMs)} · ${n}`,
        tone: 'neutral',
        tooltip: `Pomodoro parado (${Math.round(snap.durationMs / MINUTE)} min). ${done}. ${hint}`
      }
  }
}

export function notificationBody(count: number): string {
  return count === 1
    ? 'Hora de uma pausa. Hoje: 1 pomodoro 🍅'
    : `Hora de uma pausa. Hoje: ${count} pomodoros 🍅`
}
