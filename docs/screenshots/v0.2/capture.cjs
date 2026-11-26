// Renders plugin/src/panel.html in Chromium with a stand-in `orca` (the same snapshot shape the
// worker posts) and saves one PNG per state. TypeScript is transpiled on the fly with the
// repository's `typescript`, the way Orca loads the panel without a build step.
// Run from the repository root with Playwright available to Node (see the README).
const { chromium } = require('playwright')
const { join, resolve } = require('node:path')
const { readFileSync } = require('node:fs')
const ts = require(resolve(__dirname, '../../../node_modules/typescript'))

const src = resolve(__dirname, '../../../plugin/src')
const now = new Date(2026, 10, 26, 10, 0).getTime()
const MIN = 60_000
const base = { durationMs: 25 * MIN, finishedAt: null, today: '2026-11-26', at: now }
const states = {
  running: { ...base, status: 'running', remainingMs: 1122_000, endsAt: now + 1122_000, todayCount: 3 },
  paused: { ...base, status: 'paused', remainingMs: 16 * MIN, endsAt: null, todayCount: 3 },
  finished: { ...base, status: 'finished', remainingMs: 0, endsAt: null, finishedAt: now, todayCount: 4 },
  idle: { ...base, status: 'idle', remainingMs: 25 * MIN, endsAt: null, todayCount: 4 }
}
const shots = [
  ['running', 'light'], ['paused', 'light'], ['finished', 'light'], ['idle', 'light'],
  ['running', 'dark'], ['paused', 'dark'], ['finished', 'dark']
]

const types = { html: 'text/html', css: 'text/css', ts: 'application/javascript' }

// Serves plugin/src from a made-up origin, transpiling .ts files.
async function serve(route) {
  const name = new URL(route.request().url()).pathname.slice(1)
  const ext = name.split('.').pop()
  let body = readFileSync(join(src, name), 'utf8')
  if (ext === 'ts') {
    body = ts.transpileModule(body, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText
  }
  await route.fulfill({ contentType: types[ext], body })
}

async function capture(browser) {
  for (const [state, theme] of shots) {
    const page = await browser.newPage({
      viewport: { width: 340, height: 400 }, deviceScaleFactor: 2, reducedMotion: 'reduce', colorScheme: theme
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
      // Orca puts a `light` or `dark` class on <html>.
      document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add(theme))
    }, { snap: states[state], theme })
    await page.goto('http://pomodoro.panel/panel.html')
    await page.locator(`main[data-state="${state}"]`).waitFor()
    await page.locator('main').screenshot({ path: join(__dirname, `${state}-${theme}.png`) })
    await page.close()
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  try { await capture(browser) } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
