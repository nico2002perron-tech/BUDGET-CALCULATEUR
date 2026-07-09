/* ============================================================================
   check-perches.mjs — LES PERCHES du copilote (data-aware, honnêtes), pur.
   Headless (node) : chaque perche produit un VRAI changement (jamais un no-op /
   un refus), ≤3, labels filtrés ; data-aware (une famille absente → pas de
   perche) ; anti-doublon board (pas de perche pour une tuile déjà là).
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore, DEMO_SAISONNIER } from '../src/lib/storage.js'
import { perchesSable, perchesBoard, PLACEHOLDERS_SABLE, PLACEHOLDERS_BOARD, gestesDe, prochainePerche } from '../src/recettes/perches.js'
import { executerActions } from '../src/recettes/actions.js'
import { filtrerFait } from '../src/recettes/schema.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const ex = exempleStore()
const snapEx = snapshotFromStore({ ...ex, revenus: { ...ex.revenus, brutAnnuel: 52000 } })
const snapSaison = snapshotFromStore(DEMO_SAISONNIER) // saison seule (pas de coussin/fiscalité/patrimoine)

console.log('— PERCHES DU SABLE : data-aware, chacune produit un vrai changement —')
{
  // scène saisonnière (amplitude_revenus), forme COURBE (comparable), rien de posé
  const widget = { id: 'w1', recette: { situation: 'kpi_amplitude_revenus', titre: 'Ma saison', blocs: [{ KPI: 'amplitude_revenus', forme: 'courbe', params: {} }] }, accent: '#7a6fe6' }
  const scene = { widgetId: 'w1', kpiId: 'amplitude_revenus', forme: 'courbe', comparaisons: [], cible: null, objectif: undefined }
  const p = perchesSable(scene, widget, snapEx)
  ok(p.length > 0 && p.length <= 3, `saisonnier : ${p.length} perche(s) (≤3)`, p.map((x) => x.label).join(' | '))
  ok(p.some((x) => /moyenne/i.test(x.label)), 'perche « Compare à ta moyenne » offerte (saisonnier + forme comparable)')
  // forme NON comparable (nuage) → la comparaison n'a pas d'effet visible → pas de perche « moyenne »
  const pNuage = perchesSable({ ...scene, forme: 'nuage' }, { ...widget, recette: { ...widget.recette, blocs: [{ KPI: 'amplitude_revenus', forme: 'nuage', params: {} }] } }, snapEx)
  ok(!pNuage.some((x) => /à ta moyenne|coût de vie/i.test(x.label)), 'forme non comparable (nuage) : PAS de perche comparaison (jamais un faux « Fait »)', pNuage.map((x) => x.label).join(' | '))
  ok(p.some((x) => /relief|courbe/i.test(x.label)), 'perche « voir autrement » (relief/courbe)')
  ok(p.some((x) => /cible/i.test(x.label)), 'perche « Pose une cible » (KPI à réglage série)')
  // chaque perche APPLIQUE vraiment (dry-run → faites)
  const etat = { widgets: [widget], sable: scene }
  ok(p.every((x) => executerActions(x.actions, { snapshot: snapEx }, etat).faites.length === x.actions.length), 'chaque perche produit un vrai changement (aucun no-op / refus)')
  ok(p.every((x) => filtrerFait(x.label).ok), 'tous les labels passent filtrerFait')
  // couleur : jamais l'accent courant
  const couleur = p.find((x) => /mets-le en/i.test(x.label))
  if (couleur) ok(couleur.actions[0].couleur !== '#7a6fe6' && couleur.actions[0].couleur !== 'lavande', 'perche couleur ≠ l’accent courant')

  // une fois la moyenne DÉJÀ comparée → plus de perche « moyenne » (pas de no-op)
  const scene2 = { ...scene, comparaisons: [{ contexte: 'moyenne', label: 'ta moyenne' }] }
  const p2 = perchesSable(scene2, widget, snapEx)
  ok(!p2.some((x) => /à ta moyenne/i.test(x.label)), 'moyenne déjà comparée → la perche disparaît (honnête)')

  // KPI non saisonnier (patrimoine) → pas de perche « comparer » saisonnière
  const wPat = { id: 'wp', recette: { situation: 'kpi_valeur_nette', titre: 'x', blocs: [{ KPI: 'valeur_nette', forme: 'stat', params: {} }] } }
  const scenePat = { widgetId: 'wp', kpiId: 'valeur_nette', forme: 'stat', comparaisons: [], cible: null }
  const pPat = perchesSable(scenePat, wPat, snapEx)
  ok(!pPat.some((x) => /moyenne|coût de vie/i.test(x.label)), 'KPI patrimoine : aucune perche de comparaison saisonnière')
}

console.log('\n— PERCHES DU BOARD : départs data-aware + anti-doublon —')
{
  const p0 = perchesBoard([], snapEx)
  ok(p0.length > 0 && p0.length <= 3, `board vide (données riches) : ${p0.length} départ(s) (≤3)`, p0.map((x) => x.label).join(' | '))
  ok(p0.every((x) => x.actions[0] && (x.actions[0].verbe === 'creer_widget' || x.actions[0].verbe === 'repondre_kpi')), 'chaque départ = creer_widget ou repondre_kpi')
  ok(p0.every((x) => filtrerFait(x.label).ok), 'labels board filtrés')
  ok(p0.every((x) => executerActions(x.actions, { snapshot: snapEx }, { widgets: [], sable: null }).faites.length === 1), 'chaque départ crée vraiment une tuile (dry-run)')

  // anti-doublon : si le coussin est déjà dans la tour, plus de perche coussin
  const wCoussin = { id: 'wc', recette: { situation: 'kpi_mois_couverts', titre: 'Mon coussin', blocs: [{ KPI: 'mois_couverts', forme: 'jauge', params: {} }] } }
  const p1 = perchesBoard([wCoussin], snapEx)
  ok(!p1.some((x) => x.actions[0].kpi === 'mois_couverts'), 'coussin déjà présent → plus de perche coussin (anti-doublon)')

  // données maigres (saison seule) → seulement les départs soutenus
  const pMaigre = perchesBoard([], snapSaison)
  ok(!pMaigre.some((x) => x.actions[0].kpi === 'taux_effectif' || x.actions[0].kpi === 'valeur_nette'), 'sans fiscalité/patrimoine : pas de départ impôts/patrimoine (data-aware)')
  ok(pMaigre.some((x) => x.actions[0].kpi === 'amplitude_revenus'), 'saison présente : le départ saisonnier reste offert')
}

console.log('\n— ENSEIGNEMENT PROGRESSIF : le prochain geste pas encore appris —')
{
  const widget = { id: 'w1', recette: { situation: 'kpi_amplitude_revenus', titre: 'x', blocs: [{ KPI: 'amplitude_revenus', forme: 'courbe', params: {} }] }, accent: '#7a6fe6' }
  const scene = { widgetId: 'w1', kpiId: 'amplitude_revenus', forme: 'courbe', comparaisons: [], cible: null }
  const p = perchesSable(scene, widget, snapEx)
  // gestesDe : une salve → ses capacités distinctes
  ok(JSON.stringify(gestesDe([{ verbe: 'ajouter_comparateur' }, { verbe: 'changer_forme' }, { verbe: 'retirer_comparateur' }])) === JSON.stringify(['comparer', 'forme']), 'gestesDe : capacités DISTINCTES d’une salve (comparer, forme)')
  // rien appris → le prochain = la 1re perche
  const p0 = prochainePerche(p, [])
  ok(p0 && p0.label === p[0].label, 'rien appris → le prochain = la 1re perche')
  // « comparer » appris → le prochain saute la perche de comparaison
  const geste1 = p[0].actions[0].verbe // ex. ajouter_comparateur → 'comparer'
  const su = gestesDe([{ verbe: geste1 }])
  const p1 = prochainePerche(p, su)
  ok(p1 && p1.label !== p[0].label, 'geste appris → le prochain PASSE au geste suivant (déverrouillage un à un)', p1 && p1.label)
  // tout appris → plus de nudge
  const tout = ['comparer', 'forme', 'cible', 'couleur', 'nom', 'creer', 'repondre', 'retirer', 'taille', 'ouvrir']
  ok(prochainePerche(p, tout) === null, 'tout appris → plus de nudge (on ne réenseigne pas ce qu’on sait)')
}

console.log('\n— Les placeholders tournants (exemples neutres, filtrés) —')
ok(PLACEHOLDERS_SABLE.length >= 3 && PLACEHOLDERS_SABLE.every((t) => filtrerFait(t).ok), 'placeholders sable filtrés')
ok(PLACEHOLDERS_BOARD.length >= 3 && PLACEHOLDERS_BOARD.every((t) => filtrerFait(t).ok), 'placeholders board filtrés')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Les perches tiennent — 0 échec (page blanche réglée, honnêtement)')
