/* ============================================================================
   check-peaux.mjs — LES PEAUX de carte (peaux.js), pures. Un registre stable,
   une validation stricte (un id inconnu / hostile → jamais une classe posée),
   'defaut' → aucune classe (le look de base = l'absence de peau).
   ========================================================================== */
import { PEAUX, peauValide, classePeau } from '../src/lib/peaux.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

console.log('— REGISTRE + VALIDATION —')
ok(Array.isArray(PEAUX) && PEAUX.length === 4, `4 peaux (${PEAUX.length})`)
ok(PEAUX.every((p) => typeof p.id === 'string' && typeof p.label === 'string'), 'chaque peau a id + label')
ok(PEAUX[0].id === 'defaut', "la 1re peau = 'defaut' (le look de base)")
ok(PEAUX.every((p) => peauValide(p.id)), 'tous les ids du registre sont valides')

console.log('\n— peauValide : strict —')
ok(!peauValide('flou'), 'un id inconnu → invalide')
ok(!peauValide(''), 'chaîne vide → invalide')
ok(!peauValide(null) && !peauValide(undefined), 'null/undefined → invalide')
ok(!peauValide(42) && !peauValide({}), 'non-string (nombre/objet, silo hostile) → invalide')

console.log('\n— classePeau : le look de base est l’absence de classe —')
ok(classePeau('defaut') === '', "'defaut' → chaîne vide (aucune classe)")
ok(classePeau('verre') === 'peau-verre', "'verre' → 'peau-verre'")
ok(classePeau('mat') === 'peau-mat' && classePeau('relief') === 'peau-relief', 'mat/relief → leur classe')
ok(classePeau('flou') === '' && classePeau(null) === '', 'inconnu/null → vide (jamais une classe folle)')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Les peaux tiennent — 0 échec (style seulement, validation stricte)')
