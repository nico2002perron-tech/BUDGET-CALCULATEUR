/* ============================================================================
   check-missions.mjs — LES MISSIONS « 2 MIN » (lib/missions.js + la vue),
   prouvées headless. Prouve :
     - les étapes conditionnelles (`si`) suivent les réponses ;
     - appliquerMission écrit le BON modèle (revenus régulier/saisonnier,
       dépenses par catégorie, patrimoine) — et une étape sautée n'écrit RIEN ;
     - BOUT-EN-BOUT : silo vide → mission revenus + dépenses → les familles
       s'allument (DONNEE_DISPO) et des outils deviennent prêts (galerie) ;
     - pureté : le store d'entrée n'est jamais muté ;
     - la vue : une question à la fois, progression, choix joufflus.
   Lance : node scripts/check-missions.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }

try {
  const { MISSIONS, etapesVisibles, appliquerMission } = await vite.ssrLoadModule('/src/lib/missions.js')
  const { revenuMensuel } = await vite.ssrLoadModule('/src/lib/revenus.js')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { DONNEE_DISPO } = await vite.ssrLoadModule('/src/recettes/bibliotheque-kpis.js')
  const { construireGalerie } = await vite.ssrLoadModule('/src/lib/galerie.js')
  const { default: MissionAllumage } = await vite.ssrLoadModule('/src/components/MissionAllumage.jsx')

  console.log('— Les étapes suivent les réponses (`si`) —')
  ok(Object.keys(MISSIONS).join(',') === 'revenus,depenses,placements', '3 missions : revenus, dépenses, placements')
  const sansMode = etapesVisibles('revenus', {})
  ok(!sansMode.some((e) => e.id === 'montantParPaie') && !sansMode.some((e) => e.id === 'annuel'), 'avant le mode : ni « par paie » ni « annuel »')
  ok(etapesVisibles('revenus', { mode: 'biweekly' }).some((e) => e.id === 'montantParPaie'), 'mode régulier → « par paie » apparaît')
  ok(etapesVisibles('revenus', { mode: 'saisonnier' }).some((e) => e.id === 'annuel'), 'mode saisonnier → « annuel » apparaît')
  ok(!etapesVisibles('placements', {}).some((e) => e.id === 'hypotheque'), 'pas de maison → pas de question hypothèque')

  console.log('\n— appliquerMission écrit le bon modèle —')
  const rReg = appliquerMission('revenus', { mode: 'biweekly', montantParPaie: 2000, coussin: 5000, brutAnnuel: 70000 }, {})
  ok(rReg.revenus.mode === 'regulier' && rReg.revenus.freq === 'biweekly' && rReg.revenus.montantParPaie === 2000, 'régulier : mode + freq + par paie')
  ok(revenuMensuel(rReg.revenus) === Math.round((2000 * 26) / 12), `revenuMensuel branche direct (${revenuMensuel(rReg.revenus)} $/mois)`)
  ok(rReg.revenus.coussin === 5000 && rReg.revenus.brutAnnuel === 70000, 'coussin + brut écrits (→ Coussin et Impôts s\'allumeront)')
  const rSai = appliquerMission('revenus', { mode: 'saisonnier', annuel: 42000 }, {})
  ok(rSai.revenus.mode === 'saisonnier' && rSai.revenus.repartition.length === 12, 'saisonnier : répartition sur 12 mois')
  ok(Math.abs(rSai.revenus.repartition.reduce((a, b) => a + b, 0) - 42000) < 1, 'la répartition somme à l\'annuel (au dollar près)')
  const rSaute = appliquerMission('revenus', { mode: 'biweekly', montantParPaie: 2000 }, {})
  ok(!('coussin' in rSaute.revenus) && !('brutAnnuel' in rSaute.revenus), 'étapes sautées → RIEN d\'écrit (jamais de zéro inventé)')

  const dep = appliquerMission('depenses', { cat_logement: 1100, cat_alimentation: 600 }, {})
  ok(dep.depenses.find((d) => d.id === 'cat_logement').montant === 1100, 'logement écrit dans SA catégorie')
  ok(dep.depenses.find((d) => d.id === 'cat_transport').montant === null, 'transport sauté → montant reste null')
  const pat = appliquerMission('placements', { age: 34, reer: 20000 }, {})
  ok(pat.patrimoine.age === 34 && pat.patrimoine.reer === 20000 && pat.patrimoine.retraite === 65, 'patrimoine : âge + REER + défauts sûrs')

  console.log('\n— BOUT-EN-BOUT : les missions allument les familles —')
  let store = {}
  store = appliquerMission('revenus', { mode: 'biweekly', montantParPaie: 2000, coussin: 5000 }, store)
  store = appliquerMission('depenses', { cat_logement: 1100, cat_alimentation: 600 }, store)
  const snap = snapshotFromStore(store)
  ok(DONNEE_DISPO.capacite(snap) && DONNEE_DISPO.depenses(snap) && DONNEE_DISPO.coussin(snap), 'revenus + dépenses + coussin ALLUMÉS')
  const prets = construireGalerie(snap).totaux.prets
  ok(prets >= 10, `${prets} outils prêts après 2 missions de 2 min (avant : 0)`)

  console.log('\n— Pureté : le store d\'entrée n\'est jamais muté —')
  const avant = { revenus: { mode: 'regulier' }, depenses: [] }
  const gele = JSON.stringify(avant)
  appliquerMission('revenus', { mode: 'weekly', montantParPaie: 800 }, avant)
  appliquerMission('depenses', { cat_logement: 900 }, avant)
  ok(JSON.stringify(avant) === gele, 'aucune mutation de l\'entrée')

  console.log('\n— La vue : une question à la fois —')
  const norm = (raw) => raw.replace(/<!--.*?-->/g, '')
  const html = norm(renderToString(React.createElement(MissionAllumage, { famille: 'revenus', onFini: () => {}, onAnnuler: () => {} })))
  ok(html.includes('Comment tu es payé'), 'la 1re question s\'affiche')
  ok((html.match(/mis-choix"/g) || []).length === 5, '5 choix joufflus (et rien d\'autre à l\'écran)')
  ok(html.includes('mis-prog-fill'), 'la barre de progression est là')
  ok(html.includes('1/'), 'le compte d\'étapes (1/N)')
  const html2 = norm(renderToString(React.createElement(MissionAllumage, { famille: 'depenses', onFini: () => {}, onAnnuler: () => {} })))
  ok(html2.includes('Ton logement par mois') && html2.includes('mis-input'), 'mission dépenses : montant + steppers')
  ok(html2.includes('mis-pas'), 'les steppers ± sont là')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Les missions tiennent — 0 échec (2 min, et la famille s\'allume pour vrai)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
