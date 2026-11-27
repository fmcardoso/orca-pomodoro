import { assert, test } from 'orca/testing'
import {
  adjustToday,
  clampMinutes,
  emptyStore,
  FINISHED_LINGER_MS,
  formatClock,
  localDateKey,
  MINUTE,
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
  startBreak,
  suggestedBreakMinutes,
  statusBarView,
  toggle
} from './timer.ts'

const T0 = new Date(2026, 10, 26, 9, 0, 0).getTime()

test('formats the clock and clamps minutes', () => {
  assert.equal(formatClock(25 * MINUTE), '25:00')
  assert.equal(formatClock(18 * MINUTE + 42_000), '18:42')
  assert.equal(formatClock(400), '00:01')
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(65 * MINUTE), '1:05:00')
  assert.equal(clampMinutes(0), 1)
  assert.equal(clampMinutes(500), 180)
  assert.equal(clampMinutes('50'), 50)
  assert.equal(clampMinutes('x'), 25)
})

test('start, pause, resume and reset keep wall-clock facts', () => {
  let s = start(emptyStore(), T0)
  assert.equal(s.timer.status, 'running')
  assert.equal(s.timer.endsAt, T0 + 25 * MINUTE)
  s = pause(s, T0 + 5 * MINUTE)
  assert.equal(s.timer.status, 'paused')
  assert.equal(s.timer.pausedRemainingMs, 20 * MINUTE)
  assert.equal(s.timer.endsAt, null)
  s = toggle(s, T0 + 60 * MINUTE) // resumes with what was left, however long the pause
  assert.equal(s.timer.endsAt, T0 + 80 * MINUTE)
  assert.equal(snapshot(s, T0 + 70 * MINUTE).remainingMs, 10 * MINUTE)
  s = reset(s)
  assert.equal(s.timer.status, 'idle')
  assert.equal(snapshot(s, T0).remainingMs, 25 * MINUTE)
})

test('setMinutes is ignored while counting down', () => {
  const running = start(emptyStore(), T0)
  assert.equal(setMinutes(running, 50), running)
  assert.equal(setMinutes(emptyStore(), 50).timer.durationMs, 50 * MINUTE)
  assert.equal(start(emptyStore(), T0, 50).timer.endsAt, T0 + 50 * MINUTE)
})

test('expiry counts once, on the local date it ended', () => {
  const s = start(emptyStore(), T0)
  assert.equal(reconcile(s, T0 + 24 * MINUTE).completed, false)
  const done = reconcile(s, T0 + 25 * MINUTE)
  assert.equal(done.completed, true)
  assert.equal(done.store.timer.status, 'finished')
  assert.deepEqual(done.store.counts, { '2026-11-26': 1 })
  const again = reconcile(done.store, T0 + 26 * MINUTE)
  assert.equal(again.completed, false)
  assert.equal(again.changed, false)
  // The celebration ends after the linger window.
  const later = reconcile(done.store, T0 + 25 * MINUTE + FINISHED_LINGER_MS)
  assert.equal(later.store.timer.status, 'idle')
  assert.deepEqual(later.store.counts, { '2026-11-26': 1 })
})

test('day rollover: a pomodoro across midnight counts on the day it ended', () => {
  const late = new Date(2026, 10, 26, 23, 50).getTime()
  const s = { ...start(emptyStore(), late), counts: { '2026-11-26': 3 } }
  const done = reconcile(s, late + 30 * MINUTE)
  assert.deepEqual(done.store.counts, { '2026-11-26': 3, '2026-11-27': 1 })
  assert.equal(snapshot(done.store, late + 30 * MINUTE).todayCount, 1)
  assert.equal(snapshot(done.store, late).todayCount, 3)
  assert.equal(localDateKey(nextLocalMidnight(late)), '2026-11-27')
  assert.equal(nextLocalMidnight(late), new Date(2026, 10, 27).getTime())
})

test('resetDay clears only today', () => {
  const s = { ...emptyStore(), counts: { '2026-11-25': 4, '2026-11-26': 2 } }
  assert.deepEqual(resetDay(s, T0).counts, { '2026-11-25': 4 })
})

test('normalizeStore survives junk', () => {
  assert.deepEqual(normalizeStore(null, 40), emptyStore(40))
  assert.deepEqual(normalizeStore('nope'), emptyStore())
  const n = normalizeStore({ timer: { status: 'running' }, counts: { bad: 1, '2026-11-26': 2 } })
  assert.equal(n.timer.status, 'idle')
  assert.deepEqual(n.counts, { '2026-11-26': 2 })
})

test('status bar text and tone follow the state', () => {
  const idle = statusBarView(snapshot(emptyStore(), T0))
  assert.deepEqual([idle.text, idle.tone], ['🍅 25:00 · 0', 'neutral'])
  const s = { ...start(emptyStore(), T0), counts: { '2026-11-26': 3 } }
  const run = statusBarView(snapshot(s, T0 + 6 * MINUTE + 18_000))
  assert.deepEqual([run.text, run.tone], ['🍅 18:42 · 3', 'accent'])
  assert.match(run.tooltip, /18:42 left/)
  const paused = statusBarView(snapshot(pause(s, T0 + MINUTE), T0 + 2 * MINUTE))
  assert.deepEqual([paused.text, paused.tone], ['🍅 ⏸ 24:00 · 3', 'neutral'])
  const done = statusBarView(snapshot(reconcile(s, T0 + 25 * MINUTE).store, T0 + 25 * MINUTE))
  assert.deepEqual([done.text, done.tone], ['🍅 Done! · 4', 'success'])
})

test('breaks: 5 minutes, 15 on every 4th pomodoro', () => {
  assert.deepEqual([0, 1, 3, 4, 5, 8].map(suggestedBreakMinutes), [5, 5, 5, 15, 5, 15])
})

test('a break runs after a pomodoro, is not counted, and hands back the pomodoro length', () => {
  const done = reconcile(start(emptyStore(), T0, 40), T0 + 40 * MINUTE).store
  assert.equal(snapshot(done, T0 + 40 * MINUTE).suggestedBreakMinutes, 5)
  const rest = startBreak(done, T0 + 41 * MINUTE, 15)
  assert.deepEqual([rest.timer.status, rest.timer.kind, rest.timer.endsAt], ['running', 'break', T0 + 56 * MINUTE])
  assert.equal(startBreak(rest, T0 + 42 * MINUTE, 5), rest) // not over a running session
  const paused = pause(rest, T0 + 46 * MINUTE)
  assert.deepEqual([paused.timer.kind, paused.timer.pausedRemainingMs], ['break', 10 * MINUTE])
  assert.equal(toggle(paused, T0 + 50 * MINUTE).timer.kind, 'break')
  const over = reconcile(rest, T0 + 56 * MINUTE)
  assert.deepEqual([over.completed, over.store.timer.status, over.store.timer.kind], [true, 'finished', 'break'])
  assert.deepEqual(over.store.counts, done.counts) // a break never counts
  const next = start(over.store, T0 + 57 * MINUTE) // Start after a break: a pomodoro of 40 min
  assert.deepEqual([next.timer.kind, next.timer.durationMs], ['focus', 40 * MINUTE])
  const lingered = reconcile(over.store, T0 + 56 * MINUTE + FINISHED_LINGER_MS).store
  assert.deepEqual([lingered.timer.status, lingered.timer.kind, lingered.timer.durationMs], ['idle', 'focus', 40 * MINUTE])
  assert.equal(reset(rest).timer.durationMs, 40 * MINUTE)
})

test('the long break is proposed on the 4th pomodoro of the day', () => {
  const s = { ...start(emptyStore(), T0), counts: { '2026-11-26': 3 } }
  const done = reconcile(s, T0 + 25 * MINUTE).store
  assert.equal(snapshot(done, T0 + 25 * MINUTE).suggestedBreakMinutes, 15)
})

test('normalizeStore keeps a break, and drops a stale one that is not counting down', () => {
  const run = normalizeStore({ timer: { status: 'running', kind: 'break', durationMs: 5 * MINUTE, focusMs: 30 * MINUTE, endsAt: T0 } })
  assert.deepEqual([run.timer.kind, run.timer.durationMs, run.timer.focusMs], ['break', 5 * MINUTE, 30 * MINUTE])
  const idle = normalizeStore({ timer: { status: 'idle', kind: 'break', durationMs: 5 * MINUTE, focusMs: 30 * MINUTE } })
  assert.deepEqual([idle.timer.kind, idle.timer.durationMs], ['focus', 30 * MINUTE])
  assert.equal(normalizeStore({ timer: { status: 'idle', durationMs: 50 * MINUTE } }).timer.focusMs, 50 * MINUTE)
})

test('adjustToday corrects only today, never below zero, and skips no-op writes', () => {
  const s = { ...emptyStore(), counts: { '2026-11-25': 4, '2026-11-26': 2 } }
  assert.deepEqual(adjustToday(s, T0, 1).counts, { '2026-11-25': 4, '2026-11-26': 3 })
  assert.deepEqual(adjustToday(s, T0, -1).counts, { '2026-11-25': 4, '2026-11-26': 1 })
  const zero = adjustToday(adjustToday(s, T0, -1), T0, -1)
  assert.deepEqual(zero.counts, { '2026-11-25': 4 }) // zero is dropped, like Reset day
  assert.equal(adjustToday(zero, T0, -1), zero) // already zero: same store
  assert.deepEqual(adjustToday(emptyStore(), T0, 1).counts, { '2026-11-26': 1 })
  assert.equal(snapshot(adjustToday(s, T0, 1), T0).todayCount, 3)
})

test('changing the length while finished keeps the finished timer and its break offer', () => {
  const done = reconcile(start(emptyStore(), T0), T0 + 25 * MINUTE).store
  const changed = setMinutes(done, 50)
  assert.deepEqual([changed.timer.status, changed.timer.kind, changed.timer.finishedAt], ['finished', 'focus', T0 + 25 * MINUTE])
  assert.deepEqual([changed.timer.focusMs, changed.timer.durationMs], [50 * MINUTE, 50 * MINUTE])
  assert.equal(setMinutes(changed, 50), changed) // same length: no change
  assert.equal(start(changed, T0 + 26 * MINUTE).timer.endsAt, T0 + 76 * MINUTE)
  // After a break, only the pomodoro length changes.
  const rested = reconcile(startBreak(done, T0 + 25 * MINUTE, 5), T0 + 30 * MINUTE).store
  const next = setMinutes(rested, 40)
  assert.deepEqual([next.timer.status, next.timer.kind, next.timer.durationMs, next.timer.focusMs], ['finished', 'break', 5 * MINUTE, 40 * MINUTE])
})

test('old-format timers load as pomodoros; a broken break length falls back to 5 min', () => {
  const run = normalizeStore({ timer: { status: 'running', durationMs: 30 * MINUTE, endsAt: T0 } })
  assert.deepEqual([run.timer.kind, run.timer.durationMs, run.timer.focusMs], ['focus', 30 * MINUTE, 30 * MINUTE])
  const paused = normalizeStore({ timer: { status: 'paused', durationMs: 30 * MINUTE, pausedRemainingMs: MINUTE } })
  assert.deepEqual([paused.timer.status, paused.timer.kind, paused.timer.focusMs], ['paused', 'focus', 30 * MINUTE])
  const done = normalizeStore({ timer: { status: 'finished', durationMs: 30 * MINUTE, finishedAt: T0 } })
  assert.deepEqual([done.timer.status, done.timer.kind], ['finished', 'focus'])
  const broken = normalizeStore({ timer: { status: 'running', kind: 'break', durationMs: 0, focusMs: -5, endsAt: T0 } }, 30)
  assert.deepEqual([broken.timer.durationMs, broken.timer.focusMs], [5 * MINUTE, 30 * MINUTE])
})

test('a lapsed pomodoro notice drops the break suggestion', () => {
  assert.equal(notificationBody(4, 15), 'Time for a 15 min break. Today: 4 pomodoros 🍅')
  assert.equal(notificationBody(1, null), 'Today: 1 pomodoro 🍅')
})
