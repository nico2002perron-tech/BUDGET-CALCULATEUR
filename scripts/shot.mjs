/* Capture « Mon portrait du mois » : coussin à zones + anatomie du dollar + impôt. */
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
await champ.nth(2).fill('75000') // revenu brut annuel
const dep = page.locator('.dep-montant-input')
await dep.nth(0).fill('1500') // Logement (besoin)
await dep.nth(2).fill('700')  // Alimentation (besoin)
await dep.nth(3).fill('200')  // Assurances (besoin)
await dep.nth(6).fill('60')   // Abonnements (désir)
await dep.nth(10).fill('300') // Épargne
await page.waitForTimeout(400)

await page.locator('.rail-item', { hasText: 'Ma tour' }).click()
await page.waitForSelector('.tour-hero', { timeout: 5000 })
await page.locator('.sugg', { hasText: 'Mon portrait du mois' }).click()
await page.waitForSelector('.tour-vues .card', { timeout: 5000 })
await page.waitForTimeout(800)
await page.screenshot({ path: 'scripts/_shot-portrait.png', fullPage: false })

await page.setViewportSize({ width: 375, height: 1100 })
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shot-mobile.png', fullPage: false })

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
