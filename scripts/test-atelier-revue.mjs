/* e2e — correctifs de la revue adversariale (atelier). M4 : un board plus haut que
   l'écran ne cache aucune tuile (scene-tour non épinglée). M5 : cliquer une plaque
   ÉTEINTE ouvre une mission RÉELLE (jamais un atelier blanc). M3 : un ajout manuel
   verrouille le pré-remplissage (amorcee) même sans candidat budget. */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
const REPO = String.raw`C:\Users\Utilisateur\OneDrive - IA Private Wealth\IA PublicQuébec\NICOLAS PERRON\CALCULATEUR DE BUDGET`
const { exempleStore, emptyStore } = await import(pathToFileURL(REPO + '\\src\\lib\\storage.js').href)
let ok = true
const dit = (b, l, d = '') => { ok = ok && b; console.log(`${b ? 'PASS' : 'FAIL'} — ${l}${d ? ` (${d})` : ''}`) }
let browser = null
for (const c of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel: c, headless: true }); break } catch {} }
if (!browser) { console.log('Aucun navigateur.'); process.exit(2) }
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, recette: { situation: `kpi_x${i}`, titre: `Tuile ${i}`, blocs: [{ KPI: 'cout_vie_mensuel', forme: 'stat', params: {} }] }, accent: '#0077b6', taille: i === 0 ? 'xl' : 'm' }))
async function page(seed, reduit = false) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 800 }, reducedMotion: reduit ? 'reduce' : 'no-preference' })
  const p = await ctx.newPage()
  const err = []
  p.on('pageerror', (e) => err.push(String(e)))
  await p.addInitScript((s) => localStorage.setItem('budgetcalc_v1', s), seed)
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' }); await p.waitForSelector('.shell'); await p.waitForTimeout(700)
  return { ctx, p, err }
}

// M4 : 6 tuiles (dont une xl) → board > 800px → la DERNIÈRE tuile est atteignable
{
  const { ctx, p } = await page(JSON.stringify({ ...exempleStore(), amorcee: true, tourWidgets: mk(6) }))
  const derniere = p.locator('.tour-widget').last()
  await derniere.scrollIntoViewIfNeeded(); await p.waitForTimeout(300)
  const vis = await derniere.evaluate((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return top && el.contains(top) } )
  dit(vis === true, 'M4 : la dernière tuile d’un board haut est visible et non recouverte (scene-tour non épinglée)')
  await ctx.close()
}

// M5 : une plaque ÉTEINTE (patrimoine/impôt, pas de données) → « Aller la remplir »
//      ouvre une mission réelle, l'atelier ne blanchit jamais. Testé en mode PLAT
//      (mouvement réduit) : plaques statiques → clic déterministe, MÊME chemin
//      (cliquer → onAllerSaisie → allerSaisie → setMission).
{
  const { ctx, p, err } = await page(JSON.stringify({ ...exempleStore(), amorcee: true, tourWidgets: [] }), true)
  await p.locator('.scene-atelier').scrollIntoViewIfNeeded(); await p.waitForTimeout(500)
  const et = p.locator('.anneau.plat .plaque.eteinte').first()
  dit((await p.locator('.anneau.plat .plaque.eteinte').count()) > 0, 'M5 : des plaques éteintes existent (KPIs patrimoine/impôt sans données)')
  await et.click(); await p.waitForTimeout(600) // à plat : un seul clic → « aller remplir » → mission
  const aMission = await p.locator('.scene-atelier .mission, .scene-atelier form').count()
  const atelierVide = await p.locator('.scene-atelier').evaluate((el) => el.textContent.trim().length < 5)
  dit(!atelierVide, 'M5 : l’atelier n’est jamais blanc après avoir cliqué une plaque éteinte')
  dit(aMission > 0, 'M5 : une mission RÉELLE est rendue (jamais un cul-de-sac)', `contenu=${aMission}`)
  dit(err.length === 0, 'M5 : aucune erreur', err.slice(0, 2).join(' | '))
  await ctx.close()
}

// M3 : amorcee=false + une tuile déjà là (bloque l'auto-amorce via widgets>0). Un
//      AJOUT MANUEL doit poser amorcee=true → le pré-remplissage ne reviendra jamais,
//      même si la tour est ensuite vidée (l'invariant de la revue). Mode PLAT.
{
  const seed = { ...exempleStore(), amorcee: false, tourWidgets: [{ id: 'w_seed', recette: { situation: 'kpi_seed', titre: 'Semée', blocs: [{ KPI: 'cout_vie_mensuel', forme: 'stat', params: {} }] }, accent: '#0077b6' }] }
  const { ctx, p } = await page(JSON.stringify(seed), true)
  await p.waitForTimeout(500)
  const av = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('budgetcalc_v1')).amorcee } catch { return null } })
  dit(av !== true, 'M3 : au départ amorcee n’est pas verrouillée (auto-amorce bloquée par la tuile présente)', `amorcee=${av}`)
  await p.locator('.scene-atelier').scrollIntoViewIfNeeded(); await p.waitForTimeout(500)
  const dispo = p.locator('.anneau.plat .plaque:not(.eteinte):not(.creer)').first()
  dit((await dispo.count()) > 0, 'M3 : une plaque dispo existe pour l’ajout manuel')
  await dispo.click(); await p.waitForTimeout(600)
  const amorcee = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('budgetcalc_v1')).amorcee } catch { return null } })
  dit(amorcee === true, 'M3 : un ajout manuel verrouille amorcee=true (le pré-remplissage ne reviendra plus)')
  await ctx.close()
}

console.log(ok ? 'OK' : 'ECHEC')
await browser.close()
process.exit(ok ? 0 : 1)
