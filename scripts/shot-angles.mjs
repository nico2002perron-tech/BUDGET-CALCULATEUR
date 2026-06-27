/* Captures des DEUX portes de ChoixAngle (la vitrine de la bibliothèque) :
   A) « après » : un widget objectif déjà dans la tour → « Voir autrement » → échange de forme ;
   B) « pendant » : l'atelier, à l'assemblage → « Voir autrement » non bloquant.
   Seed du silo via addInitScript (données locales seulement). Lance : node scripts/shot-angles.mjs */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'
import { composerRecette } from '../src/recettes/composer.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
const seed = (extra) => JSON.stringify({ ...exempleStore(), ...extra })

async function page(extra) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => erreurs.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
  await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), extra)
  await p.goto(URL, { waitUntil: 'networkidle' })
  await p.locator('.rail-item', { hasText: 'Ma tour' }).click()
  return p
}

/* ── A) Porte « après » : widget objectif déjà posé ───────────────────────── */
const recetteObj = composerRecette('objectif_epargne', { objectif: 'maison', echeance: 'cette_annee' }, null)
const pa = await page(seed({ tourWidgets: [{ id: 'w_demo', recette: recetteObj }] }))
await pa.waitForSelector('.tour-widget', { timeout: 6000 })
await pa.locator('.tour-widget-angle').first().click()
await pa.waitForSelector('.angles', { timeout: 3000 })
await pa.waitForTimeout(400)
await pa.screenshot({ path: 'captures/angle-apres-1-ouvert.png' })
console.log('A1 capturé : ChoixAngle ouvert (recommandé = chaine pré-sélectionné)')
// Échange de forme → chronologie
await pa.locator('.angle-carte', { hasText: 'Compte à rebours' }).click()
await pa.waitForTimeout(700)
await pa.screenshot({ path: 'captures/angle-apres-2-chronologie.png' })
console.log('A2 capturé : même KPI re-rendu en chronologie (présentation pure)')

/* ── B) Porte « pendant » : l'atelier à l'assemblage ──────────────────────── */
const pb = await page(seed({ tourWidgets: [] }))
await pb.waitForSelector('.atelier', { timeout: 6000 })
await pb.locator('.atelier-opt', { hasText: 'Atteindre un objectif' }).click()
await pb.locator('.atelier-opt', { hasText: 'Une maison' }).click()
await pb.locator('.atelier-opt', { hasText: 'Cette année' }).click()
await pb.waitForSelector('.atelier-autres-angles', { timeout: 4000 })
await pb.locator('.atelier-autres-angles').click()
await pb.waitForSelector('.atelier-angles .angles', { timeout: 3000 })
await pb.waitForTimeout(400)
await pb.screenshot({ path: 'captures/angle-pendant-1-ouvert.png' })
console.log('B1 capturé : atelier — « Voir autrement » non bloquant à l’assemblage')

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
