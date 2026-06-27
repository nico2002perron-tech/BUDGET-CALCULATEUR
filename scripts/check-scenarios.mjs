/* ============================================================================
   check-scenarios.mjs — Tranche studio, PORTE C (PRIORITÉ) : les scénarios.
   Prouve que ce sont des FAITS explorables, pas des conseils, et qu'ils tiennent :
     - monotonie : plus de contribution → horizon plus court (jamais plus long) ;
     - contribution BORNÉE par la capacité réelle (jamais +500 si capacité 200) ;
     - cas-limites honnêtes : déjà atteignable → horizon 0 ; capacité nulle → null ;
     - zéro impératif (un « tu devrais »/« réduis » serait rejeté par filtrerFait) ;
     - chaque label passe filtrerFait.
   Lance : node scripts/check-scenarios.mjs
   ========================================================================== */
import { genererScenarios } from '../src/lib/scenarios.js'
import { filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

// flux dispo = revenu − coût de vie = capacité d'épargne mensuelle.
const snapNormal = { depenses: { revenu: 4000, coutVie: 2500 }, coussin: { montant: 2000 } } // cap 1500
const snapDeja = { depenses: { revenu: 4000, coutVie: 2500 }, coussin: { montant: 5000 } } // déjà > cout
const snapCapNulle = { depenses: { revenu: 2000, coutVie: 2500 }, coussin: { montant: 0 } } // cap 0 (déficit)

console.log('— Scénarios factuels : cartes tappables, bornées par la capacité réelle —')
const sc = genererScenarios(snapNormal, { cout: 6000 }) // restant 4000, cap 1500
ok(sc.length >= 2, `${sc.length} scénarios générés`)
sc.forEach((s) => console.log(`      • ${s.label}  (contrib ${s.contributionMensuelle}/mois → ${s.horizonMois} mois)`))
ok(sc.every((s) => s.contributionMensuelle <= 1500), 'chaque contribution ≤ capacité réelle (1 500/mois) — jamais au-delà')

console.log('\n— Monotonie : plus de contribution → horizon plus court (jamais plus long) —')
const tri = [...sc].sort((a, b) => a.contributionMensuelle - b.contributionMensuelle)
let monotone = true
for (let i = 1; i < tri.length; i++) if (tri[i].horizonMois > tri[i - 1].horizonMois) monotone = false
ok(monotone, 'horizon non-croissant quand la contribution augmente')

console.log('\n— L’échéance ajoute un point « pour viser ta date » SEULEMENT s’il tient dans la capacité —')
const scDate = genererScenarios(snapNormal, { cout: 6000, echeance: 'moyen' }) // H=30 → cd=ceil(4000/30)=134 ≤ 1500
ok(scDate.some((s) => s.horizonMois <= 30 && s.horizonMois >= 29), 'un scénario vise ~30 mois (échéance « moyen »)')
ok(scDate.every((s) => s.contributionMensuelle <= 1500), 'le point d’échéance reste borné par la capacité')

console.log('\n— Date HORS d’atteinte (visait ~12 mois ; même à plein régime c’est plus long) → on le DIT —')
const snapDeadline = { depenses: { revenu: 2700, coutVie: 2500 }, coussin: { montant: 0 } } // cap 200/mois
const scHors = genererScenarios(snapDeadline, { cout: 5000, echeance: 'cette_annee' }) // restant 5000, plus rapide 25 mois > 12
const capCard = scHors.find((s) => s.contributionMensuelle === 200)
ok(capCard && capCard.horizonMois === 25, 'le plus rapide (pleine capacité 200/mois) = 25 mois')
ok(capCard && /plus tard/.test(capCard.label) && /12/.test(capCard.label), 'la carte ÉNONCE l’écart (« plus tard que les ~12 mois visés ») — un chemin qui aboutit, pas une défaite')
ok(capCard && /tu y arrives/.test(capCard.label), 'le cas impossible reste cyan : « tu y arrives… » (où tu en serais), jamais « tu n’y arriveras pas »')
ok(scHors.every((s) => s.contributionMensuelle <= 200), 'aucun chemin ne dépasse la capacité réelle (200/mois)')
ok(scHors.every((s) => s.horizonMois > 12), 'aucun chemin ne prétend atteindre la date impossible (~12 mois)')
ok(scHors.every((s) => filtrerFait(s.label).ok), 'chaque label reste factuel (le mot « faudrait » est évité)')
scHors.forEach((s) => console.log(`      • ${s.label}`))

console.log('\n— Cas-limites honnêtes —')
const scDeja = genererScenarios(snapDeja, { cout: 3000 })
ok(scDeja.length === 1 && scDeja[0].horizonMois === 0, 'déjà atteignable → un seul scénario, horizon 0')
console.log(`      → "${scDeja[0].label}"`)
const scNulle = genererScenarios(snapCapNulle, { cout: 5000 })
ok(scNulle.length === 1 && scNulle[0].horizonMois === null, 'capacité nulle → hors d’atteinte (horizon null), pas de faux chemin')
console.log(`      → "${scNulle[0].label}"`)
ok(genererScenarios(snapNormal, { cout: 'vingt mille' }).length === 0, 'coût non-numérique → aucun scénario (coercition sûre, jamais d’erreur)')

console.log('\n— Conformité : faits seulement, aucun impératif —')
ok(sc.every((s) => filtrerFait(s.label).ok), 'chaque label de scénario passe filtrerFait')
ok([...sc, ...scDeja, ...scNulle].every((s) => filtrerFait(s.label).ok), 'tous les labels (y c. cas-limites) factuels')
ok(filtrerFait('Tu devrais réduire tes dépenses de 150 $.').ok === false, 'preuve : un conseil impératif SERAIT rejeté par filtrerFait')

console.log('\n' + (fail === 0 ? '✅ Les scénarios tiennent — 0 échec (faits explorables, bornés, conformes)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
