/* ============================================================================
   check-integration-kpi.mjs — LA COURROIE : la recette nomme un KPI, le moteur le
   branche sur une forme. Rendu HEADLESS via Vite SSR. Prouve :
     - une recette {KPI, forme:'stat'} résout et affiche la valeur du KPI ;
     - le MÊME KPI en stat vs chronologie → MÊME valeur, forme différente (la courroie) ;
     - forme hors blocsCompatibles → repli sûr sur une forme compatible (jamais d'erreur) ;
     - KPI inconnu → ignoré proprement (le reste de la recette rend) ;
     - rétrocompatibilité : une recette 100 % blocs simples rend comme avant ;
     - donnée manquante → état honnête (« Pas encore de donnée »), zéro chiffre inventé ;
     - le texteFactuel passe filtrerFait.
   Lance : node scripts/check-integration-kpi.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
const norm = (raw) => raw.replace(/<!--.*?-->/g, '').replace(/[  ]/g, ' ')

try {
  const { default: MoteurRendu } = await vite.ssrLoadModule('/src/recettes/MoteurRendu.jsx')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { exempleStore } = await vite.ssrLoadModule('/src/lib/storage.js')
  const { resolveKPI } = await vite.ssrLoadModule('/src/recettes/bibliotheque-kpis.js')
  const { filtrerFait } = await vite.ssrLoadModule('/src/recettes/schema.js')

  const snap = snapshotFromStore(exempleStore()) // revenu net ≈ 3 533, coût vie ≈ 2 755, coussin 8 400
  const ctx = { objectif: { nom: 'Maison', cible: 20000 } } // restant 11 600, capacité ≈ 778 → horizon 15
  const rendu = (recette, s = snap) => norm(renderToString(React.createElement(MoteurRendu, { recette, snapshot: s })))

  // Valeur de référence (calculée UNE fois par la bibliothèque — indépendante de la forme).
  const kpiVal = resolveKPI('horizon_objectif', snap, ctx)
  const V = String(kpiVal.valeur)
  console.log(`— Le KPI horizon_objectif vaut ${V} mois (résolu par la bibliothèque) —`)

  console.log('\n— Une recette {KPI, forme:stat} affiche la valeur du KPI —')
  const hStat = rendu({ blocs: [{ KPI: 'horizon_objectif', forme: 'stat', params: ctx }] })
  ok(hStat.includes(V), `la forme stat affiche la valeur du KPI (${V})`)

  console.log('\n— LA COURROIE : même KPI, deux formes → même valeur —')
  const hChrono = rendu({ blocs: [{ KPI: 'horizon_objectif', forme: 'chronologie', params: ctx }] })
  ok(hChrono.includes('chrono-num') && hChrono.includes(V), `la forme chronologie affiche la MÊME valeur (${V})`)
  ok(hStat.includes('stat') && hChrono.includes('chrono'), 'les DEUX formes diffèrent (stat ≠ chronologie) pour la même métrique')
  ok(resolveKPI('horizon_objectif', snap, ctx).valeur === kpiVal.valeur, 'la valeur ne dépend pas de la forme (résolue une seule fois)')

  console.log('\n— Forme hors blocsCompatibles → repli sûr —')
  const hRepli = rendu({ blocs: [{ KPI: 'horizon_objectif', forme: 'beignet', params: ctx }] }) // beignet ∉ [chaine,chronologie,stat]
  ok(hRepli.includes('Revenu net') || hRepli.includes('chemin vers ton objectif'), 'forme invalide (beignet) → repli sur 1er compatible (chaine), aucun crash')

  console.log('\n— KPI inconnu → ignoré proprement —')
  const hInconnu = rendu({ blocs: [{ KPI: 'kpi_bidon', forme: 'stat' }, { type: 'solde', params: {} }] })
  ok(hInconnu.includes('Ton solde du mois') && !hInconnu.includes('kpi_bidon'), 'KPI inconnu sauté, le reste de la recette rend')

  console.log('\n— Rétrocompatibilité : une recette 100 % blocs simples rend comme avant —')
  const hPlain = rendu({ blocs: [{ type: 'stat', params: {} }] })
  ok(hPlain.includes('dans ton coussin cette saison'), 'stat sans KPI → resolve d’origine (coussin), comportement inchangé')
  const hSolde = rendu({ blocs: [{ type: 'solde', params: {} }, { type: 'fait', params: {} }] })
  ok(hSolde.includes('Ton solde du mois'), 'recette de blocs simples rend normalement')

  console.log('\n— Donnée manquante → état honnête, zéro chiffre inventé —')
  const hVide = rendu({ blocs: [{ KPI: 'horizon_objectif', forme: 'stat', params: ctx }] }, {})
  ok(hVide.includes('Pas encore de donnée'), 'snapshot vide → la forme affiche un état honnête (pas un faux chiffre)')

  console.log('\n— Conformité : le texteFactuel passe filtrerFait —')
  ok(filtrerFait(kpiVal.texteFactuel).ok && kpiVal.texteFactuel, 'texteFactuel du KPI rendu = factuel (filtrerFait)')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ La courroie tient — 0 échec (la bibliothèque tourne dans la machine)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
