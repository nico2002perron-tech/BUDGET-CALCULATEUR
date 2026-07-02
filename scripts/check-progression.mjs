/* ============================================================================
   check-progression.mjs — LE CERVEAU d'« Allume ta tour » (lib/progression.js),
   prouvé headless. Prouve :
     - tour VIERGE → 5 étages éteints, conditions factuelles, 0 pièce prête ;
     - profil exemple → les étages s'allument selon DONNEE_DISPO (source unique) ;
     - fenêtres : chaque indicateur créé se branche au BON étage ;
     - pièces : les comptes se dérivent de candidatsKPI (jamais recomptés à la main) ;
     - navigation : chaque étage sait où sa donnée se saisit ;
     - conformité : un fait sur L'OUTIL, jamais un score de santé financière.
   Lance : node scripts/check-progression.mjs
   ========================================================================== */
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }

try {
  const { construireProgression, etageDuWidget } = await vite.ssrLoadModule('/src/lib/progression.js')
  const { candidatsKPI, REGISTRE_KPIS } = await vite.ssrLoadModule('/src/recettes/bibliotheque-kpis.js')
  const { filtrerFait } = await vite.ssrLoadModule('/src/recettes/schema.js')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { exempleStore } = await vite.ssrLoadModule('/src/lib/storage.js')

  console.log('— Tour vierge : tout est éteint, honnêtement —')
  const vide = construireProgression({}, [], [])
  ok(vide.etages.length === 5, '5 étages (fondation Revenus → Projets)')
  ok(vide.etages.every((e) => e.etat === 'eteint'), 'aucune donnée → tous éteints')
  ok(vide.etages.every((e) => typeof e.condition === 'string' && e.condition.length > 0), 'chaque étage éteint dit ce qui l\'allume')
  ok(vide.antenne.active === false, 'pas de projection → antenne au repos')
  ok(vide.totaux.piecesPretes === 0 && vide.totaux.piecesAVenir > 0, `0 pièce prête, ${vide.totaux.piecesAVenir} à venir (le registre attend)`)

  console.log('\n— Profil exemple : les étages s\'allument selon DONNEE_DISPO —')
  const snap = snapshotFromStore(exempleStore())
  const p = construireProgression(snap, [], [])
  const etat = Object.fromEntries(p.etages.map((e) => [e.id, e.etat]))
  ok(etat.revenus === 'allume' && etat.depenses === 'allume' && etat.coussin === 'allume' && etat.patrimoine === 'allume', 'revenus + dépenses + coussin + patrimoine allumés')
  ok(etat.projets === 'eteint', 'aucun projet créé → Projets éteint')
  ok(p.totaux.allumes === 4 && p.totaux.etages === 5, '4 étages allumés sur 5')
  ok(p.antenne.active === true, 'projection présente → l\'antenne balaie')
  ok(p.etages.filter((e) => e.etat === 'allume').every((e) => e.condition === null), 'un étage allumé n\'a plus de condition')

  console.log('\n— Fenêtres : chaque indicateur se branche au bon étage —')
  const widgets = [
    { recette: { situation: 'mon_budget', blocs: [] } },
    { recette: { situation: 'objectif_epargne', blocs: [] } },
    { recette: { situation: 'revenu_saisonnier', blocs: [] } },
    { recette: { situation: 'mystere', blocs: [{ KPI: 'mois_couverts', forme: 'jauge' }] } },
    { recette: { situation: 'mystere2', blocs: [{ type: 'carte_entite', params: {} }] } },
  ]
  const pf = construireProgression(snap, widgets, [])
  const fen = Object.fromEntries(pf.etages.map((e) => [e.id, e.fenetres]))
  ok(fen.depenses === 1, 'mon_budget → étage Dépenses')
  ok(fen.projets === 2, 'objectif_epargne + carte_entite → étage Projets')
  ok(fen.revenus === 1, 'revenu_saisonnier → fondation Revenus')
  ok(fen.coussin === 1, 'situation inconnue mais KPI héros mois_couverts → étage Coussin')
  ok(pf.totaux.fenetres === 5, '5 fenêtres au total')
  ok(pf.etages.find((e) => e.id === 'projets').etat === 'allume', 'un indicateur-projet allume l\'étage Projets')
  ok(etageDuWidget(null) === 'projets' && etageDuWidget({}) === 'projets', 'widget inconnu → Projets (c\'est TON projet), jamais d\'erreur')

  console.log('\n— Entités : un projet fabriqué au studio allume l\'étage —')
  const pe = construireProgression(snap, [], [{ id: 'goal_1', kind: 'goal' }])
  ok(pe.etages.find((e) => e.id === 'projets').etat === 'allume', 'entité goal → Projets allumé')

  console.log('\n— Pièces : dérivées de candidatsKPI, jamais recomptées à la main —')
  const DOMAINES = { saisonnier: 'revenus', impot: 'revenus', budget: 'depenses', dette: 'depenses', coussin: 'coussin', patrimoine: 'patrimoine', objectif: 'projets' }
  const attendues = Object.keys(DOMAINES).reduce((n, d) => n + candidatsKPI(d, snap).length, 0)
  ok(p.totaux.piecesPretes === attendues, `piecesPretes = Σ candidatsKPI (${attendues})`)
  const totalRegistre = REGISTRE_KPIS.filter((k) => DOMAINES[k.domaine]).length
  ok(p.totaux.piecesPretes + p.totaux.piecesAVenir === totalRegistre, `prêtes + à venir = tout le registre mappé (${totalRegistre})`)

  console.log('\n— Navigation : chaque étage sait où sa donnée se saisit —')
  const nav = Object.fromEntries(p.etages.map((e) => [e.id, e.sousSection]))
  ok(nav.revenus === 'revenus' && nav.depenses === 'depenses' && nav.patrimoine === 'placements', 'revenus/dépenses/patrimoine → leurs sous-sections')
  ok(nav.coussin === 'revenus', 'coussin → il se saisit avec les revenus')
  ok(nav.projets === null, 'projets → la surface créer (pas une sous-section)')

  console.log('\n— Conformité : des faits sur l\'outil, jamais un jugement —')
  ok(vide.etages.every((e) => filtrerFait(e.condition).ok), 'chaque condition passe filtrerFait')
  ok(vide.etages.every((e) => !/sant|bravo|retard|avance/i.test(e.condition || '')), 'aucun vocabulaire de score/jugement')

  console.log('\n— Robustesse —')
  ok(construireProgression(null).etages.length === 5, 'snapshot null → tour vierge propre, jamais d\'exception')
  ok(construireProgression(snap, null, null).totaux.fenetres === 0, 'widgets/entités null → 0 fenêtre, jamais d\'exception')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Le cerveau de la tour tient — 0 échec (les étages s\'allument par les données, les pièces par le registre)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
