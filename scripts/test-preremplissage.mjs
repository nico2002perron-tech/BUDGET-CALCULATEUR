/* e2e — LOT 1 (le pré-remplissage, VISION §8). Au 1er chargement avec des revenus
   et une tour vide, 2-3 indicateurs budget se posent SEULS (via ajouterWidget),
   seulement des KPIs dont la donnée existe ; le drapeau `amorcee` est posé.
   Une tour vidée APRÈS amorçage (choix de l'usager) ne se re-remplit PAS. */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
const REPO = String.raw`C:\Users\Utilisateur\OneDrive - IA Private Wealth\IA PublicQuébec\NICOLAS PERRON\CALCULATEUR DE BUDGET`
const { exempleStore } = await import(pathToFileURL(REPO + '\\src\\lib\\storage.js').href)
let ok = true
const dit = (b, l, d = '') => { ok = ok && b; console.log(`${b ? 'PASS' : 'FAIL'} — ${l}${d ? ` (${d})` : ''}`) }
let browser = null
for (const c of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel: c, headless: true }); break } catch {} }
if (!browser) { console.log('Aucun navigateur.'); process.exit(2) }
const erreurs = []
async function charger(seed) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => erreurs.push('PAGEERROR ' + String(e)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('c.error ' + m.text()) })
  await page.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), seed)
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.shell', { timeout: 8000 })
  await page.waitForTimeout(900)
  return { ctx, page }
}

// A) fresh + revenus (exemple), pas de tourWidgets, pas d'amorcee → la tour se remplit
{
  const seed = JSON.stringify({ ...exempleStore() }) // pas de tourWidgets, amorcee absent → false
  const { ctx, page } = await charger(seed)
  const n = await page.locator('.tour-widget').count()
  dit(n >= 2, 'A) tour vide + revenus → 2-3 tuiles posées', `${n} tuiles`)
  // amorcee posé dans le silo
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('budgetcalc_v1')).amorcee === true } catch { return false } }, { timeout: 3000 }).catch(() => {})
  const amorcee = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('budgetcalc_v1')).amorcee } catch { return null } })
  dit(amorcee === true, 'A) le drapeau amorcee est posé (true) dans le silo')
  // ce sont des KPIs budget avec de vrais chiffres (pas de tuile éteinte)
  const kpis = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('budgetcalc_v1')).tourWidgets.map((w) => w.recette.blocs[0].KPI) } catch { return [] } })
  dit(kpis.every(Boolean) && kpis.length >= 2, 'A) chaque tuile posée est un emplacement KPI', JSON.stringify(kpis))
  await ctx.close()
}

// B) amorcee déjà true + tour vide (l'usager a tout retiré) → NE se re-remplit PAS
{
  const seed = JSON.stringify({ ...exempleStore(), amorcee: true, tourWidgets: [] })
  const { ctx, page } = await charger(seed)
  const n = await page.locator('.tour-widget').count()
  dit(n === 0, 'B) amorcee=true + tour vidée par l’usager → aucune re-pose', `${n} tuiles`)
  await ctx.close()
}

// C) pas de revenus → aucune amorce (pas de tuile sur une tour sans données)
{
  const { emptyStore } = await import(pathToFileURL(REPO + '\\src\\lib\\storage.js').href)
  const seed = JSON.stringify({ ...emptyStore() })
  const { ctx, page } = await charger(seed)
  const n = await page.locator('.tour-widget').count()
  dit(n === 0, 'C) pas de revenus → aucune amorce', `${n} tuiles`)
  await ctx.close()
}

console.log('=== ERREURS ===')
console.log(erreurs.length ? erreurs.join('\n') : '(aucune)')
if (erreurs.length) ok = false
console.log(ok ? 'OK' : 'ECHEC')
await browser.close()
process.exit(ok ? 0 : 1)
