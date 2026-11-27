// Runs src/worker.ts's activate(orca) over a mock host, with the worker's clock swapped for a
// fake one so expiry, midnight and restarts are tested without waiting.
import { afterEach, assert, mockHost, mountWorker, test, type TestWorker } from 'orca/testing'
import * as main from './worker.ts'
import { STORE_KEY } from './protocol.ts'
import { MINUTE, type PomodoroStore, type Snapshot } from './timer.ts'

const T0 = new Date(2026, 10, 26, 9, 0, 0).getTime()
let now = T0
main.env.now = () => now
let opened = 0
main.env.openPanel = async () => {
  opened++
}

const mounted: TestWorker[] = []
async function mountOn(host = mockHost()) {
  const worker = await mountWorker(main, { host })
  mounted.push(worker)
  return worker
}
afterEach(async () => {
  while (mounted.length) await mounted.pop()!.deactivate()
  now = T0
})

const get = (w: TestWorker) => w.request('pomodoro.get') as Promise<Snapshot>
const stored = (w: TestWorker) => w.host.data().storage[STORE_KEY] as PomodoroStore
const lastBar = (w: TestWorker) => {
  const calls = w.host.callsOf('statusBar.update')
  return calls[calls.length - 1] as { text: string; tone: string; tooltip: string }
}
const notifications = (w: TestWorker) =>
  w.host.callsOf('notifications.show') as { title: string; body: string }[]

test('starts, pauses, resumes and resets; storage holds endsAt, not ticks', async () => {
  const w = await mountOn()
  assert.equal((await get(w)).status, 'idle')
  assert.deepEqual([lastBar(w).text, lastBar(w).tone], ['🍅 25:00 · 0', 'neutral'])

  let snap = await w.request('pomodoro.start', { minutes: 25 })
  assert.equal(snap.status, 'running')
  assert.equal(stored(w).timer.endsAt, T0 + 25 * MINUTE)
  assert.equal(lastBar(w).tone, 'accent')

  now += 5 * MINUTE
  snap = await w.request('pomodoro.toggle')
  assert.equal(snap.status, 'paused')
  assert.equal(stored(w).timer.pausedRemainingMs, 20 * MINUTE)
  assert.deepEqual([lastBar(w).text, lastBar(w).tone], ['🍅 ⏸ 20:00 · 0', 'neutral'])

  now += 30 * MINUTE // a long pause changes nothing
  snap = await w.request('pomodoro.start', {})
  assert.equal(snap.remainingMs, 20 * MINUTE)
  assert.equal(stored(w).timer.endsAt, now + 20 * MINUTE)

  snap = await w.request('pomodoro.reset')
  assert.equal(snap.status, 'idle')
  assert.equal(snap.remainingMs, 25 * MINUTE)
  assert.equal(notifications(w).length, 0)
  // Every change reached open panels.
  assert.ok(w.posts.length >= 4)
  assert.ok(w.posts.every((p) => p.event === 'pomodoro.state'))
  assert.deepEqual(w.refusals, [])
})

test('expiry finishes, counts once and notifies once', async () => {
  const w = await mountOn()
  await w.request('pomodoro.start', { minutes: 25 })
  now += 25 * MINUTE + 1000
  const snap = await get(w)
  assert.equal(snap.status, 'finished')
  assert.equal(snap.todayCount, 1)
  await get(w)
  await w.request('pomodoro.toggle') // skips the proposed break: starts the next pomodoro
  assert.equal(notifications(w).length, 1)
  assert.deepEqual(notifications(w)[0], {
    title: 'Pomodoro done 🍅',
    body: 'Time for a 5 min break. Today: 1 pomodoro 🍅'
  })
  assert.deepEqual(stored(w).counts, { '2026-11-26': 1 })
  assert.equal(lastBar(w).tone, 'accent')
  assert.deepEqual(w.refusals, [])
})

test('finished shows success, then goes back to sleep', async () => {
  const w = await mountOn()
  await w.request('pomodoro.start', { minutes: 1 })
  now += MINUTE
  await get(w)
  assert.deepEqual([lastBar(w).text, lastBar(w).tone], ['🍅 Done! · 1', 'success'])
  now += 11 * MINUTE
  assert.equal((await get(w)).status, 'idle')
  assert.equal(lastBar(w).tone, 'neutral')
})

test('restart with an endsAt that passed while Orca was closed: counted and notified once', async () => {
  const host = mockHost({
    storage: {
      [STORE_KEY]: {
        version: 1,
        timer: { status: 'running', durationMs: 25 * MINUTE, endsAt: T0 - 2 * 60 * MINUTE, pausedRemainingMs: null, finishedAt: null },
        counts: { '2026-11-26': 2 }
      }
    }
  })
  const first = await mountOn(host)
  const snap = await get(first)
  assert.equal(snap.status, 'idle') // ended long ago: counted, no lingering celebration
  assert.equal(snap.todayCount, 3)
  assert.equal(host.callsOf('notifications.show').length, 1)
  assert.match((host.callsOf('notifications.show')[0] as { body: string }).body, /Today: 3 pomodoros/)
  await first.deactivate()
  mounted.length = 0

  const second = await mountOn(host) // another restart
  assert.equal((await get(second)).todayCount, 3)
  assert.equal(host.callsOf('notifications.show').length, 1)
  assert.deepEqual(second.refusals, [])
})

test('restart while still running keeps the remaining time', async () => {
  const host = mockHost()
  const first = await mountOn(host)
  await first.request('pomodoro.start', { minutes: 25 })
  await first.deactivate()
  mounted.length = 0
  now += 10 * MINUTE
  const second = await mountOn(host)
  const snap = await get(second)
  assert.equal(snap.status, 'running')
  assert.equal(snap.remainingMs, 15 * MINUTE)
})

test('day rollover: today starts at zero after midnight; Reset day clears today only', async () => {
  now = new Date(2026, 10, 26, 23, 55).getTime()
  const host = mockHost({ storage: { [STORE_KEY]: { version: 1, timer: { status: 'idle', durationMs: 25 * MINUTE }, counts: { '2026-11-26': 5 } } } })
  const w = await mountOn(host)
  assert.equal((await get(w)).todayCount, 5)
  now = new Date(2026, 10, 27, 0, 5).getTime()
  let snap = await get(w)
  assert.equal(snap.today, '2026-11-27')
  assert.equal(snap.todayCount, 0)
  assert.equal(lastBar(w).text, '🍅 25:00 · 0')

  await w.request('pomodoro.start', { minutes: 25 })
  now += 25 * MINUTE
  snap = await get(w)
  assert.equal(snap.todayCount, 1)
  snap = await w.request('pomodoro.resetDay')
  assert.equal(snap.todayCount, 0)
  assert.deepEqual(stored(w).counts, { '2026-11-26': 5 })
})

test('uses the focusMinutes setting for a fresh timer and follows its changes', async () => {
  const host = mockHost({ settings: { focusMinutes: 40 } })
  const w = await mountOn(host)
  assert.equal((await get(w)).durationMs, 40 * MINUTE)
  assert.equal((await w.request('pomodoro.setMinutes', { minutes: 50 })).durationMs, 50 * MINUTE)
  // Out-of-range input is clamped.
  assert.equal((await w.request('pomodoro.setMinutes', { minutes: 999 })).durationMs, 180 * MINUTE)
  assert.deepEqual(w.refusals, [])
})

test('palette commands', async () => {
  const w = await mountOn()
  assert.equal(await w.command('pomodoro.focus50'), '50 min focus started 🍅')
  assert.equal((await get(w)).durationMs, 50 * MINUTE)
  assert.equal(await w.command('pomodoro.toggle'), 'Pomodoro paused')
  assert.equal(await w.command('pomodoro.reset'), 'Timer reset')
  assert.equal(await w.command('pomodoro.focus25'), '25 min focus started 🍅')
  assert.equal((await get(w)).remainingMs, 25 * MINUTE)
  assert.equal(await w.command('pomodoro.resetDay'), "Today's count cleared")
  const before = opened
  assert.equal(await w.command('pomodoro.open'), undefined)
  assert.equal(opened, before + 1)
  assert.deepEqual(w.refusals, [])
})

test('after a pomodoro the break is proposed: 5 min, 15 min on the 4th, picked and counted apart', async () => {
  const w = await mountOn()
  await w.request('pomodoro.start', { minutes: 25 })
  now += 25 * MINUTE
  let snap = await get(w)
  assert.deepEqual([snap.status, snap.kind, snap.suggestedBreakMinutes], ['finished', 'focus', 5])
  assert.match(lastBar(w).tooltip, /Suggested break: 5 min/)

  snap = await w.request('pomodoro.startBreak', { minutes: 15 }) // the person picks 15
  assert.deepEqual([snap.status, snap.kind, snap.remainingMs], ['running', 'break', 15 * MINUTE])
  assert.deepEqual([lastBar(w).text, lastBar(w).tone], ['☕ 15:00 · 1', 'success'])

  now += 15 * MINUTE
  snap = await get(w)
  assert.deepEqual([snap.status, snap.kind, snap.todayCount], ['finished', 'break', 1]) // not counted
  assert.deepEqual(notifications(w)[1], { title: 'Break over ☕', body: 'Ready for the next pomodoro?' })
  assert.equal(lastBar(w).text, '☕ Break over · 1')

  snap = await w.request('pomodoro.toggle') // back to a pomodoro of the original length
  assert.deepEqual([snap.status, snap.kind, snap.remainingMs], ['running', 'focus', 25 * MINUTE])

  // Pomodoros 2, 3 and 4: the 4th proposes the long break and says so in the notification.
  for (let i = 2; i <= 4; i++) {
    now += 25 * MINUTE
    snap = await get(w)
    assert.equal(snap.todayCount, i)
    if (i < 4) await w.request('pomodoro.start', { minutes: 25 })
  }
  assert.equal(snap.suggestedBreakMinutes, 15)
  assert.equal(notifications(w)[notifications(w).length - 1].body, 'Time for a 15 min break. Today: 4 pomodoros 🍅')

  // Resetting during a break skips it and returns to a full pomodoro.
  await w.request('pomodoro.startBreak', { minutes: 5 })
  snap = await w.request('pomodoro.reset')
  assert.deepEqual([snap.status, snap.kind, snap.remainingMs], ['idle', 'focus', 25 * MINUTE])
  assert.deepEqual(w.refusals, [])
})

test('a break cannot start over a running pomodoro; the palette proposes the suggested one', async () => {
  const w = await mountOn()
  await w.request('pomodoro.start', { minutes: 25 })
  assert.equal((await w.request('pomodoro.startBreak', { minutes: 5 })).kind, 'focus')
  assert.equal(await w.command('pomodoro.break'), 'Finish or reset the timer before taking a break')
  now += 25 * MINUTE
  assert.equal(await w.command('pomodoro.break'), '5 min break started ☕')
  assert.deepEqual(w.refusals, [])
})

test('the − and + buttons correct today\'s count and the suggested break follows', async () => {
  const w = await mountOn()
  assert.equal((await w.request('pomodoro.adjustCount', { delta: -1 })).todayCount, 0) // floor at zero
  assert.equal((await w.request('pomodoro.adjustCount', { delta: 1 })).todayCount, 1)
  assert.equal((await w.request('pomodoro.adjustCount', { delta: 1 })).todayCount, 2)
  assert.equal((await w.request('pomodoro.adjustCount', { delta: 1 })).todayCount, 3)
  await w.request('pomodoro.start', { minutes: 25 })
  now += 25 * MINUTE
  const done = await get(w) // the 4th, counted by the timer: long break proposed
  assert.deepEqual([done.todayCount, done.suggestedBreakMinutes], [4, 15])
  const fewer = await w.request('pomodoro.adjustCount', { delta: -1 }) // it was a mistake
  assert.deepEqual([fewer.todayCount, fewer.suggestedBreakMinutes], [3, 5])
  assert.equal(lastBar(w).text, '🍅 Done! · 3')
  assert.deepEqual(stored(w).counts, { '2026-11-26': 3 })
  assert.deepEqual(w.refusals, [])
})

test('a break that ended while Orca was closed is not announced; a pomodoro is, without a break', async () => {
  const host = mockHost({
    storage: {
      [STORE_KEY]: {
        version: 1,
        timer: { status: 'running', kind: 'break', durationMs: 5 * MINUTE, focusMs: 25 * MINUTE, endsAt: T0 - 60 * MINUTE },
        counts: { '2026-11-26': 2 }
      }
    }
  })
  const w = await mountOn(host)
  const snap = await get(w)
  assert.deepEqual([snap.status, snap.kind, snap.todayCount], ['idle', 'focus', 2])
  assert.equal(notifications(w).length, 0)
  await w.deactivate()
  mounted.length = 0

  const old = mockHost({
    storage: {
      [STORE_KEY]: {
        version: 1,
        timer: { status: 'running', kind: 'focus', durationMs: 25 * MINUTE, focusMs: 25 * MINUTE, endsAt: T0 - 60 * MINUTE },
        counts: { '2026-11-26': 2 }
      }
    }
  })
  const v = await mountOn(old)
  assert.equal((await get(v)).todayCount, 3)
  assert.deepEqual(notifications(v), [{ title: 'Pomodoro done 🍅', body: 'Today: 3 pomodoros 🍅' }])
})

test('changing the length or the setting while a break is offered keeps the offer', async () => {
  const host = mockHost()
  const w = await mountOn(host)
  await w.request('pomodoro.start', { minutes: 25 })
  now += 25 * MINUTE
  await get(w)
  let snap = await w.request('pomodoro.setMinutes', { minutes: 50 })
  assert.deepEqual([snap.status, snap.kind, snap.focusMs], ['finished', 'focus', 50 * MINUTE])
  snap = await w.request('pomodoro.startBreak', { minutes: 5 })
  now += 5 * MINUTE
  snap = await w.request('pomodoro.toggle') // after the break: the new length
  assert.deepEqual([snap.kind, snap.remainingMs], ['focus', 50 * MINUTE])
  assert.deepEqual(w.refusals, [])
})

test('adjustCount ignores anything but -1 and 1', async () => {
  const w = await mountOn()
  for (const delta of [0, 2, -2, null, NaN, 'abc'] as unknown as (-1 | 1)[]) {
    assert.equal((await w.request('pomodoro.adjustCount', { delta })).todayCount, 0)
  }
  assert.equal((await w.request('pomodoro.adjustCount', { delta: 1 })).todayCount, 1)
})

test('palette wording follows a break', async () => {
  const w = await mountOn()
  await w.request('pomodoro.start', { minutes: 25 })
  now += 25 * MINUTE
  assert.equal(await w.command('pomodoro.break'), '5 min break started ☕')
  assert.equal(await w.command('pomodoro.break'), 'Finish or reset the timer before taking a break')
  assert.equal(await w.command('pomodoro.toggle'), 'Break paused')
  assert.equal(await w.command('pomodoro.toggle'), 'Break running ☕')
  assert.deepEqual(w.refusals, [])
})
