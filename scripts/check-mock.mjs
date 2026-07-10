/* ============================================================================
   check-mock.mjs — LE MOCK HORS LIGNE du copilote (mockPiloter, api/build-tool.js).
   Sans clé IA, la barre « demande à ta tour » marche par MOTS-CLÉS. On vérifie que
   les phrases attendues → les bonnes actions, ET que les FAUX-POSITIFS de la revue
   nuage (répartition/partie/appartement → pct ; engagement/je m'engage → fixe/variable)
   NE se déclenchent PLUS. Garde cache-proof (node importe le fichier à neuf).
   ========================================================================== */
import { mockPiloter } from '../api/build-tool.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

// Payload « sable » d'un poste budget : mesures ET découpes offertes (le mock lit l'offre).
const P = {
  surface: 'sable', kpi: 'cout_vie_mensuel', question: 'x', formeActive: 'stat',
  formesOffertes: ['stat', 'beignet', 'courbe', 'bandes'],
  mesuresOffertes: ['brut', 'pct_revenu', 'pct_depenses'],
  decoupesOffertes: ['par_categorie', 'fixe_variable'],
  contextesOfferts: [], couleurs: ['vert', 'cyan'], cible: { present: false, unite: '', posee: false },
}
const verbes = (phrase) => mockPiloter(phrase, P).actions.map((a) => a.verbe + (a.mesure ? ':' + a.mesure : '') + (a.decoupe ? ':' + a.decoupe : '') + (a.forme ? ':' + a.forme : ''))
const a = (phrase) => verbes(phrase)

console.log('— LA LECTURE (dérivée) : bons cas —')
ok(a('en % de mon revenu').includes('changer_mesure:pct_revenu'), '« en % de mon revenu » → pct_revenu')
ok(a('la part de mon revenu').includes('changer_mesure:pct_revenu'), '« la part de mon revenu » → pct_revenu (part = mot entier)')
ok(a('montre-le en % de mes dépenses').includes('changer_mesure:pct_depenses'), '« en % de mes dépenses » → pct_depenses')
ok(a('remets le montant').includes('changer_mesure:brut'), '« remets le montant » → brut')

console.log('\n— LA DÉCOUPE : bons cas —')
ok(a('montre-le en fixe / variable').includes('changer_decoupe:fixe_variable'), '« en fixe / variable » → fixe_variable')
ok(a('mes dépenses engagées').includes('changer_decoupe:fixe_variable'), '« dépenses engagées » → fixe_variable')
ok(a('par catégorie').includes('changer_decoupe:par_categorie'), '« par catégorie » → par_categorie')

console.log('\n— FAUX-POSITIFS de la revue nuage : ÉLIMINÉS —')
ok(!a('montre la répartition de mon revenu').some((v) => v.startsWith('changer_mesure')), '« répartition de mon revenu » → PAS de changer_mesure (part ≠ répartition)', a('montre la répartition de mon revenu').join(','))
ok(!a('quelle partie de mon revenu').some((v) => v.startsWith('changer_mesure')), '« quelle partie de mon revenu » → PAS de changer_mesure')
ok(!a('mon appartement vs mon revenu').some((v) => v.startsWith('changer_mesure')), '« appartement … revenu » → PAS de changer_mesure')
ok(!a('quel est mon plus gros engagement mensuel').some((v) => v.startsWith('changer_decoupe')), '« engagement » → PAS de changer_decoupe (engage ≠ engagement)', a('quel est mon plus gros engagement mensuel').join(','))
ok(!a("je m'engage à épargner").some((v) => v.startsWith('changer_decoupe')), '« je m’engage » → PAS de changer_decoupe')

console.log('\n— La forme marche toujours (non régressée) —')
ok(a('en courbe').includes('changer_forme:courbe'), '« en courbe » → changer_forme:courbe')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Le mock hors ligne tient — 0 échec (bons cas + faux-positifs éliminés)')
