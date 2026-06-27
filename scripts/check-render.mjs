/* ============================================================================
   check-render.mjs — vérification de rendu HEADLESS via Vite SSR.
   Rend réellement MoteurRendu (JSX exécuté) avec la recette de démo et prouve :
     - le bloc flux_annuel produit du SVG (barres, ligne de dépenses) ;
     - le bloc de type inconnu est ignoré (aucun crash) ;
     - les chiffres viennent du snapshot (dépenses 3 400 $) ;
     - le bloc chaine (couche de compréhension) relie ses nœuds.
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

// SSR insère des marqueurs d'hydratation <!-- --> ; toLocaleString('fr-CA') utilise des
// espaces insécables (U+00A0 / U+202F). On les normalise en espace simple pour tester.
const normaliser = (raw) => raw.replace(/<!--.*?-->/g, '').replace(/[  ]/g, ' ')

try {
  const { default: MoteurRendu } = await vite.ssrLoadModule('/src/recettes/MoteurRendu.jsx')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { DEMO_SAISONNIER, exempleStore } = await vite.ssrLoadModule('/src/lib/storage.js')

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

  const html = normaliser(renderToString(React.createElement(MoteurRendu, { recette, snapshot })))

  ok(html.includes('<svg'), 'le flux_annuel rend un SVG')
  ok(html.includes('Ton année en un coup'), 'titre du bloc présent')
  ok(html.includes('dépenses 3 400 $/mois'), 'ligne de dépenses tirée du snapshot (3 400 $/mois)')
  ok((html.match(/<rect/g) || []).length >= 12, 'au moins 12 barres de revenus rendues')
  ok(html.includes('fill="url(#faBarCyanA)"'), 'barres en cyan (dégradé faBarCyanA — refonte Figma)')
  ok(html.includes('#f6e7c9'), 'mois déficitaires en ambre (#f6e7c9)')
  ok(html.includes('Ton coussin') && html.includes('2,5 mois'), 'bloc jauge rendu (2,5 mois couverts)')
  // Anti-redondance : jauge ET stat montrent le MÊME chiffre (coussin) → un seul rendu.
  ok(!html.includes('dans ton coussin cette saison'), 'anti-redondance : coussin pas répété (stat dédoublonné, jauge gardée)')
  ok(html.includes('puisent') && html.includes('15 000 $'), 'bloc fait CALCULÉ du snapshot (≈ 15 000 $)')
  ok(!html.includes('bloc_inexistant'), 'le bloc de type inconnu n’apparaît pas (ignoré proprement)')

  // Le bloc stat fonctionne EN ISOLATION (sans jauge → rien à dédoublonner).
  const htmlStat = renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'stat', params: {} }] }, snapshot }))
  ok(htmlStat.includes('dans ton coussin cette saison'), 'bloc stat rendu (en isolation)')

  // Vue mensuelle : le MÊME bloc réduit via un paramètre.
  const recetteMensuel = { blocs: [{ type: 'flux_annuel', params: { vue: 'mensuel' } }] }
  const htmlM = renderToString(React.createElement(MoteurRendu, { recette: recetteMensuel, snapshot }))
  ok(htmlM.includes('Ton solde mois par mois'), 'param vue:mensuel → le bloc se réduit en vue mensuelle')

  // Bloc chaîne (couche de compréhension) : profil avec dépenses saisies → chaîne ACTIVE.
  // exempleStore : revenu net ≈ 3 533 $/mois, coût de vie ≈ 2 755 $, coussin 8 400 $.
  const snapEx = snapshotFromStore(exempleStore())
  const htmlC = normaliser(renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'chaine', params: { objectif: { nom: 'Mise de fonds', cible: 20000 } } }] }, snapshot: snapEx })))
  ok(htmlC.includes('Revenu net') && htmlC.includes('Flux disponible'), 'chaine : les maillons revenuNet + fluxDisponible rendus')
  ok(htmlC.includes('Mise de fonds'), 'chaine : l’objectif (nom) vient des params de la recette → rendu sur le maillon objectif')
  ok(htmlC.includes('3 533 $'), 'chaine : revenu net tiré du snapshot (≈ 3 533 $/mois)')

  // Sans dépenses ni revenu net (profil saison-only) → chaîne INACTIVE (état honnête, aucun zéro inventé).
  const htmlCVide = renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'chaine', params: {} }] }, snapshot }))
  ok(htmlCVide.includes('Ajoute ton revenu net'), 'chaine : sans revenu net → état vide honnête (pas de chiffres inventés)')

  // ── ÉTAGE 1 : blocs manquants (barre_progression, chronologie, liste).
  const htmlBP = normaliser(renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'barre_progression', params: { cible: 20000, etiquetteGauche: 'Déjà', etiquetteDroite: 'Maison' } }] }, snapshot: snapEx })))
  ok(htmlBP.includes('Ta progression') && htmlBP.includes('42'), 'barre_progression : coussin 8 400 $ / cible 20 000 $ → 42 % (valeur du snapshot, cible de la recette)')
  ok(htmlBP.includes('Maison'), 'barre_progression : param LIBRE conservé (étiquette de cible passée par la recette)')

  const htmlChrVide = renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'chronologie', params: { label: 'Saison morte' } }] }, snapshot: snapEx }))
  ok(htmlChrVide.includes('Pas de date fixée'), 'chronologie sans date → état honnête (jamais de date inventée)')
  const htmlChr = normaliser(renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'chronologie', params: { label: 'Objectif', dateCible: '2099-01-01' } }] }, snapshot: snapEx })))
  ok(htmlChr.includes('restants') && /\d/.test(htmlChr), 'chronologie avec date → compte à rebours rendu')

  const htmlListe = normaliser(renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'liste', params: { titre: 'Où va l’argent' } }] }, snapshot: snapEx })))
  ok(htmlListe.includes('Logement'), 'liste : catégories de dépenses tirées du snapshot (jamais inventées)')

  // ── ÉTAGE D : la TUILE carte_entite (rend depuis snapshot.entites par id).
  const entite = { id: 'e1', kind: 'goal', nom: 'Voyage au Japon', icon: 'plane', photo: null, couleurAccent: 'lavande', cible: 6000, dejaEpargne: 2000, contributionMensuelle: 750, horizonMois: 6, echeanceVisee: 'moyen', scenarioLabel: 'En orientant 750 $/mois, tu y arrives en 6 mois.' }
  const snapEnt = snapshotFromStore({ entites: [entite] })
  const htmlCE = normaliser(renderToString(React.createElement(MoteurRendu, { recette: { blocs: [{ type: 'carte_entite', params: { id: 'e1' } }] }, snapshot: snapEnt })))
  ok(htmlCE.includes('Voyage au Japon'), 'carte_entite : nom de l’entité rendu')
  ok(htmlCE.includes('33') && htmlCE.includes('%'), 'carte_entite : progression 2 000 / 6 000 = 33 %')
  ok(htmlCE.includes('tu y arrives en 6 mois'), 'carte_entite : scénario choisi rendu (voix verrouillée)')
  ok(!htmlCE.includes('undefined') && !htmlCE.includes('NaN'), 'carte_entite : photo absente → état propre (aucun undefined/NaN)')
} catch (e) {
  fail++
  console.log('  ✗ exception au rendu :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Rendu vérifié (headless) — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
