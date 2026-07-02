/* Capture de la 1re vue « Ce qui bouge » (primitif événement). La bande se peuple sur une
   TRANSITION : on ouvre Ma tour (baseline = état sain), on baisse le revenu sous le coût de
   vie dans Mes données → le flux bascule négatif → l'événement EXCEPTION (ambre) apparaît.
   Lance : node scripts/shot-evenements.mjs */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })

await page.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify(exempleStore()))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.locator('.rail-item', { hasText: 'Ma tour' }).click() // baseline = état sain (au montage)

// Édition : revenu annuel 42 400 → 12 000 (mensuel ~1 000 < coût de vie ~2 755 → flux négatif).
await page.locator('.rail-item', { hasText: 'Mes données' }).click()
const annuel = page.getByLabel('Revenu net annuel')
await annuel.waitFor({ state: 'visible', timeout: 5000 })
await annuel.fill('12000')
await page.waitForTimeout(300)

// Retour à Ma tour : la bande « Ce qui bouge » montre l'exception (flux devenu négatif).
await page.locator('.rail-item', { hasText: 'Ma tour' }).click()
await page.waitForSelector('.evts .evt--exception', { timeout: 5000 })
await page.waitForTimeout(500)
await page.screenshot({ path: 'captures/evenements-1-exception.png' })
console.log('capturé : bande « Ce qui bouge » — exception (flux devenu négatif, ambre)')

await page.setViewportSize({ width: 390, height: 1500 })
await page.waitForTimeout(400)
await page.screenshot({ path: 'captures/evenements-1-exception-mobile.png' })
console.log('mobile capturé')

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
