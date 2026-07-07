/* ============================================================================
   check-carre-de-sable.mjs — les CONTRATS PURS du carré de sable + du board.
   Headless (node), zéro navigateur : formes offertes data-aware, résolution
   des séries de comparaison (jamais inventées), forme adaptée à la taille de
   tuile (présentation pure), taille dérivée d'une recette, personnalités
   conformes (filtrerFait), cohérence cible du KPI mois_sous_seuil.
   Le parcours interactif (FLIP, épinglage, drag) vit dans les e2e navigateur.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { DEMO_SAISONNIER } from '../src/lib/storage.js'
import { BLOCS, resoudreComparaisons, tailleWidget, filtrerFait, estConnu } from '../src/recettes/schema.js'
import { formesPourKPI, formeAdaptee, resolveKPI } from '../src/recettes/bibliotheque-kpis.js'
import { MASCOTTES, MASCOTTE_REPLI, VOIX_MENTOR } from '../src/lib/personas.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(DEMO_SAISONNIER)

console.log('— Les formes du sable : offertes DATA-AWARE, connues du registre —')
const formesSaison = formesPourKPI('amplitude_revenus', snap, {})
ok(['prisme3d', 'bandes', 'courbe', 'nuage'].every((f) => formesSaison.includes(f)), 'KPI saisonnier : les 4 formes-séries offertes', formesSaison.join(','))
const formesCoussin = formesPourKPI('mois_couverts', snap, {})
ok(['prisme3d', 'bandes', 'courbe', 'nuage'].every((f) => !formesCoussin.includes(f)), 'KPI coussin : aucune forme-série (pas de sens)', formesCoussin.join(','))
ok(['prisme3d', 'bandes', 'courbe', 'nuage'].every((t) => estConnu(t)), 'les 4 types du sable connus de schema (le rendu réel = check-render)')

console.log('\n— Les séries de comparaison : résolues du snapshot, JAMAIS inventées —')
const serie = BLOCS.prisme3d.resolve(snap, { comparaisons: [{ contexte: 'moyenne' }, { contexte: 'cout_vie' }, { contexte: 'an_passe' }] })
ok(Array.isArray(serie.serie) && serie.serie.length === 12 && serie.serie[6] === 7200, 'la série = les 12 mois du snapshot (juillet 7 200 $)')
ok(serie.seuil === 3400, 'le seuil = le coût de vie du snapshot (3 400 $)')
ok(serie.comparaisons.length === 2, 'an_passe SANS historique → écartée (2 séries sur 3)', `${serie.comparaisons.length}`)
const moy = serie.comparaisons.find((c) => c.contexte === 'moyenne')
const vraieMoy = Math.round(snap.saison.revenusMensuels.reduce((a, x) => a + x, 0) / 12)
ok(moy && moy.valeurs.every((v) => v === vraieMoy), `« ta moyenne » = la vraie moyenne, plate (${vraieMoy} $)`)
ok(resoudreComparaisons(snap, [{ contexte: '__proto__' }, { contexte: 'valueOf' }]).length === 0, 'contextes-pièges (__proto__, valueOf) → écartés sans exception')
const labelJuge = resoudreComparaisons(snap, [{ contexte: 'moyenne', label: 'tu devrais faire mieux' }])
ok(labelJuge[0] && labelJuge[0].label === 'ta moyenne', 'label jugeant de recette → remplacé par le label du résolveur')

console.log('\n— La forme suit la taille de tuile (présentation PURE) —')
ok(formeAdaptee('amplitude_revenus', 'flux_annuel', 's', snap, {}) === 'stat', 'tuile S : la forme large devient un chiffre compact')
ok(formeAdaptee('amplitude_revenus', 'stat', 'l', snap, {}) === 'flux_annuel', 'tuile L : le chiffre devient la 1re forme large')
ok(formeAdaptee('amplitude_revenus', 'prisme3d', 'm', snap, {}) === 'prisme3d', 'tuile M : la forme choisie reste telle quelle')
ok(formeAdaptee('mois_sous_seuil', 'flux_annuel', 's', snap, {}) === 'fait', 'S sans « stat » offert → le constat (fait) prend le relais')
const avant = { KPI: 'amplitude_revenus', forme: 'stat', params: {} }
formeAdaptee('amplitude_revenus', avant.forme, 'l', snap, avant.params)
ok(avant.forme === 'stat', 'la recette n’est JAMAIS mutée par l’adaptation')

console.log('\n— La taille d’une tuile : persistée, sinon dérivée de sa recette —')
const wStat = { recette: { blocs: [{ KPI: 'revenu_lisse', forme: 'stat', params: {} }] } }
const wJauge = { recette: { blocs: [{ KPI: 'mois_couverts', forme: 'jauge', params: {} }] } }
const wFlux = { recette: { blocs: [{ KPI: 'amplitude_revenus', forme: 'flux_annuel', params: {} }] } }
const wVue = { recette: { blocs: [{ type: 'repartition', params: {} }, { type: 'solde', params: {} }] } }
ok(tailleWidget(wStat) === 's' && tailleWidget(wJauge) === 'm' && tailleWidget(wFlux) === 'l' && tailleWidget(wVue) === 'xl', 'dérivations : stat→s, jauge→m, flux→l, vue complète→xl')
ok(tailleWidget({ ...wStat, taille: 'l' }) === 'l', 'une taille choisie par l’usager PRIME sur la dérivation')
ok(tailleWidget({ ...wStat, taille: 'geante' }) === 's', 'taille invalide (import) → retombe sur la dérivation')

console.log('\n— Les personnalités : identités curées, tout passe filtrerFait —')
const noms = [...Object.values(MASCOTTES), MASCOTTE_REPLI, ...VOIX_MENTOR.map((v) => v.nom)]
ok(noms.every((n) => filtrerFait(n).ok), 'tous les noms (mascottes + voix) passent le filtre de conformité')
const faitKpi = resolveKPI('mois_couverts', snap, {}).texteFactuel
ok(filtrerFait(`${MASCOTTES.coussin} · ${faitKpi}`).ok, 'la bande assemblée (nom + fait du KPI) reste un fait')
ok(VOIX_MENTOR.length === 3 && new Set(VOIX_MENTOR.map((v) => v.id)).size === 3, '3 voix mentor distinctes')

console.log('\n— L’objectif du KPI « mois dans le rouge » : le compte SUIT la cible —')
const sansCible = resolveKPI('mois_sous_seuil', snap, {})
const avecCible = resolveKPI('mois_sous_seuil', snap, { cible: 8000 })
ok(sansCible.valeur === snap.saison.revenusMensuels.filter((v) => v < 3400).length, 'sans cible : compté contre le coût de vie')
ok(avecCible.valeur === snap.saison.revenusMensuels.filter((v) => v < 8000).length, 'cible posée : compté contre TA cible (visuel = texte)')
ok(/plancher visé/.test(avecCible.texteFactuel) && filtrerFait(avecCible.texteFactuel).ok, 'le texte suit la même lecture, filtré')

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Le carré de sable + le board tiennent — 0 échec (contrats purs)')
