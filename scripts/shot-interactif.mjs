/* Capture des CARTES QUI RÉPONDENT : on fabrique un widget KPI (magenta), puis
   (1) TAP sur la carte → elle se métamorphose (jauge → forme suivante),
   (2) RETOUCHE → on la passe au vert, tout le widget suit.
   Lance : node scripts/shot-interactif.mjs (dev :5173) */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
p.on('pageerror', (e) => erreurs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify(exempleStore()))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.locator('.rail-item', { hasText: 'Ma tour' }).first().click()
await p.waitForSelector('.galerie', { timeout: 5000 })

// Fabrique le widget : coussin → « tient combien de mois » → magenta → Ajouter.
await p.locator('.gal-famille', { hasText: 'Mon coussin' }).click()
await p.locator('.gal-carte', { hasText: 'Mon coussin tient combien de mois' }).first().click()
await p.waitForSelector('.gal-essai', { timeout: 4000 })
await p.locator('.gal-accent[aria-label="Couleur magenta"]').click()
await p.locator('.gal-ajouter').click()
await p.waitForSelector('.tour-board .tour-widget', { timeout: 5000 })
await p.waitForTimeout(1600)

const widget = p.locator('.tour-board .tour-widget').first()
await widget.scrollIntoViewIfNeeded()
await p.waitForTimeout(300)
await widget.screenshot({ path: 'captures/interactif-1-jauge.png' })
console.log('capturé : interactif-1-jauge.png (la jauge magenta, indice « tape »)')

// (1) TAP sur la carte → la forme suivante.
await widget.locator('.tour-rendu .card').first().click()
await p.waitForTimeout(900)
await widget.screenshot({ path: 'captures/interactif-2-morph.png' })
console.log('capturé : interactif-2-morph.png (même KPI, forme suivante)')

// (2) RETOUCHE → vert.
await widget.locator('.tour-widget-retouche').click()
await p.waitForTimeout(400)
await widget.locator('.gal-accent[aria-label="Couleur vert"]').click()
await p.waitForTimeout(600)
await widget.screenshot({ path: 'captures/interactif-3-vert.png' })
console.log('capturé : interactif-3-vert.png (retouche : le widget passe au vert)')

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
process.exit(erreurs.length ? 1 : 0)
