/* ============================================================================
   check-recette.mjs — prouve les 2 garde-fous du moteur, sans navigateur :
     #1  un bloc de type INCONNU est ignoré proprement (jamais d'erreur) ;
     #2  le filtre de conformité REJETTE un `fait` contenant un mot interdit.
   Lance : node scripts/check-recette.mjs
   ========================================================================== */
import { validerRecette, filtrerFait, estConnu, BLOCS } from '../src/recettes/schema.js'
import { composerRecette } from '../src/recettes/composer.js'

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

console.log('\n— Clé de voûte : l’entretien (composer) sort une recette VALIDE schema.js —')
const rc = composerRecette('revenu_saisonnier', { vue: 'mensuel', mesure: 'montant', side: 'coussin' })
ok(rc.situation === 'revenu_saisonnier' && Array.isArray(rc.blocs), 'composer → recette { situation, titre, blocs }')
ok(rc.blocs.every((b) => estConnu(b.type)), 'tous les blocs produits sont connus du registre')
ok(rc.blocs[0].type === 'flux_annuel' && rc.blocs[0].params.vue === 'mensuel', 'la réponse vue:mensuel passe dans le bloc')
const vc = validerRecette(rc)
ok(vc.blocs.length === rc.blocs.length && !vc.blocs.some((b) => b._ignore), 'le validateur accepte la recette (aucun bloc ignoré)')
console.log(`      → side:coussin = ${rc.blocs.map((b) => b.type).join(', ')}`)
const rcTout = composerRecette('revenu_saisonnier', { side: 'tout' })
ok(rcTout.blocs.length === 3, 'side:tout → 3 blocs (flux + jauge + fait ; coussin une seule fois)')
const rcFait = composerRecette('revenu_saisonnier', { side: 'fait' })
ok(rcFait.blocs.length === 2, 'side:fait → 2 blocs (flux + fait)')
ok(typeof BLOCS === 'object', 'BLOCS exporté (sanity)')

console.log('\n— Couche de compréhension : objectif_epargne compose un HÉROS KPI (forme chaine) —')
ok(estConnu('chaine') === true, 'le bloc chaine est connu (schema + registre)')
const rcObj = composerRecette('objectif_epargne')
ok(rcObj.blocs.some((b) => b.KPI === 'horizon_objectif' && b.forme === 'chaine'), 'objectif_epargne compose un emplacement KPI horizon_objectif, forme chaine')
ok(rcObj.blocs.every((b) => (b.KPI ? estConnu(b.forme) : estConnu(b.type))), 'tous les blocs de objectif_epargne sont connus (type OU forme du KPI)')
const vObj = validerRecette(rcObj)
ok(!vObj.blocs.some((b) => b._ignore), 'le validateur accepte la recette objectif_epargne (aucun bloc ignoré)')

console.log('\n' + (fail === 0 ? '✅ Les garde-fous + le composer tiennent — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
