/* Capture après correctifs : coussin, jauge/stat réelles, calendrier relibellé. */
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1180 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.freq-cards', { timeout: 5000 })

const champ = page.locator('.champ-input')
await champ.nth(0).fill('2000') // montant par paie
await champ.nth(1).fill('5000') // coussin actuel (nouveau champ)
const dep = page.locator('.dep-montant-input')
await dep.nth(0).fill('1100')
await dep.nth(2).fill('600')
await dep.nth(3).fill('140')
await dep.nth(6).fill('55')
await dep.nth(10).fill('200')
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shot-donnees.png', fullPage: false })

// Ma tour : composer → jauge/stat doivent refléter le coussin (5000), plus 0.
await page.locator('.rail-item', { hasText: 'Ma tour' }).click()
await page.waitForSelector('.tour-hero', { timeout: 5000 })
await page.locator('.sugg', { hasText: "Passer l'hiver" }).click()
await page.waitForSelector('.tour-vues .card', { timeout: 5000 })
await page.setViewportSize({ width: 1440, height: 1180 })
await page.waitForTimeout(800)
await page.screenshot({ path: 'scripts/_shot-compose.png', fullPage: false })

// Calendrier : libellés relibellés (« de paies » / « de sorties fixes »).
await page.locator('.rail-item', { hasText: 'Calendrier' }).click()
await page.waitForSelector('.cal-grille', { timeout: 5000 })
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shot-calendrier.png', fullPage: false })

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
