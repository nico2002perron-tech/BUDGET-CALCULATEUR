/* Capture « Ma tour » ServiceNow (accueil + vue composée). node scripts/shot.mjs */
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', (e) => erreurs.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.rail-item', { timeout: 5000 })

// Charger l'exemple (données pleines) pour des cartes parlantes.
await page.locator('.lien-action', { hasText: 'Voir un exemple' }).click()
await page.waitForTimeout(200)

// 1) « Ma tour » — accueil (héros : bonjour + chat qui rayonne + suggestions).
await page.locator('.rail-item', { hasText: 'Ma tour' }).click()
await page.waitForSelector('.tour-hero', { timeout: 5000 })
await page.waitForTimeout(300)
await page.screenshot({ path: 'scripts/_shot-tour.png', fullPage: false })

// 2) Vue composée — cartes qui flottent dans la grille.
await page.locator('.sugg', { hasText: "Passer l'hiver" }).click()
await page.waitForSelector('.tour-vues .card', { timeout: 5000 })
await page.setViewportSize({ width: 1440, height: 1180 })
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shot-compose.png', fullPage: false })

// 3) Mobile 375px — accueil « Ma tour ».
await page.locator('.tour-reset').click().catch(() => {})
await page.setViewportSize({ width: 375, height: 780 })
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_shot-mobile.png', fullPage: false })

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
