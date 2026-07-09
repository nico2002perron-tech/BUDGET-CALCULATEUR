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
  const d = deriver('pct_revenu', rCoutVie, snap)
  const attendu = Math.round((rCoutVie.valeur / snap.depenses.revenu) * 100)
  ok(d.unite === '%' && d.valeur === attendu, `pct_revenu : ${rCoutVie.valeur} $ → ${d.valeur} % (attendu ${attendu})`, JSON.stringify(d))
  ok(/% de ton revenu/.test(d.texteFactuel), 'texte factuel « … % de ton revenu … »', d.texteFactuel)
  ok(filtrerFait(d.texteFactuel).ok, 'le texte dérivé passe filtrerFait')
}
ok(deriver('brut', rCoutVie, snap) === rCoutVie, "'brut' → la résolution d'origine (identité)")
ok(deriver('inconnue', rCoutVie, snap) === rCoutVie, 'dérivée inconnue → identité')
ok(deriver('pct_revenu', rCoutVie, snapSansRevenu) === rCoutVie, 'revenu absent → identité (rien inventé)')
ok(deriver('pct_revenu', { disponible: true, valeur: 3, unite: 'mois' }, snap).unite === 'mois', 'unité ≠ $ → identité (jamais un % sur des mois)')
ok(deriver('pct_revenu', { disponible: false, valeur: null, unite: '$' }, snap).disponible === false, 'donnée indisponible → identité')
ok(deriver('pct_revenu', { disponible: true, valeur: Infinity, unite: '$' }, snap).valeur === Infinity, 'valeur non finie → identité')

console.log('\n— derivationsPourKPI : offerte seulement là où ça a un sens —')
ok(derivationsPourKPI('cout_vie_mensuel', snap, 'stat').includes('pct_revenu'), 'cout_vie (stat, $, revenu) → pct_revenu offerte')
ok(!derivationsPourKPI('cout_vie_mensuel', snap, 'prisme3d').includes('pct_revenu'), 'forme non scalaire (prisme) → pas offerte (une série resterait en $)')
ok(!derivationsPourKPI('mois_couverts', snap, 'stat').includes('pct_revenu'), 'KPI non-$ (mois_couverts) → pas offerte')
ok(!derivationsPourKPI('cout_vie_mensuel', snapSansRevenu, 'stat').includes('pct_revenu'), 'sans revenu connu → pas offerte (data-aware)')
ok(derivationsPourKPI('cout_vie_mensuel', snap, 'stat')[0] === 'brut', "'brut' toujours en tête")

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ L’atelier de composition (dérivées) tient — 0 échec (borné, honnête, filtré)')
