/* Capture « Ma vie financière » : courbe de patrimoine + L'Horizon + composition. */
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1280 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.freq-cards', { timeout: 5000 })

const champ = page.locator('.champ-input')
await champ.nth(0).fill('2000')  // montant par paie
await champ.nth(1).fill('9000')  // coussin
await champ.nth(2).fill('75000') // brut annuel
const dep = page.locator('.dep-montant-input')
await dep.nth(0).fill('1500')
await dep.nth(2).fill('700')
await dep.nth(10).fill('400')
// Patrimoine : âge + avoirs + dettes.
await page.locator('.pat-mini .jour-input').nth(0).fill('34') // âge
const pat = page.locator('.pat-input')
await pat.nth(0).fill('22000')  // REER
await pat.nth(1).fill('14000')  // CELI
await pat.nth(2).fill('6000')   // non enregistré
await pat.nth(3).fill('320000') // maison
await pat.nth(4).fill('240000') // hypothèque
await pat.nth(5).fill('8000')   // autres dettes
await page.waitForTimeout(400)

await page.locator('.rail-item', { hasText: 'Ma tour' }).click()
await page.waitForSelector('.tour-hero', { timeout: 5000 })
await page.locator('.sugg', { hasText: 'Ma vie financière' }).click()
await page.waitForSelector('.tour-vues .card', { timeout: 5000 })
await page.waitForTimeout(800)
await page.screenshot({ path: 'scripts/_shot-vie.png', fullPage: false })

await page.setViewportSize({ width: 375, height: 1150 })
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shot-mobile.png', fullPage: false })

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
