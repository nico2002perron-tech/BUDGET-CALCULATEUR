/* ============================================================================
   check-comparaison-scenarios.mjs — LE TUYAU scenarios.js → comparaison, sans
   navigateur. Deux scénarios d'un objectif deviennent les deux côtés d'un comparaison.
   Prouve :
     - deux scénarios distincts → comparaison avec deux horizons différents + écart correct ;
     - chaque côté = resolveKPI du MÊME KPI avec un ctx différent (jamais un calcul du bloc) ;
     - monotonie : plus de contribution → horizon plus court → écart cohérent ;
     - un seul scénario (ou capacité nulle / déjà atteint) → comparaison NON offert ;
     - contribution bornée par la capacité réelle (jamais un faux scénario) ;
     - chaque étiquette + l'écart passent filtrerFait (un texte jugeant serait rejeté) ;
     - data-aware : comparaison offert SSI deux vraies valeurs (avec ctx) ; sinon non.
   Lance : node scripts/check-comparaison-scenarios.mjs
   ========================================================================== */
import { genererScenarios } from '../src/lib/scenarios.js'
import { comparaisonScenarios, resolveKPI, formesPourKPI } from '../src/recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }

// Capacité 1 245 $/mois (4000 − 2755), coussin 5 000, cible 20 000 → restant 15 000.
const snap = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 5000 } }
const ctx = { objectif: { nom: 'Maison', cible: 20000 } }
const CAP = 1245

console.log('— Deux scénarios distincts → un comparaison (deux horizons + écart) —')
const d = comparaisonScenarios(snap, ctx)
ok(!!d, 'comparaisonScenarios rend une paire (≥2 scénarios distincts)')
ok(d.ctxA.contributionMensuelle < d.ctxB.contributionMensuelle, `contribution A (${d.ctxA.contributionMensuelle}) < B (${d.ctxB.contributionMensuelle})`)
ok(d.ecart > 0, `écart > 0 (${d.ecart} mois)`)

console.log('\n— Chaque côté = resolveKPI du MÊME KPI, ctx différent (pas un calcul du bloc) —')
const vA = resolveKPI('horizon_objectif', snap, { ...ctx, ...d.ctxA }).valeur
const vB = resolveKPI('horizon_objectif', snap, { ...ctx, ...d.ctxB }).valeur
console.log(`      A : ${d.ctxA.contributionMensuelle} $/mois → ${vA} mois   ·   B : ${d.ctxB.contributionMensuelle} $/mois → ${vB} mois   ·   écart ${d.ecart}`)
ok(typeof vA === 'number' && typeof vB === 'number', 'les deux horizons sont des nombres résolus par resolveKPI')
ok(d.ecart === Math.abs(vA - vB), 'l’écart de la paire == |resolveKPI(A) − resolveKPI(B)| (la valeur sort bien de resolveKPI)')

console.log('\n— Monotonie : plus de contribution → horizon plus court —')
ok(vB < vA, `B (plus de contribution) a un horizon plus court (${vB} < ${vA})`)

console.log('\n— Contribution bornée par la capacité réelle (jamais un faux scénario) —')
ok(d.ctxA.contributionMensuelle <= CAP && d.ctxB.contributionMensuelle <= CAP, `les deux contributions ≤ capacité (${CAP} $/mois)`)

console.log('\n— UN SEUL SCÉNARIO → comparaison NON offert (data-aware, note #1 résolue) —')
// Capacité nulle : genererScenarios rend UNE seule carte (message « capacité à zéro »).
const snapCapNulle = { depenses: { revenu: 2000, coutVie: 2755 }, coussin: { montant: 5000 } }
ok(genererScenarios(snapCapNulle, { cout: 20000 }).length === 1, 'capacité nulle → genererScenarios rend 1 seul scénario')
ok(comparaisonScenarios(snapCapNulle, ctx) === null, 'un seul scénario → comparaisonScenarios = null (rien à comparer)')
ok(!formesPourKPI('horizon_objectif', snapCapNulle, ctx).includes('comparaison'), 'un seul scénario → comparaison NON offert dans le sélecteur')
// Déjà atteint : coussin ≥ cible → 1 carte « tu y es déjà » → pas de comparaison absurde.
const snapAtteint = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 25000 } }
ok(comparaisonScenarios(snapAtteint, ctx) === null, 'déjà atteint → pas de comparaison absurde (null)')

console.log('\n— Data-aware : comparaison offert SSI deux vraies valeurs —')
ok(formesPourKPI('horizon_objectif', snap, ctx).includes('comparaison'), 'AVEC ctx (objectif) + capacité → comparaison OFFERT')
ok(!formesPourKPI('horizon_objectif', snap).includes('comparaison'), 'SANS ctx → comparaison non offert (il ne sait pas quoi comparer)')

console.log('\n— Conformité : étiquettes + repli passent filtrerFait —')
ok(!!d.etiquetteA && filtrerFait(d.etiquetteA).ok, `étiquette A factuelle (« ${d.etiquetteA} »)`)
ok(!!d.etiquetteB && filtrerFait(d.etiquetteB).ok, `étiquette B factuelle (« ${d.etiquetteB} »)`)
ok(filtrerFait('Tu devrais en mettre plus, c’est mieux.').ok === false, 'preuve : un texte jugeant SERAIT rejeté')

console.log('\n' + (fail === 0 ? '✅ Le tuyau scénarios→comparaison tient — 0 échec (l’angle s’allume parce qu’il a deux vraies valeurs)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
