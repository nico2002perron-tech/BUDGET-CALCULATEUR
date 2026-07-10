/* ============================================================================
   check-decoupes.mjs — L'ATELIER DE COMPOSITION : LA DÉCOUPE (decoupes.js), pure.
   Registre fermé + validation stricte ; les parts viennent du snapshot (jamais
   inventées) ; offerte SEULEMENT sur une forme-parts, un KPI budget, avec une
   vraie alternative (donnée fixe/variable). Sinon rien.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'
import { DECOUPES, decoupeValide, partsDecoupe, decoupesPourKPI } from '../src/recettes/decoupes.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(exempleStore())
const el = snap.depenses && snap.depenses.engageLibre

console.log('— REGISTRE + validation stricte —')
ok(Array.isArray(DECOUPES) && DECOUPES[0].id === 'par_categorie', "registre non vide, 'par_categorie' d'abord (le défaut)")
ok(decoupeValide('fixe_variable') && !decoupeValide('par_lune') && !decoupeValide(7), 'decoupeValide strict')

console.log('\n— partsDecoupe : les parts viennent du snapshot, jamais inventées —')
ok(el && (el.fixe > 0 || el.variable > 0), `l'exemple a une donnée fixe/variable (${el && el.fixe} / ${el && el.variable})`, JSON.stringify(el))
{
  const p = partsDecoupe('fixe_variable', snap)
  ok(p && Array.isArray(p.parCategorie) && p.parCategorie.length === 2, 'fixe_variable → 2 parts')
  ok(p && p.parCategorie[0].montant === Math.round(el.fixe) || (p && p.parCategorie[0].montant === el.fixe), 'la part Fixe = la donnée du snapshot', JSON.stringify(p && p.parCategorie[0]))
  ok(p && p.total === (Math.round(el.fixe) + Math.round(el.variable)) || (p && p.total === el.fixe + el.variable), 'le total = fixe + variable', String(p && p.total))
  ok(p && p.parCategorie[0].classe !== p.parCategorie[1].classe, 'deux classes (couleurs) distinctes')
}
ok(partsDecoupe('par_categorie', snap) === null, "'par_categorie' (défaut) → null (passe par partsDuKPI)")
ok(partsDecoupe('fixe_variable', { depenses: {} }) === null, 'sans donnée fixe/variable → null (rien inventé)')
ok(partsDecoupe('fixe_variable', null) === null, 'snapshot null → null')

console.log('\n— decoupesPourKPI : offerte seulement là où ça a un sens —')
ok(JSON.stringify(decoupesPourKPI('top_categorie', snap, 'beignet')) === JSON.stringify(['par_categorie', 'fixe_variable']), 'top_categorie (budget, beignet, donnée) → les 2 découpes')
ok(decoupesPourKPI('top_categorie', snap, 'stat').length === 0, 'forme non-parts (stat) → aucune découpe')
ok(decoupesPourKPI('mois_couverts', snap, 'beignet').length === 0, 'KPI non-budget (coussin) → aucune découpe')
ok(decoupesPourKPI('top_categorie', { depenses: { parCategorie: [] } }, 'beignet').length === 0, 'sans donnée fixe/variable → aucune découpe (pas de choix vide)')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ La découpe tient — 0 échec (bornée, honnête, data-aware)')
