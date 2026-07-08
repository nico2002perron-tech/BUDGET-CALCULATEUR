/* ============================================================================
   check-carre-de-sable.mjs — les CONTRATS PURS du carré de sable + du board.
   Headless (node), zéro navigateur : formes offertes data-aware, résolution
   des séries de comparaison (jamais inventées), forme adaptée à la taille de
   tuile (présentation pure), taille dérivée d'une recette, personnalités
   conformes (filtrerFait), cohérence cible du KPI mois_sous_seuil.
   Le parcours interactif (FLIP, épinglage, drag) vit dans les e2e navigateur.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { DEMO_SAISONNIER, exempleStore } from '../src/lib/storage.js'
import { BLOCS, resoudreComparaisons, tailleWidget, filtrerFait, estConnu } from '../src/recettes/schema.js'
import { formesPourKPI, formeAdaptee, resolveKPI, serieDuKPI, partsDuKPI, FORMES_SERIE, FORMES_PARTS } from '../src/recettes/bibliotheque-kpis.js'
import { normaliserSerie, etiquetteCourte } from '../src/lib/serie.js'
import { MASCOTTES, MASCOTTE_REPLI, VOIX_MENTOR } from '../src/lib/personas.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(DEMO_SAISONNIER)
// L'exemple complet (patrimoine, coussin+épargne, catégories) + un brut saisi :
// le terrain de jeu du déblocage générique. DEMO_SAISONNIER n'a NI coussin NI
// fiscalité dans son snapshot — parfait pour prouver la rétraction (null).
const ex = exempleStore()
const snapEx = snapshotFromStore({ ...ex, revenus: { ...ex.revenus, brutAnnuel: 52000 } })

console.log('— Les formes du sable : offertes DATA-AWARE, connues du registre —')
const formesSaison = formesPourKPI('amplitude_revenus', snap, {})
ok(['prisme3d', 'bandes', 'courbe', 'nuage'].every((f) => formesSaison.includes(f)), 'KPI saisonnier : les 4 formes-séries offertes', formesSaison.join(','))
ok(['beignet', 'anneau3d'].every((f) => formesSaison.includes(f)), 'KPI saisonnier : les parts de l’année débloquent beignet/anneau', formesSaison.join(','))
const formesCoussin = formesPourKPI('mois_couverts', snapEx, {})
ok(['prisme3d', 'bandes', 'courbe', 'nuage'].every((f) => formesCoussin.includes(f)), 'KPI coussin : le coussin PROJETÉ débloque les formes-séries', formesCoussin.join(','))
ok(['beignet', 'anneau3d'].every((f) => !formesCoussin.includes(f)), 'KPI coussin : pas un tout à découper → beignet/anneau restent fermés', formesCoussin.join(','))
ok([...FORMES_SERIE, ...FORMES_PARTS].every((t) => estConnu(t)), 'les 6 types du sable connus de schema (le rendu réel = check-render)')

console.log('\n— LE DÉBLOCAGE GÉNÉRIQUE : chaque famille expose SA vraie donnée —')
// patrimoine → la projection par âge (échantillonnée, bornes incluses)
const sPat = serieDuKPI('patrimoine_retraite', snapEx, {})
ok(sPat && sPat.labels.length <= 12 && sPat.labels[0] === '34 ans', 'patrimoine : série = projection, 1er point = l’âge réel', sPat && sPat.labels.join(','))
ok(sPat && sPat.valeurs.length === sPat.labels.length && Math.round(sPat.valeurs[0]) === Math.round(snapEx.projection.annees[0].patrimoineNet), 'patrimoine : 1re valeur = le patrimoine net d’AUJOURD’HUI (jamais inventé)')
ok(sPat && /selon tes hypothèses/.test(sPat.legende), 'patrimoine : la légende dit l’hypothèse')
ok(sPat && sPat.labels.includes('65 ans'), 'patrimoine : l’année de RETRAITE a toujours son point (ancre — la courbe contient le fait daté du héros)', sPat && sPat.labels.join(','))
// net négatif quelque part → une hauteur ne sait pas le dire → rétraction (null)
const snapDette = snapshotFromStore({ ...ex, patrimoine: { ...ex.patrimoine, reer: 3000, celi: 0, nonEnregistre: 0, maisonValeur: 0, hypotheque: 0, autresDettes: 60000 } })
ok(serieDuKPI('patrimoine_retraite', snapDette, {}) === null, 'patrimoine : net NÉGATIF → rétraction (jamais borné à 0 = chiffre inventé)')
// impot → les segments du brut, zéros écartés, total = somme
const sImp = serieDuKPI('taux_effectif', snapEx, {})
ok(sImp && sImp.labels.includes('Impôt Québec') && sImp.valeurs.every((v) => v > 0), 'impôt : série = les segments réels du brut (zéros écartés)', sImp && sImp.labels.join(','))
const pImp = partsDuKPI('taux_effectif', snapEx)
ok(pImp && pImp.total === pImp.parCategorie.reduce((a, x) => a + x.montant, 0) && pImp.centre === 'par an', 'impôt : parts = un TOUT cohérent (total = somme, « par an »)')
// l'anneau BOUCLE : la dernière part ne porte jamais la couleur de la première
const pPat = partsDuKPI('patrimoine_retraite', snapEx)
ok(pPat && pPat.parCategorie.length === 4 && pPat.parCategorie[3].classe !== pPat.parCategorie[0].classe && pPat.parCategorie[3].classe !== pPat.parCategorie[2].classe, 'parts : jamais deux couleurs identiques ADJACENTES sur l’anneau (4 actifs)', pPat && pPat.parCategorie.map((x) => x.classe).join(','))
// budget → les postes triés du snapshot
const sBud = serieDuKPI('top_categorie', snapEx, {})
ok(sBud && sBud.labels[0] === snapEx.depenses.parCategorie[0].label && sBud.valeurs[0] === snapEx.depenses.parCategorie[0].montant, 'budget : série = les postes du snapshot, même ordre')
// coussin → départ réel + épargne réelle, l'HYPOTHÈSE d'affectation divulguée
const sCou = serieDuKPI('mois_couverts', snapEx, {})
ok(sCou && sCou.valeurs[0] === snapEx.coussin.montant + snapEx.depenses.parClasse.epargne && /si ton épargne/.test(sCou.legende), 'coussin : projeté = départ réel + épargne réelle, hypothèse divulguée (« si ton épargne… y allait »)')
ok(sCou && sCou.seuil === snapEx.coussin.cible3 && /cible 3 mois/.test(sCou.seuilTexte), 'coussin : le seuil = la cible 3 mois du snapshot')
// objectif → « selon ton plan » SEULEMENT si la contribution est posée par l'usager
const sObjRythme = serieDuKPI('horizon_objectif', snapEx, { objectif: { cible: 20000 } })
ok(sObjRythme && /à ton rythme/.test(sObjRythme.legende), 'objectif SANS contribution posée : « à ton rythme » (capacité calculée ≠ plan)', sObjRythme && sObjRythme.legende)
const sObjPlan = serieDuKPI('horizon_objectif', snapEx, { objectif: { cible: 20000 }, contributionMensuelle: 300 })
ok(sObjPlan && /selon ton plan/.test(sObjPlan.legende) && sObjPlan.valeurs[0] === Math.min(20000, snapEx.coussin.montant + 300), 'objectif AVEC contribution posée : « selon ton plan », au rythme posé')
// saisonnier → contrat HISTORIQUE (serie/seuil) : le rendu d’aujourd’hui ne bouge pas
const sSai = serieDuKPI('amplitude_revenus', snap, {})
ok(sSai && Array.isArray(sSai.serie) && sSai.serie.length === 12 && !sSai.labels && !sSai.titreBase, 'saisonnier : contrat historique (serie/seuil, sans titreBase) — rendu inchangé')
// donnée absente → null, jamais un chiffre inventé
ok(serieDuKPI('patrimoine_retraite', snap, {}) === null, 'patrimoine SANS projection → null (la forme reste grisée)')
ok(partsDuKPI('taux_effectif', snap) === null, 'impôt SANS brut saisi → null (jamais inventé)')
ok(serieDuKPI('inconnu', snapEx, {}) === null && partsDuKPI('inconnu', snapEx) === null, 'KPI inconnu → null, sans exception')

console.log('\n— normaliserSerie : le contrat générique des blocs-série —')
const nG = normaliserSerie({ labels: ['A', 'B', 'C'], valeurs: [10, -5, 'x'], titreBase: 'Test', seuil: 4 })
ok(nG.labels.length === 3 && nG.valeurs[0] === 10 && nG.valeurs[1] === 0 && nG.valeurs[2] === 0, 'mode générique : N points, négatifs/invalides bornés à 0')
ok(/coût de vie/.test(nG.seuilTexte) === false || nG.seuilTexte.includes('4'), 'seuilTexte de repli construit sur le seuil')
const nH = normaliserSerie({ serie: [1, 2, 3], seuil: 0 })
ok(nH.labels.length === 12 && nH.valeurs.length === 12 && nH.titreBase === null, 'mode historique : 12 mois remplis, titreBase null (titres d’origine)')
const nCap = normaliserSerie({ labels: Array.from({ length: 30 }, (_, i) => String(i)), valeurs: Array.from({ length: 30 }, () => 1) })
ok(nCap.labels.length === 12 && nCap.valeurs.length === 12, 'jamais plus de 12 points (bornage dur)')
ok(etiquetteCourte('34 ans', 5) === '34…' && etiquetteCourte('Logement', 6) === 'Logem…' && etiquetteCourte('Juil', 6) === 'Juil', 'étiquettes coupées AU MOT, jamais au milieu d’un chiffre')

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
