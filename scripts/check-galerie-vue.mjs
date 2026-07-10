/* ============================================================================
   check-galerie-vue.mjs — LE STUDIO GUIDÉ (Galerie v3 + EssayageForme), rendu
   HEADLESS via Vite SSR. Prouve l'accueil façon Duolingo :
     - une décision à la fois : LA vedette « choisi pour toi » + 5 boutons-familles
       (jamais un mur de cartes) ;
     - chaque famille dit son état : « N outils prêts » ou sa condition d'allumage ;
     - la réassurance est écrite ; la barre « décris-le » est là ;
     - l'essayage : vrai bloc + formes + couleurs + note + feuille mobile ;
     - data-aware : snapshot vide → 5 familles éteintes, pas de fausse vedette.
   Lance : node scripts/check-galerie-vue.mjs
   ========================================================================== */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
const norm = (raw) => raw.replace(/<!--.*?-->/g, '').replace(/[   ]/g, ' ')

try {
  const { default: Galerie, EssayageForme } = await vite.ssrLoadModule('/src/components/Galerie.jsx')
  const { construireGalerie } = await vite.ssrLoadModule('/src/lib/galerie.js')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { exempleStore } = await vite.ssrLoadModule('/src/lib/storage.js')

  const snap = snapshotFromStore(exempleStore())
  const g = construireGalerie(snap)
  const rendre = (props) => norm(renderToString(React.createElement(Galerie, {
    snapshot: snap, widgets: [], chargement: false, erreur: null,
    onDecrire: () => {}, onAjouter: () => {}, onAllerSaisie: () => {}, ...props,
  })))
  const html = rendre({})

  console.log('— L\'accueil : une décision à la fois —')
  ok(html.includes('Qu’est-ce qu’on crée aujourd’hui'), 'le titre friendly')
  ok(html.includes('gal-chat-input'), 'la barre « décris-le »')
  // UNE seule vedette : on compte le badge « Choisi pour toi » (marqueur unique),
  // pas la sous-chaîne de classe (la vedette-live a plusieurs classes gal-vedette-*).
  ok(html.includes('Choisi pour toi') && (html.match(/Choisi pour toi/g) || []).length === 1, 'UNE seule vedette curée (pas trois)')
  // LA VITRINE : la vedette est une VRAIE mini-tuile vivante (aperçu MoteurRendu) + un bouton.
  ok(html.includes('gal-vedette-apercu') && html.includes('gal-vedette-ajouter'), 'la vedette se montre en mini-tuile vivante + bouton « Ajouter »')
  ok((html.match(/gal-famille /g) || []).length + (html.match(/gal-famille"/g) || []).length >= 5, '5 boutons-familles joufflus')
  ok(html.includes('Mon argent du mois') && html.includes('Mon coussin de sécurité') && html.includes('Mon patrimoine'), 'les familles parlent en mots de tous les jours')
  ok(!html.includes('gal-grille'), 'AUCUNE grille-mur à l\'accueil')
  ok(html.includes('rien ne s’ajoute tant que tu ne le décides pas'), 'la permission d\'explorer est écrite')

  console.log('\n— Chaque famille dit son état —')
  const nBudget = g.indicateurs.filter((k) => k.pret && k.domaine === 'budget').length + (g.tableaux.find((t) => t.situation === 'mon_budget')?.pret ? 1 : 0)
  ok(html.includes(`${nBudget} outils prêts`), `Budget annonce « ${nBudget} outils prêts »`)
  ok(html.includes('is-eteinte'), 'la famille sans donnée est éteinte (tirets)')
  ok(html.includes('s’allume avec'), 'l\'éteinte dit sa condition d\'allumage')

  console.log('\n— Snapshot vide : honnête, jamais une fausse vedette —')
  const vide = rendre({ snapshot: {} })
  ok((vide.match(/is-eteinte/g) || []).length >= 5, 'toutes les familles éteintes')
  ok(!vide.includes('Choisi pour toi'), 'pas de données → pas de vedette inventée')

  console.log('\n— L\'essayage (étape 2, feuille du bas comprise) —')
  const kpi = g.indicateurs.find((k) => k.id === 'mois_couverts' && k.pret)
  const essai = norm(renderToString(React.createElement(EssayageForme, { kpi, snapshot: snap, onAjouter: () => {}, onFermer: () => {} })))
  ok(essai.includes('gal-essai-apercu') && essai.includes('card'), 'le VRAI bloc en aperçu')
  ok((essai.match(/gal-forme/g) || []).length >= 2 && (essai.match(/gal-accent/g) || []).length >= 6, 'formes + 6 couleurs')
  ok(essai.includes('Ajouter à ma tour'), 'le gros bouton d\'adoption')
  ok(essai.includes('Tu pourras tout retoucher en tout temps.'), 'la réassurance de réversibilité')
  ok(essai.includes('gal-essai-poignee') && essai.includes('gal-essai-fond'), 'la feuille du bas (poignée + fond) est prête pour mobile')

  console.log('\n— CRÉER SON KPI : cible + icône + nom —')
  ok(essai.includes('gal-cible') && essai.includes('Ta cible'), 'SA CIBLE : le stepper est là (mois_couverts est réglable)')
  ok(essai.includes('>3<') || essai.includes('3<small>'), 'la cible par défaut (3 mois) s\'affiche')
  ok((essai.match(/gal-icone[ "]/g) || []).length >= 14, 'SON ICÔNE : l\'automatique + la douzaine au choix')
  ok(essai.includes('gal-nom') && essai.includes('Nomme ton outil'), 'SON NOM : le champ est là (vide = la question)')
  const sansReglage = g.indicateurs.find((k) => k.id === 'montant_coussin' && k.pret)
  const essai2 = norm(renderToString(React.createElement(EssayageForme, { kpi: sansReglage, snapshot: snap, onAjouter: () => {}, onFermer: () => {} })))
  ok(!essai2.includes('gal-cible'), 'un KPI sans réglage → pas de stepper cible (jamais un faux réglage)')

  console.log('\n— Zéro valeur cassée —')
  ok(!html.includes('NaN') && !html.includes('undefined'), 'aucun NaN/undefined rendu')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Le studio guidé tient — 0 échec (une décision à la fois, jamais un mur)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
