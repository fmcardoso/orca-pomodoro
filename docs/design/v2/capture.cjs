// Run with Playwright available to Node. CHROME_PATH selects a system Chromium.
const { chromium } = require('playwright')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')

const variants = { dueto: 'A · Dueto', ninho: 'B · Ninho', regua: 'C · Régua' }
const width = 340
const local = name => pathToFileURL(resolve(__dirname, name)).href

async function capture(browser) {
  const page = await browser.newPage({
    viewport: { width, height: 640 }, deviceScaleFactor: 1, reducedMotion: 'reduce'
  })
  await page.clock.install({ time: new Date(2026, 3, 15, 12) })
  await page.clock.pauseAt(new Date(2026, 3, 15, 12, 1))

  const panels = []
  for (const [variant, name] of Object.entries(variants)) {
    for (const [state, theme] of [['running', 'light'], ['paused', 'light'], ['finished', 'light'], ['running', 'dark']]) {
      await page.goto(local(variant + '.html') + '?state=' + state + '&theme=' + theme)
      await page.locator('main[data-state="' + state + '"]').waitFor()
      const file = [variant, state, theme].join('-') + '.png'
      const widget = page.locator('main')
      await widget.screenshot({ path: join(__dirname, file) })
      if (state === 'running' && theme === 'light') {
        panels.push({ name, height: Math.round((await widget.boundingBox()).height) })
      }
    }
  }

  console.table(panels)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  try { await capture(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
