/* ============================================================================
   check-intentions.mjs — ÉTAPE 1 « Ta question » (P4), sans navigateur. Prouve :
     - chaque intention (hors libre) mène à des KPI RÉSOLUBLES de ses domaines ;
     - « une question libre » → [] (elle rejoint la barre IA) ;
     - data-aware : snapshot vide → [] partout (jamais un indicateur vide).
   Lance : node scripts/check-intentions.mjs
   ========================================================================== */
import { INTENTIONS, kpisPourIntention } from '../src/recettes/intentions.js'
import { resolveKPI } from '../src/recettes/bibliotheque-kpis.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'

let fail = 0
const ok = (c, l) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) fail++ }
const snap = snapshotFromStore(exempleStore())

console.log('— Les 6 intentions —')
ok(INTENTIONS.length === 6 && INTENTIONS.some((i) => i.libre), '6 intentions dont « une question libre »')

console.log('\n— Une intention mène à des KPI RÉSOLUBLES (data-aware) —')
const reste = kpisPourIntention('reste', snap)
ok(reste.length > 0, `« Ce qu'il me reste » → ${reste.length} indicateur(s)`)
ok(reste.every((k) => k.kpiId && k.question), 'chacun a kpiId + question')
ok(reste.every((k) => { const r = resolveKPI(k.kpiId, snap); return r && r.disponible && r.valeur != null }), 'chacun RÉSOUT avec une vraie valeur (jamais vide)')
ok(kpisPourIntention('argent', snap).length > 0, '« Où va mon argent » → des indicateurs budget')

console.log('\n— « Une question libre » → [] (barre IA) —')
ok(kpisPourIntention('libre', snap).length === 0, 'libre → [] (pas de domaine)')
ok(kpisPourIntention('inconnue', snap).length === 0, 'intention inconnue → []')

console.log('\n— Cold start : snapshot vide → [] partout —')
ok(INTENTIONS.filter((i) => !i.libre).every((i) => kpisPourIntention(i.id, {}).length === 0), 'snapshot {} → aucune intention ne propose (jamais un indicateur vide)')

console.log('\n— « Un projet » ne fabrique JAMAIS une cible (revue nuage P4 — défaut bloquant) —')
ok(kpisPourIntention('projet', snap).length === 0, '« Un projet » sans objectif réel → [] (jamais le repli 10 000 $ présenté comme « ta cible »)')
const hNul = resolveKPI('horizon_objectif', snap, {})
ok(hNul && hNul.valeur == null, 'horizon_objectif sans ctx.objectif → valeur null (muet)')
const dNul = resolveKPI('date_atteinte_projetee', snap, {})
ok(dNul && dNul.valeur == null, 'date_atteinte_projetee sans ctx.objectif → valeur null (muet)')
const hReel = resolveKPI('horizon_objectif', snap, { objectif: { id: 'x', nom: 'Projet', cible: 20000 } })
ok(hReel && hReel.valeur != null, 'horizon_objectif AVEC une vraie cible → résout (composer héros / vue-objectif préservés)')

console.log('\n' + (fail === 0 ? '✅ Ta question tient — 0 échec (une intention → des KPI réels, jamais vides)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
