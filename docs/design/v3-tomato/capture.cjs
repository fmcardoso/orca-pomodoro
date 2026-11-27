const { chromium } = require('playwright')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

async function capture(browser) {
  const page = await browser.newPage({
    viewport: { width: 2160, height: 2200 }, deviceScaleFactor: 1, reducedMotion: 'reduce'
  })
  const url = pathToFileURL(join(__dirname, 'index.html')).href
  await page.clock.install({ time: new Date(2026, 3, 15, 12) })
  await page.clock.pauseAt(new Date(2026, 3, 15, 12, 1))
  for (const theme of ['light', 'dark']) {
    await page.goto(url + '?sheet=1&theme=' + theme)
    const cards = page.locator('iframe')
    if (await cards.count() !== 18) throw new Error('Cards are missing from the comparison')
    for (const card of await cards.all()) await card.contentFrame().locator('.pixel-pet').waitFor()
    await page.locator('.sheet').screenshot({ path: join(__dirname, theme === 'light' ? 'sheet.png' : 'sheet-dark.png') })
  }
  await page.goto(url + '?frames=1&theme=light')
  for (let i = 1; i <= 6; i++) {
    await page.locator('#strip-' + i).screenshot({path: join(__dirname, i + '-frames.png')})
  }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  try { await capture(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
