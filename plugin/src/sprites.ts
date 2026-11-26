// The pet: 03 Costelão (32 × 32 pixel art) with face A · Pontinho, ported unchanged from the
// design rounds (docs/design/v3-tomato/sprites.js for the body and palette,
// docs/design/v4-costelao/faces.js for the face, Z and sparkles). Pure data, no DOM, so tests run
// it in Node; panel-main.ts turns the runs into <rect>s.
import type { Face } from './panel-view.ts'

export const GRID = 32
/** CSS pixels per sprite pixel in the Dueto card (a 64 × 64 sprite). */
export const SCALE = 2
export const FRAMES = 4

/** Ink letters. `Z` (sleep mark) and `S` (sparkle) follow the theme through CSS classes. */
export const COLORS: Record<string, string> = {
  L: '#397456',
  l: '#84a766',
  V: '#a8bf70',
  R: '#e9614c',
  r: '#cb4b40',
  D: '#a33d3b',
  H: '#ff9d79',
  I: '#522c33',
  B: '#fa9b83'
}
export const THEMED_INKS: Record<string, string> = { Z: 'ink-sleep', S: 'ink-star' }

type Stamp = [x: number, y: number, ...rows: string[]]

const BODY: Stamp[] = [
  [1, 9, '.....rrRRR...rrRRRRR...Rrr', '...rRRRRRRRrRRRRRRRRRrRRRRrr',
    '..rRRRHHHHRRRRHHHHRRRRRHHRRRr', '.rRRRHHRRRrRRHHHHRRRrRRRHHHRrr',
    '.RRRHHRRRrRRHHRRRRRRrrRRRRHHRr', 'rRRHHRRRrrRRRRRRRRRRRrRRRRRRRrr',
    'RRHHRRRRrRRRRRRRRRRRRrrRRRRRRrr', 'RRRRRRRrrRRRRRRRRRRRRRrRRRRRRrr',
    'RRRRRRRrRRRRRRRRRRRRRRrRRRRRRrr', 'RRRRRRRrRRRRRRRRRRRRRRrRRRRRRrr',
    'rRRRRRRrRRRRRRRRRRRRRRrRRRRRRrr', 'rRRRRRRrRRRRRRRRRRRRRrrRRRRRrrr',
    '.rRRRRRrRRRRRRRRRRRRRrRRRRRRrr', '.rRRRRRrrRRRRRRRRRRRrrRRRRRrrD',
    '..rRRRRRrRRRRRRRRRRRrrRRRRrrD', '...rrRRRrrRRRRRRRRRrrRRRRrrD',
    '....DrrrrrrRRRRRRRrrrrrrrrD', '......DDDDrrrrrrrrrDDDDD', '...........DDDDDDD'],
  [6, 2, '............llL', '...........llL', '..........llL', '.........lLL',
    '..ll....lLLL....ll', '...lLL..LLL..llLL', '....lLLLLLLLLLLL',
    '......LLLLLLLL', '...llLLLLLLLLLLL', 'llLLLLL..LLL..LLLL', '........LLL.....LL', '........LL']
]

/** Face A · Pontinho: button eyes, soft blush, short smile; closed arcs when it celebrates. */
const FACE = {
  eyes: [10, 20, 17] as const,
  awake: ['II', 'II'],
  asleep: ['I.I', 'III'],
  happy: ['IIII', 'I..I'],
  smile: ['I..I', '.II.'],
  cheeks: ['BBB'],
  laugh: ['IIIII', 'IIIII', '.IBI.', '..I..']
}
const SLEEP_AT = [25, 4] as const
const STARS = [[2, 6], [27, 5]] as const

/** One horizontal run of a single ink: what a <rect height="1"> draws. */
export type Run = { x: number; y: number; w: number; ink: string }

function stamp(x: number, y: number, rows: readonly string[], out: Run[], dy = 0): void {
  rows.forEach((row, i) => {
    for (const match of row.matchAll(/([^.])\1*/g)) {
      out.push({ x: x + (match.index ?? 0), y: y + i + dy, w: match[0].length, ink: match[1] })
    }
  })
}

/** The runs of one animation frame (0..3) for a face. Body and face lift together; the Z and the
 *  sparkles float on their own. */
export function frameRuns(face: Face, frame: number): Run[] {
  const happy = face === 'happy'
  const sleeping = face === 'sleeping'
  const blink = face === 'focused' && frame === 3
  const [left, right, y] = FACE.eyes
  const eyes = happy ? FACE.happy : sleeping || blink ? FACE.asleep : FACE.awake
  const eyeY = happy ? 16 : sleeping || blink ? 18 : y
  const cheekY = happy ? 19 : 20
  const mouth = happy ? FACE.laugh : sleeping ? [frame === 2 ? 'II' : 'I'] : FACE.smile
  const lift = happy ? [0, 1, 2, 0][frame] : Number(face === 'focused' && frame === 2)

  const out: Run[] = []
  for (const [x, sy, ...rows] of BODY) stamp(x, sy, rows, out, -lift)
  stamp(left, eyeY, eyes, out, -lift)
  stamp(right, eyeY, eyes, out, -lift)
  stamp(6, cheekY, FACE.cheeks, out, -lift)
  stamp(23, cheekY, FACE.cheeks, out, -lift)
  stamp(Math.floor((GRID - mouth[0].length) / 2), 21, mouth, out, -lift)

  if (sleeping) {
    const [x, zy] = SLEEP_AT
    stamp(x, zy + [1, 0, -1, 0][frame], ['ZZZZ', '..Z.', '.Z..', 'ZZZZ'], out)
    if (frame === 1 || frame === 2) stamp(x - 3, zy + 4, ['ZZ', '.Z', 'ZZ'], out)
  }
  if (happy) {
    STARS.forEach(([x, sy], i) => {
      stamp(x, sy - Number(frame === 2), (frame + i) % 2 ? ['S'] : ['.S.', 'SSS', '.S.'], out)
    })
  }
  return out
}

/** The reel's class: each face has its own timing in panel.css. */
export const REEL_CLASS: Record<Face, string> = { focused: 'running', sleeping: 'paused', happy: 'finished' }

export const PET_LABEL: Record<Face, string> = {
  focused: 'Tomate concentrado',
  sleeping: 'Tomate dormindo',
  happy: 'Tomate festejando'
}
