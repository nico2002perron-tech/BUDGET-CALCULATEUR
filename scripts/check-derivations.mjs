/* ============================================================================
   check-derivations.mjs — L'ATELIER DE COMPOSITION (derivations.js), pur.
   Une dérivée = une LECTURE bornée, déclarative, calculée depuis des valeurs qui
   EXISTENT (jamais inventée) ; HONNÊTE : rend l'original quand elle ne s'applique
   pas ; OFFERTE seulement là où elle a un sens (forme scalaire, $ , revenu connu).
   Texte factuel filtré (conformité).
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'
import { DERIVATIONS, derivationValide, deriver, derivationsPourKPI } from '../src/recettes/derivations.js'
import { resolveKPI } from '../src/recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../src/recettes/schema.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(exempleStore())
const snapSansRevenu = { ...snap, depenses: { ...snap.depenses, revenu: 0 } }
const rCoutVie = resolveKPI('cout_vie_mensuel', snap) // $ scalaire

console.log('— REGISTRE + validation stricte —')
ok(Array.isArray(DERIVATIONS) && DERIVATIONS.length >= 2 && DERIVATIONS[0].id === 'brut', "registre non vide, 'brut' d'abord")
ok(derivationValide('pct_revenu') && !derivationValide('inconnue') && !derivationValide(42), 'derivationValide strict')

console.log('\n— deriver : transforme quand applicable, sinon RIEN d’inventé —')
ok(rCoutVie && rCoutVie.unite === '$' && typeof rCoutVie.valeur === 'number', `cout_vie_mensuel résout en $ (${rCoutVie.valeur})`, JSON.stringify(rCoutVie))
{
  const d = deriver('pct_revenu', rCoutVie, snap, 'cout_vie_mensuel')
  const attendu = Math.round((rCoutVie.valeur / snap.depenses.revenu) * 100)
  ok(d.unite === '%' && d.valeur === attendu, `pct_revenu : ${rCoutVie.valeur} $ → ${d.valeur} % (attendu ${attendu})`, JSON.stringify(d))
  ok(/% de ton revenu/.test(d.texteFactuel), 'texte factuel « … % de ton revenu … »', d.texteFactuel)
  ok(filtrerFait(d.texteFactuel).ok, 'le texte dérivé passe filtrerFait')
}
ok(deriver('brut', rCoutVie, snap, 'cout_vie_mensuel') === rCoutVie, "'brut' → la résolution d'origine (identité)")
ok(deriver('inconnue', rCoutVie, snap, 'cout_vie_mensuel') === rCoutVie, 'dérivée inconnue → identité')
ok(deriver('pct_revenu', rCoutVie, snapSansRevenu, 'cout_vie_mensuel') === rCoutVie, 'revenu absent → identité (rien inventé)')
ok(deriver('pct_revenu', { disponible: true, valeur: 3, unite: 'mois' }, snap, 'cout_vie_mensuel').unite === 'mois', 'unité ≠ $ → identité (jamais un % sur des mois)')
ok(deriver('pct_revenu', { disponible: false, valeur: null, unite: '$' }, snap, 'cout_vie_mensuel').disponible === false, 'donnée indisponible → identité')
ok(deriver('pct_revenu', { disponible: true, valeur: Infinity, unite: '$' }, snap, 'cout_vie_mensuel').valeur === Infinity, 'valeur non finie → identité')
// FIX REVUE : une dérivée % sur un KPI NON budget (stock/annuel) → identité, même appelée directement.
{
  const rNet = resolveKPI('valeur_nette', snap) // $ mais STOCK (patrimoine)
  ok(!rNet || rNet.unite !== '$' || deriver('pct_revenu', rNet, snap, 'valeur_nette').unite === '$', 'valeur nette (stock $) : deriver pct_revenu → reste en $ (jamais « X % de ton revenu »)', JSON.stringify(rNet))
  ok(!rNet || rNet.unite !== '$' || deriver('pct_depenses', rNet, snap, 'valeur_nette').unite === '$', 'valeur nette (stock $) : deriver pct_depenses → reste en $')
  ok(deriver('pct_revenu', rCoutVie, snap) === rCoutVie, 'deriver sans kpiId → identité (défense en profondeur)')
}
{
  const rTop = resolveKPI('top_categorie', snap) // $ , poste de dépense (budget)
  const d = deriver('pct_depenses', rTop, snap, 'top_categorie')
  const attendu = Math.round((rTop.valeur / snap.depenses.coutVie) * 100)
  ok(d.unite === '%' && d.valeur === attendu, `pct_depenses : ${rTop.valeur} $ → ${d.valeur} % des dépenses (attendu ${attendu})`, JSON.stringify(d))
  ok(/% de tes dépenses/.test(d.texteFactuel) && filtrerFait(d.texteFactuel).ok, 'texte « … % de tes dépenses … » filtré', d.texteFactuel)
  ok(deriver('pct_depenses', rTop, { ...snap, depenses: { ...snap.depenses, coutVie: 0 } }, 'top_categorie') === rTop, 'sans total de dépenses → identité')
  ok(deriver('pct_depenses', { disponible: true, valeur: 3, unite: 'mois' }, snap, 'top_categorie').unite === 'mois', 'pct_depenses : unité ≠ $ → identité')
}

console.log('\n— derivationsPourKPI : offerte seulement là où ça a un sens —')
ok(derivationsPourKPI('cout_vie_mensuel', snap, 'stat').includes('pct_revenu'), 'cout_vie (stat, $, revenu) → pct_revenu offerte')
ok(!derivationsPourKPI('cout_vie_mensuel', snap, 'prisme3d').includes('pct_revenu'), 'forme non scalaire (prisme) → pas offerte (une série resterait en $)')
ok(!derivationsPourKPI('mois_couverts', snap, 'stat').includes('pct_revenu'), 'KPI non-$ (mois_couverts) → pas offerte')
ok(!derivationsPourKPI('cout_vie_mensuel', snapSansRevenu, 'stat').includes('pct_revenu'), 'sans revenu connu → pas offerte (data-aware)')
ok(derivationsPourKPI('cout_vie_mensuel', snap, 'stat')[0] === 'brut', "'brut' toujours en tête")
ok(derivationsPourKPI('top_categorie', snap, 'fait').includes('pct_depenses'), 'poste budget (top_categorie, fait) → pct_depenses offerte')
ok(!derivationsPourKPI('montant_coussin', snap, 'stat').includes('pct_depenses'), 'épargne (montant_coussin) → PAS pct_depenses (pas un poste de dépense)')
ok(!derivationsPourKPI('top_categorie', snap, 'beignet').includes('pct_depenses'), 'forme non scalaire → pct_depenses pas offerte')
// FIX REVUE : un KPI $ NON budget (stock/annuel) n'offre AUCUNE dérivée % (lecture trompeuse).
ok(!derivationsPourKPI('valeur_nette', snap, 'stat').includes('pct_revenu'), 'valeur nette (stock patrimoine, $) → PAS pct_revenu (jamais « 10 000 % de ton revenu »)')
ok(!derivationsPourKPI('montant_coussin', snap, 'stat').includes('pct_revenu'), 'coussin (stock $) → PAS pct_revenu')
ok(!derivationsPourKPI('valeur_nette', snap, 'stat').includes('pct_depenses'), 'valeur nette (non budget) → PAS pct_depenses')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ L’atelier de composition (dérivées) tient — 0 échec (borné, honnête, filtré)')
