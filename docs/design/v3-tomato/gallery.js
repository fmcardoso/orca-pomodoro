const params = new URLSearchParams(location.search)
const gallery = document.getElementById('gallery')
const still = params.has('sheet')
const states = ['running', 'paused', 'finished']
const labels = ['Focused', 'Sleeping', 'Happy']
const theme = params.get('theme')
let dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
let selected = 0
let pose = 'running'
document.documentElement.classList.toggle('dark', dark)
const number = i => String(i + 1).padStart(2, '0')

function pair(index, state) {
  const sample = document.createElement('div')
  sample.className = 'pair'
  const preview = document.createElement('iframe')
  preview.title = tomatoes[index].name + ' in Dueto · ' + spriteStates[state]
  preview.width = 340
  preview.height = 250
  preview.src = 'card.html?' + new URLSearchParams({
    pet: index + 1, state, theme: dark ? 'dark' : 'light', ...(still ? {still: '1'} : {})
  })
  const zoom = document.createElement('div')
  zoom.className = 'zoom'
  zoom.innerHTML = spriteSVG(index, state, {zoom: 4, frame: still ? 0 : undefined})
  sample.append(preview, zoom)
  return sample
}

function sheet() {
  gallery.className = 'sheet'
  gallery.innerHTML = '<header><h1>Pixel tomatoes</h1><p>Dueto at actual size · detail enlarged 4×</p></header>'
  const table = document.createElement('table')
  table.innerHTML = '<thead><tr><th class="theme">' + (dark ? 'Dark theme' : 'Light theme') +
    '</th>' + labels.map(label => '<th scope="col">' + label + '</th>').join('') + '</tr></thead><tbody></tbody>'
  const tbody = table.querySelector('tbody')
  tomatoes.forEach((pet, i) => {
    const row = tbody.insertRow()
    const label = document.createElement('th')
    label.scope = 'row'
    label.innerHTML = '<span class="number">' + number(i) + '</span><strong>' + pet.name +
      '</strong><small>' + pet.grid + ' × ' + pet.grid + '</small>'
    row.append(label)
    for (const state of states) row.insertCell().append(pair(i, state))
  })
  gallery.append(table)
}

function frameStrips() {
  gallery.className = 'strips'
  tomatoes.forEach((pet, i) => {
    const strip = document.createElement('article')
    strip.id = 'strip-' + (i + 1)
    strip.innerHTML = '<header><h1>' + number(i) + ' · ' + pet.name +
      '</h1><p>Four frames per state · read left to right →</p></header>'
    const table = document.createElement('table')
    table.innerHTML = '<tbody></tbody>'
    states.forEach((state, s) => {
      const row = table.tBodies[0].insertRow()
      const label = document.createElement('th')
      label.scope = 'row'
      label.textContent = labels[s]
      row.append(label)
      for (let frame = 0; frame < 4; frame++) {
        row.insertCell().innerHTML = spriteSVG(i, state, {frame, zoom: 2})
      }
    })
    strip.append(table)
    gallery.append(strip)
  })
}

function radio(name, value, label, checked) {
  return '<label><input type="radio" name="' + name + '" value="' + value + '"' +
    (checked ? ' checked' : '') + '><span>' + label + '</span></label>'
}
function swap() {
  gallery.querySelector('#sample').replaceChildren(pair(selected, pose))
  gallery.querySelector('#detail-name').textContent = number(selected) + ' · ' + tomatoes[selected].name
  const art = tomatoes[selected]
  gallery.querySelector('#detail-grid').textContent = art.grid + ' × ' + art.grid + ' px · ' + art.style
}
function chooser() {
  gallery.className = 'chooser'
  gallery.innerHTML = `<header><div><h1>Pixel tomatoes</h1><p>Pick the companion for Dueto.</p></div>
    <fieldset class="segments"><legend>Theme</legend>${radio('theme','light','Light',!dark)}${radio('theme','dark','Dark',dark)}</fieldset></header>
    <fieldset class="pets"><legend>Tomato</legend>${tomatoes.map((pet,i) => radio('pet',i,
      '<span class="thumbnail">' + spriteSVG(i,'running',{frame:0}) + '</span><b>' + number(i) + ' · ' + pet.name + '</b>', i === selected)).join('')}</fieldset>
    <section class="detail"><div class="detail-head"><div><h2 id="detail-name"></h2><p id="detail-grid"></p></div>
      <fieldset class="segments"><legend>Expression</legend>${states.map((s,i) => radio('pose',s,labels[i],s === pose)).join('')}</fieldset></div>
      <div class="scale"><span>Dueto card · 1×</span><span>Sprite · 4×</span></div><div id="sample"></div>
    </section>`
  gallery.addEventListener('change', event => {
    if (event.target.name === 'pet') selected = Number(event.target.value)
    if (event.target.name === 'pose') pose = event.target.value
    if (event.target.name === 'theme') {
      dark = event.target.value === 'dark'
      document.documentElement.classList.toggle('dark', dark)
    }
    swap()
  })
  window.addEventListener('message', event => {
    const iframe = gallery.querySelector('iframe')
    const data = event.data
    if (event.source !== iframe.contentWindow || data?.type !== 'dueto-pet' ||
      data.pet !== selected || !Object.hasOwn(spriteStates, data.state)) return
    pose = data.state
    gallery.querySelector('input[value="' + (pose === 'idle' ? 'paused' : pose) + '"][name="pose"]').checked = true
    gallery.querySelector('.zoom').innerHTML = spriteSVG(selected, pose, {zoom: 4})
  })
  swap()
}

if (still) sheet()
else if (params.has('frames')) frameStrips()
else chooser()
