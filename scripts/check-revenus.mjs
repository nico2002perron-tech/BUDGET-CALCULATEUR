/* ============================================================================
   check-revenus.mjs — prouve la CONFORMITÉ de la répartition saisonnière :
   la somme rendue vaut EXACTEMENT le total de l'usager (aucun dollar inventé),
   la forme est en cloche, et les mois inactifs restent à 0.
   Lance : node scripts/check-revenus.mjs
   ========================================================================== */
import { repartirSaisonnier, revenusMensuels, moisActifsDefaut, revenuMensuel, payDaysForMonth } from '../src/lib/revenus.js'

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

console.log('\n— Fréquence de paie → revenu mensuel —')
ok(revenuMensuel({ mode: 'regulier', freq: 'monthly', montantParPaie: 3000 }) === 3000, 'mensuel 3000/paie → 3000 $/mois')
ok(revenuMensuel({ mode: 'regulier', freq: 'semimonthly', montantParPaie: 1500 }) === 3000, '2×/mois 1500/paie → 3000 $/mois')
ok(revenuMensuel({ mode: 'regulier', freq: 'biweekly', montantParPaie: 2000 }) === 4333, 'aux 2 sem 2000/paie → 4333 $/mois')
ok(revenuMensuel({ mode: 'regulier', freq: 'weekly', montantParPaie: 1000 }) === 4333, 'chaque sem 1000/paie → 4333 $/mois')
ok(revenusMensuels({ mode: 'regulier', freq: 'monthly', montantParPaie: 3000 }).every((v) => v === 3000), 'régulier → 12 mois égaux')

console.log('\n— Jours de paie sur le mois (juin 2026) —')
ok(JSON.stringify(payDaysForMonth({ mode: 'regulier', freq: 'semimonthly', jours: [1, 15] }, 2026, 5)) === '[1,15]', '2×/mois → [1,15]')
ok(JSON.stringify(payDaysForMonth({ mode: 'regulier', freq: 'monthly', jours: [5] }, 2026, 5)) === '[5]', 'mensuel → [5]')
const jeudis = payDaysForMonth({ mode: 'regulier', freq: 'weekly', weekday: 4 }, 2026, 5)
ok(jeudis.length >= 4 && jeudis.every((d) => new Date(2026, 5, d).getDay() === 4), 'hebdo jeudi → tous les jeudis')
const bw = payDaysForMonth({ mode: 'regulier', freq: 'biweekly', weekday: 4, anchor: '2026-06-04' }, 2026, 5)
ok(bw.includes(4) && bw.includes(18), 'aux 2 sem (ancre 4 juin) → 4 et 18')
console.log(`      → jeudis=${JSON.stringify(jeudis)}  aux2sem=${JSON.stringify(bw)}`)

console.log('\n— Cas limite : 2 paies/mois ≥ 29 en février non bissextile (pas de fusion) —')
const fev = payDaysForMonth({ mode: 'regulier', freq: 'semimonthly', jours: [29, 30] }, 2026, 1) // fév 2026 = 28 j
ok(fev.length === 2, 'deux paies conservées (clampées à 28) au lieu de fusionner en une')
ok(fev.every((d) => d === 28), 'les deux tombent le 28 (dernier jour) → revenu de février complet')

console.log('\n' + (fail === 0 ? '✅ Répartition + fréquence conformes' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
