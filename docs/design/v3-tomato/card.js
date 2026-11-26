// The parent page can also be opened via file://, where an iframe has an opaque origin.
// Post only the displayed state and dimensions to keep the enlarged sprite in sync.
const requestedPet = Number(query.get('pet') || 1) - 1
const petIndex = Number.isInteger(requestedPet) && tomatoes[requestedPet] ? requestedPet : 0
const still = query.has('still') ? 0 : undefined
const portrait = main.querySelector('.portrait')
function alignSprite() {
  const svg = portrait.querySelector('.pixel-pet')
  const box = portrait.getBoundingClientRect()
  const width = svg.width.baseVal.value
  svg.style.left = Math.round(box.x + (box.width - width) / 2) - box.x + 'px'
  svg.style.top = Math.round(box.y + (box.height - width) / 2) - box.y + 'px'
}
function refreshPet() {
  portrait.querySelector('.pixel-pet')?.remove()
  portrait.insertAdjacentHTML('beforeend', spriteSVG(petIndex, main.dataset.state, { frame: still }))
  alignSprite()
  if (parent !== window) parent.postMessage({
    type: 'dueto-pet', pet: petIndex, state: main.dataset.state,
    height: Math.ceil(main.getBoundingClientRect().height)
  }, '*')
}
refreshPet()
new MutationObserver(refreshPet).observe(main, { attributes: true, attributeFilter: ['data-state'] })
new ResizeObserver(alignSprite).observe(main)
