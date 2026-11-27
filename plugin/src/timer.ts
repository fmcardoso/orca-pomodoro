// Pure Pomodoro timer logic shared by the worker and the panel. No I/O, no clocks: every
// function takes `now` (ms since epoch) so tests can drive time and a restart can reconcile.
//
// The timer is stored as wall-clock facts (`endsAt`, `pausedRemainingMs`), never as a tick
// counter, so a worker reload or an Orca restart computes the right remaining time.

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

/** A pomodoro (`focus`) or the rest after it (`break`). */
export type TimerKind = 'focus' | 'break'

export type Timer = {
  status: TimerStatus
  kind: TimerKind
  /** Length of the current (or next) session: a pomodoro, or the break while `kind` is `break`. */
  durationMs: number
  /** The pomodoro length to come back to once a break is over (equals `durationMs` for focus). */
  focusMs: number
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
  kind: TimerKind
  durationMs: number
  focusMs: number
  /** The break proposed after a pomodoro, in minutes: 5, or 15 on every 4th pomodoro of the day. */
  suggestedBreakMinutes: number
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
export const SHORT_BREAK_MINUTES = 5
export const LONG_BREAK_MINUTES = 15
/** Every this many pomodoros in a day, the proposed break is the long one. */
export const LONG_BREAK_EVERY = 4
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

/** A stopped pomodoro of `focusMs`. */
export function idleTimer(focusMs: number): Timer {
  return {
    status: 'idle',
    kind: 'focus',
    durationMs: focusMs,
    focusMs,
    endsAt: null,
    pausedRemainingMs: null,
    finishedAt: null
  }
}

/** `timer` with its countdown facts cleared, ready to be given a new status. */
function cleared(timer: Timer): Timer {
  return { ...timer, status: 'idle', endsAt: null, pausedRemainingMs: null, finishedAt: null }
}

/** The break proposed once `pomodorosDone` pomodoros are done today: long on every 4th. */
export function suggestedBreakMinutes(pomodorosDone: number): number {
  return pomodorosDone > 0 && pomodorosDone % LONG_BREAK_EVERY === 0
    ? LONG_BREAK_MINUTES
    : SHORT_BREAK_MINUTES
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
  const validMs = (v: unknown): v is number => isNum(v) && v >= MINUTE
  const kind: TimerKind = t.kind === 'break' ? 'break' : 'focus'
  const durationMs = validMs(t.durationMs)
    ? t.durationMs
    : kind === 'break'
      ? SHORT_BREAK_MINUTES * MINUTE
      : fresh.timer.durationMs
  const focusMs = kind === 'break' && validMs(t.focusMs) ? t.focusMs : kind === 'break' ? fresh.timer.focusMs : durationMs
  let timer: Timer = { ...idleTimer(focusMs), kind, durationMs }
  if (t.status === 'running' && isNum(t.endsAt)) {
    timer = { ...timer, status: 'running', endsAt: t.endsAt }
  } else if (t.status === 'paused' && isNum(t.pausedRemainingMs) && t.pausedRemainingMs > 0) {
    timer = { ...timer, status: 'paused', pausedRemainingMs: t.pausedRemainingMs }
  } else if (t.status === 'finished' && isNum(t.finishedAt)) {
    timer = { ...timer, status: 'finished', finishedAt: t.finishedAt }
  } else {
    timer = idleTimer(focusMs) // idle is always a pomodoro waiting to start
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
  /** True when a running session reached its end in this call: notify once (pomodoros also count). */
  completed: boolean
  /** True when anything changed and the store must be written back. */
  changed: boolean
}

/**
 * Brings the store up to `now`: a running timer whose `endsAt` passed becomes `finished`; a
 * pomodoro is counted once, on the local date it ended (even if Orca was closed then), a break is
 * not counted. A finished timer older than the linger window goes back to an idle pomodoro.
 */
export function reconcile(store: PomodoroStore, now: number): Reconciled {
  const { timer } = store
  if (timer.status === 'running' && timer.endsAt !== null && timer.endsAt <= now) {
    const day = localDateKey(timer.endsAt)
    const counts =
      timer.kind === 'focus'
        ? pruneCounts({ ...store.counts, [day]: countOn(store, day) + 1 }, now)
        : store.counts
    const finishedAt = timer.endsAt
    const next: Timer =
      now - finishedAt > FINISHED_LINGER_MS
        ? idleTimer(timer.focusMs)
        : { ...cleared(timer), status: 'finished', finishedAt }
    return { store: { ...store, timer: next, counts }, completed: true, changed: true }
  }
  if (timer.status === 'finished' && (timer.finishedAt ?? 0) + FINISHED_LINGER_MS <= now) {
    return { store: { ...store, timer: idleTimer(timer.focusMs) }, completed: false, changed: true }
  }
  return { store, completed: false, changed: false }
}

/**
 * Starts a fresh pomodoro (optionally of a new length) or resumes a paused session, break
 * included. Starting after a break (or while one is idle) always begins a pomodoro.
 */
export function start(store: PomodoroStore, now: number, minutes?: number): PomodoroStore {
  const { timer } = store
  if (timer.status === 'running' && minutes === undefined) return store
  if (timer.status === 'paused' && minutes === undefined) {
    const left = timer.pausedRemainingMs ?? timer.durationMs
    return { ...store, timer: { ...cleared(timer), status: 'running', endsAt: now + left } }
  }
  const durationMs = minutes === undefined ? timer.focusMs : clampMinutes(minutes) * MINUTE
  return {
    ...store,
    timer: { ...idleTimer(durationMs), status: 'running', endsAt: now + durationMs }
  }
}

/**
 * Starts a break of `minutes`, once a pomodoro is done (or whenever nothing is counting down).
 * Ignored while a session is running or paused.
 */
export function startBreak(store: PomodoroStore, now: number, minutes: number): PomodoroStore {
  const { timer } = store
  if (timer.status === 'running' || timer.status === 'paused') return store
  const durationMs = clampMinutes(minutes, SHORT_BREAK_MINUTES) * MINUTE
  return {
    ...store,
    timer: {
      ...cleared(timer),
      status: 'running',
      kind: 'break',
      durationMs,
      focusMs: timer.focusMs,
      endsAt: now + durationMs
    }
  }
}

export function pause(store: PomodoroStore, now: number): PomodoroStore {
  const { timer } = store
  if (timer.status !== 'running') return store
  const left = remainingMs(timer, now)
  if (left <= 0) return store
  return { ...store, timer: { ...cleared(timer), status: 'paused', pausedRemainingMs: left } }
}

/** Start/Pause: running pauses, anything else starts (or resumes). */
export function toggle(store: PomodoroStore, now: number): PomodoroStore {
  return store.timer.status === 'running' ? pause(store, now) : start(store, now)
}

/** Back to an idle pomodoro of the full length (optionally a new one), skipping any break; the day's count is untouched. */
export function reset(store: PomodoroStore, minutes?: number): PomodoroStore {
  const durationMs = minutes === undefined ? store.timer.focusMs : clampMinutes(minutes) * MINUTE
  return { ...store, timer: idleTimer(durationMs) }
}

/**
 * Changes the pomodoro length while nothing is counting down; ignored while running or paused.
 * A finished timer stays finished (so a proposed break is still offered) and starts the next
 * pomodoro at the new length.
 */
export function setMinutes(store: PomodoroStore, minutes: number): PomodoroStore {
  const { timer } = store
  if (timer.status === 'running' || timer.status === 'paused') return store
  if (timer.status === 'finished') {
    const focusMs = clampMinutes(minutes) * MINUTE
    if (focusMs === timer.focusMs) return store
    const durationMs = timer.kind === 'focus' ? focusMs : timer.durationMs
    return { ...store, timer: { ...timer, focusMs, durationMs } }
  }
  return reset(store, minutes)
}

/** Reset day: today's count back to zero. */
export function resetDay(store: PomodoroStore, now: number): PomodoroStore {
  const counts = { ...store.counts }
  delete counts[localDateKey(now)]
  return { ...store, counts }
}

/**
 * Corrects today's count by `delta` (the panel's − and + buttons), never below zero. Returns the
 * same store when nothing changes, so the worker skips the write.
 */
export function adjustToday(store: PomodoroStore, now: number, delta: number): PomodoroStore {
  const day = localDateKey(now)
  const before = countOn(store, day)
  const after = Math.max(0, before + Math.trunc(delta))
  if (after === before) return store
  const counts = { ...store.counts }
  if (after === 0) delete counts[day]
  else counts[day] = after
  return { ...store, counts }
}

export function snapshot(store: PomodoroStore, now: number): Snapshot {
  const today = localDateKey(now)
  const doneOn = localDateKey(store.timer.finishedAt ?? now)
  return {
    status: store.timer.status,
    kind: store.timer.kind,
    durationMs: store.timer.durationMs,
    focusMs: store.timer.focusMs,
    suggestedBreakMinutes: suggestedBreakMinutes(countOn(store, doneOn)),
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
  const done = `${n} ${n === 1 ? 'pomodoro' : 'pomodoros'} done today`
  const hint = 'Click to open Pomodoro.'
  const rest = snap.kind === 'break'
  switch (snap.status) {
    case 'running':
      return rest
        ? {
            text: `☕ ${formatClock(snap.remainingMs)} · ${n}`,
            tone: 'success',
            tooltip: `Break: ${formatClock(snap.remainingMs)} left. ${done}. ${hint}`
          }
        : {
            text: `🍅 ${formatClock(snap.remainingMs)} · ${n}`,
            tone: 'accent',
            tooltip: `Pomodoro in focus: ${formatClock(snap.remainingMs)} left. ${done}. ${hint}`
          }
    case 'paused':
      return {
        text: `${rest ? '☕' : '🍅'} ⏸ ${formatClock(snap.remainingMs)} · ${n}`,
        tone: 'neutral',
        tooltip: `${rest ? 'Break paused' : 'Pomodoro paused'} with ${formatClock(snap.remainingMs)} left. ${done}. ${hint}`
      }
    case 'finished':
      return rest
        ? {
            text: `☕ Break over · ${n}`,
            tone: 'success',
            tooltip: `Break over. Ready for the next pomodoro? ${done}. ${hint}`
          }
        : {
            text: `🍅 Done! · ${n}`,
            tone: 'success',
            tooltip: `Pomodoro done! Suggested break: ${snap.suggestedBreakMinutes} min. ${done}. ${hint}`
          }
    default:
      return {
        text: `🍅 ${formatClock(snap.durationMs)} · ${n}`,
        tone: 'neutral',
        tooltip: `Pomodoro stopped (${Math.round(snap.durationMs / MINUTE)} min). ${done}. ${hint}`
      }
  }
}

/** The pomodoro-done notice; `breakMinutes` is null when the break offer has already lapsed. */
export function notificationBody(count: number, breakMinutes: number | null = SHORT_BREAK_MINUTES): string {
  const today = `Today: ${count === 1 ? '1 pomodoro' : `${count} pomodoros`} 🍅`
  return breakMinutes === null ? today : `Time for a ${breakMinutes} min break. ${today}`
}

export const BREAK_DONE_TITLE = 'Break over ☕'
export const BREAK_DONE_BODY = 'Ready for the next pomodoro?'
