/* ============================================================================
   check-calendrier.mjs — prouve la logique PURE du calendrier :
   dépenses récurrentes filtrées, paies/sorties placées sur les bons jours,
   échéances datées triées dans l'horizon. 0 montant inventé.
   Lance : node scripts/check-calendrier.mjs
   ========================================================================== */
import { depensesRecurrentes, evenementsDuMois, prochainesEcheances, revenuParPaie } from '../src/lib/calendrier.js'
import { totalDepensesVie, totalClasse, depensesParDefaut } from '../src/lib/depenses.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

const DEP = [
  { id: 'cat_logement', label: 'Logement', classe: 'besoin', type: 'fixe', montant: 1100, jour: 1 },
  { id: 'cat_transport', label: 'Transport', classe: 'besoin', type: 'variable', montant: 350, jour: null },
  { id: 'cat_dettes_impots', label: 'Dettes', classe: 'besoin', type: 'fixe', montant: 0, jour: 21 }, // 0 → exclu
  { id: 'fix_epargne', label: 'Épargne', classe: 'epargne', type: 'fixe', montant: 200, jour: 1 },
]

console.log('— Dépenses récurrentes (fixes datées, montant > 0) —')
const rec = depensesRecurrentes(DEP)
ok(rec.length === 2, 'garde Logement + Épargne (Transport variable et Dettes à 0 exclus)')
ok(rec.every((d) => d.jour > 0 && d.montant > 0), 'chaque récurrente a un jour et un montant')

console.log('\n— Totaux dépenses —')
ok(totalDepensesVie(DEP) === 1450, 'coût de vie = 1100 + 350 (hors épargne)')
ok(totalClasse(DEP, 'epargne') === 200, 'épargne = 200')
ok(depensesParDefaut().length === 11, 'gabarit = 11 catégories pré-remplies')
ok(depensesParDefaut().every((d) => d.montant === null), 'gabarit : aucun montant inventé')

console.log('\n— Événements du mois (juin 2026, régulier mensuel le 15, 3000/paie) —')
const ev = evenementsDuMois({ mode: 'regulier', freq: 'monthly', montantParPaie: 3000, jours: [15] }, rec, 2026, 5)
ok(ev.entrees.length === 1 && ev.entrees[0].jour === 15 && ev.entrees[0].montant === 3000, 'paie de 3000 le 15')
ok(ev.sorties.length === 2 && ev.sorties.some((s) => s.jour === 1 && s.montant === 1100), 'sorties placées (Logement le 1er)')
ok(revenuParPaie({ mode: 'regulier', montantParPaie: 3000 }) === 3000, 'revenuParPaie régulier = montant par paie')

console.log('\n— Événements saisonnier (revenu du mois posé le 1er) —')
const rep = [0, 0, 800, 3200, 5600, 6800, 7200, 7000, 6200, 4200, 1200, 200]
const evS = evenementsDuMois({ mode: 'saisonnier', repartition: rep }, rec, 2026, 5) // juin = index 5
ok(evS.entrees.length === 1 && evS.entrees[0].jour === 1 && evS.entrees[0].montant === 6800, 'juin saisonnier → 6800 le 1er')
ok(revenuParPaie({ mode: 'saisonnier', repartition: rep }) === 0, 'saisonnier : pas de montant par paie (géré au mois)')

console.log('\n— Prochaines échéances (datées, triées, dans l’horizon) —')
const av = prochainesEcheances({ mode: 'regulier', freq: 'monthly', montantParPaie: 3000, jours: [15] }, rec, new Date(2026, 5, 1), 45)
ok(av.length === 6, '4 sorties (1er juin/juil ×2) + 2 paies (15 juin/juil) dans 45 j')
ok(av[0].date === '2026-06-01', 'la 1re échéance est le 1er juin')
ok(av.every((e, i) => i === 0 || av[i - 1].date <= e.date), 'triées par date croissante')
ok(av.every((e) => e.type === 'entree' || e.type === 'sortie'), 'chaque item est une entrée ou une sortie')
console.log('      → ' + av.map((e) => `${e.date} ${e.type === 'entree' ? '+' : '−'}${e.montant}`).join('  '))

console.log('\n— Horizon 90 j réellement peuplé (au-delà de 45 j / 3 mois) —')
const av90 = prochainesEcheances({ mode: 'regulier', freq: 'monthly', montantParPaie: 3000, jours: [1] }, [{ jour: 1, montant: 1100, type: 'fixe', classe: 'besoin', label: 'Logement' }], new Date(2026, 5, 24), 90)
ok(av90.some((e) => e.date === '2026-09-01'), '1er septembre (≈69 j depuis le 24 juin) présent')
ok(av90.every((e) => e.date <= '2026-09-30'), 'rien au-delà de l’horizon (90 j ≈ fin septembre)')

console.log('\n' + (fail === 0 ? '✅ Calendrier conforme — placements et montants justes' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
