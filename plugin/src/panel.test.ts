// The HTML panel's logic: what it draws for each state, and its controller driving the real
// worker (mounted over a mock host). The DOM glue in panel-main.ts is checked against panel.html.
import { afterEach, assert, mockHost, mountWorker, test, type TestWorker } from 'orca/testing'
import { readFileSync } from 'node:fs'
import * as main from './worker.ts'
import { createPanelController, panelView, snapshotFromStorage, type PanelView } from './panel-view.ts'
import { emptyStore, MINUTE, pause, reconcile, snapshot, start, startBreak, type Snapshot } from './timer.ts'

const T0 = new Date(2026, 10, 26, 9, 0, 0).getTime()
let now = T0
main.env.now = () => now

const workers: TestWorker[] = []
afterEach(async () => {
  while (workers.length) await workers.pop()!.deactivate()
  now = T0
})

test('idle: sleeping face, full ring, Start, minutes editable', () => {
  const v = panelView(snapshot(emptyStore(), T0), T0)
  assert.equal(v.face, 'sleeping')
  assert.equal(v.clock, '25:00')
  assert.equal(v.ring, 1)
  assert.equal(v.primaryLabel, 'Start')
  assert.equal(v.canEditMinutes, true)
  assert.equal(v.canReset, false)
  assert.equal(v.todayLabel, 'Today: 0 🍅')
  assert.deepEqual([v.statusLabel, v.hours], ['Ready', false])
})

test('status labels match the Dueto card; long pomodoros show hours', () => {
  const running = snapshot(start(emptyStore(), T0, 90), T0)
  const v = panelView(running, T0)
  assert.deepEqual([v.statusLabel, v.clock, v.hours], ['Focus', '1:30:00', true])
  assert.equal(panelView(snapshot(pause(start(emptyStore(), T0), T0), T0), T0).statusLabel, 'Paused')
  const done = reconcile(start(emptyStore(), T0), T0 + 25 * MINUTE).store
  assert.equal(panelView(snapshot(done, T0 + 25 * MINUTE), T0 + 25 * MINUTE).statusLabel, 'Done')
})

test('running: focused face, ring and clock follow the panel clock between posts', () => {
  const snap = snapshot(start(emptyStore(), T0), T0)
  const v = panelView(snap, T0 + 10 * MINUTE)
  assert.equal(v.face, 'focused')
  assert.equal(v.clock, '15:00')
  assert.equal(v.ring, 0.6)
  assert.equal(v.primaryLabel, 'Pause')
  assert.equal(v.canEditMinutes, false)
})

test('paused sleeps with Resume; finished celebrates', () => {
  const paused = panelView(snapshot(pause(start(emptyStore(), T0), T0 + MINUTE), T0 + MINUTE), T0 + 9 * MINUTE)
  assert.deepEqual([paused.face, paused.primaryLabel, paused.clock], ['sleeping', 'Resume', '24:00'])
  const done = reconcile(start(emptyStore(), T0), T0 + 25 * MINUTE).store
  const v = panelView(snapshot(done, T0 + 25 * MINUTE), T0 + 25 * MINUTE)
  assert.deepEqual([v.face, v.primaryLabel, v.clock, v.ring, v.todayLabel], ['happy', 'Take break', '00:00', 1, 'Today: 1 🍅'])
  assert.deepEqual([v.offerBreak, v.breakMinutes, v.primaryAction], [true, 5, 'break'])
})

test('controller: a break is proposed, the pick sticks, Take break starts it, Start follows', async () => {
  const { controller, last, errors, worker } = await controllerOnWorker()
  await controller.primary(25)
  now += 25 * MINUTE
  await controller.refresh()
  assert.deepEqual([last().primaryLabel, last().offerBreak, last().breakMinutes], ['Take break', true, 5])
  controller.chooseBreak(15)
  assert.equal(last().breakMinutes, 15)
  await controller.refresh() // a repeated snapshot does not forget the pick
  assert.equal(last().breakMinutes, 15)
  await controller.primary(25)
  assert.deepEqual([last().status, last().kind, last().statusLabel, last().clock, last().face], ['running', 'break', 'Break', '15:00', 'sleeping'])
  assert.deepEqual([last().offerBreak, last().minutes, last().canEditMinutes], [false, 25, false])
  now += 15 * MINUTE
  await controller.refresh()
  assert.deepEqual([last().statusLabel, last().primaryLabel, last().offerBreak], ['Break over', 'Start', false])
  await controller.primary(25)
  assert.deepEqual([last().kind, last().clock], ['focus', '25:00'])
  // Skip: skip the offered break and start the next pomodoro.
  now += 25 * MINUTE
  await controller.refresh()
  assert.equal(last().offerBreak, true)
  await controller.skipBreak(25)
  assert.deepEqual([last().status, last().kind], ['running', 'focus'])
  assert.deepEqual(errors, [])
  assert.deepEqual(worker.refusals, [])
})

test('controller: − and + correct today\'s count; − is off at zero', async () => {
  const { controller, last, errors, worker } = await controllerOnWorker()
  assert.deepEqual([last().todayCount, last().canDecrement], [0, false])
  await controller.adjustCount(1)
  await controller.adjustCount(1)
  assert.deepEqual([last().todayLabel, last().canDecrement], ['Today: 2 🍅', true])
  await controller.adjustCount(-1)
  await controller.adjustCount(-1)
  await controller.adjustCount(-1) // already zero: stays there
  assert.deepEqual([last().todayLabel, last().canDecrement], ['Today: 0 🍅', false])
  assert.deepEqual(errors, [])
  assert.deepEqual(worker.refusals, [])
})

test('controller: the break pick is forgotten when the next pomodoro finishes; the length can change meanwhile', async () => {
  const { controller, last } = await controllerOnWorker()
  await controller.primary(25)
  now += 25 * MINUTE
  await controller.refresh()
  controller.chooseBreak(15)
  await controller.setMinutes(50) // set up the next pomodoro: the offer and the pick stay
  assert.deepEqual([last().offerBreak, last().breakMinutes, last().minutes], [true, 15, 50])
  await controller.skipBreak(50)
  now += 50 * MINUTE
  await controller.refresh()
  assert.deepEqual([last().offerBreak, last().breakMinutes], [true, 5]) // back to the suggestion
  const paused = panelView(snapshot(pause(startBreak(emptyStore(), T0, 5), T0 + MINUTE), T0 + MINUTE), T0 + MINUTE)
  assert.equal(paused.statusLabel, 'Break paused')
})

test('a snapshot from before midnight shows zero for the new day', () => {
  const late = new Date(2026, 10, 26, 23, 59).getTime()
  const snap = snapshot({ ...emptyStore(), counts: { '2026-11-26': 4 } }, late)
  assert.equal(panelView(snap, late).todayCount, 4)
  assert.equal(panelView(snap, late + 2 * MINUTE).todayCount, 0)
})

async function controllerOnWorker(host = mockHost()) {
  const worker = await mountWorker(main, { host })
  workers.push(worker)
  const views: PanelView[] = []
  const errors: string[] = []
  const controller = createPanelController(
    {
      request: (name, input) => worker.request(name, input as never) as Promise<Snapshot>,
      readStore: async () => host.data().storage.pomodoro ?? null,
      now: () => now
    },
    (v) => views.push(v),
    (e) => errors.push(e)
  )
  await controller.refresh()
  return { worker, controller, views, errors, last: () => views[views.length - 1] }
}

test('controller: Start uses the minutes input, Pause/Resume, Reset, Reset day', async () => {
  const { controller, last, errors, worker } = await controllerOnWorker()
  assert.equal(last().primaryLabel, 'Start')

  await controller.primary(50)
  assert.deepEqual([last().status, last().clock], ['running', '50:00'])
  now += 10 * MINUTE
  await controller.primary(50)
  assert.deepEqual([last().status, last().primaryLabel, last().clock], ['paused', 'Resume', '40:00'])
  await controller.primary(99) // resumes; the input is ignored while paused
  assert.deepEqual([last().status, last().clock], ['running', '40:00'])
  now += 40 * MINUTE
  await controller.refresh()
  assert.deepEqual([last().face, last().todayCount], ['happy', 1])
  await controller.resetDay()
  assert.equal(last().todayLabel, 'Today: 0 🍅')
  await controller.setMinutes(30)
  await controller.reset()
  assert.deepEqual([last().status, last().clock], ['idle', '30:00'])
  assert.deepEqual(errors, [])
  assert.deepEqual(worker.refusals, [])
})

test('controller: worker posts update the view; older snapshots are ignored', async () => {
  const { controller, last } = await controllerOnWorker()
  const newer = snapshot(start(emptyStore(), T0 + 1000), T0 + 1000)
  controller.receive(newer)
  assert.equal(last().status, 'running')
  controller.receive(snapshot(emptyStore(), T0))
  assert.equal(last().status, 'running')
})

test('controller: falls back to storage when the worker cannot answer', async () => {
  const stored = start(emptyStore(), T0 - 5 * MINUTE)
  const views: PanelView[] = []
  const controller = createPanelController(
    {
      request: async () => {
        throw Object.assign(new Error('no worker'), { code: 'unavailable' })
      },
      readStore: async () => stored,
      now: () => T0
    },
    (v) => views.push(v)
  )
  await controller.refresh()
  assert.deepEqual([views[0].status, views[0].clock], ['running', '20:00'])
  assert.equal(snapshotFromStorage(null, T0).status, 'idle')
})

test('panel.html has every element panel-main.ts looks up', () => {
  const html = readFileSync(new URL('./panel.html', import.meta.url), 'utf8')
  const script = readFileSync(new URL('./panel-main.ts', import.meta.url), 'utf8')
  const ids = [...script.matchAll(/\$(?:<[^>]+>)?\('([\w-]+)'\)/g)].map((m) => m[1])
  assert.ok(ids.length >= 9)
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing #${id}`)
  for (const cls of ['dial', 'arc', 'pixel-pet', 'data-preset="25"', 'data-preset="50"', 'data-break="5"', 'data-break="15"', 'id="count-minus"', 'id="count-plus"', 'icon-play', 'icon-pause']) {
    assert.ok(html.includes(cls), `missing .${cls}`)
  }
  assert.ok(html.includes('src="./panel-main.ts"'))
  assert.ok(!/https?:\/\//.test(html.replace(/xmlns="[^"]+"/g, '')), 'no network assets')
})
