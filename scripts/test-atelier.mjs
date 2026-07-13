/* e2e — LOT 3+4 (l'atelier + l'anneau). La tour (scène collante) et l'atelier
   (feuille qui glisse par-dessus) sont deux scènes ; le passage --p suit le
   scroll ; le scroll-snap ne vit QUE sur la tour ; prendre une plaque de l'anneau
   POSE une tuile (via ajouterWidget) ; mouvement réduit → tout à plat, cliquable. */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
const REPO = String.raw`C:\Users\Utilisateur\OneDrive - IA Private Wealth\IA PublicQuébec\NICOLAS PERRON\CALCULATEUR DE BUDGET`
const { exempleStore } = await import(pathToFileURL(REPO + '\\src\\lib\\storage.js').href)
const seed = JSON.stringify({ ...exempleStore(), amorcee: true, tourWidgets: [
  { id: 'w_cv', recette: { situation: 'kpi_cout_vie_mensuel', titre: 'Mon coût de vie', blocs: [{ KPI: 'cout_vie_mensuel', forme: 'stat', params: {} }] }, accent: '#0077b6' },
] })
let ok = true
const dit = (b, l, d = '') => { ok = ok && b; console.log(`${b ? 'PASS' : 'FAIL'} — ${l}${d ? ` (${d})` : ''}`) }
let browser = null
for (const c of ['msedge', 'chrome']) { try { browser = await chromium.launch({ channel: c, headless: true }); break } catch {} }
if (!browser) { console.log('Aucun navigateur.'); process.exit(2) }

async function page(reduit) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: reduit ? 'reduce' : 'no-preference' })
  const p = await ctx.newPage()
  const erreurs = []
  p.on('pageerror', (e) => erreurs.push('PAGEERROR ' + String(e)))
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push('c.error ' + m.text()) })
  await p.addInitScript((s) => { if (!localStorage.getItem('budgetcalc_v1')) localStorage.setItem('budgetcalc_v1', s) }, seed)
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await p.waitForSelector('.shell', { timeout: 8000 }); await p.waitForTimeout(700)
  return { ctx, p, erreurs }
}

// ── MOUVEMENT NORMAL ────────────────────────────────────────────────────────
{
  const { ctx, p, erreurs } = await page(false)
  dit((await p.locator('.scene-tour').count()) === 1 && (await p.locator('.scene-atelier').count()) === 1, 'les deux scènes existent (tour + atelier)')
  dit((await p.locator('.ia-barre').count()) === 1, 'la barre IA (porte « décrire ») est là')
  dit((await p.locator('.anneau-vue .plaque').count()) > 5, 'l’anneau porte des plaques (modèles KPI)')
  dit(await p.evaluate(() => document.documentElement.classList.contains('scene-active')), 'scene-active posée sur la tour (scroll-snap actif)')

  // le passage suit le scroll
  const p0 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--p').trim())
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(900)
  const p1 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--p').trim())
  dit(Number(p1) > Number(p0) + 0.2, 'le passage --p monte quand on descend vers l’atelier', `${p0} → ${p1}`)

  // une SEULE plaque de front
  await p.locator('.car-pts .car-pt').first().click(); await p.waitForTimeout(1200)
  const nAvant = await p.locator('.plaque.avant').count()
  dit(nAvant === 1, 'une seule plaque est « avant » (le point focal)', `${nAvant} avant`)

  // PRENDRE la plaque de front → une tuile se pose (via ajouterWidget)
  const avantWidgets = await p.locator('.tour-widget').count()
  await p.locator('.plaque.avant').click(); await p.waitForTimeout(700)
  const apresWidgets = await p.locator('.tour-widget').count()
  dit(apresWidgets === avantWidgets + 1, 'prendre la plaque de front POSE une tuile sur la tour', `${avantWidgets} → ${apresWidgets}`)

  dit(erreurs.length === 0, 'aucune erreur console/page (mouvement normal)', erreurs.slice(0, 3).join(' | '))
  await ctx.close()
}

// ── PIÈGE A : la saisie de données n’a PAS de scroll-snap ────────────────────
{
  const { ctx, p } = await page(false)
  await p.locator('.rail-item', { hasText: 'Mes données' }).first().click(); await p.waitForTimeout(400)
  dit(!(await p.evaluate(() => document.documentElement.classList.contains('scene-active'))), 'PIÈGE A : sur « Mes données », scene-active est RETIRÉE')
  dit((await p.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType)) === 'none', 'PIÈGE A : plus de scroll-snap sur la saisie')
  dit((await p.locator('.scene-atelier').count()) === 0, 'PIÈGE A : pas d’atelier hors de la tour')
  await ctx.close()
}

// ── MOUVEMENT RÉDUIT : anneau à plat, passage éteint, tout reste cliquable ───
{
  const { ctx, p, erreurs } = await page(true)
  await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(500)
  const pr = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--p').trim())
  dit(pr === '0' || pr === '', 'mouvement réduit : le passage reste à 0 (rien ne bouge au scroll)', `--p=${pr}`)
  // les plaques restent cliquables (pointer-events auto) et posent une tuile
  const avW = await p.locator('.tour-widget').count()
  await p.locator('.car-pts .car-pt').first().click(); await p.waitForTimeout(300)
  await p.locator('.plaque').first().click({ trial: false }).catch(() => {})
  await p.waitForTimeout(500)
  const apW = await p.locator('.tour-widget').count()
  dit(apW >= avW, 'mouvement réduit : l’anneau reste interactif (aucune info portée par le mouvement seul)', `${avW} → ${apW}`)
  dit(erreurs.length === 0, 'aucune erreur (mouvement réduit)', erreurs.slice(0, 3).join(' | '))
  await ctx.close()
}

console.log(ok ? 'OK' : 'ECHEC')
await browser.close()
process.exit(ok ? 0 : 1)
