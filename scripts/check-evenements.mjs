/* ============================================================================
   check-evenements.mjs — LE PRIMITIF ÉVÉNEMENT, sans navigateur. Prouve :
     - une échéance (dette) → un événement DATÉ avec conséquence PROPAGÉE (evaluerGraphe),
       pas juste un montant (un deltaHorizon calculé, pas le paiement échoé) ;
     - un KPI qui franchit un seuil vs état précédent → un événement ; pas de franchissement → rien ;
     - flux devenu négatif → severite 'exception' (ambre) ; une bonne nouvelle → jamais ambre ;
     - data-aware : snapshot sans dettes → aucun événement d'échéance (zéro inventé) ;
     - evenementsSaillants cape et classe (exception / urgent d'abord) ;
     - changement trivial (< seuil de signifiance) → aucun événement (pas de bruit) ;
     - chaque titre/texte passe filtrerFait (un texte jugeant serait rejeté) ;
     - snapshot vide / état précédent absent → [] propre, jamais d'erreur.
   Lance : node scripts/check-evenements.mjs
   ========================================================================== */
import { genererEvenements, evenementsSaillants } from '../src/lib/evenements.js'
import { filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
const MTN = { maintenant: '2026-01-01' }
const type = (evs, t) => evs.filter((e) => e.type === t)

// Snapshot de base : revenu net 4000, coût de vie 2755 (flux +1245), coussin 5000.
const base = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 5000, moisCouverts: 2.5, essentielles: 2000 } }

console.log('— Échéance (dette) → événement daté + conséquence PROPAGÉE (pas juste un montant) —')
const snapDette = { ...base, dettes: [{ id: 'auto', label: 'prêt auto', paiementMensuel: 300, finLe: '2026-03-01' }] }
const evD = genererEvenements(snapDette, null, MTN)
const ech = type(evD, 'echeance')[0]
ok(!!ech, 'une échéance de dette est émise')
ok(ech && ech.quand === '2026-03-01' && /59/.test(ech.titre), 'datée dans le futur (59 jours), titre factuel')
ok(ech && ech.consequence.deltaFlux === 300, 'conséquence : +300 $/mois de flux libéré (propagé par evaluerGraphe)')
ok(ech && ech.consequence.deltaHorizon === -1, 'conséquence PROPAGÉE : horizon de l’objectif raccourci de 1 mois (pas juste le montant)')
console.log(`      → "${ech.titre}" · "${ech.consequence.texte}"`)

console.log('\n— Échéance imminente → attention (cyan), JAMAIS exception (ambre) —')
const snapImm = { ...base, dettes: [{ id: 'auto', label: 'prêt auto', paiementMensuel: 300, finLe: '2026-01-10' }] }
const echImm = type(genererEvenements(snapImm, null, MTN), 'echeance')[0]
ok(echImm && echImm.severite === 'attention', 'échéance dans 9 jours → severite attention (cyan)')

console.log('\n— Échéance : data-aware + bornes (passé / sans paiement → rien) —')
ok(type(genererEvenements(base, null, MTN), 'echeance').length === 0, 'snapshot SANS dettes → aucun événement d’échéance (zéro inventé)')
ok(type(genererEvenements({ ...base, dettes: [{ label: 'vieux', paiementMensuel: 200, finLe: '2025-01-01' }] }, null, MTN), 'echeance').length === 0, 'échéance passée → non émise')
ok(type(genererEvenements({ ...base, dettes: [{ label: 'sans', finLe: '2026-03-01' }] }, null, MTN), 'echeance').length === 0, 'dette sans paiement chiffrable → non émise')

console.log('\n— Seuil KPI franchi vs état précédent (coussin atteint 3 mois) —')
const prec2 = { ...base, coussin: { montant: 4000, moisCouverts: 2.0, essentielles: 2000 } }
const now3 = { ...base, coussin: { montant: 6500, moisCouverts: 3.2, essentielles: 2000 } }
const seuil = type(genererEvenements(now3, prec2, MTN), 'seuil_franchi')[0]
ok(!!seuil && /3 mois/.test(seuil.titre), 'coussin 2.0 → 3.2 → événement « atteint 3 mois »')
ok(seuil && seuil.severite === 'info', 'franchir un palier = bonne nouvelle → severite info (jamais ambre)')
const noCross = type(genererEvenements({ ...base, coussin: { montant: 7000, moisCouverts: 3.5, essentielles: 2000 } }, now3, MTN), 'seuil_franchi')
ok(noCross.length === 0, 'pas de franchissement (3.2 → 3.5) → aucun événement de seuil')

console.log('\n— Flux devenu négatif → exception (ambre) ; bonne nouvelle → JAMAIS ambre —')
const precPos = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 5000 } } // flux +1245
const nowNeg = { depenses: { revenu: 2000, coutVie: 2755 }, coussin: { montant: 5000 } } // flux −755
const chgNeg = type(genererEvenements(nowNeg, precPos, MTN), 'changement')[0]
ok(chgNeg && chgNeg.severite === 'exception', 'flux +1245 → −755 → severite exception (ambre, la vraie exception)')
const chgPos = type(genererEvenements(precPos, nowNeg, MTN), 'changement')[0]
ok(chgPos && chgPos.severite !== 'exception', 'flux −755 → +1245 (bonne nouvelle) → JAMAIS ambre')
ok(genererEvenements(precPos, nowNeg, MTN).every((e) => e.severite !== 'exception'), 'une bonne nouvelle ne produit AUCUN événement ambre')

console.log('\n— Changement trivial (< seuil de signifiance) → aucun bruit —')
const precT = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 5000 } }
const nowT = { depenses: { revenu: 4000, coutVie: 2757 }, coussin: { montant: 5000 } } // flux −2 $, horizon identique
ok(type(genererEvenements(nowT, precT, MTN), 'changement').length === 0, 'flux varie de 2 $ (< 5 $) et horizon identique → aucun changement émis')

console.log('\n— evenementsSaillants : cape et classe (exception / urgent d’abord) —')
const snapRich = { depenses: { revenu: 2000, coutVie: 2755 }, coussin: { montant: 6500, moisCouverts: 3.2, essentielles: 2000 }, dettes: [{ id: 'auto', label: 'prêt auto', paiementMensuel: 300, finLe: '2026-03-01' }] }
const precRich = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 4000, moisCouverts: 2.0, essentielles: 2000 } }
const tous = genererEvenements(snapRich, precRich, MTN)
const saill = evenementsSaillants(tous, 2)
ok(tous.length >= 3, `≥3 événements produits (${tous.map((e) => e.type).join(', ')})`)
ok(saill.length === 2, 'evenementsSaillants(…, 2) en garde 2')
ok(saill[0].severite === 'exception', 'le plus saillant en tête = l’exception (flux négatif)')

console.log('\n— Conformité : chaque titre + texte passe filtrerFait —')
const tousTextes = [...evD, ...tous, seuil, chgNeg].filter(Boolean)
ok(tousTextes.every((e) => filtrerFait(e.titre).ok && filtrerFait(e.consequence.texte).ok), 'tous les titres + conséquences sont factuels (filtrerFait)')
ok(filtrerFait('Tu devrais rembourser, c’est mieux.').ok === false, 'preuve : un texte jugeant SERAIT rejeté')

console.log('\n— Robustesse : vide / absent → [] propre, jamais d’erreur —')
ok(genererEvenements({}, null, MTN).length === 0, 'snapshot vide → []')
ok(genererEvenements(null).length === 0, 'snapshot null → []')
ok(genererEvenements(base).length === 0, 'sans état précédent + sans dettes → [] (rien à raconter)')

console.log('\n' + (fail === 0 ? '✅ Le primitif événement tient — 0 échec (le moteur raconte l’impact, pas le mouvement)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
