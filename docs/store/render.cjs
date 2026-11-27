// Renders the images for the plugin's page in Orca's plugin directory into plugin/assets/:
// icon.png (256 × 256), cover.png (1600 × 1000) and screenshot-*.png (1600 × 1000).
// The panel in them is the real plugin/src/panel.html, drawn in Chromium with a stand-in `orca`
// (like docs/screenshots/v0.2/capture.cjs); the big tomato is drawn from plugin/src/sprites.ts.
// Run from the repository root with Playwright available to Node (see docs/store/README.md).
const { chromium } = require('playwright')
const { join, resolve } = require('node:path')
const { readFileSync, statSync } = require('node:fs')
const ts = require(resolve(__dirname, '../../node_modules/typescript'))

const root = resolve(__dirname, '../..')
const src = join(root, 'plugin/src')
const out = join(root, 'plugin/assets')

const transpile = (code, module) =>
  ts.transpileModule(code, { compilerOptions: { module, target: ts.ScriptTarget.ES2022 } }).outputText

// The sprite data, loaded in Node.
function loadSprites() {
  const code = transpile(readFileSync(join(src, 'sprites.ts'), 'utf8'), ts.ModuleKind.CommonJS)
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}
const sprites = loadSprites()
const INKS = { ...sprites.COLORS, Z: '#626e86', S: '#bd7c24' }

/** One frame of the pet as an SVG string, `scale` CSS pixels per art pixel. */
function petSvg(face, frame, scale) {
  const size = sprites.GRID * scale
  const rects = sprites
    .frameRuns(face, frame)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${INKS[r.ink]}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>`
}

// Snapshots shaped like the worker's (see src/timer.ts `snapshot`).
const now = new Date(2026, 10, 26, 10, 0).getTime()
const MIN = 60_000
const base = {
  kind: 'focus', durationMs: 25 * MIN, focusMs: 25 * MIN, suggestedBreakMinutes: 5,
  finishedAt: null, today: '2026-11-26', at: now
}
const states = {
  running: { ...base, status: 'running', remainingMs: 1122_000, endsAt: now + 1122_000, todayCount: 3 },
  finished: { ...base, suggestedBreakMinutes: 15, status: 'finished', remainingMs: 0, endsAt: null, finishedAt: now, todayCount: 4 },
  'break-running': { ...base, status: 'running', kind: 'break', durationMs: 15 * MIN, remainingMs: 11 * MIN + 40_000, endsAt: now + 700_000, todayCount: 4 },
  paused: { ...base, status: 'paused', remainingMs: 16 * MIN, endsAt: null, todayCount: 6 }
}

const types = { html: 'text/html', css: 'text/css', ts: 'application/javascript' }
async function serve(route) {
  const name = new URL(route.request().url()).pathname.slice(1)
  const ext = name.split('.').pop()
  let body = readFileSync(join(src, name), 'utf8')
  if (ext === 'ts') body = transpile(body, ts.ModuleKind.ESNext)
  await route.fulfill({ contentType: types[ext], body })
}

/** The real panel for a state and theme, as a PNG data URL at 3× for sharp downscaling. */
async function panel(browser, state, theme) {
  const page = await browser.newPage({
    viewport: { width: 340, height: 400 }, deviceScaleFactor: 3, reducedMotion: 'reduce', colorScheme: theme
  })
  await page.clock.install({ time: now })
  await page.clock.pauseAt(now)
  await page.route('http://pomodoro.panel/**', serve)
  page.on('pageerror', (error) => console.error(state, theme, error))
  await page.addInitScript(({ snap, theme }) => {
    window.orca = {
      plugin: { request: async () => snap, on() {} },
      storage: { get: async () => null, onDidChange() {} }
    }
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(theme))
  }, { snap: states[state], theme })
  await page.goto('http://pomodoro.panel/panel.html')
  await page.locator(`main[data-state="${states[state].status}"]`).waitFor()
  const png = await page.locator('.widget').screenshot({ omitBackground: true })
  await page.close()
  return 'data:image/png;base64,' + png.toString('base64')
}

const palettes = {
  light: { bg: '#fbf4ec', glow: 'rgba(233, 97, 76, .16)', leaf: 'rgba(55, 116, 91, .12)', ink: '#202322', soft: '#5d625f', card: '#ffffff', edge: '#eadfd3' },
  dark: { bg: '#141416', glow: 'rgba(238, 136, 117, .18)', leaf: 'rgba(136, 191, 161, .12)', ink: '#ececf0', soft: '#a9abb2', card: '#121214', edge: '#2c2c31' }
}

function page({ theme, body, width = 1600, height = 1000 }) {
  const p = palettes[theme]
  return `<!doctype html><html lang="en"><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0 }
    body {
      width: ${width}px; height: ${height}px; overflow: hidden; color: ${p.ink};
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      background:
        radial-gradient(900px 700px at 88% 30%, ${p.glow}, transparent 70%),
        radial-gradient(700px 600px at 8% 100%, ${p.leaf}, transparent 70%),
        ${p.bg};
    }
    .stage { display: flex; align-items: center; height: 100%; padding: 0 120px; gap: 96px }
    .copy { flex: 1 1 0; min-width: 0 }
    .eyebrow { font-size: 22px; font-weight: 600; letter-spacing: .02em; color: #d65b48; margin-bottom: 22px }
    h1 { font-size: 68px; line-height: 1.04; font-weight: 720; letter-spacing: -.035em }
    p { margin-top: 26px; font-size: 27px; line-height: 1.45; color: ${p.soft}; max-width: 560px }
    .card {
      flex: none; width: 600px; padding: 10px; border-radius: 30px; background: ${p.card};
      border: 1px solid ${p.edge};
      box-shadow: 0 40px 90px -30px rgba(60, 30, 20, ${theme === 'dark' ? '.7' : '.28'}), 0 2px 6px rgba(0,0,0,.05);
    }
    .card img { display: block; width: 100% }
    .pill {
      display: inline-flex; align-items: center; gap: 10px; margin-top: 40px;
      padding: 12px 20px; border-radius: 12px; font-size: 24px; font-weight: 600;
      font-variant-numeric: tabular-nums; background: #1d1e22; color: #f2f2f4;
      box-shadow: 0 14px 30px -12px rgba(0,0,0,.45);
    }
    .pill small { font-size: 17px; font-weight: 500; color: #9a9ca4; margin-right: 6px }
    .pet { display: block; margin-bottom: 34px; image-rendering: pixelated }
  </style><body>${body}</body></html>`
}

const pill = (label, text, color) =>
  `<div class="pill"><small>${label}</small><span style="color:${color}">${text}</span></div>`

async function shoot(browser, html, file, { width = 1600, height = 1000, type = 'png' } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(out, file), type, omitBackground: file === 'icon.png' })
  await page.close()
  console.log(file, `${Math.round(statSync(join(out, file)).size / 1024)} KB`)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  try {
    // Icon: the focused tomato, 8 px per art pixel, on a transparent background.
    await shoot(
      browser,
      `<!doctype html><style>*{margin:0}body{background:transparent}</style>${petSvg('focused', 0, 8)}`,
      'icon.png',
      { width: 256, height: 256 }
    )

    const shot = {
      running: await panel(browser, 'running', 'light'),
      finished: await panel(browser, 'finished', 'light'),
      breakDark: await panel(browser, 'break-running', 'dark'),
      pausedDark: await panel(browser, 'paused', 'dark')
    }

    // Cover: the celebrating tomato, the name, and the card proposing a break.
    await shoot(browser, page({
      theme: 'light',
      body: `<div class="stage"><div class="copy">
        ${petSvg('happy', 1, 7).replace('<svg', '<svg class="pet"')}
        <h1 style="font-size:96px">Pomodoro</h1>
        <p style="font-size:30px">A pet tomato that keeps your focus, proposes your breaks and counts your day, right inside Orca.</p>
      </div><div class="card"><img src="${shot.finished}"></div></div>`
    }), 'cover.png')

    const slides = [
      {
        file: 'screenshot-focus.png', theme: 'light', img: shot.running,
        eyebrow: 'Focus', title: 'Stay focused with a pet tomato',
        text: 'A Pomodoro timer in Orca’s sidebar. the tomato blinks along while you work, and the countdown also sits in the status bar.',
        extra: pill('Status bar', '🍅 18:42 · 3', '#ff8f7a')
      },
      {
        file: 'screenshot-break.png', theme: 'light', img: shot.finished,
        eyebrow: 'Breaks', title: 'Your break, already proposed',
        text: 'When a pomodoro ends you get 5 minutes, or 15 after every 4th. Pick one and take it, or skip straight to the next pomodoro.'
      },
      {
        file: 'screenshot-rest.png', theme: 'dark', img: shot.breakDark,
        eyebrow: 'Rest', title: 'Rest while your tomato naps',
        text: 'Breaks get a green ring, never count as pomodoros, and hand back your pomodoro length when they end.',
        extra: pill('Status bar', '☕ 11:40 · 4', '#88bfa1')
      },
      {
        file: 'screenshot-day.png', theme: 'dark', img: shot.pausedDark,
        eyebrow: 'Your day', title: 'Every pomodoro, counted',
        text: 'Today’s count rolls over at midnight and survives restarts. Missed one? Fix it with − and +. Follows Orca’s light and dark themes.'
      }
    ]
    for (const s of slides) {
      await shoot(browser, page({
        theme: s.theme,
        body: `<div class="stage"><div class="copy">
          <div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1><p>${s.text}</p>${s.extra ?? ''}
        </div><div class="card"><img src="${s.img}"></div></div>`
      }), s.file)
    }
  } finally {
    await browser.close()
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
