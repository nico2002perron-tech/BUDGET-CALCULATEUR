/* ============================================================================
   check-bouge.mjs — LE VIVANT : kpiABouge (a-t-il bougé depuis la dernière visite),
   pur. Compare la VALEUR résolue entre deux snapshots — jamais un chiffre inventé ;
   false si un côté manque (1re visite → rien ne pulse) ou KPI inconnu.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'
import { kpiABouge, resolveKPI } from '../src/recettes/bibliotheque-kpis.js'

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

console.log('\n— FIX REVUE : valeur OBJET → jamais un faux positif (pas de compare par référence) —')
{
  // equilibre_503020 rend valeur = un OBJET {besoin,envie,epargne}. Deux instances
  // ÉGALES-mais-distinctes (baseline désérialisée ≠ live) → l'ancien code pulsait à tort.
  const snapB = { ...snap, depenses: { ...snap.depenses, pct: snap.depenses.pct ? { ...snap.depenses.pct } : snap.depenses.pct } }
  const vEq = resolveKPI('equilibre_503020', snap).valeur
  ok(vEq && typeof vEq === 'object', `equilibre_503020 rend bien un OBJET (${JSON.stringify(vEq)})`)
  ok(kpiABouge('equilibre_503020', snap, snapB) === false, 'valeur objet égale (instances distinctes) → NE pulse PAS (plus de faux positif permanent)')
}

console.log('\n— FIX REVUE : le ctx (params de la tuile) est passé aux deux résolutions —')
{
  const ctx = { objectif: { cible: 20000 } }
  const avecCtx = resolveKPI('pct_atteint', snap, ctx)
  const sansCtx = resolveKPI('pct_atteint', snap)
  ok(avecCtx && avecCtx.disponible && typeof avecCtx.valeur === 'number', `avec ctx : pct_atteint résout (${avecCtx && avecCtx.valeur})`, JSON.stringify(avecCtx))
  ok(!sansCtx || sansCtx.valeur == null, 'sans ctx : pct_atteint rend null (d’où le faux négatif sans le fix)', JSON.stringify(sansCtx))
  // sans ctx → null des deux côtés → n'aurait jamais pulsé ; avec ctx la valeur existe donc PEUT pulser
  ok(kpiABouge('pct_atteint', snap, snap, ctx) === false, 'même snapshot + ctx → pas de mouvement (mais résolu, donc capable de pulser)')
}

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Le vivant (kpiABouge) tient — 0 échec (factuel, prudent, valeur primitive, ctx câblé)')
