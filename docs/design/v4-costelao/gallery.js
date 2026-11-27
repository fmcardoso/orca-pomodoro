const params = new URLSearchParams(location.search)
const gallery = document.querySelector('#gallery')
const themeParam = params.get('theme')
let dark = themeParam === 'dark' || (themeParam !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
document.documentElement.classList.toggle('dark', dark)

const states = {running: 'Focused', paused: 'Sleeping', finished: 'Happy'}
const still = params.has('sheet')
let selected = 1
let pose = 'running'

function labelFor(option) {
  return option.id === 'ref' ? 'Reference' : 'Option ' + option.id.toUpperCase()
}

function pair(index, state) {
  const option = faceOptions[index]
  const card = document.createElement('iframe')
  card.title = option.name + ' in Dueto · ' + states[state]
  card.src = 'card.html?' + new URLSearchParams({
    face: option.id, state, theme: dark ? 'dark' : 'light', ...(still ? {still: '1'} : {})
  })
  const zoom = document.createElement('div')
  zoom.className = 'zoom'
  zoom.innerHTML = faceSVG(index, state, {zoom: 4, frame: still ? 0 : undefined})
  const sample = document.createElement('div')
  sample.className = 'pair'
  sample.append(card, zoom)
  return sample
}

function sheet() {
  gallery.className = 'sheet'
  gallery.innerHTML = `<header><div><h1>Costelão expressions</h1>
    <p>Dueto card at actual size · detail enlarged 4×</p></div>
    <div class="theme-label">32 × 32 px<br>${dark ? 'Dark' : 'Light'} theme</div></header>
    <table><thead><tr><th scope="col">Face</th>${Object.values(states).map(label => '<th scope="col">' + label + '</th>').join('')}</tr></thead>
    <tbody></tbody></table>`
  for (const [index, option] of faceOptions.entries()) {
    const row = gallery.querySelector('tbody').insertRow()
    row.innerHTML = `<th scope="row"><span class="number">${labelFor(option)}</span><strong>${option.name}</strong></th>`
    for (const state of Object.keys(states)) row.insertCell().append(pair(index, state))
  }
}

function strips() {
  gallery.className = 'strips'
  for (const [index, option] of faceOptions.entries()) {
    const strip = document.createElement('article')
    strip.id = 'strip-' + option.id
    strip.innerHTML = `<header><h1>${labelFor(option)} · ${option.name}</h1><p>${option.detail}</p></header>
      <table><thead><tr><th>State</th>${[1,2,3,4].map(n => '<th scope="col">Frame ' + n + '</th>').join('')}</tr></thead><tbody></tbody></table>`
    for (const [state, label] of Object.entries(states)) {
      const row = strip.querySelector('tbody').insertRow()
      row.innerHTML = '<th scope="row">' + label + '</th>'
      for (let frame = 0; frame < 4; frame++) row.insertCell().innerHTML = faceSVG(index, state, {zoom: 2, frame})
    }
    gallery.append(strip)
  }
}

function radio(name, value, label, checked) {
  return `<label><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${label}</span></label>`
}

function showSample() {
  const option = faceOptions[selected]
  gallery.querySelector('h2').textContent = option.name
  gallery.querySelector('#detail').textContent = option.detail
  gallery.querySelector('#sample').replaceChildren(pair(selected, pose))
}

function preview() {
  gallery.className = 'chooser'
  gallery.innerHTML = `<header><div><h1>Costelão expressions</h1><p>32 × 32 pixel tomato for Dueto.</p></div>
    <fieldset class="segments"><legend>Theme</legend>${radio('theme','light','Light',!dark)}${radio('theme','dark','Dark',dark)}</fieldset></header>
    <fieldset class="pets"><legend>Face</legend>${faceOptions.map((option, i) => radio('face', i,
      '<span class="thumbnail">' + faceSVG(i, 'running', {frame: 0}) + '</span><small>' + labelFor(option) + '</small><b>' + option.name + '</b>', i === selected)).join('')}</fieldset>
    <section class="detail"><div class="detail-head"><div><h2></h2><p id="detail"></p></div>
      <fieldset class="segments"><legend>Expression</legend>${Object.entries(states).map(([state, label]) => radio('pose',state,label,pose === state)).join('')}</fieldset></div>
      <div class="scale"><span>Dueto card · 1×</span><span>Detail · 4×</span></div><div id="sample"></div></section>
    <nav aria-label="Sheets"><a href="sheet.png">Light sheet</a><a href="sheet-dark.png">Dark sheet</a><a href="?frames">Animation frames</a></nav>`
  gallery.addEventListener('change', ({target}) => {
    if (target.name === 'pose') pose = target.value
    if (target.name === 'face') selected = Number(target.value)
    if (target.name === 'theme') {
      dark = target.value === 'dark'
      document.documentElement.classList.toggle('dark', dark)
    }
    showSample()
  })
  window.addEventListener('message', ({source, data}) => {
    if (source !== gallery.querySelector('iframe').contentWindow || data?.type !== 'costelao' ||
        data.face !== selected || !Object.hasOwn(spriteStates, data.state)) return
    pose = data.state === 'idle' ? 'paused' : data.state
    gallery.querySelector('input[name="pose"][value="' + pose + '"]').checked = true
    gallery.querySelector('.zoom').innerHTML = faceSVG(selected, pose, {zoom: 4})
  })
  showSample()
}

if (still) sheet()
else if (params.has('frames')) strips()
else preview()
