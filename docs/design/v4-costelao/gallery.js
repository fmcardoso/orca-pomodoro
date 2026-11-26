const params = new URLSearchParams(location.search)
const gallery = document.querySelector('#gallery')
const themeParam = params.get('theme')
let dark = themeParam === 'dark' || (themeParam !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
document.documentElement.classList.toggle('dark', dark)

const states = {running: 'Concentrado', paused: 'Dormindo', finished: 'Feliz'}
const still = params.has('sheet')
let selected = 1
let pose = 'running'

function labelFor(option) {
  return option.id === 'ref' ? 'Referência' : 'Opção ' + option.id.toUpperCase()
}

function pair(index, state) {
  const option = faceOptions[index]
  const card = document.createElement('iframe')
  card.title = option.name + ' no Dueto · ' + states[state]
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
  gallery.innerHTML = `<header><div><h1>Expressões do Costelão</h1>
    <p>Cartão Dueto em tamanho real · detalhe ampliado 4×</p></div>
    <div class="theme-label">32 × 32 px<br>Tema ${dark ? 'escuro' : 'claro'}</div></header>
    <table><thead><tr><th scope="col">Rosto</th>${Object.values(states).map(label => '<th scope="col">' + label + '</th>').join('')}</tr></thead>
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
      <table><thead><tr><th>Estado</th>${[1,2,3,4].map(n => '<th scope="col">Quadro ' + n + '</th>').join('')}</tr></thead><tbody></tbody></table>`
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
  gallery.innerHTML = `<header><div><h1>Expressões do Costelão</h1><p>Tomate de 32 × 32 pixels para o Dueto.</p></div>
    <fieldset class="segments"><legend>Tema</legend>${radio('theme','light','Claro',!dark)}${radio('theme','dark','Escuro',dark)}</fieldset></header>
    <fieldset class="pets"><legend>Rosto</legend>${faceOptions.map((option, i) => radio('face', i,
      '<span class="thumbnail">' + faceSVG(i, 'running', {frame: 0}) + '</span><small>' + labelFor(option) + '</small><b>' + option.name + '</b>', i === selected)).join('')}</fieldset>
    <section class="detail"><div class="detail-head"><div><h2></h2><p id="detail"></p></div>
      <fieldset class="segments"><legend>Expressão</legend>${Object.entries(states).map(([state, label]) => radio('pose',state,label,pose === state)).join('')}</fieldset></div>
      <div class="scale"><span>Cartão Dueto · 1×</span><span>Detalhe · 4×</span></div><div id="sample"></div></section>
    <nav aria-label="Pranchas"><a href="sheet.png">Prancha clara</a><a href="sheet-dark.png">Prancha escura</a><a href="?frames">Quadros de animação</a></nav>`
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
