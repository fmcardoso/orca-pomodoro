const selectedFace = Math.max(0, faceOptions.findIndex(option => option.id === query.get('face')))
const portrait = main.querySelector('.portrait')
function showExpression() {
  const state = main.dataset.state
  portrait.querySelector('.pixel-pet')?.remove()
  portrait.insertAdjacentHTML('beforeend', faceSVG(selectedFace, state, {frame: query.has('still') ? 0 : undefined}))
  const svg = portrait.querySelector('.pixel-pet')
  const box = portrait.getBoundingClientRect()
  const size = svg.width.baseVal.value
  svg.style.left = Math.round(box.x + (box.width - size) / 2) - box.x + 'px'
  svg.style.top = Math.round(box.y + (box.height - size) / 2) - box.y + 'px'
  parent.postMessage({type: 'costelao', face: selectedFace, state}, '*')
}
showExpression()
new MutationObserver(showExpression).observe(main, {attributes: true, attributeFilter: ['data-state']})
