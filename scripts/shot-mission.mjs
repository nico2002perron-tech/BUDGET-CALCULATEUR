/* Capture de LA MISSION « 2 MIN » : tour vierge → famille éteinte → mission
   (chips → montants) → célébration (« N outils viennent de s'allumer »).
   Lance : node scripts/shot-mission.mjs (dev :5173) */
import { chromium } from 'playwright-core'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
p.on('pageerror', (e) => erreurs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify({ version: 1, revenus: {}, depenses: [], patrimoine: {} }))
await p.goto(URL, { waitUntil: 'networkidle' })
const tour = p.locator('.rail-item, .tab-item', { hasText: 'Ma tour' }).first()
if (await tour.count()) await tour.click()
await p.waitForSelector('.galerie', { timeout: 5000 })

// Famille éteinte « Mon coussin » → l'invitation → « Aller la saisir · 2 min ».
await p.locator('.gal-famille', { hasText: 'Mon coussin' }).click()
await p.waitForSelector('.gal-eteinte', { timeout: 4000 })
await p.locator('.gal-eteinte .gal-ajouter').click()
await p.waitForSelector('.mission', { timeout: 4000 })
await p.waitForTimeout(600)
await p.locator('.mission').screenshot({ path: 'captures/mission-1-chips.png' })
console.log('capturé : mission-1-chips.png (une question, 5 choix)')

// Choisit « Aux 2 semaines » → l'étape montant.
await p.locator('.mis-choix', { hasText: 'Aux 2 semaines' }).click()
await p.waitForTimeout(500)
await p.locator('.mis-input').fill('2000')
await p.waitForTimeout(300)
await p.locator('.mission').screenshot({ path: 'captures/mission-2-montant.png' })
console.log('capturé : mission-2-montant.png (gros chiffre + steppers)')

// Continue → coussin 5000 → brut : passer → la célébration.
await p.locator('.mis-continuer').click()
await p.waitForTimeout(400)
await p.locator('.mis-input').fill('5000')
await p.locator('.mis-continuer').click()
await p.waitForTimeout(400)
await p.locator('.mis-passer').click()
await p.waitForSelector('.tour-allume', { timeout: 5000 })
await p.waitForTimeout(900)
await p.locator('.tour').screenshot({ path: 'captures/mission-3-celebration.png' })
console.log('capturé : mission-3-celebration.png (N outils s\'allument + familles à jour)')

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
process.exit(erreurs.length ? 1 : 0)
