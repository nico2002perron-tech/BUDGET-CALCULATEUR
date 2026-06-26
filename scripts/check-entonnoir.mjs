/* ============================================================================
   check-entonnoir.mjs — Pas 3a : l'ARBRE DE L'ENTONNOIR, sans navigateur.
   Prouve, au terminal, AVANT de coder l'écran :
     - intégrité : chaque nœud a ≥2 réponses ; chaque « vers » pointe vers un nœud
       existant ; aucune réponse ne mène à un cul-de-sac ;
     - chaque chemin complet (racine → feuille) résout vers une recette VALIDE
       selon schema.js (situation dispo, blocs connus, aucun _ignore) ;
     - le chemin témoin objectif › maison › cette année donne la bonne situation ;
     - les 4 situations requises sont atteignables.
   Lance : node scripts/check-entonnoir.mjs
   ========================================================================== */
import { ENTONNOIR, RACINE, resoudreEntonnoir, cheminsComplets, noeudCourant, cheminLisible } from '../src/recettes/entonnoir.js'
import { composerRecette, SITUATIONS } from '../src/recettes/composer.js'
import { validerRecette, estConnu } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

console.log('— Intégrité de l’arbre (aucun cul-de-sac) —')
let structureOk = true
const morts = []
for (const [id, noeud] of Object.entries(ENTONNOIR)) {
  if (noeud.id !== id) structureOk = false
  if (!Array.isArray(noeud.reponses) || noeud.reponses.length < 2) { structureOk = false; morts.push(`${id}: <2 réponses`) }
  for (const rep of noeud.reponses) {
    if (rep.vers && !ENTONNOIR[rep.vers]) { structureOk = false; morts.push(`${id}/${rep.id} → « ${rep.vers} » inexistant`) }
  }
}
ok(!!ENTONNOIR[RACINE], 'la racine existe')
ok(structureOk, 'chaque nœud a ≥2 réponses ; chaque « vers » pointe vers un nœud existant')
if (morts.length) console.log('      culs-de-sac : ' + JSON.stringify(morts))

const chemins = cheminsComplets()
console.log(`\n— ${chemins.length} chemins complets → recette valide (schema.js) —`)
let tousValides = true
for (const chemin of chemins) {
  const { situation, reponses, complet } = resoudreEntonnoir(chemin)
  const def = SITUATIONS[situation]
  const recette = composerRecette(situation, reponses)
  const v = validerRecette(recette)
  const valide =
    complet === true &&
    !!def && def.dispo === true &&
    Array.isArray(v.blocs) && v.blocs.length > 0 &&
    !v.blocs.some((b) => b._ignore) &&
    v.blocs.every((b) => (b.slot === 'graphique' ? !!b.choisi : estConnu(b.type)))
  if (!valide) { tousValides = false; console.log(`      ✗ ${chemin.join(' › ')} → ${situation}`) }
}
ok(tousValides, `les ${chemins.length} chemins résolvent vers une recette valide (situation dispo, blocs connus, aucun _ignore)`)
for (const chemin of chemins) {
  const { situation, reponses } = resoudreEntonnoir(chemin)
  const blocs = composerRecette(situation, reponses).blocs.map((b) => b.type).join(', ')
  console.log(`      ${chemin.join(' › ').padEnd(34)} → ${situation.padEnd(18)} [${blocs}]`)
}

console.log('\n— Chemin témoin : objectif › maison › cette année —')
const r = resoudreEntonnoir(['objectif', 'maison', 'cette_annee'])
ok(r.situation === 'objectif_epargne', 'situation = objectif_epargne')
ok(r.reponses.objectif === 'maison', 'reponses.objectif = maison')
ok(r.reponses.echeance === 'cette_annee', 'reponses.echeance = cette_annee')
ok(r.complet === true, 'chemin complet (feuille atteinte)')
const recetteObj = validerRecette(composerRecette(r.situation, r.reponses))
ok(recetteObj.blocs.some((b) => b.type === 'chaine') && !recetteObj.blocs.some((b) => b._ignore), 'recette = bloc chaine valide')

console.log('\n— Couverture des situations requises (5 portes) —')
const atteintes = new Set(chemins.map((c) => resoudreEntonnoir(c).situation))
for (const s of ['objectif_epargne', 'mon_budget', 'mon_portrait', 'ma_vie', 'revenu_saisonnier']) {
  ok(atteintes.has(s), `situation « ${s} » atteignable par au moins un chemin`)
}

console.log('\n— Fil d’Ariane lisible (cheminLisible) —')
const fil = cheminLisible(['objectif', 'maison', 'cette_annee'])
ok(fil.length === 3, 'objectif › maison › cette année → 3 étapes')
ok(fil[0].label === 'Atteindre un objectif d’épargne' && fil[1].label === 'Une maison', 'chaque étape porte son libellé')
ok(cheminLisible(['portrait']).length === 1, 'porte directe (portrait) → 1 étape lisible')

console.log('\n— Navigation (noeudCourant) cohérente pour l’écran —')
ok(noeudCourant([]) === ENTONNOIR[RACINE], 'chemin vide → la racine')
ok(noeudCourant(['objectif']) === ENTONNOIR.obj_type, 'objectif → nœud « type d’objectif »')
ok(noeudCourant(['objectif', 'maison']) === ENTONNOIR.obj_echeance, 'objectif › maison → nœud « échéance »')
ok(noeudCourant(['objectif', 'maison', 'cette_annee']) === null, 'chemin complet → plus de question (null)')

console.log('\n' + (fail === 0 ? '✅ L’arbre de l’entonnoir tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
