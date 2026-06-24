/* ============================================================================
   check-recette.mjs — prouve les 2 garde-fous du moteur, sans navigateur :
     #1  un bloc de type INCONNU est ignoré proprement (jamais d'erreur) ;
     #2  le filtre de conformité REJETTE un `fait` contenant un mot interdit.
   Lance : node scripts/check-recette.mjs
   ========================================================================== */
import { validerRecette, filtrerFait, estConnu } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

console.log('— Garde-fou #2 : filtre de conformité (faits, jamais jugement) —')
const conforme = filtrerFait("Tes 6 mois d'été génèrent 87 % de ton revenu annuel.")
ok(conforme.ok === true && conforme.texte, 'un fait FACTUEL passe le filtre')
console.log(`      → "${conforme.texte}"`)

const interdit = filtrerFait('Tu devrais couper tes dépenses, tu es sur la bonne voie.')
ok(interdit.ok === false && interdit.texte === null, 'un fait JUGEANT est rejeté (texte nettoyé → null)')
console.log(`      → rejeté · mots interdits détectés : ${JSON.stringify(interdit.motif)}`)

const interdit2 = filtrerFait('Bien géré ! Continue, tu es en avance sur ton plan.')
ok(interdit2.ok === false, 'autre fait jugeant rejeté ("bien géré", "en avance")')
console.log(`      → rejeté · ${JSON.stringify(interdit2.motif)}`)

console.log('\n— Garde-fou #1 : type inconnu ignoré + params bornés —')
const recette = {
  situation: 'revenu_saisonnier',
  titre: "Passer l'hiver",
  blocs: [
    { type: 'flux_annuel', params: { souligner: 'PAS_UNE_VALEUR', vue: 'mensuel' } }, // souligner hors borne
    { type: 'bloc_inexistant_xyz', params: {} }, // type inconnu
    { type: 'fait', params: { texte: 'Tu dois rembourser plus vite.' } }, // fait interdit
  ],
}
const v = validerRecette(recette)

ok(estConnu('flux_annuel') === true && estConnu('bloc_inexistant_xyz') === false, 'estConnu distingue connu/inconnu')

const flux = v.blocs[0]
ok(flux.params.souligner === 'mois_deficitaires', 'param hors borne (souligner) → défaut sûr')
ok(flux.params.vue === 'mensuel', 'param valide (vue:mensuel) → conservé')

const inconnu = v.blocs[1]
ok(inconnu._ignore === true, 'type inconnu → marqué _ignore (le moteur le sautera)')

const fait = v.blocs[2]
ok(fait.params.texte === null && Array.isArray(fait._faitRejete) && fait._faitRejete.length > 0, 'fait interdit dans la recette → texte nettoyé + motif')
console.log(`      → fait rejeté · ${JSON.stringify(fait._faitRejete)}`)

console.log('\n' + (fail === 0 ? '✅ Les 2 garde-fous tiennent — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
