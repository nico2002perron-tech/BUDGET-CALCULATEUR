/* Capture des WIDGETS JOUFFLUS : on fabrique 2 outils par le studio (la vedette +
   un KPI coussin teinté MAGENTA à l'essayage) puis on photographie le tableau.
   Lance : node scripts/shot-widgets.mjs (dev :5173) */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1250 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
p.on('pageerror', (e) => erreurs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify(exempleStore()))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.locator('.rail-item', { hasText: 'Ma tour' }).first().click()
await p.waitForSelector('.galerie', { timeout: 5000 })

// 1) La vedette « choisi pour toi » (saison, accent lavande).
await p.locator('.gal-vedette').click()
await p.waitForSelector('.tour-board .tour-widget', { timeout: 5000 })
await p.waitForTimeout(1500)

// 2) Un KPI coussin, teinté MAGENTA à l'essayage.
await p.locator('.gal-famille', { hasText: 'Mon coussin' }).click()
await p.waitForTimeout(500)
await p.locator('.gal-carte', { hasText: 'Mon coussin tient combien de mois' }).first().click()
await p.waitForSelector('.gal-essai', { timeout: 4000 })
await p.locator('.gal-accent[aria-label="Couleur magenta"]').click()
await p.waitForTimeout(300)
await p.locator('.gal-ajouter').click()
await p.waitForTimeout(1800)

// Le tableau : widgets joufflus, chacun dans SA couleur.
await p.locator('.tour-board').scrollIntoViewIfNeeded()
await p.waitForTimeout(600)
await p.locator('.tour-board').screenshot({ path: 'captures/widgets-1-board.png' })
console.log('capturé : widgets-1-board.png')

await p.setViewportSize({ width: 390, height: 1300 })
await p.waitForTimeout(500)
await p.locator('.tour-board').scrollIntoViewIfNeeded()
await p.waitForTimeout(400)
await p.locator('.tour-board').screenshot({ path: 'captures/widgets-2-mobile.png' })
console.log('capturé : widgets-2-mobile.png')

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
process.exit(erreurs.length ? 1 : 0)
