/* ============================================================================
   check-vue-objectif.mjs — L'ADVISOR CONFORME (vue-objectif.js), pur. Un but →
   une VUE de FAITS (KPI objectif), data-aware, sans le héros, cible partagée ;
   [] si cible absente/nulle ou rien ne résout. Aucun fait inventé, aucun jugement.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'
import { composerVueObjectif } from '../src/recettes/vue-objectif.js'
import { kpiPourId, resolveKPI } from '../src/recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../src/recettes/schema.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(exempleStore())
const objectif = { id: 'maison', nom: 'Maison', cible: 20000 }

console.log('— La vue composée : des FAITS résolubles, cible partagée, sans le héros —')
const vue = composerVueObjectif(objectif, snap, 'horizon_objectif')
ok(vue.length >= 2, `la vue compose ${vue.length} fait(s)`, vue.map((r) => r.blocs[0].KPI).join(', '))
ok(vue.every((r) => kpiPourId(r.blocs[0].KPI) && kpiPourId(r.blocs[0].KPI).domaine === 'objectif'), 'chaque tuile est un KPI de domaine objectif')
ok(vue.every((r) => r.blocs[0].params.objectif.cible === 20000), 'toutes partagent la MÊME cible (20 000)')
ok(!vue.some((r) => r.blocs[0].KPI === 'horizon_objectif'), 'le héros (horizon_objectif) est EXCLU (pas de doublon)')
ok(vue.every((r) => typeof r.situation === 'string' && r.titre), 'chaque recette a situation + titre')
// data-aware : chacune résout VRAIMENT (jamais un fait absent)
ok(vue.every((r) => { const rr = resolveKPI(r.blocs[0].KPI, snap, { objectif }); return rr && rr.disponible }), 'chaque fait de la vue RÉSOUT vraiment (data-aware)')

console.log('\n— Conformité : les faits énoncés passent filtrerFait (jamais un conseil) —')
{
  const textes = vue.map((r) => resolveKPI(r.blocs[0].KPI, snap, { objectif }).texteFactuel).filter((t) => t && t.trim())
  ok(textes.length >= 1, `textes factuels : ${textes.length}`)
  ok(textes.every((t) => filtrerFait(t).ok), 'tous les faits de la vue passent filtrerFait', textes.join(' | ').slice(0, 120))
}

console.log('\n— Prudence : rien sans cible, jamais un plantage —')
ok(composerVueObjectif({ id: 'x', cible: 0 }, snap).length === 0, 'cible 0 → [] (rien à composer)')
ok(composerVueObjectif(null, snap).length === 0, 'objectif null → []')
ok(composerVueObjectif(objectif, null).length === 0, 'snapshot null → []')
ok(composerVueObjectif({ id: 'x', cible: 20000 }, { depenses: {} }).length === 0, 'snapshot maigre (pas de capacité/coussin) → [] (data-aware)')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ L’advisor conforme (vue-objectif) tient — 0 échec (faits, data-aware, jamais un conseil)')
