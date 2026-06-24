/* ============================================================================
   check-data.mjs — vérifie la couche données isolément (entrées → sorties) :
   le snapshot canonique sur le profil démo + les formules budget sur un cas type.
   Lance : node scripts/check-data.mjs
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { DEMO_SAISONNIER } from '../src/lib/storage.js'
import { totaux, repartition, engageLibre } from '../src/lib/budget.js'

console.log('— Snapshot canonique (profil démo saisonnier) —')
const snap = snapshotFromStore(DEMO_SAISONNIER)
console.log('  clés du contrat :', Object.keys(snap).join(', '))
console.log('  identity        :', JSON.stringify(snap.identity))
console.log('  budget          :', snap.budget) // null attendu (saisonnier sans budget détaillé)
console.log('  saison.revenus  :', JSON.stringify(snap.saison.revenusMensuels))
console.log('  saison.depenses :', snap.saison.depensesMensuelles, '$/mois  | coussin :', snap.saison.coussin, '$')
const revAnnuel = snap.saison.revenusMensuels.reduce((a, b) => a + b, 0)
const moisDeficit = snap.saison.revenusMensuels.filter((r) => r < snap.saison.depensesMensuelles).length
console.log('  → revenu annuel :', revAnnuel, '$  | mois sous le seuil de dépenses :', moisDeficit)

console.log('\n— Formules budget (cas type : 4000 $ rev, besoins/envies/épargne) —')
const cas = {
  revenus: [{ montant: 4000 }],
  depenses: [
    { montant: 1400, classe: 'besoin', type: 'fixe' }, // loyer
    { montant: 400, classe: 'besoin', type: 'variable' }, // épicerie
    { montant: 600, classe: 'envie', type: 'variable' }, // sorties
    { montant: 300, classe: 'envie', type: 'fixe' }, // abonnements
    { montant: 500, classe: 'epargne', type: 'fixe' }, // REER
  ],
}
console.log('  totaux       :', JSON.stringify(totaux(cas)))
console.log('  repartition  :', JSON.stringify(repartition(cas)), '(% du revenu — repère 50/30/20)')
console.log('  engageLibre  :', JSON.stringify(engageLibre(cas)), '(fixe vs variable, hors épargne)')

// Vérifs simples
const t = totaux(cas)
const ok = t.revenu === 4000 && t.besoins === 1800 && t.envies === 900 && t.epargne === 500 && t.depenseTotal === 2700
const el = engageLibre(cas)
const ok2 = el.engage === 1700 && el.libre === 1000 && el.total === 2700 // fixe=1400+300, variable=400+600
console.log('\n' + (ok && ok2 ? '✅ Formules budget conformes (totaux + engageLibre)' : '❌ Écart dans les formules budget'))
process.exit(ok && ok2 ? 0 : 1)
