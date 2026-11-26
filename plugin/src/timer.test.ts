import { assert, test } from 'orca/testing'
import {
  clampMinutes,
  emptyStore,
  FINISHED_LINGER_MS,
  formatClock,
  localDateKey,
  MINUTE,
  nextLocalMidnight,
  normalizeStore,
  pause,
  reconcile,
  reset,
  resetDay,
  setMinutes,
  snapshot,
  start,
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
  assert.match(run.tooltip, /faltam 18:42/)
  const paused = statusBarView(snapshot(pause(s, T0 + MINUTE), T0 + 2 * MINUTE))
  assert.deepEqual([paused.text, paused.tone], ['🍅 ⏸ 24:00 · 3', 'neutral'])
  const done = statusBarView(snapshot(reconcile(s, T0 + 25 * MINUTE).store, T0 + 25 * MINUTE))
  assert.deepEqual([done.text, done.tone], ['🍅 Pronto! · 4', 'success'])
})
