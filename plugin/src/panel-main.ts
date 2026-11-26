// DOM glue for the HTML panel. The worker owns the timer; this file only draws snapshots and
// forwards presses. It ticks its own countdown while running so the clock and ring move smoothly
// between the worker's posts, and stops ticking otherwise.
import { STATE_EVENT, STORE_KEY } from './protocol.ts'
import { createPanelController, type Face, type PanelView } from './panel-view.ts'
import { COLORS, FRAMES, frameRuns, GRID, PET_LABEL, REEL_CLASS, THEMED_INKS } from './sprites.ts'
import type { Snapshot } from './timer.ts'

const $ = <T extends Element = HTMLElement>(id: string) => document.getElementById(id) as unknown as T

const app = $('app')
const portrait = $('portrait')
const pet = $<SVGSVGElement>('pet')
const arc = $<SVGCircleElement>('arc')
const statusText = $('status')
const clock = $('clock')
const primaryBtn = $<HTMLButtonElement>('primary')
const primaryLabel = $('primary-label')
const resetBtn = $<HTMLButtonElement>('reset')
const minutesInput = $<HTMLInputElement>('minutes')
const todayLabel = $('today')
const resetDayBtn = $<HTMLButtonElement>('reset-day')
const errorBox = $('error')
const presets = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preset]'))

const SVG_NS = 'http://www.w3.org/2000/svg'
let ticker: ReturnType<typeof setInterval> | null = null
let lastStatus = ''
let lastFace: Face | null = null
let askedAtEnd = false

/** Draws the pet's four frames side by side in one reel; panel.css steps through them. */
function drawPet(face: Face): void {
  const reel = document.createElementNS(SVG_NS, 'g')
  reel.setAttribute('class', `reel ${REEL_CLASS[face]}`)
  for (let frame = 0; frame < FRAMES; frame++) {
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('transform', `translate(${GRID * frame} 0)`)
    for (const run of frameRuns(face, frame)) {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', String(run.x))
      rect.setAttribute('y', String(run.y))
      rect.setAttribute('width', String(run.w))
      rect.setAttribute('height', '1')
      if (THEMED_INKS[run.ink]) rect.setAttribute('class', THEMED_INKS[run.ink])
      else rect.setAttribute('fill', COLORS[run.ink])
      g.append(rect)
    }
    reel.append(g)
  }
  pet.replaceChildren(reel)
  pet.setAttribute('aria-label', PET_LABEL[face])
}

/** Keeps the sprite on whole CSS pixels inside the dial, so every art pixel stays crisp. */
function alignPet(): void {
  const box = portrait.getBoundingClientRect()
  const size = pet.width.baseVal.value
  pet.style.left = `${Math.round(box.x + (box.width - size) / 2) - box.x}px`
  pet.style.top = `${Math.round(box.y + (box.height - size) / 2) - box.y}px`
}
new ResizeObserver(alignPet).observe(app)
// Asleep until the first snapshot, as the idle timer would be.
lastFace = 'sleeping'
drawPet(lastFace)

function render(view: PanelView): void {
  app.dataset.state = view.status
  app.classList.toggle('hours', view.hours)
  if (view.face !== lastFace) {
    lastFace = view.face
    drawPet(view.face)
    alignPet()
  }
  statusText.textContent = view.statusLabel
  clock.textContent = view.clock
  arc.style.strokeDasharray = `${view.ring * 100} 100`

  primaryLabel.textContent = view.primaryLabel
  primaryBtn.setAttribute('aria-label', view.primaryLabel)
  primaryBtn.title = view.primaryLabel
  resetBtn.disabled = !view.canReset
  minutesInput.disabled = !view.canEditMinutes
  if (document.activeElement !== minutesInput || !view.canEditMinutes) {
    minutesInput.value = String(view.minutes)
  }
  for (const button of presets) {
    button.disabled = !view.canEditMinutes
    button.setAttribute('aria-pressed', String(Number(button.dataset.preset) === view.minutes))
  }
  todayLabel.textContent = view.todayLabel

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
    }, 250)
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
for (const button of presets) {
  button.addEventListener('click', () => {
    minutesInput.value = button.dataset.preset ?? '25'
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
