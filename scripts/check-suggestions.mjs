/* ============================================================================
   check-suggestions.mjs — « la tour pense » (suggestions.js), sans navigateur.
   Prouve :
     - un snapshot saisonnier propose revenu_saisonnier EN TÊTE ;
     - un snapshot budget-seul propose mon_budget ;
     - un snapshot vide → [] (cold start) ;
     - jamais plus de 3, classées par pertinence (le plus spécifique d'abord) ;
     - chaque raison passe filtrerFait (faits seulement) ;
     - chaque situation proposée est dispo ET pointe vers une recette VALIDE ;
     - honnêteté : aucune suggestion sans la donnée qui la soutient.
   Lance : node scripts/check-suggestions.mjs
   ========================================================================== */
import { suggererIndicateurs } from '../src/recettes/suggestions.js'
import { composerRecette, SITUATIONS } from '../src/recettes/composer.js'
import { validerRecette, estConnu, filtrerFait } from '../src/recettes/schema.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { DEMO_SAISONNIER, exempleStore, emptyStore } from '../src/lib/storage.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}
// Une suggestion est SAINE : raison factuelle (filtrerFait) + situation dispo + recette valide.
const saine = (s) => {
  if (!filtrerFait(s.raison).ok || !s.raison) return false
  if (!SITUATIONS[s.situation] || SITUATIONS[s.situation].dispo !== true) return false
  const v = validerRecette(composerRecette(s.situation, {}))
  return v.blocs.length > 0 && !v.blocs.some((b) => b._ignore) && v.blocs.every((b) => (b.slot === 'graphique' ? !!b.choisi : estConnu(b.type)))
}
const montre = (nom, sugs) => console.log(`      [${nom}] ${sugs.map((s) => `${s.situation}(${s.pertinence})`).join(' › ') || '∅'}`)

console.log('— Snapshot saisonnier → revenu_saisonnier EN TÊTE —')
const snapSaison = { saison: { revenusMensuels: [0, 0, 800, 3200, 5600, 6800, 7200, 7000, 6200, 4200, 1200, 200], depensesMensuelles: 3400, coussin: 8400 } }
const sSaison = suggererIndicateurs(snapSaison)
ok(sSaison.length >= 1 && sSaison[0].situation === 'revenu_saisonnier', 'revenu_saisonnier proposé en tête')
ok(!sSaison.some((s) => s.situation === 'ma_vie'), 'honnêteté : pas de patrimoine → aucune suggestion ma_vie')
montre('saison', sSaison)
console.log(`      raison : "${sSaison[0] && sSaison[0].raison}"`)

console.log('\n— Snapshot budget-seul → mon_budget —')
const snapBudget = { depenses: { parCategorie: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], coutVie: 2000, total: 2000 } }
const sBudget = suggererIndicateurs(snapBudget)
ok(sBudget.length === 1 && sBudget[0].situation === 'mon_budget', 'une seule suggestion : mon_budget')
ok(!sBudget.some((s) => s.situation === 'revenu_saisonnier'), 'honnêteté : revenu stable → aucune suggestion saisonnier')
montre('budget', sBudget)
console.log(`      raison : "${sBudget[0] && sBudget[0].raison}"`)

console.log('\n— Cold start : snapshot vide → [] —')
ok(suggererIndicateurs({}).length === 0, 'snapshot {} → []')
ok(suggererIndicateurs(null).length === 0, 'snapshot null → []')
ok(suggererIndicateurs(snapshotFromStore(emptyStore())).length === 0, 'emptyStore (réel) → [] (la surface n’affiche rien)')

console.log('\n— Honnêteté : objets présents mais VIDES ne déclenchent rien —')
ok(suggererIndicateurs({ patrimoine: {} }).length === 0, 'patrimoine {} (sans actifs ni passifs) → aucune suggestion ma_vie')
ok(suggererIndicateurs({ patrimoine: { actifs: 0, passifs: 0 } }).length === 0, 'patrimoine à zéro → aucune suggestion')
ok(suggererIndicateurs({ fiscalite: {} }).length === 0, 'fiscalite {} (sans brut) → aucune suggestion mon_portrait')
ok(suggererIndicateurs({ depenses: { parCategorie: [] } }).length === 0, 'depenses sans catégorie → aucune suggestion mon_budget')
ok(suggererIndicateurs({ patrimoine: { actifs: 5000, passifs: 0 } })[0].raison === 'Tu as saisi tes avoirs.', 'avoirs seuls → raison honnête « Tu as saisi tes avoirs. »')

console.log('\n— Cap à 3 + classement quand tout s’active —')
const snapTout = {
  saison: { revenusMensuels: [1000, 1000, 1000, 8000, 8000, 8000, 8000, 8000, 1000, 1000, 1000, 1000], depensesMensuelles: 3000, coussin: 5000 },
  depenses: { parCategorie: [{ id: 'a' }, { id: 'b' }], coutVie: 2500, total: 2500 },
  patrimoine: { net: 50000, actifs: 100000, passifs: 50000 },
  fiscalite: { brut: 65000 },
}
const sTout = suggererIndicateurs(snapTout)
ok(sTout.length === 3, '4 règles actives → plafonné à 3')
ok(sTout[0].situation === 'revenu_saisonnier', 'le plus spécifique (saisonnier) en tête')
ok(!sTout.some((s) => s.situation === 'mon_budget'), 'le budget générique (pertinence la plus basse) est écarté au-delà de 3')
ok(sTout.every((s, i) => i === 0 || s.pertinence <= sTout[i - 1].pertinence), 'classées par pertinence décroissante')
montre('tout', sTout)

console.log('\n— Conformité + validité sur TOUTES les suggestions produites —')
for (const [nom, sugs] of [['saison', sSaison], ['budget', sBudget], ['tout', sTout]]) {
  ok(sugs.every((s) => filtrerFait(s.raison).ok && s.raison), `[${nom}] chaque raison passe filtrerFait (faits seulement)`)
  ok(sugs.every(saine), `[${nom}] chaque suggestion est dispo + recette valide`)
}

console.log('\n— Intégration réelle (snapshots construits par canonical.js) —')
const sDemo = suggererIndicateurs(snapshotFromStore(DEMO_SAISONNIER))
ok(sDemo.length >= 1 && sDemo[0].situation === 'revenu_saisonnier', 'DEMO_SAISONNIER → saisonnier en tête')
ok(sDemo.every(saine), 'DEMO_SAISONNIER : suggestions saines')
const sExemple = suggererIndicateurs(snapshotFromStore(exempleStore()))
ok(sExemple.length <= 3 && sExemple[0].situation === 'revenu_saisonnier', 'exempleStore (riche) → saisonnier en tête, ≤ 3')
ok(sExemple.every(saine), 'exempleStore : suggestions saines')
montre('exempleStore', sExemple)

console.log('\n' + (fail === 0 ? '✅ La tour propose juste — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
