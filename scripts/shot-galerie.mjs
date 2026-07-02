/* Capture du STUDIO GUIDÉ (Galerie v3, façon Duolingo) : accueil (vedette + 5
   familles joufflues), étape famille (grand tableau + 3 outils), essayage,
   mobile (accueil + feuille du bas). Lance : node scripts/shot-galerie.mjs */
import { chromium } from 'playwright-core'
import { exempleStore } from '../src/lib/storage.js'

const URL = 'http://localhost:5173/'
let browser = null
for (const channel of ['msedge', 'chrome']) {
  try { browser = await chromium.launch({ channel, headless: true }); console.log('navigateur :', channel); break } catch { /* suivant */ }
}
if (!browser) { console.log('Aucun navigateur trouvé.'); process.exit(2) }

const erreurs = []
async function page(store, mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 1100 } : { width: 1440, height: 1150 }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => erreurs.push(String(e)))
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error: ' + m.text()) })
  if (store) await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), JSON.stringify(store))
  await p.goto(URL, { waitUntil: 'networkidle' })
  const tour = p.locator('.rail-item, .tab-item', { hasText: 'Ma tour' }).first()
  if (await tour.count()) await tour.click()
  await p.waitForSelector('.galerie', { timeout: 5000 })
  await p.waitForTimeout(800)
  return { ctx, p }
}

// 1) L'accueil du studio (vedette + 5 familles).
{
  const { ctx, p } = await page(exempleStore())
  await p.locator('.galerie').scrollIntoViewIfNeeded()
  await p.waitForTimeout(400)
  await p.locator('.galerie').screenshot({ path: 'captures/studio-1-accueil.png' })
  console.log('capturé : studio-1-accueil.png')

  // 2) Étape famille : Coussin (grand tableau absent, 4 outils verts).
  await p.locator('.gal-famille', { hasText: 'Mon coussin' }).click()
  await p.waitForTimeout(900)
  await p.locator('.galerie').screenshot({ path: 'captures/studio-2-famille.png' })
  console.log('capturé : studio-2-famille.png')

  // 3) L'essayage.
  const carte = p.locator('.gal-carte', { hasText: 'Mon coussin tient combien de mois' }).first()
  if (await carte.count()) {
    await carte.click()
    await p.waitForSelector('.gal-essai', { timeout: 4000 })
    await p.waitForTimeout(700)
    await p.locator('.gal-essai').screenshot({ path: 'captures/studio-3-essayage.png' })
    console.log('capturé : studio-3-essayage.png')
  }
  await ctx.close()
}

// 4) Tour vierge : les 5 familles éteintes (l'invitation honnête).
{
  const { ctx, p } = await page({ version: 1, revenus: {}, depenses: [], patrimoine: {} })
  await p.locator('.galerie').scrollIntoViewIfNeeded()
  await p.waitForTimeout(300)
  await p.locator('.galerie').screenshot({ path: 'captures/studio-4-vierge.png' })
  console.log('capturé : studio-4-vierge.png')
  await ctx.close()
}

// 5) Mobile : accueil + feuille du bas.
{
  const { ctx, p } = await page(exempleStore(), true)
  await p.locator('.galerie').scrollIntoViewIfNeeded()
  await p.waitForTimeout(300)
  await p.locator('.galerie').screenshot({ path: 'captures/studio-5-mobile.png' })
  console.log('capturé : studio-5-mobile.png')
  await p.locator('.gal-famille', { hasText: 'Mon coussin' }).click()
  await p.waitForTimeout(700)
  const carteM = p.locator('.gal-carte', { hasText: 'Mon coussin tient combien de mois' }).first()
  if (await carteM.count()) {
    await carteM.click()
    await p.waitForSelector('.gal-essai', { timeout: 4000 })
    await p.waitForTimeout(700)
    await p.screenshot({ path: 'captures/studio-6-feuille-mobile.png' })
    console.log('capturé : studio-6-feuille-mobile.png')
  }
  await ctx.close()
}

console.log('--- erreurs page ---')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
await browser.close()
process.exit(erreurs.length ? 1 : 0)
