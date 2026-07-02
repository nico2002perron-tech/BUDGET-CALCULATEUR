/* Capture « CRÉER SON KPI » : cible 6 mois + forme + couleur verte + icône étoile
   + nom « Mon fonds de liberté » → le widget posé porte TOUT. Puis la retouche
   complète (nom/couleur/forme/icône). Lance : node scripts/shot-creer-kpi.mjs */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1150 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
p.on('pageerror', (e) => erreurs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify(exempleStore()))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.locator('.rail-item', { hasText: 'Ma tour' }).first().click()
await p.waitForSelector('.galerie', { timeout: 5000 })

// L'essayage complet : coussin → « Combien pour atteindre ma cible ? ».
await p.locator('.gal-famille', { hasText: 'Mon coussin' }).click()
await p.waitForTimeout(400)
await p.locator('.gal-voirplus').click().catch(() => {})
await p.waitForTimeout(300)
await p.locator('.gal-carte', { hasText: 'Combien pour atteindre ma cible' }).first().click()
await p.waitForSelector('.gal-essai', { timeout: 4000 })

// Cible 3 → 6 (trois +), couleur verte, icône étoile, nom perso.
for (let i = 0; i < 3; i++) await p.locator('.gal-cible-pas').nth(1).click()
await p.locator('.gal-accent[aria-label="Couleur vert"]').click()
await p.locator('.gal-icone[aria-label="Icône etoile"]').click()
await p.locator('.gal-nom').fill('Mon fonds de liberté')
await p.waitForTimeout(500)
await p.locator('.gal-essai').screenshot({ path: 'captures/creerkpi-1-essayage.png' })
console.log('capturé : creerkpi-1-essayage.png (cible 6 + vert + étoile + nom perso)')

// Ajouter → le widget posé porte TOUT.
await p.locator('.gal-ajouter').click()
await p.waitForSelector('.tour-board .tour-widget', { timeout: 5000 })
await p.waitForTimeout(1600)
const widget = p.locator('.tour-board .tour-widget').first()
await widget.scrollIntoViewIfNeeded()
await p.waitForTimeout(300)
await widget.screenshot({ path: 'captures/creerkpi-2-widget.png' })
console.log('capturé : creerkpi-2-widget.png (« Mon fonds de liberté », étoile verte, cible 6)')

// La retouche complète.
await widget.locator('.tour-widget-retouche').click()
await p.waitForTimeout(500)
await widget.screenshot({ path: 'captures/creerkpi-3-retouche.png' })
console.log('capturé : creerkpi-3-retouche.png (nom + couleur + forme + icône)')

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
process.exit(erreurs.length ? 1 : 0)
