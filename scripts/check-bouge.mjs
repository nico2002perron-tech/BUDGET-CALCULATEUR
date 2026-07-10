/* ============================================================================
   check-bouge.mjs — LE VIVANT : kpiABouge (a-t-il bougé depuis la dernière visite),
   pur. Compare la VALEUR résolue entre deux snapshots — jamais un chiffre inventé ;
   false si un côté manque (1re visite → rien ne pulse) ou KPI inconnu.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'
import { kpiABouge } from '../src/recettes/bibliotheque-kpis.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(exempleStore())
const snapCoutVie = { ...snap, depenses: { ...snap.depenses, coutVie: snap.depenses.coutVie + 500 } }

console.log('— kpiABouge : détecte un vrai changement, ignore l’immobile —')
ok(kpiABouge('cout_vie_mensuel', snap, snapCoutVie) === true, 'coût de vie modifié → a bougé')
ok(kpiABouge('cout_vie_mensuel', snap, snap) === false, 'même snapshot → n’a pas bougé')
ok(kpiABouge('mois_couverts', snap, snapCoutVie) === false, 'un KPI dont la donnée n’a pas changé → immobile')

console.log('\n— Prudence : rien sans repère, jamais de plantage —')
ok(kpiABouge('cout_vie_mensuel', null, snap) === false, '1re visite (pas de baseline) → false')
ok(kpiABouge('cout_vie_mensuel', snap, null) === false, 'snapshot courant absent → false')
ok(kpiABouge('kpi_inexistant', snap, snapCoutVie) === false, 'KPI inconnu → false')

console.log('\n— Donnée qui APPARAÎT / DISPARAÎT compte comme un mouvement —')
{
  const snapSansCoussin = { ...snap, coussin: { ...snap.coussin, moisCouverts: null } }
  ok(kpiABouge('mois_couverts', snapSansCoussin, snap) === true, 'la donnée apparaît (null → valeur) → a bougé')
  ok(kpiABouge('mois_couverts', snap, snapSansCoussin) === true, 'la donnée disparaît (valeur → null) → a bougé')
}

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Le vivant (kpiABouge) tient — 0 échec (factuel, prudent)')
