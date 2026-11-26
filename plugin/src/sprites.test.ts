// The pet sprite: the panel's frames must stay pixel-identical to the chosen design
// (03 Costelão, face A · Pontinho in docs/design/v4-costelao/faces.js).
import { assert, test } from 'orca/testing'
import { COLORS, FRAMES, frameRuns, GRID, THEMED_INKS, type Run } from './sprites.ts'
import type { Face } from './panel-view.ts'

/** Paints runs onto a GRID × GRID canvas of ink letters, later runs on top. */
function paint(runs: Run[]): string[] {
  const rows = Array.from({ length: GRID }, () => Array<string>(GRID).fill('.'))
  for (const { x, y, w, ink } of runs) {
    for (let i = 0; i < w; i++) if (rows[y]?.[x + i] !== undefined) rows[y][x + i] = ink
  }
  return rows.map((row) => row.join(''))
}

/** Keeps only the face inks, so body pixels under the face read as '.'. */
function face(row: string): string {
  return row.replace(/[^IB]/g, '.')
}

const faces: Face[] = ['focused', 'sleeping', 'happy']

test('every frame stays on the 32 × 32 grid and uses only known inks', () => {
  for (const face of faces) {
    for (let frame = 0; frame < FRAMES; frame++) {
      for (const run of frameRuns(face, frame)) {
        assert.ok(run.x >= 0 && run.x + run.w <= GRID, `${face}/${frame} x ${run.x}+${run.w}`)
        assert.ok(run.y >= 0 && run.y < GRID, `${face}/${frame} y ${run.y}`)
        assert.ok(COLORS[run.ink] || THEMED_INKS[run.ink], `ink ${run.ink}`)
      }
    }
  }
})

test('focused: button eyes and a short smile; blinks on the last frame', () => {
  const open = paint(frameRuns('focused', 0))
  assert.equal(face(open[17].slice(10, 12)), 'II')
  assert.equal(face(open[17].slice(20, 22)), 'II')
  assert.equal(face(open[21].slice(14, 18)), 'I..I')
  assert.equal(face(open[22].slice(14, 18)), '.II.')
  const blink = paint(frameRuns('focused', 3))
  assert.equal(face(blink[18].slice(10, 13)), 'I.I')
  assert.equal(face(blink[19].slice(10, 13)), 'III')
  // Frame 2 bobs the whole pet up one pixel.
  assert.equal(face(paint(frameRuns('focused', 2))[16].slice(10, 12)), 'II')
})

test('sleeping: closed eyes and a floating Z; no sparkle', () => {
  const frames = [0, 1, 2, 3].map((f) => frameRuns('sleeping', f))
  for (const runs of frames) {
    assert.ok(runs.some((r) => r.ink === 'Z'))
    assert.ok(!runs.some((r) => r.ink === 'S'))
  }
  assert.equal(paint(frames[0])[5].slice(25, 29), 'ZZZZ')
  assert.equal(paint(frames[2])[3].slice(25, 29), 'ZZZZ')
  // The small z appears on the middle frames only.
  assert.equal(paint(frames[1])[8].slice(22, 24), 'ZZ')
  assert.equal(paint(frames[0])[8].slice(22, 24), '..')
})

test('happy: arc eyes, open laugh, sparkles; jumps two pixels', () => {
  const still = paint(frameRuns('happy', 0))
  assert.equal(face(still[16].slice(10, 14)), 'IIII')
  assert.equal(face(still[17].slice(10, 14)), 'I..I')
  assert.equal(face(still[23].slice(13, 18)), '.IBI.')
  assert.equal(still[6].slice(2, 5), '.S.')
  assert.equal(still[7].slice(2, 5), 'SSS')
  const top = paint(frameRuns('happy', 2))
  assert.equal(face(top[14].slice(10, 14)), 'IIII')
  assert.ok(!frameRuns('happy', 0).some((r) => r.ink === 'Z'))
})
