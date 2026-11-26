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
  await w.request('pomodoro.toggle') // starts the next one
  assert.equal(notifications(w).length, 1)
  assert.deepEqual(notifications(w)[0], {
    title: 'Pomodoro concluído 🍅',
    body: 'Hora de uma pausa. Hoje: 1 pomodoro 🍅'
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
  assert.deepEqual([lastBar(w).text, lastBar(w).tone], ['🍅 Pronto! · 1', 'success'])
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
  assert.match((host.callsOf('notifications.show')[0] as { body: string }).body, /Hoje: 3 pomodoros/)
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

test('day rollover: today starts at zero after midnight; Zerar dia clears today only', async () => {
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
  assert.equal(await w.command('pomodoro.focus50'), 'Foco de 50 min iniciado 🍅')
  assert.equal((await get(w)).durationMs, 50 * MINUTE)
  assert.equal(await w.command('pomodoro.toggle'), 'Pomodoro pausado')
  assert.equal(await w.command('pomodoro.reset'), 'Timer resetado')
  assert.equal(await w.command('pomodoro.focus25'), 'Foco de 25 min iniciado 🍅')
  assert.equal((await get(w)).remainingMs, 25 * MINUTE)
  assert.equal(await w.command('pomodoro.resetDay'), 'Contagem de hoje zerada')
  const before = opened
  assert.equal(await w.command('pomodoro.open'), undefined)
  assert.equal(opened, before + 1)
  assert.deepEqual(w.refusals, [])
})
