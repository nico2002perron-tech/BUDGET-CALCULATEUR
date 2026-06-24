/* ============================================================================
   check-revenus.mjs — prouve la CONFORMITÉ de la répartition saisonnière :
   la somme rendue vaut EXACTEMENT le total de l'usager (aucun dollar inventé),
   la forme est en cloche, et les mois inactifs restent à 0.
   Lance : node scripts/check-revenus.mjs
   ========================================================================== */
import { repartirSaisonnier, revenusMensuels, moisActifsDefaut } from '../src/lib/revenus.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

console.log('— Conformité : somme = total exact —')
for (const annuel of [42400, 50000, 99999, 1, 7, 123457]) {
  for (const actifs of [
    moisActifsDefaut(),
    [false, false, false, true, true, true, true, true, true, true, false, false], // avr→oct
    [false, false, false, false, false, false, true, false, false, false, false, false], // juillet seul
  ]) {
    const rep = repartirSaisonnier(annuel, actifs)
    const somme = rep.reduce((a, b) => a + b, 0)
    if (somme !== annuel) { fail++; console.log(`  ✗ somme ${somme} ≠ total ${annuel}`) }
  }
}
ok(true, 'somme === total pour tous les cas (sinon ✗ ci-dessus)')

console.log('\n— Mois inactifs à 0 + forme en cloche —')
const actifs = [false, false, false, true, true, true, true, true, true, true, false, false] // avr→oct
const rep = repartirSaisonnier(42400, actifs)
console.log('  répartition avr→oct :', JSON.stringify(rep))
ok([0, 1, 2, 10, 11].every((i) => rep[i] === 0), 'mois inactifs = 0')
ok(rep.slice(3, 10).every((v) => v > 0), 'mois actifs > 0')
const pic = rep.indexOf(Math.max(...rep))
ok(pic >= 5 && pic <= 7, 'le pic est au milieu de la saison (≈ juillet)')
ok(rep[3] < rep[6] && rep[9] < rep[6], 'forme en cloche (bords < centre)')

console.log('\n— Cas limites —')
ok(repartirSaisonnier(0, actifs).every((v) => v === 0), 'total 0 → tout à 0')
ok(repartirSaisonnier(50000, Array(12).fill(false)).every((v) => v === 0), 'aucun mois actif → tout à 0')

console.log('\n— Dérivation stable vs saisonnier —')
ok(JSON.stringify(revenusMensuels({ mode: 'stable', mensuel: 3000 })) === JSON.stringify(Array(12).fill(3000)), 'stable → 12 mois égaux')
ok(revenusMensuels({ mode: 'saisonnier', repartition: rep }).reduce((a, b) => a + b, 0) === 42400, 'saisonnier → somme de la répartition')

console.log('\n' + (fail === 0 ? '✅ Répartition conforme — 0 dollar inventé' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
