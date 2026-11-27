// Offline design fixture. All interactions affect only this page.
const query = new URLSearchParams(location.search)
const main = document.querySelector('main')
const variant = main.className
const root = document.documentElement
const theme = query.get('theme')
if (theme === 'light' || theme === 'dark') {
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
} else if (!root.matches('.light, .dark')) {
  root.classList.add(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

const faces = {
  awake: '<circle cx="30" cy="47" r="2.7"/><circle cx="51" cy="47" r="2.7"/><path class="line" d="M37 51q3.5 4 7 0"/>',
  asleep: '<path class="line" d="M26 46q4 5 8 0m13 0q4 5 8 0"/><ellipse cx="40.5" cy="53" rx="2.1" ry="2.5"/>',
  happy: '<path class="line" d="M26 47q4-7 8 0m13 0q4-7 8 0"/><path d="M35 51h11q-1 9-5.5 9T35 51Z"/>'
}

const tomato = `<svg class="tomato" viewBox="0 0 80 76" role="img" aria-labelledby="pet-title">
  <title id="pet-title"></title>
  <ellipse cx="40" cy="69" rx="19" ry="2.4" class="ground"/>
  <path fill="#ed624d" d="M40 23c-7-4-15-6-23-2C6 26 3 39 7 50c4 12 16 18 28 17 4 1 8 1 12 0 13 0 24-8 27-20 3-12-2-23-12-27-8-3-16-1-22 3Z"/>
  <path fill="#29765b" d="M39 25c-5 1-12 0-17-5 7-2 12-1 16 1-3-4-4-8-3-11 5 2 8 6 8 11 5-4 11-5 17-3-4 4-10 6-15 7 4 2 6 5 6 8-5-1-9-4-11-8-2 4-5 6-9 7 1-4 4-6 8-7Z"/>
  <path fill="none" stroke="#29765b" stroke-width="3.7" stroke-linecap="round" d="M40 22q0-8 6-12"/>
  <path fill="none" stroke="#ffb09a" stroke-width="3.2" stroke-linecap="round" d="M14 34q1-4 5-6"/>
  <g fill="#ffad9e"><ellipse cx="23" cy="51" rx="4.7" ry="2.5"/><ellipse cx="58" cy="51" rx="4.7" ry="2.5"/></g>
  <g class="expression"></g>
  <path class="sleep-mark" d="M61 10h6l-5 6h6"/>
  <g class="sparkle" fill="#e2ae49"><path d="m12 12 1.6 4.4L18 18l-4.4 1.6L12 24l-1.6-4.4L6 18l4.4-1.6Z"/><path d="m69 8 1.2 3.8L74 13l-3.8 1.2L69 18l-1.2-3.8L64 13l3.8-1.2Z"/></g>
</svg>`

const iconPaths = {
  pause: '<path d="M8 5.5v13m8-13v13" stroke-width="3.7"/>',
  play: '<path d="m8 5 10 7-10 7Z" fill="currentColor" stroke-linejoin="round"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1.4 7.2M4 4.5V10h5.5"/>'
}
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon">${iconPaths[name]}</svg>`
const ring = `<svg class="dial" viewBox="0 0 100 100" aria-hidden="true">
  <circle class="track" cx="50" cy="50" r="46"/>
  <circle class="arc" cx="50" cy="50" r="46" pathLength="100" transform="rotate(-90 50 50)"/>
</svg>`
const pet = `<div class="portrait">${variant === 'dueto' ? ring : ''}${tomato}</div>`
const statusText = '<span class="status" role="status"></span>'
const clock = '<div class="clock" role="timer" aria-label="Time remaining"></div>'
const primary = '<button class="primary"></button>'
const reset = `<button class="reset" title="Reset timer" aria-label="Reset timer">${icon('reset')}</button>`
const bar = '<div class="meter" aria-hidden="true"><div class="fill"></div></div>'
const hero = {
  dueto: `${pet}<div class="readout">${statusText}${clock}<div class="actions">${primary}${reset}</div></div>`,
  ninho: `<div class="perch">${primary}${pet}${reset}</div>${clock}${statusText}${bar}`,
  regua: `<div class="strip">${pet}<div class="readout">${statusText}${clock}</div><div class="actions">${primary}${reset}</div></div>
    <div class="ruler">${bar}<div class="ticks"></div></div>`
}
main.innerHTML = `<div class="widget">
  <section class="hero">${hero[variant]}</section>
  <section class="settings" aria-label="Session length">
    <span class="row-label">Duration</span>
    <div class="choices" role="group" aria-label="Shortcuts in minutes">
      <button data-preset="25" aria-label="25 minutes">25</button><button data-preset="50" aria-label="50 minutes">50</button>
    </div>
    <label class="custom"><input aria-label="Custom minutes" title="Custom minutes" type="number" min="1" max="180" step="1" value="25"> min</label>
  </section>
  <footer><span class="today"></span><button class="clear">Reset day</button></footer>
</div>`

const find = selector => main.querySelector(selector)
const stateLabel = { running: 'Focus', paused: 'Paused', finished: 'Done', idle: 'Ready' }
const faceLabel = { awake: 'Focused tomato', asleep: 'Sleeping tomato', happy: 'Celebrating tomato' }
let state = Object.hasOwn(stateLabel, query.get('state')) ? query.get('state') : 'running'
let minutes = 25
let left = { running: 1122, paused: 960, finished: 0, idle: 1500 }[state]
let endsAt = Date.now() + left * 1000
let count = state === 'finished' ? 4 : 3
let confirmTimeout = null
let renderedState

function draw() {
  const running = state === 'running'
  const editable = state === 'idle' || state === 'finished'
  const fraction = state === 'finished' ? 1 : left / (minutes * 60)
  main.style.setProperty('--progress', (fraction * 100) + '%')
  if (variant === 'dueto') find('.arc').style.strokeDasharray = (fraction * 100) + ' 100'
  const hh = Math.floor(left / 3600)
  const mm = String(Math.floor(left / 60) % 60).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  find('.clock').textContent = (hh ? hh + ':' : '') + mm + ':' + ss
  main.classList.toggle('hours', hh > 0)
  find('.today').textContent = 'Today: ' + count + ' 🍅'
  if (document.activeElement !== find('input')) find('input').value = minutes
  for (const button of main.querySelectorAll('[data-preset]')) {
    button.disabled = !editable
    button.setAttribute('aria-pressed', String(Number(button.dataset.preset) === minutes))
  }
  if (renderedState === state) return
  renderedState = state
  main.dataset.state = state
  const face = running ? 'awake' : state === 'finished' ? 'happy' : 'asleep'
  find('.expression').innerHTML = faces[face]
  find('#pet-title').textContent = faceLabel[face]
  find('.status').textContent = stateLabel[state]
  const label = running ? 'Pause' : state === 'paused' ? 'Resume' : 'Start'
  find('.primary').innerHTML = icon(running ? 'pause' : 'play') +
    (variant === 'dueto' ? '<span>' + label + '</span>' : '')
  find('.primary').setAttribute('aria-label', label)
  find('.primary').title = label
  find('.reset').disabled = state === 'idle'
  find('input').disabled = !editable
}

function tick() {
  if (state !== 'running') return
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  if (remaining === left) return
  left = remaining
  if (!left) {
    state = 'finished'
    count++
  }
  draw()
}

find('.primary').onclick = () => {
  if (state === 'running') {
    tick()
    if (state === 'running') state = 'paused'
  } else {
    if (state !== 'paused') left = minutes * 60
    endsAt = Date.now() + left * 1000
    state = 'running'
  }
  draw()
}
function resetTimer() {
  left = minutes * 60
  state = 'idle'
  draw()
}
find('.reset').onclick = resetTimer
find('input').onchange = event => {
  minutes = Math.max(1, Math.min(180, Math.round(Number(event.target.value))))
  event.target.value = minutes
  resetTimer()
}
find('input').onkeydown = event => { if (event.key === 'Enter') event.target.blur() }
for (const button of main.querySelectorAll('[data-preset]')) {
  button.onclick = () => {
    minutes = Number(button.dataset.preset)
    resetTimer()
  }
}
function disarm() {
  clearTimeout(confirmTimeout)
  confirmTimeout = null
  find('.clear').textContent = 'Reset day'
}
find('.clear').onclick = () => {
  if (confirmTimeout === null) {
    find('.clear').textContent = 'Confirm?'
    confirmTimeout = setTimeout(disarm, 3000)
  } else {
    disarm()
    count = 0
    draw()
  }
}
draw()
setInterval(tick, 250)
