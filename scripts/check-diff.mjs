/* ============================================================================
   check-diff.mjs — Pas 2 : la DÉTECTION DE CHANGEMENT (diff.js), sans navigateur.
   Prouve :
     - un changement de revenu net produit le bon événement (flux + horizon) ;
     - chaque transition de cas-limite donne un delta cohérent (zéro NaN, zéro « null ») ;
     - flux qui change de signe (surplus → déficit) → severite ambre ; l'inverse → info ;
     - objectif comblé des deux côtés → null ; changement trivial → null ;
     - un côté inactif (pas de revenu) → null, jamais de plantage ;
     - le garde-fou filtrerFait rejette bien un jugement, et chaque conséquence le passe.
   Lance : node scripts/check-diff.mjs
   ========================================================================== */
import { diffGraphe } from '../src/lib/diff.js'
import { evaluerGraphe } from '../src/lib/graphe.js'
import { filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}
const norm = (s) => String(s).replace(/[  ]/g, ' ') // espaces insécables fr-CA → simple
// Aucune fuite de valeur technique dans le texte montré à l'usager.
const sain = (e) => !!e && !/\bnull\b/i.test(e.consequence) && !/NaN/.test(e.consequence) && !/undefined/i.test(e.consequence)

// Objectif EXPLICITE (cible 20 000) pour découpler ce test du repli OBJECTIF_DEFAUT
// de graphe.js : les horizons restent ceux attendus quelle que soit la valeur du repli.
const ev = (snap, ov = {}) => evaluerGraphe(snap, { objectif: { nom: 'Cible', cible: 20000 }, ...ov })

// États de référence, produits par evaluerGraphe comme en prod.
const base = { depenses: { revenu: 4000, coutVie: 2500 }, coussin: { montant: 5000 } } // flux 1500, horizon 10
const gBase = ev(base)

console.log('— Un changement de revenu net produit le bon événement —')
const gPlus = ev(base, { revenuNetMensuel: 5000 }) // flux 2500, horizon 6
const evt1 = diffGraphe(gBase, gPlus)
ok(evt1 !== null, 'événement émis')
ok(evt1 && evt1.severite === 'info', 'flux reste positif → severite info (pas d’ambre pour une bonne nouvelle)')
ok(evt1 && evt1.type === 'horizon', 'type = horizon (flux ok, horizon bouge)')
ok(evt1 && evt1.cause === 'variation de revenu net', 'cause = variation de revenu net')
ok(evt1 && norm(evt1.consequence).includes('+1 000 $'), 'conséquence : flux +1 000 $')
ok(evt1 && norm(evt1.consequence).includes('4 mois'), 'conséquence : horizon raccourci de 4 mois (10 → 6)')
ok(evt1 && filtrerFait(evt1.consequence).ok === true, 'conséquence factuelle (passe filtrerFait)')
ok(sain(evt1), 'aucun NaN / null / undefined dans le texte')
console.log(`      → "${evt1 && evt1.consequence}"`)

console.log('\n— Flux qui change de signe : surplus → déficit → ambre —')
const gSurplus = ev({ depenses: { revenu: 3000, coutVie: 2500 }, coussin: { montant: 0 } }) // flux +500, horizon 40
const gDeficit = ev({ depenses: { revenu: 2000, coutVie: 2500 }, coussin: { montant: 0 } }) // flux −500, horizon null
const evt2 = diffGraphe(gSurplus, gDeficit)
ok(evt2 !== null, 'événement émis')
ok(evt2 && evt2.severite === 'ambre', 'flux devient négatif → severite ambre (l’exception, VISION §12)')
ok(evt2 && evt2.type === 'deficit', 'type = deficit')
ok(evt2 && norm(evt2.consequence).includes('hors') && norm(evt2.consequence).includes('atteinte'), 'horizon 40 → null formulé « hors d’atteinte » (pas « +null mois »)')
ok(filtrerFait(evt2 ? evt2.consequence : '').ok === true, 'conséquence factuelle (passe filtrerFait)')
ok(sain(evt2), 'aucun NaN / null / undefined dans le texte')
console.log(`      → "${evt2 && evt2.consequence}"`)

console.log('\n— L’inverse : déficit → surplus → info, horizon redevient un nombre —')
const evt3 = diffGraphe(gDeficit, gSurplus)
ok(evt3 !== null, 'événement émis')
ok(evt3 && evt3.severite === 'info', 'flux repasse positif → info (jamais d’ambre pour une bonne nouvelle)')
ok(evt3 && norm(evt3.consequence).includes('40 mois'), 'horizon null → 40 formulé en mois (pas « null »)')
ok(evt3 && norm(evt3.consequence).includes('atteignable'), 'conséquence : « de nouveau atteignable »')
ok(sain(evt3), 'aucun NaN / null / undefined dans le texte')
console.log(`      → "${evt3 && evt3.consequence}"`)

console.log('\n— Objectif comblé des deux côtés (horizon 0 ↔ 0) → null —')
const gComble = ev({ depenses: { revenu: 4000, coutVie: 1000 }, coussin: { montant: 20000 } }) // horizon 0
const gCombleAutre = ev({ depenses: { revenu: 4000, coutVie: 1000 }, coussin: { montant: 20000 } }, { revenuNetMensuel: 6000 })
ok(diffGraphe(gComble, gComble) === null, 'comblé ↔ comblé → null')
ok(diffGraphe(gComble, gCombleAutre) === null, 'comblé ↔ comblé (même avec flux différent) → null')

console.log('\n— Changement trivial (flux sous le seuil, horizon inchangé) → null —')
const gMicro = ev(base, { revenuNetMensuel: 4002 }) // flux 1502, horizon 10
ok(diffGraphe(gBase, gMicro) === null, 'flux +2 $, horizon inchangé → null (pas de bruit)')

console.log('\n— Un côté inactif (pas de revenu) → null, jamais de plantage —')
const gInactif = ev({}) // actif:false
ok(diffGraphe(gInactif, gBase) === null, 'avant inactif → null')
ok(diffGraphe(gBase, gInactif) === null, 'apres inactif → null')
ok(diffGraphe(gInactif, gInactif) === null, 'deux inactifs → null')

console.log('\n— Déficit qui s’améliore mais reste déficit (−1000 → −200) → info (jamais d’ambre pour une bonne nouvelle) —')
const gDef1 = ev({ depenses: { revenu: 2000, coutVie: 3000 }, coussin: { montant: 0 } }) // flux −1000, horizon null
const gDef2 = ev({ depenses: { revenu: 2000, coutVie: 2200 }, coussin: { montant: 0 } }) // flux −200, horizon null
const evtAmel = diffGraphe(gDef1, gDef2)
ok(evtAmel !== null, 'événement émis')
ok(evtAmel && evtAmel.severite === 'info', 'le déficit reste mais s’améliore → info (le flux ne « devient » pas négatif)')
ok(evtAmel && evtAmel.type === 'flux', 'type = flux (flux bouge, horizon inchangé)')
ok(evtAmel && evtAmel.cause === 'variation de ton coût de vie', 'cause = variation de ton coût de vie')
ok(evtAmel && filtrerFait(evtAmel.consequence).ok === true, 'conséquence factuelle')
ok(sain(evtAmel), 'aucun NaN / null / undefined dans le texte')
console.log(`      → "${evtAmel && evtAmel.consequence}"`)

console.log('\n— Transitions DEPUIS « objectif comblé » (horizon 0) —')
const gCombleH = ev(base, { dejaEpargne: 20000 }) // horizon 0 (restant comblé)
const gVersMois = ev(base, { dejaEpargne: 5000 }) // horizon 10
const evtCM = diffGraphe(gCombleH, gVersMois)
ok(evtCM && norm(evtCM.consequence).includes('ramène') && norm(evtCM.consequence).includes('10 mois'), 'comblé (0) → 10 mois : « ramène un horizon estimé à 10 mois »')
ok(evtCM && evtCM.cause === 'variation de ton épargne accumulée', 'cause = variation de ton épargne accumulée')
ok(sain(evtCM), 'aucun NaN / null dans le texte')
console.log(`      → "${evtCM && evtCM.consequence}"`)
const gVersHors = ev({ depenses: { revenu: 1000, coutVie: 1000 }, coussin: { montant: 0 } }) // flux 0, horizon null
const evtCH = diffGraphe(gCombleH, gVersHors)
ok(evtCH && evtCH.consequence.includes('hors') && evtCH.consequence.includes('atteinte'), 'comblé (0) → hors : « hors d’atteinte » (pas « null »)')
ok(sain(evtCH), 'aucun NaN / null dans le texte')
console.log(`      → "${evtCH && evtCH.consequence}"`)

console.log('\n— Transitions VERS « objectif comblé » (horizon 0) : « amène ton objectif à sa cible » —')
const evtMC = diffGraphe(gVersMois, gCombleH) // 10 mois → comblé 0
ok(evtMC && evtMC.consequence.includes('amène') && evtMC.consequence.includes('cible'), 'mois (10) → comblé (0) : « amène ton objectif à sa cible »')
ok(sain(evtMC), 'aucun NaN / null dans le texte')
console.log(`      → "${evtMC && evtMC.consequence}"`)
const gHors = ev({ depenses: { revenu: 2000, coutVie: 2500 }, coussin: { montant: 0 } }) // flux −500, horizon null
const gCombleDepuisHors = ev({ depenses: { revenu: 2000, coutVie: 2500 }, coussin: { montant: 20000 } }) // restant 0 → horizon 0
const evtHC = diffGraphe(gHors, gCombleDepuisHors)
ok(evtHC && evtHC.consequence.includes('amène') && evtHC.consequence.includes('cible'), 'hors (null) → comblé (0) : « amène ton objectif à sa cible »')
ok(sain(evtHC), 'aucun NaN / null dans le texte')
console.log(`      → "${evtHC && evtHC.consequence}"`)

console.log('\n— Cas-limite horizon = 1 mois (minimum de la classe « mois ») —')
const gH1 = ev({ depenses: { revenu: 5000, coutVie: 1000 }, coussin: { montant: 19000 } }) // restant 1000, flux 4000 → horizon 1
const evtH1 = diffGraphe(gHors, gH1) // hors (null) → 1 mois
ok(evtH1 && norm(evtH1.consequence).includes('1 mois'), 'hors → 1 mois : « horizon estimé à 1 mois » (pas « null », pas NaN)')
ok(sain(evtH1), 'aucun NaN / null dans le texte')
console.log(`      → "${evtH1 && evtH1.consequence}"`)

console.log('\n— Type = flux : le flux bouge mais l’horizon reste identique —')
const gFluxSeul = ev({ depenses: { revenu: 3000, coutVie: 2500 }, coussin: { montant: 0 } }) // flux 500, horizon 40
const gFluxSeul2 = ev({ depenses: { revenu: 3000, coutVie: 2500 }, coussin: { montant: 0 } }, { revenuNetMensuel: 3008 }) // flux 508, horizon 40
const evtFlux = diffGraphe(gFluxSeul, gFluxSeul2)
ok(evtFlux && evtFlux.type === 'flux', 'type = flux (horizon 40 inchangé, flux +8 $)')
ok(evtFlux && !/mois/.test(evtFlux.consequence), 'conséquence : aucune clause d’horizon (seul le flux a bougé)')
ok(sain(evtFlux), 'aucun NaN / null dans le texte')
console.log(`      → "${evtFlux && evtFlux.consequence}"`)

console.log('\n— Le garde-fou de conformité (filtrerFait) rejette bien un jugement —')
const juge = filtrerFait('Tu devrais épargner plus, tu es sur la bonne voie.')
ok(juge.ok === false && juge.texte === null, 'texte jugeant → rejeté (texte nettoyé → null)')
console.log(`      → motifs : ${JSON.stringify(juge.motif)}`)

console.log('\n' + (fail === 0 ? '✅ La détection de changement tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
