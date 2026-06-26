/* ============================================================================
   check-composition.mjs — ÉTAGE 2 : la COMPOSITION VIVANTE, sans navigateur.
   Prouve que le « même rendu » est MORT :
     - chaque situation produit un HÉROS distinct (jamais partagé) ;
     - deux échéances d'objectif → recettes différentes (court ≠ long) ;
     - maison ≠ voyage ≠ fonds d'urgence (corps + objectif différents) ;
     - la chaine reçoit le VRAI objectif (plus de 20 000 codé en dur) ;
     - le focus saisonnier varie le corps ;
     - data-aware : un bloc non soutenu par les données est OMIS ;
     - chaque recette est valide (schema.js) et chaque fait passe filtrerFait.
   Lance : node scripts/check-composition.mjs
   ========================================================================== */
import { composerRecette } from '../src/recettes/composer.js'
import { validerRecette, estConnu, filtrerFait, BLOCS } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}
// Un slot (emplacement à candidats) est un héros/bloc valide : on le lit via son recommande.
const typeBloc = (b) => (b && b.slot === 'graphique' ? b.recommande : b && b.type)
const heros = (r) => (r.blocs[0] ? typeBloc(r.blocs[0]) : null)
const types = (r) => r.blocs.map((b) => (b.slot === 'graphique' ? `slot(${b.recommande})` : b.type)).join(' · ')
const valide = (r) => {
  const v = validerRecette(r)
  return v.blocs.length > 0 && !v.blocs.some((b) => b._ignore) && v.blocs.every((b) => (b.slot === 'graphique' ? !!b.choisi : estConnu(b.type)))
}
// Snapshot RICHE (toutes les sections présentes → aucun bloc omis par data-aware).
const snapRiche = {
  saison: { revenusMensuels: [1000, 1000, 1000, 8000, 8000, 8000, 8000, 8000, 1000, 1000, 1000, 1000], depensesMensuelles: 3000, coussin: 5000 },
  depenses: { revenu: 4000, coutVie: 2755, total: 2955, reste: 1045, parClasse: { besoin: 2190, envie: 565, epargne: 200 }, engageLibre: { fixe: 1000, variable: 1755 }, parCategorie: [{ id: 'a', label: 'Logement', classe: 'besoin', montant: 1100 }, { id: 'b', label: 'Épicerie', classe: 'besoin', montant: 600 }], pct: { besoin: 55, envie: 14, epargne: 5 } },
  coussin: { montant: 5000, essentielles: 2000, moisCouverts: 2.5, zone: 'orange', cible3: 6000, cible6: 12000 },
  patrimoine: { net: 50000, actifs: 100000, passifs: 50000, composition: { reer: 40000, celi: 20000, nonEnregistre: 0, maison: 0, hypotheque: 0, autresDettes: 0 } },
  projection: { annees: [{ age: 34, patrimoineNet: 50000 }, { age: 35, patrimoineNet: 60000 }], retraiteAge: 65, ageRupture: null },
  fiscalite: { brut: 65000, federal: 8000, quebec: 9000, cotisations: 4000, net: 44000, tauxEffectif: 32, jourLiberation: 117, segments: [] },
}

console.log('— Un HÉROS distinct par situation (jamais partagé) —')
const SITS = ['objectif_epargne', 'mon_budget', 'mon_portrait', 'ma_vie', 'revenu_saisonnier']
const lesHeros = SITS.map((s) => heros(composerRecette(s, {}, snapRiche)))
SITS.forEach((s, i) => console.log(`      ${s.padEnd(18)} → héros: ${lesHeros[i]}`))
ok(new Set(lesHeros).size === SITS.length, `${SITS.length} situations → ${new Set(lesHeros).size} héros DISTINCTS`)

console.log('\n— Une situation, des CORPS différents selon les réponses (le « même rendu » meurt) —')
const maisonCourt = composerRecette('objectif_epargne', { objectif: 'maison', echeance: 'cette_annee' }, snapRiche)
const maisonLong = composerRecette('objectif_epargne', { objectif: 'maison', echeance: 'long' }, snapRiche)
console.log(`      maison/court : ${types(maisonCourt)}`)
console.log(`      maison/long  : ${types(maisonLong)}`)
ok(types(maisonCourt) !== types(maisonLong), 'maison court terme ≠ maison long terme')
ok(maisonCourt.blocs.some((b) => b.type === 'chronologie') && !maisonLong.blocs.some((b) => b.type === 'chronologie'), 'court → chronologie ; long → pas de chronologie')
ok(maisonLong.blocs.some((b) => b.type === 'horizon'), 'long → horizon (« et si »)')

console.log('\n— maison ≠ voyage ≠ fonds d’urgence —')
const voyage = composerRecette('objectif_epargne', { objectif: 'voyage', echeance: 'cette_annee' }, snapRiche)
const fonds = composerRecette('objectif_epargne', { objectif: 'fonds_urgence', echeance: 'cette_annee' }, snapRiche)
console.log(`      voyage : ${types(voyage)}`)
console.log(`      fonds  : ${types(fonds)}`)
ok(heros(fonds) === 'coussin_urgence', 'fonds d’urgence → héros coussin_urgence (corps distinct)')
ok(heros(maisonCourt) === 'chaine', 'maison → héros chaine')
const chMaison = maisonCourt.blocs.find((b) => b.type === 'chaine')
const chVoyage = voyage.blocs.find((b) => b.type === 'chaine')
ok(chMaison.params.objectif.cible === 20000 && chVoyage.params.objectif.cible === 5000, 'la chaine reçoit le VRAI objectif (maison 20 000 ≠ voyage 5 000 — plus de 20 000 en dur)')
ok(chVoyage.params.objectif.nom === 'Voyage', 'le nom de l’objectif vient des réponses')
const bpMaison = maisonCourt.blocs.find((b) => b.type === 'barre_progression')
ok(bpMaison.params.cible === 20000 && bpMaison.params.etiquetteDroite === 'Maison', 'barre_progression personnalisée (cible + étiquette de l’objectif)')

console.log('\n— Le focus saisonnier varie le corps —')
const sTout = composerRecette('revenu_saisonnier', { side: 'tout' }, snapRiche)
const sCoussin = composerRecette('revenu_saisonnier', { side: 'coussin' }, snapRiche)
const sConstat = composerRecette('revenu_saisonnier', { side: 'fait' }, snapRiche)
ok(types(sTout) !== types(sCoussin) && types(sCoussin) !== types(sConstat), `focus tout/coussin/constat → 3 corps : [${types(sTout)}] / [${types(sCoussin)}] / [${types(sConstat)}]`)

console.log('\n— Data-aware : un bloc non soutenu est OMIS (jamais un bloc vide) —')
const snapPauvre = { depenses: snapRiche.depenses, coussin: snapRiche.coussin } // ni fiscalite, ni patrimoine, ni saison
const portraitPauvre = composerRecette('mon_portrait', {}, snapPauvre)
ok(!portraitPauvre.blocs.some((b) => b.type === 'anatomie_dollar' || b.type === 'impot_palier'), 'mon_portrait sans fiscalite → blocs fiscaux OMIS')
const viePauvre = composerRecette('ma_vie', {}, snapPauvre)
ok(!viePauvre.blocs.some((b) => ['patrimoine_vie', 'composition', 'horizon'].includes(b.type)), 'ma_vie sans patrimoine → blocs patrimoine OMIS')

console.log('\n— Chaque recette VALIDE (schema.js) + chaque fait passe filtrerFait —')
const toutes = [maisonCourt, maisonLong, voyage, fonds, sTout, ...SITS.map((s) => composerRecette(s, {}, snapRiche))]
ok(toutes.every(valide), 'toutes les recettes produites sont valides (blocs connus, aucun _ignore)')
const faitConforme = filtrerFait(BLOCS.fait.resolve(snapRiche).texte).ok
ok(faitConforme, 'le fait calculé depuis le snapshot passe filtrerFait (faits seulement)')
console.log(`      fait : "${BLOCS.fait.resolve(snapRiche).texte}"`)

console.log('\n' + (fail === 0 ? '✅ La composition vivante tient — 0 échec (le « même rendu » est mort)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
