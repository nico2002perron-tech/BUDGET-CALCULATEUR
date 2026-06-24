/* ============================================================================
   check-render.mjs — vérification de rendu HEADLESS via Vite SSR.
   Rend réellement MoteurRendu (JSX exécuté) avec la recette de démo et prouve :
     - le bloc flux_annuel produit du SVG (barres, ligne de dépenses) ;
     - le bloc de type inconnu est ignoré (aucun crash) ;
     - les chiffres viennent du snapshot (dépenses 3 400 $).
   Lance : node scripts/check-render.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

try {
  const { default: MoteurRendu } = await vite.ssrLoadModule('/src/recettes/MoteurRendu.jsx')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { DEMO_SAISONNIER } = await vite.ssrLoadModule('/src/lib/storage.js')

  const snapshot = snapshotFromStore(DEMO_SAISONNIER)
  const recette = {
    situation: 'revenu_saisonnier',
    titre: "Passer l'hiver",
    blocs: [
      { type: 'flux_annuel', params: { souligner: 'mois_deficitaires' } },
      { type: 'jauge', params: { mesure: 'mois', cible: 5 } },
      { type: 'stat', params: {} },
      { type: 'fait', params: {} },
      { type: 'bloc_inexistant_xyz', params: {} }, // doit être ignoré
    ],
  }

  const raw = renderToString(React.createElement(MoteurRendu, { recette, snapshot }))
  // SSR insère des marqueurs d'hydratation <!-- --> entre texte+expression ;
  // toLocaleString('fr-CA') utilise des espaces insécables. On normalise pour tester.
  const html = raw.replace(/<!--.*?-->/g, '').replace(/[  ]/g, ' ')

  ok(html.includes('<svg'), 'le flux_annuel rend un SVG')
  ok(html.includes('Ton année en un coup'), 'titre du bloc présent')
  ok(html.includes('dépenses 3 400 $/mois'), 'ligne de dépenses tirée du snapshot (3 400 $/mois)')
  ok((html.match(/<rect/g) || []).length >= 12, 'au moins 12 barres de revenus rendues')
  ok(html.includes('fill="#00b4d8"'), 'barres en cyan (#00b4d8)')
  ok(html.includes('#f6e7c9'), 'mois déficitaires en ambre (#f6e7c9)')
  ok(html.includes('Ton coussin') && html.includes('2,5 mois'), 'bloc jauge rendu (2,5 mois couverts)')
  ok(html.includes('dans ton coussin cette saison'), 'bloc stat rendu')
  ok(html.includes('puisent') && html.includes('15 000 $'), 'bloc fait CALCULÉ du snapshot (≈ 15 000 $)')
  ok(!html.includes('bloc_inexistant'), 'le bloc de type inconnu n’apparaît pas (ignoré proprement)')

  // Vue mensuelle : le MÊME bloc réduit via un paramètre.
  const recetteMensuel = { blocs: [{ type: 'flux_annuel', params: { vue: 'mensuel' } }] }
  const htmlM = renderToString(React.createElement(MoteurRendu, { recette: recetteMensuel, snapshot }))
  ok(htmlM.includes('Ton solde mois par mois'), 'param vue:mensuel → le bloc se réduit en vue mensuelle')
} catch (e) {
  fail++
  console.log('  ✗ exception au rendu :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Rendu vérifié (headless) — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
