/* ============================================================================
   check-calendrier.mjs — prouve la logique PURE du calendrier :
   dépenses récurrentes filtrées, paies/sorties placées sur les bons jours,
   échéances datées triées dans l'horizon. 0 montant inventé.
   Lance : node scripts/check-calendrier.mjs
   ========================================================================== */
import { depensesRecurrentes, evenementsDuMois, prochainesEcheances, revenuParPaie, offsetVersMois } from '../src/lib/calendrier.js'
import { totalDepensesVie, totalClasse, depensesParDefaut } from '../src/lib/depenses.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { moisCouverts, zoneDe } from '../src/lib/coussin.js'
import { etSi, socleCourbe } from '../src/lib/horizon.js'

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

console.log('\n— Détail des dépenses (snap.depenses) pour les blocs « où va l’argent » —')
const snap = snapshotFromStore({
  revenus: { mode: 'regulier', freq: 'monthly', montantParPaie: 4000, jours: [1] },
  depenses: [
    { id: 'a', classe: 'besoin', type: 'fixe', montant: 2000, jour: 1 },
    { id: 'b', classe: 'envie', type: 'variable', montant: 1000, jour: null },
    { id: 'c', classe: 'epargne', type: 'fixe', montant: 400, jour: 1 },
  ],
})
const D = snap.depenses
ok(!!D, 'snap.depenses présent dès qu’une dépense est saisie')
ok(D.parClasse.besoin === 2000 && D.parClasse.envie === 1000 && D.parClasse.epargne === 400, 'parClasse exact')
ok(D.coutVie === 3000 && D.total === 3400, 'coût de vie 3000 (hors épargne) · total 3400')
ok(D.reste === 600, 'reste = revenu 4000 − total 3400 = 600')
ok(D.pct.besoin === 50 && D.pct.envie === 25 && D.pct.epargne === 10, '% du revenu (50/25/10)')
ok(D.engageLibre.fixe === 2000 && D.engageLibre.variable === 1000, 'engagé (fixe) 2000 · libre (variable) 1000')
ok(D.parCategorie[0].montant === 2000, 'parCategorie trié décroissant')

console.log('\n— Fonds d’urgence (coussin) —')
ok(moisCouverts(9000, 3000) === 3, '9000 $ / 3000 $ essentiels = 3 mois couverts')
ok(moisCouverts(9000, 0) === null, 'sans essentiels → null (pas de division par zéro)')
ok(zoneDe(0.5) === 'faible' && zoneDe(2) === 'moyen' && zoneDe(4) === 'repere' && zoneDe(8) === 'plus', 'zones : faible/moyen/repère/plus')

console.log('\n— Fiscalité (anatomie du dollar, via twin.calcTax) —')
const snapF = snapshotFromStore({
  revenus: { mode: 'regulier', freq: 'monthly', montantParPaie: 4000, brutAnnuel: 75000, coussin: 9000 },
  depenses: [{ id: 'l', classe: 'besoin', type: 'fixe', montant: 3000, jour: 1 }],
})
ok(!!snapF.fiscalite, 'snap.fiscalite présent dès qu’un brut est saisi')
ok(snapF.fiscalite.brut === 75000, 'brut conservé (75 000)')
ok(snapF.fiscalite.net > 0 && snapF.fiscalite.net < 75000, 'net = brut − impôts/cotisations (0 < net < brut)')
ok(snapF.fiscalite.tauxEffectif > 0 && snapF.fiscalite.tauxEffectif < 60, 'taux effectif plausible')
ok(Math.abs(snapF.fiscalite.segments.reduce((s, x) => s + x.montant, 0) - 75000) < 100, 'les segments couvrent ≈ le brut')
ok(snapF.coussin && snapF.coussin.moisCouverts === 3, 'snap.coussin : 9000 / 3000 = 3 mois')
console.log(`      → net=${snapF.fiscalite.net}  taux=${snapF.fiscalite.tauxEffectif}%  libération=jour ${snapF.fiscalite.jourLiberation}`)

console.log('\n— Patrimoine & projection (twin projectLife) —')
const snapP = snapshotFromStore({
  identity: { age: 34 },
  revenus: { brutAnnuel: 75000 },
  depenses: [
    { id: 'l', classe: 'besoin', type: 'fixe', montant: 2000, jour: 1 },
    { id: 'e', classe: 'epargne', type: 'fixe', montant: 500, jour: 1 },
  ],
  patrimoine: { age: 34, retraite: 65, rendement: 5, reer: 20000, celi: 10000, nonEnregistre: 0, maisonValeur: 300000, hypotheque: 220000, autresDettes: 0 },
})
ok(snapP.patrimoine && snapP.patrimoine.net === 110000, 'valeur nette = (20000+10000+300000) − 220000 = 110000')
ok(snapP.projection && Array.isArray(snapP.projection.annees) && snapP.projection.annees.length === 57, 'projection : 57 années (âge 34 → 90)')
ok(snapP.projection.annees[0].age === 34 && snapP.projection.annees[56].age === 90, 'âges de 34 à 90')
ok(snapP.projection.retraiteAge === 65, 'âge de retraite = 65')
ok(snapP.projection.annees.every((y, i) => i === 0 || snapP.projection.annees[i - 1].age < y.age), 'âges strictement croissants')

console.log('\n— L’Horizon (le « et si ») —')
const socle = socleCourbe(snapP.projection.annees)
ok(socle && socle.years === 56, 'socle : 90 − 34 = 56 ans')
ok(etSi(100000, 0, 0.05, 10) === 100000, '+0 $/mois → socle inchangé')
ok(etSi(100000, 200, 0.05, 10) > 100000, '+200 $/mois → socle + valeur future de l’annuité')
ok(Math.abs(etSi(0, 100, 0, 10) - 12000) < 1, 'taux 0 → extra × nMois (100 × 120 = 12 000)')
console.log(`      → net=${snapP.patrimoine.net}  à 90 ans=${snapP.projection.annees[56].patrimoineNet}  rendement implicite=${(socle.rate * 100).toFixed(1)}%`)

console.log('\n— P0 · le saut de mois (offsetVersMois : ouvrir le calendrier sur la date d’une tuile) —')
const baseCal = new Date(2026, 6, 15) // juillet 2026 (mois index 6)
ok(offsetVersMois('2026-07', baseCal) === 0, 'même mois → 0 (mois courant)')
ok(offsetVersMois('2026-08', baseCal) === 1, 'mois suivant → +1 (le saut)')
ok(offsetVersMois('2026-06', baseCal) === -1, 'mois précédent → −1')
ok(offsetVersMois('2027-01', baseCal) === 6, 'janvier prochain → +6')
ok(offsetVersMois('2025-07', baseCal) === -12, 'l’an passé → −12')
ok(offsetVersMois(null, baseCal) === 0, 'null → 0 (défaut sûr)')
ok(offsetVersMois('pas-une-date', baseCal) === 0, 'format invalide → 0')
ok(offsetVersMois('2026-13', baseCal) === 0, 'mois hors borne → 0')

console.log('\n' + (fail === 0 ? '✅ Calendrier + dépenses + portrait + patrimoine conformes' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
