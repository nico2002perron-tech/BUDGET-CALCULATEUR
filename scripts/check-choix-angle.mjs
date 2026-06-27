/* ============================================================================
   check-choix-angle.mjs — LE SÉLECTEUR D'ANGLE, deux modèles, sans navigateur :
     A) SLOT (héros mon_budget) : candidatsValides / resoudreSlot (logique d'origine) ;
     B) KPI (vitrine de la bibliothèque) : formesPourKPI / resoudreForme + le composant
        ChoixAngle rendu en SSR.
   Prouve pour le KPI :
     - les formes offertes = blocsCompatibles filtrés par les données (vide → aucune) ;
     - un KPI rendu via ChoixAngle change de FORME sans changer de VALEUR (la courroie) ;
     - forme hors blocsCompatibles → repli sûr ; recommandé PRÉ-SÉLECTIONNÉ ;
     - chaque « pourquoi » passe filtrerFait.
   Lance : node scripts/check-choix-angle.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
const norm = (raw) => raw.replace(/<!--.*?-->/g, '').replace(/[  ]/g, ' ')

try {
  const { candidatsValides, resoudreSlot, validerRecette, filtrerFait, BLOCS } = await vite.ssrLoadModule('/src/recettes/schema.js')
  const { composerRecette, POURQUOI } = await vite.ssrLoadModule('/src/recettes/composer.js')
  const { formesPourKPI, resoudreForme, pourquoiForme, resolveKPI } = await vite.ssrLoadModule('/src/recettes/bibliotheque-kpis.js')
  const { default: ChoixAngle } = await vite.ssrLoadModule('/src/recettes/ChoixAngle.jsx')
  const { default: MoteurRendu } = await vite.ssrLoadModule('/src/recettes/MoteurRendu.jsx')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { exempleStore } = await vite.ssrLoadModule('/src/lib/storage.js')

  /* ============================ A) MODÈLE SLOT (héros) ============================ */
  const SLOT = { slot: 'graphique', recommande: 'beignet', alternatives: ['barre_empilee', 'repartition', 'liste'], choisi: 'beignet', pourquoi: POURQUOI.beignet }
  const snapRiche = { depenses: { parCategorie: [{ id: 'a', label: 'Logement', montant: 1100, classe: 'besoin' }, { id: 'b', label: 'Épicerie', montant: 600, classe: 'besoin' }, { id: 'c', label: 'Transport', montant: 350, classe: 'besoin' }, { id: 'd', label: 'Sorties', montant: 220, classe: 'envie' }, { id: 'e', label: 'Abonnements', montant: 55, classe: 'envie' }], engageLibre: { fixe: 1000, variable: 1755 }, parClasse: { besoin: 2050, envie: 275, epargne: 200 }, total: 2525 } }
  const snapPauvre = { depenses: { parCategorie: [{ id: 'x', label: 'Tout', montant: 100, classe: 'besoin' }], engageLibre: { fixe: 0, variable: 0 }, parClasse: { besoin: 0, envie: 0, epargne: 0 } } }

  console.log('— [SLOT] candidatsValides filtre selon le snapshot (data-aware) —')
  const cR = candidatsValides(SLOT, snapRiche)
  ok(cR.length === 4 && cR[0] === 'beignet', '4 candidats valides (riche), recommande en tête')
  const cP = candidatsValides(SLOT, snapPauvre)
  ok(cP.includes('beignet') && cP.includes('liste') && !cP.includes('barre_empilee') && !cP.includes('repartition'), 'pauvre → seulement beignet + liste')
  ok(candidatsValides(SLOT, {}).length === 0, 'snapshot vide → aucun candidat')

  console.log('\n— [SLOT] résolution + repli sûr + présentation pure —')
  ok(resoudreSlot(SLOT, snapRiche) === 'beignet', 'choisi = beignet → rend beignet')
  ok(resoudreSlot({ ...SLOT, choisi: 'repartition' }, snapRiche) === 'repartition', 'choisi = repartition → rend repartition')
  ok(resoudreSlot({ ...SLOT, choisi: 'inconnu_xyz' }, snapRiche) === 'beignet', 'choisi inconnu → repli sur recommande')
  ok(resoudreSlot({ ...SLOT, choisi: 'barre_empilee' }, snapPauvre) === 'beignet', 'choisi non soutenu → repli sur 1er valide')
  ok(resoudreSlot(SLOT, {}) === null, 'aucun candidat → null (slot ignoré)')
  const avant = JSON.stringify(snapRiche)
  const dA = JSON.stringify(BLOCS.beignet.resolve(snapRiche))
  resoudreSlot({ ...SLOT, choisi: 'liste' }, snapRiche)
  ok(JSON.stringify(snapRiche) === avant && dA === JSON.stringify(BLOCS.beignet.resolve(snapRiche)), 'changer d’angle ne mute ni ne recalcule rien')

  console.log('\n— [SLOT] validerRecette + composer + pourquoi filtrés —')
  const vr = validerRecette({ blocs: [{ slot: 'graphique', recommande: 'beignet', alternatives: ['liste'], pourquoi: 'Tu devrais choisir le beignet.' }] })
  ok(vr.blocs[0].choisi === 'beignet' && vr.blocs[0].pourquoi === '', 'choisi défaut = recommande ; pourquoi jugeant vidé')
  const slotBudget = composerRecette('mon_budget', {}, snapRiche).blocs.find((b) => b.slot === 'graphique')
  ok(slotBudget && slotBudget.choisi === slotBudget.recommande && filtrerFait(slotBudget.pourquoi).ok, 'composer pose un slot ; pourquoi factuel')
  for (const t of Object.keys(POURQUOI)) ok(filtrerFait(POURQUOI[t]).ok, `pourquoi[${t}] factuel`)

  /* ============================ B) MODÈLE KPI (vitrine) ============================ */
  const snap = snapshotFromStore(exempleStore()) // revenu net ≈ 3 533, coussin 8 400
  const ctx = { objectif: { cible: 20000 } }

  console.log('\n— [KPI] formes offertes = blocsCompatibles filtrés par les données —')
  const formes = formesPourKPI('horizon_objectif', snap)
  ok(formes.includes('stat') && formes.includes('chronologie') && formes.includes('chaine'), `horizon_objectif → angles offerts [${formes}]`)
  ok(formesPourKPI('horizon_objectif', {}).length === 0, 'snapshot vide → aucun angle (métrique absente, jamais offerte)')
  ok(formesPourKPI('kpi_bidon', snap).length === 0, 'KPI inconnu → aucun angle')

  console.log('\n— [KPI] LA COURROIE : changer d’ANGLE ne change pas la VALEUR —')
  const V = resolveKPI('horizon_objectif', snap, ctx).valeur
  const rendForme = (forme) => norm(renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ KPI: 'horizon_objectif', forme, params: ctx }] }, snapshot: snap })))
  const hStat = rendForme('stat'), hChrono = rendForme('chronologie'), hChaine = rendForme('chaine')
  ok(hStat.includes(String(V)) && hChrono.includes(String(V)) && hChaine.includes(String(V)), `valeur ${V} identique en stat, chronologie ET chaine`)
  ok(hStat.includes('stat-v') && hChrono.includes('chrono-num') && (hChaine.includes('Revenu net') || hChaine.includes('chemin')), 'trois formes DISTINCTES pour le même fond')
  ok(resolveKPI('horizon_objectif', snap, ctx).valeur === V, 'la valeur ne dépend pas de la forme (résolue une fois)')

  console.log('\n— [KPI] repli sûr —')
  ok(resoudreForme('horizon_objectif', 'beignet', snap) === formes[0], 'forme hors blocsCompatibles → repli sur la 1re offerte')
  ok(resoudreForme('horizon_objectif', 'stat', snap) === 'stat', 'forme valide → conservée')
  ok(resoudreForme('horizon_objectif', 'stat', {}) === null, 'aucune forme offerte → null (jamais de rendu fantôme)')

  console.log('\n— [KPI] ChoixAngle (SSR) : recommandé PRÉ-SÉLECTIONNÉ + pourquoi —')
  const htmlCA = norm(renderToString(React.createElement(ChoixAngle, { kpiId: 'horizon_objectif', snapshot: snap, recommande: 'chaine', formeActuelle: 'chaine', onChoisir() {} })))
  ok(htmlCA.includes('angle-carte angle-sel angle-reco'), 'la carte recommandée (chaine) est PRÉ-SÉLECTIONNÉE (sel + reco)')
  ok(htmlCA.includes('Recommandé') && (htmlCA.match(/Autre angle/g) || []).length >= 2, 'une pastille « Recommandé », les autres « Autre angle »')
  ok(htmlCA.includes(pourquoiForme('chaine')) && filtrerFait(pourquoiForme('chaine')).ok, 'le « pourquoi » du recommandé rendu et factuel')
  // Après échange (formeActuelle = stat) : la sélection suit, le recommandé reste marqué.
  const htmlCA2 = norm(renderToString(React.createElement(ChoixAngle, { kpiId: 'horizon_objectif', snapshot: snap, recommande: 'chaine', formeActuelle: 'stat', onChoisir() {} })))
  ok(htmlCA2.includes('angle-carte angle-sel') && !htmlCA2.includes('angle-carte angle-sel angle-reco'), 'sélection déplacée sur « stat » ; le recommandé reste chaine (non sélectionné)')
  const htmlUn = renderToString(React.createElement(ChoixAngle, { kpiId: 'horizon_objectif', snapshot: snap, recommande: 'stat', formeActuelle: 'stat', formes: ['stat'], onChoisir() {} }))
  ok(htmlUn === '', 'un seul angle → ChoixAngle ne rend RIEN (n’encombre pas l’écran)')
  for (const f of formes) ok(filtrerFait(pourquoiForme(f)).ok && pourquoiForme(f), `pourquoi[${f}] factuel et non vide`)
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Sélecteur d’angle (slot + KPI) — 0 échec : changer d’angle = présentation pure' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
