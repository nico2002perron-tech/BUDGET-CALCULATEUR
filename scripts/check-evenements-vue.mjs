/* ============================================================================
   check-evenements-vue.mjs — 1re VUE sur le primitif (EvenementsSaillants), rendue
   HEADLESS via Vite SSR. Prouve, sans navigateur :
     - la vue rend les événements produits par le primitif (titre + conséquence) ;
     - couleur = sens : exception → evt--exception (ambre), attention → cyan, info → neutre ;
     - les conséquences chiffrées (deltaFlux/deltaHorizon) apparaissent en puces ;
     - data-aware : aucun événement → la vue ne rend RIEN (pas de boîte vide).
   Lance : node scripts/check-evenements-vue.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
const norm = (raw) => raw.replace(/<!--.*?-->/g, '').replace(/[  ]/g, ' ')

try {
  const { default: EvenementsSaillants } = await vite.ssrLoadModule('/src/components/EvenementsSaillants.jsx')
  const { genererEvenements } = await vite.ssrLoadModule('/src/lib/evenements.js')
  const MTN = { maintenant: '2026-01-01' }
  const base = { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 5000, moisCouverts: 2.5, essentielles: 2000 } }

  // Trois événements réels, un par sévérité.
  const exception = genererEvenements({ depenses: { revenu: 2000, coutVie: 2755 }, coussin: { montant: 5000 } }, { depenses: { revenu: 4000, coutVie: 2755 }, coussin: { montant: 5000 } }, MTN).find((e) => e.severite === 'exception')
  const attention = genererEvenements({ ...base, dettes: [{ id: 'auto', label: 'prêt auto', paiementMensuel: 300, finLe: '2026-01-10' }] }, null, MTN).find((e) => e.type === 'echeance')
  const info = genererEvenements({ ...base, coussin: { montant: 6500, moisCouverts: 3.2, essentielles: 2000 } }, { ...base, coussin: { montant: 4000, moisCouverts: 2.0, essentielles: 2000 } }, MTN).find((e) => e.type === 'seuil_franchi')
  const events = [exception, attention, info].filter(Boolean)
  ok(events.length === 3, `3 événements réels construits (un par sévérité) — ${events.map((e) => e.severite).join(', ')}`)

  const html = norm(renderToString(React.createElement(EvenementsSaillants, { events })))

  console.log('— La vue rend les événements (titre + conséquence) —')
  ok(html.includes('Ce qui bouge'), 'en-tête « Ce qui bouge » présent')
  ok(events.every((e) => html.includes(e.titre)), 'chaque titre rendu')
  ok(html.includes(exception.consequence.texte), 'la conséquence (texte) est rendue')

  console.log('\n— Couleur = sens (VISION §12) —')
  ok(html.includes('evt--exception'), 'flux négatif → classe evt--exception (ambre)')
  ok(html.includes('evt--attention'), 'échéance imminente → classe evt--attention (cyan)')
  ok(html.includes('evt--info'), 'palier franchi → classe evt--info (neutre)')

  console.log('\n— Conséquences chiffrées (impact propagé) en puces —')
  ok(html.includes('300') && html.includes('/mois'), 'puce deltaFlux (+300 $/mois) rendue')
  ok(/[−-]\s?1 mois/.test(html), 'puce deltaHorizon (−1 mois) rendue')
  ok(!html.includes('null') && !html.includes('NaN') && !html.includes('undefined'), 'aucun null/NaN/undefined')

  console.log('\n— « Depuis ta dernière visite » : sous-titre quand un changement est DÉTECTÉ —')
  const avecDepuis = norm(renderToString(React.createElement(EvenementsSaillants, { events, depuis: '2026-01-01T12:00:00.000Z' })))
  ok(avecDepuis.includes('Depuis ta dernière visite'), 'changement détecté + horodatage connu → sous-titre rendu')
  const echeanceSeule = norm(renderToString(React.createElement(EvenementsSaillants, { events: [attention], depuis: '2026-01-01T12:00:00.000Z' })))
  ok(!echeanceSeule.includes('Depuis ta dernière visite'), 'échéance à venir seule (pas « depuis ») → aucun sous-titre')
  const sansDepuis = norm(renderToString(React.createElement(EvenementsSaillants, { events })))
  ok(!sansDepuis.includes('Depuis ta dernière visite'), 'aucun horodatage (1re visite) → aucun sous-titre')

  console.log('\n— Data-aware : rien à dire → rien à l’écran —')
  ok(renderToString(React.createElement(EvenementsSaillants, { events: [] })) === '', 'liste vide → la vue ne rend rien')
  ok(renderToString(React.createElement(EvenementsSaillants, { events: null })) === '', 'events null → la vue ne rend rien (jamais d’erreur)')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ La vue « Ce qui bouge » tient — 0 échec (la 1re vue repose sur la brique prouvée)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
