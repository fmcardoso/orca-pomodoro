// DOM glue for the HTML panel. The worker owns the timer; this file only draws snapshots and
// forwards presses. It ticks its own countdown while running so the clock and ring move smoothly
// between the worker's posts, and stops ticking otherwise.
import { STATE_EVENT, STORE_KEY } from './protocol.ts'
import { createPanelController, type PanelView } from './panel-view.ts'
import type { Snapshot } from './timer.ts'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const app = $('app')
const clock = $('clock')
const caption = $('caption')
const primaryBtn = $<HTMLButtonElement>('primary')
const resetBtn = $<HTMLButtonElement>('reset')
const minutesInput = $<HTMLInputElement>('minutes')
const todayLabel = $('today')
const dots = $('dots')
const resetDayBtn = $<HTMLButtonElement>('reset-day')
const errorBox = $('error')
const ring = document.querySelector<SVGCircleElement>('.ring-progress')!
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('.chip'))

const MAX_DOTS = 12
let ticker: ReturnType<typeof setInterval> | null = null
let lastStatus = ''
let lastDots = -1
let askedAtEnd = false
let ready = false

function render(view: PanelView): void {
  app.dataset.status = view.status
  app.className = `pet is-${view.status} face-${view.face}${ready ? ' ready' : ''}`
  if (!ready) requestAnimationFrame(() => requestAnimationFrame(() => {
    ready = true
    app.classList.add('ready')
  }))
  clock.textContent = view.clock
  caption.textContent = view.caption
  ring.style.strokeDashoffset = String(Math.round((1 - view.ring) * 1000))

  primaryBtn.textContent = view.primaryLabel
  resetBtn.disabled = !view.canReset
  minutesInput.disabled = !view.canEditMinutes
  if (document.activeElement !== minutesInput || !view.canEditMinutes) {
    minutesInput.value = String(view.minutes)
  }
  for (const chip of chips) {
    chip.disabled = !view.canEditMinutes
    chip.classList.toggle('active', Number(chip.dataset.minutes) === view.minutes)
  }

  todayLabel.textContent = view.todayLabel
  if (view.todayCount !== lastDots) {
    lastDots = view.todayCount
    dots.replaceChildren()
    if (view.todayCount === 0) {
      const empty = document.createElement('span')
      empty.className = 'empty'
      empty.textContent = 'Nenhum ainda. Bora?'
      dots.append(empty)
    }
    for (let i = 0; i < Math.min(view.todayCount, MAX_DOTS); i++) {
      const dot = document.createElement('span')
      dot.className = 'dot'
      dots.append(dot)
    }
    if (view.todayCount > MAX_DOTS) {
      const more = document.createElement('span')
      more.className = 'more'
      more.textContent = `+${view.todayCount - MAX_DOTS}`
      dots.append(more)
    }
  }

  if (view.status !== lastStatus) {
    lastStatus = view.status
    askedAtEnd = false
    setTicking(view.status === 'running')
  }
  errorBox.hidden = true
}

function showError(message: string): void {
  errorBox.textContent = `Ops: ${message}`
  errorBox.hidden = false
}

const controller = createPanelController(
  {
    request: async (name, input) => (await orca.plugin.request(name, input as never)) as Snapshot,
    readStore: () => orca.storage.get(STORE_KEY),
    now: () => Date.now()
  },
  render,
  showError
)

function setTicking(on: boolean): void {
  if (on && !ticker) {
    ticker = setInterval(() => {
      const view = controller.view()
      if (view) render(view)
      // The worker posts when the pomodoro ends; ask once in case that post was missed.
      if (view && view.clock === '00:00' && !askedAtEnd) {
        askedAtEnd = true
        setTimeout(() => void controller.refresh(), 1500)
      }
    }, 500)
  } else if (!on && ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function inputMinutes(): number {
  return Number(minutesInput.value)
}

primaryBtn.addEventListener('click', () => void controller.primary(inputMinutes()))
resetBtn.addEventListener('click', () => void controller.reset())
minutesInput.addEventListener('change', () => void controller.setMinutes(inputMinutes()))
minutesInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') minutesInput.blur()
})
for (const chip of chips) {
  chip.addEventListener('click', () => {
    minutesInput.value = chip.dataset.minutes ?? '25'
    void controller.setMinutes(inputMinutes())
  })
}

// "Zerar dia" asks once more before clearing today's count.
let confirmTimer: ReturnType<typeof setTimeout> | null = null
resetDayBtn.addEventListener('click', () => {
  if (!resetDayBtn.classList.contains('confirming')) {
    resetDayBtn.classList.add('confirming')
    resetDayBtn.textContent = 'Confirmar?'
    confirmTimer = setTimeout(disarm, 3000)
    return
  }
  disarm()
  void controller.resetDay()
})
function disarm(): void {
  if (confirmTimer) clearTimeout(confirmTimer)
  confirmTimer = null
  resetDayBtn.classList.remove('confirming')
  resetDayBtn.textContent = 'Zerar dia'
}

// Stay in sync: the worker posts every change; storage changes cover a post we missed.
orca.plugin.on(STATE_EVENT, (snap) => controller.receive(snap as Snapshot))
orca.storage.onDidChange(({ key }) => {
  if (key === STORE_KEY) void controller.refresh()
})
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void controller.refresh()
})

void controller.refresh()
