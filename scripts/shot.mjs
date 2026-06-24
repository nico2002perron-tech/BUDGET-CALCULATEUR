/* Capture d'écran de la page rendue (Edge système). node scripts/shot.mjs */
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5173/'
const channels = ['msedge', 'chrome']

let browser = null
for (const channel of channels) {
  try {
    browser = await chromium.launch({ channel, headless: true })
    console.log('navigateur :', channel)
    break
  } catch {
    /* essaie le suivant */
  }
}
if (!browser) {
  console.log('Aucun navigateur (msedge/chrome) trouvé.')
  process.exit(2)
}

const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('svg', { timeout: 5000 })
await page.waitForTimeout(1200) // laisse les animations SMIL se poser
await page.screenshot({ path: 'scripts/_shot-desktop.png', fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shot-mobile.png', fullPage: true })

const texte = await page.evaluate(() => document.body.innerText)
console.log('--- texte visible ---')
console.log(texte)
console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')

await browser.close()
