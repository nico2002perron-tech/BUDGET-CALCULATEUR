/* ============================================================================
   check-memoire-visite.mjs — LA MÉMOIRE INTER-VISITE (VISION §7a·1). Prouve, sans
   navigateur (localStorage simulé), que « ce qui bouge » se mesure d'une VISITE à
   l'autre, pas seulement pendant la session :
     - round-trip : saveBaseline(snap) → loadBaseline() rend { snapshot, visitedAt } ;
     - silo SÉPARÉ : le repère n'écrit jamais dans le silo budget (budgetcalc_v1) ;
     - bout-en-bout : un palier de coussin franchi DEPUIS la dernière visite → événement ;
     - 1re visite (aucun repère) → SILENCE : rien de détecté (jamais inventé, §10) ;
     - robustesse : absent / corrompu → null, jamais d'exception.
   Lance : node scripts/check-memoire-visite.mjs
   ========================================================================== */
import { createServer } from 'vite'

// localStorage simulé (Node n'en a pas) — storage.js n'y touche QUE dans ses fonctions,
// donc le poser avant tout appel suffit. On garde la Map pour inspecter les clés écrites.
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }

try {
  const { loadBaseline, saveBaseline, STORAGE_KEY, BASELINE_KEY } = await vite.ssrLoadModule('/src/lib/storage.js')
  const { genererEvenements } = await vite.ssrLoadModule('/src/lib/evenements.js')

  // Deux visites : seul le coussin change (2,0 → 3,2 mois). Dépenses identiques → l'unique
  // événement attendu est le PALIER franchi, pas une bascule de flux.
  const derniereVisite = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 4000, moisCouverts: 2.0, essentielles: 2000 } }
  const maintenant = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 6500, moisCouverts: 3.2, essentielles: 2000 } }

  console.log('— 1re visite : aucun repère encore —')
  ok(loadBaseline() === null, 'loadBaseline() → null (rien de persisté)')
  ok(genererEvenements(maintenant, null).every((e) => e.type !== 'seuil_franchi' && e.type !== 'changement'), 'sans repère → aucun événement détecté (silence, jamais inventé)')

  console.log('\n— Départ : on estampille le snapshot courant —')
  ok(saveBaseline(derniereVisite) === true, 'saveBaseline(snapshot) → true')
  const repere = loadBaseline()
  ok(repere && JSON.stringify(repere.snapshot) === JSON.stringify(derniereVisite), 'loadBaseline().snapshot = le snapshot enregistré (round-trip exact)')
  ok(repere && typeof repere.visitedAt === 'string' && repere.visitedAt.length > 0, 'visitedAt horodaté (→ « il y a N jours »)')
  ok(mem.has(BASELINE_KEY) && !mem.has(STORAGE_KEY), `silo séparé : écrit dans ${BASELINE_KEY}, jamais dans ${STORAGE_KEY}`)

  console.log('\n— Visite suivante : « ce qui a bougé depuis » —')
  const evts = genererEvenements(maintenant, loadBaseline().snapshot)
  ok(evts.some((e) => e.quand === 'detecte'), 'le repère persisté fait émerger au moins un changement détecté')
  const palier = evts.find((e) => e.type === 'seuil_franchi')
  ok(!!palier, 'palier de coussin franchi depuis la dernière visite → événement émis')
  ok(palier && /3 mois/.test(palier.titre), `le palier nomme « 3 mois » — « ${palier && palier.titre} »`)
  // Le coussin qui grossit raccourcit AUSSI l'horizon vers la cible → un changement d'horizon
  // légitime peut accompagner le palier (propagation via evaluerGraphe). Ce qu'on EXCLUT : une
  // fausse exception (ambre) alors que le flux disponible, lui, n'a pas bougé.
  ok(!evts.some((e) => e.severite === 'exception'), 'flux inchangé → aucune fausse exception (ambre)')

  console.log('\n— Robustesse : absent / corrompu → null, jamais d’exception —')
  mem.delete(BASELINE_KEY)
  ok(loadBaseline() === null, 'repère absent → null')
  mem.set(BASELINE_KEY, '{pas du json')
  ok(loadBaseline() === null, 'repère corrompu → null (aucune exception)')
  mem.set(BASELINE_KEY, JSON.stringify({ visitedAt: '2026-01-01' })) // sans snapshot
  ok(loadBaseline() === null, 'repère sans snapshot → null')
  ok(saveBaseline(null) === false && saveBaseline(undefined) === false, 'saveBaseline(null/undefined) → false (rien écrit)')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ La mémoire inter-visite tient — 0 échec (« ce qui a bougé depuis ta dernière visite » survit au rechargement)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
