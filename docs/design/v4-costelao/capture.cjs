const { chromium } = require('playwright')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

async function capture(browser) {
  const page = await browser.newPage({ viewport: {width: 2040, height: 1500}, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const url = pathToFileURL(join(__dirname, 'index.html')).href
  await page.clock.install({time: new Date(2026, 3, 15, 12)})
  await page.clock.pauseAt(new Date(2026, 3, 15, 12, 1))
  for (const theme of ['light', 'dark']) {
    await page.goto(url + '?sheet&theme=' + theme)
    const cards = await page.locator('iframe').all()
    if (cards.length !== 12) throw new Error('A prancha precisa de doze cartões')
    for (const card of cards) await card.contentFrame().locator('.portrait .pixel-pet').waitFor()
    await page.locator('.sheet').screenshot({path: join(__dirname, theme === 'light' ? 'sheet.png' : 'sheet-dark.png')})
  }
  await page.goto(url + '?frames&theme=light')
  for (const id of ['ref', 'a', 'b', 'c']) {
    await page.locator('#strip-' + id).screenshot({path: join(__dirname, id + '-frames.png')})
  }
}

;(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH})
  try { await capture(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
