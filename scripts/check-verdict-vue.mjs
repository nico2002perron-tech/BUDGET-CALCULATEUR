/* ============================================================================
   check-verdict-vue.mjs — LE HÉROS cockpit (VerdictDuJour), rendu HEADLESS via
   Vite SSR. Prouve, sans navigateur :
     - la vue habite la bande (.band, la seule zone navy→cyan) + tag + date ;
     - les segments forts deviennent des <b> (déficit → <b class="neg">) ;
     - le rythme : piste, portion écoulée, marqueurs (passés éteints), curseur ;
     - data-aware : verdict null / vide → la vue ne rend RIEN ;
     - aucun null/NaN/undefined rendu.
   Lance : node scripts/check-verdict-vue.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
// On enlève les commentaires SSR et on normalise les espaces insécables (fines) de formatCAD.
const norm = (raw) => raw.replace(/<!--.*?-->/g, '').replace(/[   ]/g, ' ')

try {
  const { default: VerdictDuJour } = await vite.ssrLoadModule('/src/components/VerdictDuJour.jsx')
  const { construireVerdict } = await vite.ssrLoadModule('/src/lib/verdict.js')

  const PLAN = {
    depenses: { revenu: 4000, coutVie: 2755, epargne: 200, total: 2955, reste: 1045 },
    calendrier: {
      revenus: { mode: 'regulier', freq: 'biweekly' },
      depenses: [
        { id: 'log', jour: 1, label: 'Logement', montant: 1100, classe: 'besoin', type: 'fixe' },
        { id: 'abo', jour: 15, label: 'Abonnements', montant: 55, classe: 'envie', type: 'fixe' },
        { id: 'ass', jour: 21, label: 'Assurances', montant: 140, classe: 'besoin', type: 'fixe' },
      ],
    },
  }
  const MTN = { maintenant: '2026-07-16T12:00:00' }
  const verdict = construireVerdict(PLAN, MTN)
  const html = norm(renderToString(React.createElement(VerdictDuJour, { verdict })))

  console.log('— Le héros habite la bande (la seule zone navy→cyan) —')
  ok(html.includes('class="band verdict"'), 'section .band.verdict')
  ok(html.includes('Le verdict du jour'), 'tag « Le verdict du jour »')
  ok(html.includes('juillet'), 'la date du jour est affichée')
  ok(html.includes('band-verdict'), 'la phrase vit dans .band-verdict')

  console.log('\n— Les montants en évidence (segments forts → <b>) —')
  ok((html.match(/<b[ >]/g) || []).length === 3, '3 <b> pour les 3 montants')
  ok(html.includes('2 955 $') && html.includes('4 000 $') && html.includes('1 045 $'), 'les montants sont rendus')
  ok(!html.includes('class="neg"'), 'reste positif → aucun <b class="neg">')

  const vd = construireVerdict({ depenses: { revenu: 2500, coutVie: 2755, epargne: 200, total: 2955, reste: -455 } }, MTN)
  const htmlNeg = norm(renderToString(React.createElement(VerdictDuJour, { verdict: vd })))
  ok(htmlNeg.includes('class="neg"'), 'déficit → le montant porte <b class="neg"> (ambre réservé à l\'exception)')

  console.log('\n— Le rythme du mois —')
  ok(html.includes('vr-piste') && html.includes('vr-ecoule'), 'piste + portion écoulée')
  ok((html.match(/vr-pt/g) || []).length === 3, '3 marqueurs de sortie')
  ok((html.match(/is-passe/g) || []).length === 2, 'les 2 sorties passées (1er, 15) sont éteintes')
  ok(html.includes('vr-auj'), 'curseur « aujourd\'hui » présent')
  ok(html.includes('Jour 16 sur 31'), 'aria-label factuel de la piste')
  ok(html.includes('140 $ de sorties datées à venir'), 'l\'en-tête chiffre ce qui reste à sortir')
  ok(html.includes(`width:${verdict.rythme.sortiPct}%`), 'le remplissage encode l\'ARGENT sorti (sortiPct), pas le temps — le curseur porte le temps')
  const sansRythme = construireVerdict({ depenses: PLAN.depenses }, MTN)
  ok(!norm(renderToString(React.createElement(VerdictDuJour, { verdict: sansRythme }))).includes('vr-piste'), 'pas de sorties datées → pas de barre')

  console.log('\n— Data-aware : rien → rien —')
  ok(renderToString(React.createElement(VerdictDuJour, { verdict: null })) === '', 'verdict null → la vue ne rend rien')
  ok(renderToString(React.createElement(VerdictDuJour, { verdict: { phrase: [] } })) === '', 'phrase vide → rien (jamais de bande muette)')

  console.log('\n— Aucune valeur cassée —')
  ok(!html.includes('null') && !html.includes('NaN') && !html.includes('undefined'), 'aucun null/NaN/undefined rendu')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Le héros « verdict du jour » tient — 0 échec (la bande dit des faits, en évidence)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
