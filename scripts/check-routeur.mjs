/* ============================================================================
   check-routeur.mjs — Tranche studio, PORTE A : le routeur (sans navigateur, sans clé).
   Prouve : « puis-je me payer un voyage » → projet_abordable (repli mots-clés) ;
   le mapping archétype→canal est stable ; un message hors-sujet → 'inconnu' (jamais
   d'erreur). Lance : node scripts/check-routeur.mjs
   ========================================================================== */
import { routerMessage, archetypeVersCanal } from '../src/recettes/routeur.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

console.log('— Repli déterministe par mots-clés (sans clé IA) —')
for (const m of ['est-ce que je peux me payer un voyage', 'Puis-je me permettre un voyage en Europe ?', 'je veux économiser pour une mise de fonds', 'acheter une auto']) {
  const r = routerMessage(m)
  ok(r.canal === 'projet_abordable', `« ${m} » → projet_abordable`)
}

console.log('\n— Mapping archétype → canal (stable, pur) —')
ok(archetypeVersCanal('goal') === 'projet_abordable', 'goal → projet_abordable')
ok(archetypeVersCanal('debt') === 'inconnu', 'debt → inconnu (canal pas encore outillé)')
ok(archetypeVersCanal('budget') === 'inconnu', 'budget → inconnu')
ok(archetypeVersCanal('unknown') === 'inconnu', 'unknown → inconnu')
ok(archetypeVersCanal(undefined) === 'inconnu', 'archétype absent → inconnu (jamais d’erreur)')

console.log('\n— Hors-sujet / vide → inconnu, jamais d’erreur —')
ok(routerMessage('quelle heure est-il ?').canal === 'inconnu', 'phrase hors-sujet → inconnu')
ok(routerMessage('').canal === 'inconnu', 'vide → inconnu')
ok(routerMessage(null).canal === 'inconnu', 'null → inconnu (robuste)')

console.log('\n' + (fail === 0 ? '✅ Le routeur tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
