/* ============================================================================
   check-graphe.mjs — la COUCHE DE COMPRÉHENSION (graphe.js), sans navigateur.
   Prouve :
     - honnêteté : sans revenu net, la chaîne est INACTIVE (aucun zéro inventé) ;
     - 4 nœuds reliés, dérivés du snapshot ;
     - l'OBJECTIF est paramétré (plus de cible codée en dur) : maison / voyage (déjà
       atteint) / auto / fonds donnent des horizons DIFFÉRENTS ;
     - PROPAGATION : un override rejoue toute la chaîne (base du « et si ») ;
     - états limites : flux négatif → horizon null ; objectif comblé → 0.
   Lance : node scripts/check-graphe.mjs
   ========================================================================== */
import { evaluerGraphe, OBJECTIF_DEFAUT } from '../src/lib/graphe.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

// Snapshots synthétiques (exactement la forme que lit graphe.js).
const snapVide = {}
const snapBase = { depenses: { revenu: 4000, coutVie: 2500 }, coussin: { montant: 5000 } } // flux 1500, déjà 5000

console.log('— Honnêteté : sans revenu net, la chaîne est INACTIVE —')
const g0 = evaluerGraphe(snapVide)
ok(g0.actif === false, 'pas de revenu net → actif:false')
ok(g0.objectif === null && Object.keys(g0.noeuds).length === 0, 'aucun nœud ni objectif inventé')

console.log('\n— 4 nœuds reliés + objectif PARAMÉTRÉ (maison 20 000) —')
const gMaison = evaluerGraphe(snapBase, { objectif: { nom: 'Maison', cible: 20000 } })
ok(gMaison.actif === true, 'revenu net présent → actif:true')
ok(gMaison.noeuds.revenuNet.valeur === 4000 && gMaison.noeuds.fluxDisponible.valeur === 1500, 'revenuNet 4000 → flux 1500')
ok(gMaison.objectif.nom === 'Maison' && gMaison.objectif.cible === 20000, 'objectif = celui de la recette (nom + cible)')
ok(gMaison.objectif.restant === 15000 && gMaison.objectif.horizonMois === 10, 'restant 15 000 → horizon 10 (ceil 15000/1500)')

console.log('\n— Plusieurs objectifs → horizons DIFFÉRENTS (plus de 20 000 en dur) —')
const gVoyage = evaluerGraphe(snapBase, { objectif: { nom: 'Voyage', cible: 5000 } }) // déjà 5000 → atteint
const gAuto = evaluerGraphe(snapBase, { objectif: { nom: 'Auto', cible: 12000 } }) // restant 7000 → 5
const gFonds = evaluerGraphe(snapBase, { objectif: { nom: 'Fonds d’urgence', cible: 8000 } }) // restant 3000 → 2
ok(gVoyage.objectif.restant === 0 && gVoyage.objectif.horizonMois === 0, 'voyage 5 000, déjà 5 000 → atteint (restant 0, horizon 0) — honnête')
ok(gAuto.objectif.horizonMois === 5, 'auto 12 000 → horizon 5')
ok(gFonds.objectif.horizonMois === 2, 'fonds 8 000 → horizon 2')
ok(new Set([gMaison.objectif.horizonMois, gVoyage.objectif.horizonMois, gAuto.objectif.horizonMois, gFonds.objectif.horizonMois]).size === 4, 'les 4 objectifs donnent 4 horizons distincts')

console.log('\n— Repli neutre quand la recette ne fournit pas d’objectif —')
const gDefaut = evaluerGraphe(snapBase)
ok(gDefaut.objectif.cible === OBJECTIF_DEFAUT.cible && gDefaut.objectif.nom === OBJECTIF_DEFAUT.nom, 'sans objectif → OBJECTIF_DEFAUT (repli)')

console.log('\n— PROPAGATION : un override rejoue toute la chaîne (base du « et si ») —')
const gPlus = evaluerGraphe(snapBase, { objectif: { nom: 'Maison', cible: 20000 }, revenuNetMensuel: 5000 })
ok(gPlus.noeuds.fluxDisponible.valeur === 2500, 'revenu +1000 → flux 2500 (propagé en aval)')
ok(gPlus.objectif.horizonMois === 6 && gPlus.objectif.horizonMois < gMaison.objectif.horizonMois, 'plus de revenu → horizon plus court (6 < 10)')

console.log('\n— États limites —')
const gNeg = evaluerGraphe({ depenses: { revenu: 2000, coutVie: 3000 }, coussin: { montant: 0 } }, { objectif: { nom: 'Maison', cible: 20000 } })
ok(gNeg.noeuds.fluxDisponible.valeur === -1000, 'flux négatif conservé (−1000)')
ok(gNeg.noeuds.capaciteEpargne.valeur === 0, 'capacité plancher à 0')
ok(gNeg.objectif.horizonMois === null, 'capacité nulle → horizon null (hors d’atteinte)')
const gComble = evaluerGraphe({ depenses: { revenu: 4000, coutVie: 1000 }, coussin: { montant: 20000 } }, { objectif: { nom: 'Maison', cible: 20000 } })
ok(gComble.objectif.restant === 0 && gComble.objectif.horizonMois === 0, 'déjà épargné ≥ cible → restant 0, horizon 0')

console.log('\n' + (fail === 0 ? '✅ La couche de compréhension tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
