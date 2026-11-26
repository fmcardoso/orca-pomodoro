// The reference, body stamps and palette come directly from the v3 Costelão.
const costelaoIndex = tomatoes.findIndex(tomato => tomato.name === 'Costelão')
const costelao = tomatoes[costelaoIndex]
const faceOptions = [
  { id: 'ref', name: 'Original', detail: '03 Costelão · referência de v3' },
  {
    id: 'a', name: 'Pontinho', detail: 'Olhos de botão e um sorriso curto.',
    eyes: [10, 20, 17], awake: ['II', 'II'], asleep: ['I.I', 'III'],
    happy: ['IIII', 'I..I'], smile: ['I..I', '.II.'], cheeks: ['BBB'],
    laugh: ['IIIII', 'IIIII', '.IBI.', '..I..']
  },
  {
    id: 'b', name: 'Brilho', detail: 'Um ponto de luz em cada olho e bochechas redondas.',
    eyes: [9, 20, 16], awake: ['III', 'IHI', 'III', '.I.'], asleep: ['I..I', 'IIII'],
    happy: ['.II.', 'IHII', 'IIII', '.II.'], smile: ['I..I', 'IIII'], cheeks: ['.BB.', 'BBBB'],
    laugh: ['IIIII', 'IIIII', 'IBBBI', '.III.']
  },
  {
    id: 'c', name: 'Sossego', detail: 'Pálpebras baixas e um sorriso tranquilo.',
    eyes: [9, 20, 17], awake: ['DDDD', '.II.'], asleep: ['I..I', 'IIII'],
    happy: ['IIIII', 'I...I'], smile: ['I...I', '.III.'], cheeks: ['BBB'],
    laugh: ['IIIIII', '.IIII.', '.IBBI.']
  }
]

const spriteInks = { ...costelao.colors, Z: 'var(--sleep-ink)', S: 'var(--star-ink)' }

function stampPixels(x, y, rows) {
  const output = []
  for (const [dy, row] of rows.entries()) {
    for (const match of row.matchAll(/([^.])\1*/g)) {
      output.push(`<rect x="${x + match.index}" y="${y + dy}" width="${match[0].length}" height="1" fill="${spriteInks[match[1]]}"/>`)
    }
  }
  return output.join('')
}

const costelaoBody = costelao.body.map(([x, y, ...rows]) => stampPixels(x, y, rows)).join('')

function drawFace(option, state, frame) {
  const happy = state === 'finished'
  const sleeping = state === 'paused'
  const blink = state === 'running' && frame === 3
  const [left, right, y] = option.eyes
  const eyes = happy ? option.happy : sleeping || blink ? option.asleep : option.awake
  const eyeY = happy ? 16 : sleeping || blink ? 18 : y
  const cheekY = happy ? 19 : 20
  const rightCheek = option.cheeks[0].length === 4 ? 22 : 23
  const mouth = happy ? option.laugh : sleeping ? [frame === 2 ? 'II' : 'I'] : option.smile
  const face = [
    stampPixels(left, eyeY, eyes), stampPixels(right, eyeY, eyes),
    stampPixels(6, cheekY, option.cheeks), stampPixels(rightCheek, cheekY, option.cheeks),
    stampPixels(Math.floor((32 - mouth[0].length) / 2), 21, mouth)
  ].join('')

  const lift = happy ? [0, 1, 2, 0][frame] : Number(state === 'running' && frame === 2)
  let effect = ''
  if (sleeping) {
    const [x, y] = costelao.sleep
    effect = stampPixels(x, y + [1, 0, -1, 0][frame], ['ZZZZ', '..Z.', '.Z..', 'ZZZZ'])
    if (frame === 1 || frame === 2) effect += stampPixels(x - 3, y + 4, ['ZZ', '.Z', 'ZZ'])
  }
  if (happy) {
    costelao.stars.forEach(([x, y], i) => {
      effect += stampPixels(x, y - Number(frame === 2), (frame + i) % 2 ? ['S'] : ['.S.', 'SSS', '.S.'])
    })
  }
  return `<g transform="translate(0 ${-lift})">${costelaoBody}${face}</g>${effect}`
}

function faceSVG(index, state, { zoom = 1, frame } = {}) {
  if (index === 0) return spriteSVG(costelaoIndex, state, { zoom, frame })
  const option = faceOptions[index]
  const pose = state === 'idle' ? 'paused' : state
  const size = costelao.grid * costelao.scale * zoom
  const art = frame === undefined
    ? '<g class="reel ' + pose + '">' + [0, 1, 2, 3].map(i =>
      `<g transform="translate(${32 * i} 0)">${drawFace(option, pose, i)}</g>`).join('') + '</g>'
    : drawFace(option, pose, frame)
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pixel-pet" role="img" aria-label="${option.name} · ${spriteStates[state]}" width="${size}" height="${size}" viewBox="0 0 32 32">${art}</svg>`
}
