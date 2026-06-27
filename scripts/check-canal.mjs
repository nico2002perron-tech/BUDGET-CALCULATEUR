/* ============================================================================
   check-canal.mjs — Tranche studio, PORTE B : le canal scripté (sans navigateur).
   Prouve : le canal projet_abordable résout vers une config complète ; un montant
   non-numérique est rejeté proprement (coercition) ; chaque ligne de dialogue passe
   filtrerFait (faits seulement). Lance : node scripts/check-canal.mjs
   ========================================================================== */
import { CANAUX, coerceMontant, etapeCanalCourante, canalComplet, resoudreCanal } from '../src/recettes/entonnoir.js'
import { filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

console.log('— Coercition du montant (jamais de texte dans un calcul) —')
ok(coerceMontant('4 000 $') === 4000, '« 4 000 $ » → 4000')
ok(coerceMontant('4000') === 4000, '« 4000 » → 4000')
ok(coerceMontant('vingt mille') === null, '« vingt mille » → null (rejeté)')
ok(coerceMontant('') === null && coerceMontant(0) === null && coerceMontant(-5) === null, 'vide / 0 / négatif → null')

console.log('\n— Progression scriptée : une étape à la fois —')
ok(etapeCanalCourante('projet_abordable', {}).id === 'cout', 'départ → étape « cout »')
ok(etapeCanalCourante('projet_abordable', { cout: '4 000 $' }).id === 'echeance', 'après cout → « echeance »')
ok(etapeCanalCourante('projet_abordable', { cout: '4 000 $', echeance: 'moyen' }).id === 'scenarioChoisi', 'après echeance → « scenarioChoisi »')
ok(etapeCanalCourante('projet_abordable', { cout: 'vingt mille', echeance: 'moyen' }).id === 'cout', 'montant non-numérique → on RESTE à l’étape cout (rejeté proprement)')

console.log('\n— Config complète (photo optionnelle) —')
const reponses = { cout: '4 000 $', echeance: 'moyen', scenarioChoisi: { contributionMensuelle: 150, horizonMois: 27 }, couleur: 'cyan' }
ok(canalComplet('projet_abordable', reponses) === true, 'cout+echeance+scenario+couleur (photo absente) → complet')
const cfg = resoudreCanal('projet_abordable', reponses)
ok(cfg.complet === true && cfg.reponses.cout === 4000, 'resoudreCanal → complet, cout coercé à 4000')
ok(cfg.scenarioChoisi && cfg.scenarioChoisi.contributionMensuelle === 150, 'scénario choisi conservé')
ok(canalComplet('projet_abordable', { cout: '4 000 $', echeance: 'moyen', scenarioChoisi: {} }) === false, 'sans couleur → pas encore complet')
ok(resoudreCanal('inconnu', {}) === null, 'canal inconnu → null (jamais d’erreur)')

console.log('\n— Conformité : chaque ligne de dialogue passe filtrerFait —')
let toutesOk = true
for (const e of CANAUX.projet_abordable.etapes) {
  if (!filtrerFait(e.question).ok) { toutesOk = false; console.log(`      ✗ "${e.question}"`) }
  for (const o of e.options || []) if (!filtrerFait(o.label).ok) { toutesOk = false; console.log(`      ✗ option "${o.label}"`) }
}
ok(toutesOk, 'toutes les questions + options sont factuelles (aucun jugement/impératif)')

console.log('\n' + (fail === 0 ? '✅ Le canal scripté tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
