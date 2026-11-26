// Run with Playwright available to Node. CHROME_PATH selects a system Chromium.
const { chromium } = require('playwright')
const { resolve, join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { readFile } = require('node:fs/promises')

const variants = { dueto: 'A · Dueto', ninho: 'B · Ninho', regua: 'C · Régua' }
const width = 340
const local = name => pathToFileURL(resolve(__dirname, name)).href
const imageData = async path => 'data:image/png;base64,' + (await readFile(path)).toString('base64')

async function capture(browser) {
  const page = await browser.newPage({
    viewport: { width, height: 640 }, deviceScaleFactor: 1, reducedMotion: 'reduce'
  })
  await page.clock.install({ time: new Date(2026, 3, 15, 12) })
  await page.clock.pauseAt(new Date(2026, 3, 15, 12, 1))

  // Use the actual archived rendering, which can have different system font metrics.
  // Its bordered footer is the last visible row, followed only by main's bottom padding.
  const archived = '../../screenshots/preview-panel-running.png'
  await page.route('**/panel-main.ts', route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  await page.goto(local('../../../plugin/src/panel.html'))
  const baseline = await page.evaluate(async src => {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data
    for (let i = pixels.length - 4; i >= 0; i -= 4) {
      if (pixels[i] !== pixels[0] || pixels[i+1] !== pixels[1] || pixels[i+2] !== pixels[2]) {
        const footerBottom = Math.floor(i / 4 / img.width) + 1
        return footerBottom + parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom)
      }
    }
    throw new Error('Captura de referência vazia')
  }, await imageData(resolve(__dirname, archived)))
  const panels = [{ name: 'v0.1 · Atual', height: baseline, file: archived }]
  for (const [variant, name] of Object.entries(variants)) {
    for (const [state, theme] of [['running', 'light'], ['paused', 'light'], ['finished', 'light'], ['running', 'dark']]) {
      await page.goto(local(variant + '.html') + '?state=' + state + '&theme=' + theme)
      await page.locator('main[data-state="' + state + '"]').waitFor()
      const file = [variant, state, theme].join('-') + '.png'
      const widget = page.locator('main')
      await widget.screenshot({ path: join(__dirname, file) })
      if (state === 'running' && theme === 'light') {
        panels.push({ name, file, height: Math.round((await widget.boundingBox()).height) })
      }
    }
  }

  const columns = []
  for (const panel of panels) {
    const reduction = Math.round(100 * (1 - panel.height / baseline))
    const png = await imageData(resolve(__dirname, panel.file))
    columns.push(`<article>
      <header><h2>${panel.name}</h2><span>${panel.height} px</span></header>
      <div class="sidebar"><img src="${png}"><div class="measure" style="top:${panel.height}px"></div></div>
      <footer>${reduction ? reduction + '% menor' : 'Altura de referência'}</footer>
    </article>`)
  }
  const board = await browser.newPage({ viewport: { width: 1470, height: 740 }, deviceScaleFactor: 1 })
  await board.setContent(`<html lang="pt-BR"><meta charset="utf-8"><style>
    * { box-sizing:border-box } body { margin:0; color:#29302d; background:#f3f3ef;
      font:14px system-ui,sans-serif; -webkit-font-smoothing:antialiased }
    main { padding:28px; width:max-content } h1 { font-size:28px; font-weight:620; letter-spacing:-1.1px; margin:0 }
    p { margin:4px 0 22px; color:#5c6660 } section { display:flex; gap:16px }
    article { width:342px; border:1px solid #d9dcd6; border-radius:9px; overflow:hidden; background:#fff }
    header,footer { padding:10px 13px; background:#f9f9f6; font-size:12px }
    header { display:flex; align-items:baseline; justify-content:space-between; border-bottom:1px solid #e1e3df }
    header span { color:#56605a; font-variant-numeric:tabular-nums }
    h2 { margin:0; font-size:16px; font-weight:600; letter-spacing:-.4px }
    .sidebar { height:${baseline + 16}px; position:relative; overflow:hidden }
    img { display:block; width:340px } .measure { position:absolute; width:100%; border-top:1px dashed #ced4cd }
    footer { color:#525b55; border-top:1px solid #e1e3df }
    </style><main><h1>Pomodoro compacto</h1><p>Barra lateral de 340 px · Mesma sessão em foco, na mesma escala</p>
    <section>${columns.join('')}</section></main></html>`)
  await board.locator('main').screenshot({ path: join(__dirname, 'compare.png') })
  console.table(panels.map(({ name, height }) => ({ name, height })))
}

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  try { await capture(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
