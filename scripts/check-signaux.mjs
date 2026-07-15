/* ============================================================================
   check-signaux.mjs — LE MOTEUR DE SIGNAUX (P3), sans navigateur. Prouve :
     - chaque signal s'allume sur un snapshot qui le porte, PAS sur un qui ne le porte pas ;
     - les suggestions sont data-aware (KPI résoluble), sans doublon avec le board ;
     - l'apprentissage : une écartée reste tue 3 mois, revient si le signal se renforce,
       reste tue si inchangé ; un domaine gardé remonte.
   Lance : node scripts/check-signaux.mjs
   ========================================================================== */
import { detecterSignaux, suggestionsKPI, moisDeSnapshot } from '../src/lib/signaux-kpi.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'

let fail = 0
const ok = (c, l) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) fail++ }
const aSignal = (snap, id, opts) => detecterSignaux(snap, opts).some((s) => s.id === id)

console.log('— Chaque signal : s’allume / ne s’allume pas —')
ok(aSignal({ saison: { revenusMensuels: [0, 0, 800, 3200, 5600, 6800, 7200, 7000, 6200, 4200, 1200, 200] } }, 'saison'), 'saison : revenus variables → allumé')
ok(!aSignal({ saison: { revenusMensuels: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000] } }, 'saison'), 'saison : revenus plats → éteint')
ok(aSignal({ depenses: { parCategorie: [{ label: 'Logement', montant: 1100 }, { label: 'Bouffe', montant: 400 }], coutVie: 2000 } }, 'concentration'), 'concentration : top 55 % → allumé')
ok(!aSignal({ depenses: { parCategorie: [{ montant: 300 }, { montant: 300 }], coutVie: 2000 } }, 'concentration'), 'concentration : top 15 % → éteint')
ok(aSignal({ depenses: { reste: 578 } }, 'marge'), 'marge : reste présent → allumé')
ok(aSignal({ coussin: { montant: 8400 } }, 'coussin'), 'coussin : montant > 0 → allumé')
ok(!aSignal({ coussin: { montant: 0 } }, 'coussin'), 'coussin : montant 0 → éteint')
ok(aSignal({ depenses: { engageLibre: { fixe: 1200, variable: 800 } } }, 'engage_libre'), 'fixe/variable présent → allumé')
ok(aSignal({}, 'historique', { historique: [{}, {}, {}] }), 'historique : 3 photos → allumé')
ok(!aSignal({}, 'historique', { historique: [{}, {}] }), 'historique : 2 photos → éteint')
ok(aSignal({ depenses: { reste: 600 } }, 'changement', { baseline: { depenses: { reste: 400 } } }), 'changement : +200 vs baseline → allumé')
ok(!aSignal({ depenses: { reste: 610 } }, 'changement', { baseline: { depenses: { reste: 600 } } }), 'changement : +10 (sous le seuil) → éteint')

console.log('\n— Cold start : snapshot vide → aucun signal —')
ok(detecterSignaux({}).length === 0, 'snapshot {} → 0 signal')
ok(detecterSignaux(null).length === 0, 'snapshot null → 0 signal')

console.log('\n— Suggestions data-aware sur un vrai profil (exemple) —')
const snap = { ...snapshotFromStore(exempleStore()), meta: { generatedAt: '2026-07-15T12:00:00Z' } }
const sugg = suggestionsKPI(snap)
ok(sugg.length > 0, `${sugg.length} suggestion(s) émises`)
ok(sugg.every((x) => x.id && x.question && x.raison && x.kpiId && Array.isArray(x.couchesRecommandees)), 'chaque suggestion a id/question/raison/kpiId/couches')
ok(moisDeSnapshot(snap) === '2026-07', 'moisDeSnapshot pur (via meta.generatedAt)')

console.log('\n— Pas de doublon avec le board (dejaEpingles) —')
const premier = sugg[0].kpiId
const sansPremier = suggestionsKPI(snap, { dejaEpingles: [premier] })
ok(!sansPremier.some((x) => x.kpiId === premier), `${premier} déjà épinglé → plus suggéré`)

console.log('\n— Data-aware STRICT : un KPI disponible mais SANS valeur est sauté —')
const snapCoussinVide = { coussin: { montant: 5000, moisCouverts: null, essentielles: 0 }, meta: { generatedAt: '2026-07-15T12:00:00Z' } }
const sc = suggestionsKPI(snapCoussinVide)
const coussinSugg = sc.find((x) => x.domaine === 'coussin')
ok(coussinSugg && coussinSugg.kpiId === 'montant_coussin', 'coussin sans essentielles : mois_couverts (valeur null) sauté → montant_coussin (chiffré)')

console.log('\n— Apprentissage : écartée tue 3 mois, revient si renforcée —')
const idTop = sugg[0].id, scoreTop = sugg[0].scoreSignal // score BRUT (homogène avec la porte de réapparition)
// écartée CE mois → exclue (< 3 mois)
const ecarteeRecente = suggestionsKPI(snap, { ecartees: { [idTop]: { mois: '2026-07', score: scoreTop } } })
ok(!ecarteeRecente.some((x) => x.id === idTop), 'écartée ce mois-ci → exclue (< 3 mois)')
// écartée il y a 4 mois AVEC un score BAS + signal plus fort aujourd'hui → réapparaît
const ecarteeVieilleFaible = suggestionsKPI(snap, { ecartees: { [idTop]: { mois: '2026-03', score: scoreTop - 100 } } })
ok(ecarteeVieilleFaible.some((x) => x.id === idTop), 'écartée il y a 4 mois + signal renforcé → réapparaît')
// écartée il y a 4 mois AVEC un score ÉGAL/supérieur → reste tue (signal inchangé)
const ecarteeVieilleForte = suggestionsKPI(snap, { ecartees: { [idTop]: { mois: '2026-03', score: scoreTop + 10 } } })
ok(!ecarteeVieilleForte.some((x) => x.id === idTop), 'écartée il y a 4 mois + signal inchangé → reste tue')

console.log('\n— Apprentissage : un domaine gardé remonte (+score) —')
const dom = sugg[0].domaine
if (dom) {
  const base = suggestionsKPI(snap).find((x) => x.domaine === dom)
  const boostee = suggestionsKPI(snap, { gardees: { [dom]: '2026-06' } }).find((x) => x.domaine === dom)
  ok(boostee && base && boostee.score === base.score + 15, `domaine gardé « ${dom} » → +15 au score`)
} else {
  ok(true, '(1re suggestion sans domaine — boost non applicable)')
}

console.log('\n' + (fail === 0 ? '✅ Le moteur de signaux tient — 0 échec (des faits, une suggestion à la fois, apprentissage honnête)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
