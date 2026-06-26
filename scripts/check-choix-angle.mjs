/* ============================================================================
   check-choix-angle.mjs — ÉTAGE 3a : le SÉLECTEUR D'ANGLE (logique pure).
   Prouve, sans navigateur :
     - candidatsValides filtre selon le snapshot (riche / pauvre / vide) ;
     - un emplacement à candidats résout vers le bloc CHOISI ;
     - changer `choisi` ne change QUE la présentation : snapshot jamais muté, resolve
       déterministe, aucun montant recalculé ;
     - un `choisi` invalide/inconnu retombe proprement (repli sûr) ;
     - validerRecette conserve le slot, défaut choisi=recommande, filtre le pourquoi ;
     - chaque « pourquoi » posé passe filtrerFait (faits seulement).
   Lance : node scripts/check-choix-angle.mjs
   ========================================================================== */
import { candidatsValides, resoudreSlot, validerRecette, filtrerFait } from '../src/recettes/schema.js'
import { composerRecette, POURQUOI } from '../src/recettes/composer.js'
import { BLOCS } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

const SLOT = { slot: 'graphique', recommande: 'beignet', alternatives: ['barre_empilee', 'repartition', 'liste'], choisi: 'beignet', pourquoi: POURQUOI.beignet }
const snapRiche = { depenses: { parCategorie: [{ id: 'a', label: 'Logement', montant: 1100, classe: 'besoin' }, { id: 'b', label: 'Épicerie', montant: 600, classe: 'besoin' }, { id: 'c', label: 'Transport', montant: 350, classe: 'besoin' }, { id: 'd', label: 'Sorties', montant: 220, classe: 'envie' }, { id: 'e', label: 'Abonnements', montant: 55, classe: 'envie' }], engageLibre: { fixe: 1000, variable: 1755 }, parClasse: { besoin: 2050, envie: 275, epargne: 200 }, total: 2525 } }
const snapPauvre = { depenses: { parCategorie: [{ id: 'x', label: 'Tout', montant: 100, classe: 'besoin' }], engageLibre: { fixe: 0, variable: 0 }, parClasse: { besoin: 0, envie: 0, epargne: 0 } } }
const snapVide = {}

console.log('— candidatsValides filtre selon le snapshot (data-aware) —')
const cR = candidatsValides(SLOT, snapRiche)
ok(cR.length === 4 && cR[0] === 'beignet', '4 candidats valides (riche), recommande en tête')
const cP = candidatsValides(SLOT, snapPauvre)
ok(cP.includes('beignet') && cP.includes('liste') && !cP.includes('barre_empilee') && !cP.includes('repartition'), 'pauvre → seulement beignet + liste (pas de fixe/variable, pas de classes)')
ok(candidatsValides(SLOT, snapVide).length === 0, 'snapshot vide → aucun candidat')

console.log('\n— Un emplacement résout vers le bloc CHOISI —')
ok(resoudreSlot(SLOT, snapRiche) === 'beignet', 'choisi = beignet → rend beignet')
ok(resoudreSlot({ ...SLOT, choisi: 'repartition' }, snapRiche) === 'repartition', 'choisi = repartition → rend repartition')

console.log('\n— Repli sûr : un choisi invalide ne peut jamais atteindre le rendu —')
ok(resoudreSlot({ ...SLOT, choisi: 'inconnu_xyz' }, snapRiche) === 'beignet', 'choisi inconnu → repli sur recommande')
ok(resoudreSlot({ ...SLOT, choisi: 'barre_empilee' }, snapPauvre) === 'beignet', 'choisi non soutenu par les données → repli sur 1er candidat valide')
ok(resoudreSlot(SLOT, snapVide) === null, 'aucun candidat valide → null (slot ignoré proprement)')

console.log('\n— Changer d’angle ne touche JAMAIS aux chiffres (présentation pure) —')
const avant = JSON.stringify(snapRiche)
const dBeignetA = JSON.stringify(BLOCS.beignet.resolve(snapRiche))
resoudreSlot({ ...SLOT, choisi: 'liste' }, snapRiche)
resoudreSlot({ ...SLOT, choisi: 'barre_empilee' }, snapRiche)
const dBeignetB = JSON.stringify(BLOCS.beignet.resolve(snapRiche))
ok(JSON.stringify(snapRiche) === avant, 'le snapshot n’est jamais muté (lecture seule)')
ok(dBeignetA === dBeignetB, 'changer de choisi ne recalcule pas les chiffres (resolve déterministe, aucun montant touché)')

console.log('\n— validerRecette : conserve le slot, choisi=recommande par défaut, pourquoi filtré —')
const vr = validerRecette({ blocs: [{ slot: 'graphique', recommande: 'beignet', alternatives: ['liste'], pourquoi: 'Tu devrais choisir le beignet.' }] })
ok(vr.blocs[0].slot === 'graphique', 'le slot est conservé')
ok(vr.blocs[0].choisi === 'beignet', 'choisi défaut = recommande')
ok(vr.blocs[0].pourquoi === '', 'pourquoi jugeant rejeté par filtrerFait → vidé (jamais de texte brut)')
const vr2 = validerRecette({ blocs: [{ slot: 'graphique', recommande: 'inconnu', alternatives: ['aussi_inconnu'] }] })
ok(vr2.blocs[0]._ignore === true, 'slot sans candidat connu → _ignore (ignoré proprement)')

console.log('\n— composer pose un emplacement à candidats pour mon_budget —')
const recBudget = composerRecette('mon_budget', {}, snapRiche)
const slotBudget = recBudget.blocs.find((b) => b.slot === 'graphique')
ok(!!slotBudget, 'mon_budget → héros = emplacement à candidats')
ok(slotBudget.recommande === 'beignet', 'recommande déterministe : beaucoup de catégories → beignet')
ok(slotBudget.choisi === slotBudget.recommande && slotBudget.alternatives.length >= 1, 'choisi défaut = recommande ; alternatives offertes')
ok(filtrerFait(slotBudget.pourquoi).ok && !!slotBudget.pourquoi, 'le pourquoi posé passe filtrerFait')
console.log(`      → recommande:${slotBudget.recommande} · alternatives:[${slotBudget.alternatives}] · "${slotBudget.pourquoi}"`)

console.log('\n— Chaque « pourquoi » du registre passe filtrerFait (faits seulement) —')
for (const t of Object.keys(POURQUOI)) {
  ok(filtrerFait(POURQUOI[t]).ok, `pourquoi[${t}] factuel`)
}

console.log('\n' + (fail === 0 ? '✅ Le sélecteur d’angle tient — 0 échec (changer d’angle = présentation pure)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
