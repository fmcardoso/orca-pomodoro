// A character is one source pixel. Faces, movement and effects use the same grid.
// Keep each palette local so the six characters also read differently in silhouette.
const tomatoes = [
  {
    name: 'Pingo', style: 'Outline-free cherry tomato', grid: 16, scale: 4,
    colors: { L: '#36725c', l: '#83b47a', R: '#f36951', r: '#d8483c', H: '#ffc49a', I: '#462938', B: '#ffa397' },
    body: [
      [6,1,'..lL', '.lLL', 'LlLL.lL'],
      [1,4,'...RRRLLLRR', '..RRRRRLRRRrr', '.RHHHRRRRRRRrr', 'RRHHRRRRRRRRRr',
        'RRRRRRRRRRRRRr', 'RRRRRRRRRRRRRr', 'RRRRRRRRRRRRRr', '.RRRRRRRRRRRrr',
        '..RRRRRRRRRrr', '...rRRRRRrrr', '.....rrrrr'],
      [4,4,'llL.LL.ll', '.LLLLLLL', '...LL.L']
    ],
    eyes: [[5,8],[10,8]], mouth: [7,10], cheeks: [[3,10],[11,10]],
    expression: 'dots', sleep: [12,0], stars: [[0,2],[13,1]]
  },
  {
    name: 'Roma', style: 'Roma tomato in boots', grid: 24, scale: 3,
    colors: { L: '#24634e', l: '#77a765', R: '#ed6541', r: '#c14632', D: '#993b38', H: '#ffbc79', I: '#482d38', B: '#ffa180' },
    body: [
      [7,1,'.....lL', '.....LL', '...llL', '.LLlLL', 'LLL.LL'],
      [3,5,'.........RRRR', '.......RRRRRRrr', '.....RRHHHRRRRrr',
        '....RRHHHRRRRRRrr', '...RRHHRRRRRRRRrr', '..RRHHRRRRRRRRRrr', '.RRRRRRRRRRRRRRrr',
        '.RRRRRRRRRRRRRrr', 'RRRRRRRRRRRRRRrr', 'RRRRRRRRRRRRRrr', 'RRRRRRRRRRRRrr',
        'rRRRRRRRRRRrr', 'rrRRRRRRRrrr', '.rrRRRRrrrD', '..rrrrrrDD', '....DDDD'],
      [9,4,'....L.llLL', '.lLLLLLLL', 'LLLLLL', '...LL.L', '...L..L'],
      [5,20,'..DD...DD', '.DDD...DD', 'DDDD...DDDD']
    ],
    eyes: [[8,12],[14,11]], mouth: [11,14], cheeks: [[6,14],[16,13]],
    expression: 'runner', sleep: [20,1], stars: [[2,8],[19,3]]
  },
  {
    name: 'Costelão', style: 'Ribbed persimmon tomato', grid: 32, scale: 2,
    colors: { L: '#397456', l: '#84a766', V: '#a8bf70', R: '#e9614c', r: '#cb4b40', D: '#a33d3b', H: '#ff9d79', I: '#522c33', B: '#fa9b83' },
    body: [
      [1,9,'.....rrRRR...rrRRRRR...Rrr', '...rRRRRRRRrRRRRRRRRRrRRRRrr',
        '..rRRRHHHHRRRRHHHHRRRRRHHRRRr', '.rRRRHHRRRrRRHHHHRRRrRRRHHHRrr',
        '.RRRHHRRRrRRHHRRRRRRrrRRRRHHRr', 'rRRHHRRRrrRRRRRRRRRRRrRRRRRRRrr',
        'RRHHRRRRrRRRRRRRRRRRRrrRRRRRRrr', 'RRRRRRRrrRRRRRRRRRRRRRrRRRRRRrr',
        'RRRRRRRrRRRRRRRRRRRRRRrRRRRRRrr', 'RRRRRRRrRRRRRRRRRRRRRRrRRRRRRrr',
        'rRRRRRRrRRRRRRRRRRRRRRrRRRRRRrr', 'rRRRRRRrRRRRRRRRRRRRRrrRRRRRrrr',
        '.rRRRRRrRRRRRRRRRRRRRrRRRRRRrr', '.rRRRRRrrRRRRRRRRRRRrrRRRRRrrD',
        '..rRRRRRrRRRRRRRRRRRrrRRRRrrD', '...rrRRRrrRRRRRRRRRrrRRRRrrD',
        '....DrrrrrrRRRRRRRrrrrrrrrD', '......DDDDrrrrrrrrrDDDDD', '...........DDDDDDD'],
      [6,2,'............llL', '...........llL', '..........llL', '.........lLL',
        '..ll....lLLL....ll', '...lLL..LLL..llLL', '....lLLLLLLLLLLL',
        '......LLLLLLLL', '...llLLLLLLLLLLL', 'llLLLLL..LLL..LLLL', '........LLL.....LL', '........LL']
    ],
    eyes: [[10,17],[20,17]], mouth: [14,21], cheeks: [[7,20],[23,20]],
    expression: 'brows', sleep: [25,4], stars: [[2,6],[27,5]]
  },
  {
    name: 'Cartucho', style: 'Four arcade colors', grid: 16, scale: 4,
    colors: { I: '#402f4a', L: '#996064', R: '#e78568', H: '#ffdb9b' },
    body: [
      [2,1,'...II...II', '...ILI.ILI', '....ILILI'],
      [1,4,'...IIIIIIII', '.IIRRRLLRRRII', 'IHRRRRILRRRRRI', 'IHRRRRRRRRRRRI',
        'IHRHHHHHHHHRRI', 'IRRHHHHHHHHRRI', 'IRRHHHHHHHHRLI', 'IRRRRRRRRRRRLI',
        '.ILRRRRRRRRLI', '..IILLLLLLII', '...II....II'],
      [4,5,'..LLILL', '.LLLILLL', '....I']
    ],
    eyes: [[5,9],[10,9]], mouth: [7,11], cheeks: [],
    expression: 'console', sleep: [0,0], stars: [[0,2],[13,0]]
  },
  {
    name: 'Duplinha', style: 'Two cherries on one vine', grid: 24, scale: 3,
    colors: { L: '#367260', l: '#80ad77', R: '#eb654c', r: '#c34942', A: '#f59c4d', a: '#d37b46', H: '#ffcb93', I: '#492f37', B: '#ffafa1' },
    body: [
      [4,1,'......llL...ll', '......lLL..lLL', '.......LLlLLL', '......lLLLL',
        '.....LLL.LL', '....LLL...LL', '...LLL.....LL', '...LL.......LL', '..LL.........LL', '..LL..........LL'],
      [11,9,'....AAA..AA', '..AAAHAAAaaa', '.AAHHAAAAAAa', '.AAHAAAAAAAa',
        'AAAAAAAAAAAaa', 'AAAAAAAAAAAaa', '.AAAAAAAAAAa', '.aAAAAAAAAaa', '..aAAAAAAaa', '...aaAAaaa', '.....aaa'],
      [0,10,'.....RRR', '...RRRRRRRr', '..RRHRRRRRRr', '.RRHHRRRRRRRr',
        '.RRHRRRRRRRRr', 'RRRRRRRRRRRRrr', 'RRRRRRRRRRRRrr', 'RRRRRRRRRRRRrr',
        '.rRRRRRRRRRrr', '..rRRRRRRRrr', '...rrRRRRrr', '.....rrrr'],
      [3,9,'....L', '..lLLL', 'LLLLLLL', '...LL'],
      [15,8,'..L', '.LLLl', 'LL.LLL']
    ],
    eyes: [[4,16],[9,16]], mouth: [6,18], cheeks: [[2,18],[10,18]],
    expression: 'twins', sleep: [19,2], stars: [[1,5],[20,3]]
  },
  {
    name: 'Broto', style: 'Yellow sprout tomato', grid: 24, scale: 3,
    colors: { L: '#337565', l: '#72a767', V: '#b2c879', R: '#efb653', r: '#e39645', D: '#bd7343', H: '#ffe39a', I: '#4b3541', B: '#ef956a', W: '#fff4da' },
    body: [
      [3,8,'.....RRRRRr', '...RRRRRHHRRr', '..RRHHHRRRRRRRr', '.RRHHHRRRRRRRRRr',
        '.RHHHRRRRRRRRRRr', 'RRHHRRRRRRRRRRRRr', 'RRHRRRRRRRRRRRRRr', 'RRRRRRRRRRRRRRRRr',
        'RHRRRRRRRRRRRRRRr', 'RRRRRRRRRRRRRRRRr', 'RRRRRRRRRRRRRRRrr',
        '.RRRRRRRRRRRRRrr', '..rRRRRRRRRRRrr', '...rrRRRRRRrrr', '.....rrrrrrr'],
      [2,1,'.............lVVVl', '..ll........lVVVll', '.lVVlll....lVVVll',
        '..llllll..lVVlll', '....llLLL.Llll', '......LLLLLL', '........LLL', '......llLLLll', '....llllLLLLLLL','.......LLL...LL']
    ],
    eyes: [[7,16],[14,16]], mouth: [10,19], cheeks: [[5,19],[16,19]],
    expression: 'big', sleep: [20,5], stars: [[1,8],[20,4]]
  }
]

const spriteStates = {
  running: 'Focused', paused: 'Sleeping', finished: 'Happy', idle: 'Sleeping'
}

function spriteFrame(pet, state, frame) {
  const size = pet.grid
  const pixels = Array.from({ length: size }, () => Array(size).fill('.'))
  // Silhouettes are drawn in place. Only a settled pose gets the happy jump.
  const lift = state === 'finished' ? [0, 1, size === 32 ? 2 : 1, 0][frame] :
    state === 'running' && frame === 2 ? 1 : 0
  function stamp(x, y, rows, raised = true) {
    rows.forEach((row, dy) => [...row].forEach((ink, dx) => {
      const line = pixels[y + dy - (raised ? lift : 0)]
      if (ink !== '.' && line && x + dx >= 0 && x + dx < size) line[x + dx] = ink
    }))
  }
  for (const [x, y, ...rows] of pet.body) stamp(x, y, rows)
  const sleeping = state === 'paused' || state === 'idle'
  const happy = state === 'finished'
  const blink = state === 'running' && frame === 3
  for (const [x, y] of pet.cheeks) stamp(x, y, ['BB'])
  for (const [index, [x, y]] of pet.eyes.entries()) {
    let eye
    if (sleeping || blink) {
      eye = pet.expression === 'big' || pet.expression === 'brows' ? ['I.I','.I.'] : ['II']
    } else if (happy) {
      eye = ['.I.', 'I.I']
    } else {
      switch (pet.expression) {
        case 'big': eye = ['III','IWI','III']; break
        case 'brows': eye = index === 0 ? ['II.','.II','.II'] : ['.II','II.','II.']; break
        case 'runner': eye = ['II','.I']; break
        case 'console': eye = ['II','II']; break
        default: eye = ['I','I']
      }
    }
    stamp(x - (happy ? 1 : 0), y - (happy ? 1 : 0), eye)
  }
  const [mx,my] = pet.mouth
  const small = size === 16 || pet.expression === 'twins'
  stamp(mx, my, sleeping ? ['.I'] : happy ? (small ? ['III','.H.'] : ['III','III','.H']) :
    pet.expression === 'big' ? ['I.I','.I.'] : ['II'])
  if (pet.expression === 'twins') {
    stamp(15,13, happy ? ['.I...I','I.I.I.I'] : sleeping || blink ? ['II..II'] : ['I...I','I...I'])
    stamp(17,15, happy ? ['II','.I'] : ['I'])
  }
  if (sleeping) {
    const [x,y] = pet.sleep
    stamp(x, y + (frame === 0 || frame === 3 ? 1 : 0), ['ZZZZ','..Z.','.Z..','ZZZZ'], false)
    if (size >= 24 && (frame === 1 || frame === 2)) stamp(x - 3, y + 4, ['ZZ','.Z','ZZ'], false)
  }
  if (happy) {
    pet.stars.forEach(([x,y], i) => {
      stamp(x, y + (frame === 2 ? -1 : 0), (frame + i) % 2 ? ['S'] : ['.S.','SSS','.S.'], false)
    })
  }
  // Merge horizontal runs of the same ink; all geometry stays on the sprite grid.
  const paths = new Map()
  pixels.forEach((row, y) => {
    for (let x = 0; x < size;) {
      const ink = row[x]
      let end = x + 1
      while (end < size && row[end] === ink) end++
      if (ink !== '.') {
        const w = end - x
        paths.set(ink, (paths.get(ink) || '') + 'M' + x + ' ' + y + 'h' + w + 'v1h-' + w + 'z')
      }
      x = end
    }
  })
  const colors = { Z: 'var(--sleep-ink)', S: 'var(--star-ink)', ...pet.colors }
  if (pet.expression === 'console') {
    colors.S = pet.colors.R
    colors.Z = pet.colors.L
  }
  return [...paths].map(([ink, d]) => '<path fill="' + colors[ink] + '" d="' + d + '"/>').join('')
}

function spriteSVG(index, state, { zoom = 1, frame } = {}) {
  const pet = tomatoes[index]
  const size = pet.grid * pet.scale * zoom
  const pose = state === 'idle' ? 'paused' : state
  let art
  if (frame === undefined) {
    const frames = [0,1,2,3].map(i => '<g transform="translate(' + pet.grid * i + ' 0)">' +
      spriteFrame(pet, pose, i) + '</g>').join('')
    art = '<g class="reel ' + pose + '">' + frames + '</g>'
  } else {
    art = spriteFrame(pet, pose, frame)
  }
  return '<svg class="pixel-pet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
    pet.name + ' · ' + spriteStates[state] + '" width="' + size + '" height="' + size +
    '" viewBox="0 0 ' + pet.grid + ' ' + pet.grid + '">' + art + '</svg>'
}
