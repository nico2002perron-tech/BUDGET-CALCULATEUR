/* Capture du HÉROS cockpit « Le verdict du jour » (VISION §7a·2) — la bande navy→cyan.
   Deux profils : (1) exempleStore (saisonnier → verdict du mois courant + rythme des
   sorties fixes datées) ; (2) plan mensuel régulier (sorties prévues / revenus / reste).
   Lance : node scripts/shot-verdict.mjs (serveur dev sur :5173 requis) */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
async function capture(nom, store, mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 1400 } : { width: 1440, height: 1300 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => erreurs.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
  await page.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify(store))
  await page.goto(URL, { waitUntil: 'networkidle' })
  const tour = page.locator('.rail-item, .tab-item', { hasText: 'Ma tour' }).first()
  await tour.click()
  await page.waitForSelector('.band.verdict', { timeout: 5000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `captures/verdict-${nom}.png` })
  console.log(`capturé : captures/verdict-${nom}.png`)
  await ctx.close()
}

// (1) saisonnier (exempleStore : paysagiste, revenus qui varient + sorties fixes datées)
await capture('saisonnier', exempleStore())
await capture('saisonnier-mobile', exempleStore(), true)

// (2) plan mensuel régulier : 2 000 $/paie aux 2 semaines + les mêmes dépenses datées
const plan = { ...exempleStore(), revenus: { mode: 'regulier', freq: 'biweekly', montantParPaie: 2000, weekday: 4, anchor: null, jours: [1, 15] } }
await capture('plan', plan)

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
process.exit(erreurs.length ? 1 : 0)
