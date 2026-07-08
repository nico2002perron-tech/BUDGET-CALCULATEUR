/* ============================================================================
   check-actions.mjs — LE REGISTRE D'ACTIONS de la barre-copilote (A1), pur.
   Headless (node), zéro navigateur, zéro IA : chaque verbe (cas valide + cas
   REFUSÉ data-aware), la salve multi-actions (validée contre l'état courant),
   l'immutabilité (→ Annuler = restaurer l'état d'avant), et TOUT texte rendu à
   l'usager (raison de refus, résumé) filtré par filtrerFait.
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'
import { ACTIONS, VERBES, executerActions, resumeActions } from '../src/recettes/actions.js'
import { filtrerFait } from '../src/recettes/schema.js'
import { reglageCible, resolveKPI } from '../src/recettes/bibliotheque-kpis.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

// Snapshot RICHE (toutes les familles allumées) : le brut allume les impôts.
const ex = exempleStore()
const snapEx = snapshotFromStore({ ...ex, revenus: { ...ex.revenus, brutAnnuel: 52000 } })
// Snapshot MAIGRE : saison seule (patrimoine/fiscalité absents) → refus data-aware.
const snapSaison = snapshotFromStore(ex)
const ctx = { snapshot: snapEx }

// Un board de départ + une scène saisonnière ouverte.
const wSaison = { id: 'w1', recette: { situation: 'kpi_amplitude_revenus', titre: 'Ma saison', blocs: [{ KPI: 'amplitude_revenus', forme: 'prisme3d', params: {} }] }, accent: '#7a6fe6' }
const wCoussin = { id: 'w2', recette: { situation: 'kpi_mois_couverts', titre: 'Mon coussin', blocs: [{ KPI: 'mois_couverts', forme: 'jauge', params: {} }] }, accent: '#0f8a5f' }
const etatSable = { widgets: [wSaison, wCoussin], sable: { widgetId: 'w1', kpiId: 'amplitude_revenus', forme: 'prisme3d', comparaisons: [], cible: null } }
const etatBoard = { widgets: [wSaison, wCoussin], sable: null }

const gele = JSON.stringify(etatSable) // pour prouver l'immutabilité
const un = (verbe, extra, etat = etatSable, c = ctx) => executerActions([{ verbe, ...extra }], c, etat)

console.log('— Chaque verbe existe et porte un scope connu —')
ok(VERBES.length === 14, `14 verbes exposés`, VERBES.join(','))
ok(VERBES.every((v) => ['sable', 'board', 'tuile'].includes(ACTIONS[v].scope)), 'tous les scopes ∈ {sable, board, tuile}')

console.log('\n— ajouter_comparateur : data-aware (« l’an passé » attend l’historique) —')
{
  const r = un('ajouter_comparateur', { contexte: 'moyenne' })
  ok(r.faites.length === 1 && r.etat.sable.comparaisons[0].contexte === 'moyenne', 'moyenne : ajoutée à la scène')
  ok(r.etat.sable.comparaisons[0].label === 'ta moyenne', 'le label vient du résolveur (pas de la commande)')
  const anp = un('ajouter_comparateur', { contexte: 'an_passe' })
  ok(anp.faites.length === 0 && /historique/.test(anp.refusees[0].raison), 'l’an passé : REFUSÉ avec sa condition (jamais inventé)', anp.refusees[0] && anp.refusees[0].raison)
  const inconnu = un('ajouter_comparateur', { contexte: '__proto__' })
  ok(inconnu.refusees.length === 1, 'contexte-piège (__proto__) : refusé sans exception')
  // hors saison : le KPI coussin n'accepte pas de comparateur
  const etatCoussin = { ...etatBoard, sable: { widgetId: 'w2', kpiId: 'mois_couverts', forme: 'jauge', comparaisons: [], cible: null } }
  const hs = un('ajouter_comparateur', { contexte: 'moyenne' }, etatCoussin)
  ok(hs.faites.length === 0, 'KPI non saisonnier : comparateur refusé (honnête)')
}

console.log('\n— poser_cible / retirer_cible : bornées au reglage, sinon refus —')
{
  const reg = reglageCible('mois_couverts', snapEx, {})
  const etatCoussin = { ...etatBoard, sable: { widgetId: 'w2', kpiId: 'mois_couverts', forme: 'jauge', comparaisons: [], cible: null } }
  const r = un('poser_cible', { valeur: 999 }, etatCoussin) // hors borne (max 12 mois)
  ok(r.faites.length === 1 && r.etat.sable.cible === reg.max, `cible clampée au max (${reg.max} ${reg.unite})`, `${r.etat.sable.cible}`)
  ok(/Cible posée/.test(r.faites[0].resume), 'résumé « Cible posée à … »', r.faites[0] && r.faites[0].resume)
  const nan = un('poser_cible', { valeur: 'beaucoup' }, etatCoussin)
  ok(nan.faites.length === 0, 'cible non numérique : refusée')
  // un KPI patrimoine (net) n'a pas de cible saisonnière
  const etatPat = { widgets: [{ id: 'wp', recette: { situation: 'kpi_valeur_nette', titre: 'x', blocs: [{ KPI: 'valeur_nette', forme: 'stat', params: {} }] } }], sable: { widgetId: 'wp', kpiId: 'valeur_nette', forme: 'stat', comparaisons: [], cible: null } }
  ok(!reglageCible('valeur_nette', snapEx, {}) && un('poser_cible', { valeur: 5 }, etatPat).faites.length === 0, 'KPI sans reglage : « pas de cible à poser »')
  // retirer quand rien de posé
  ok(un('retirer_cible', {}, etatCoussin).faites.length === 0, 'retirer_cible sans cible : refusé')
  const pose = un('poser_cible', { valeur: 4 }, etatCoussin).etat
  ok(executerActions([{ verbe: 'retirer_cible' }], ctx, pose).etat.sable.cible === null, 'retirer_cible après pose : cible = null')
}

console.log('\n— changer_forme : seulement parmi les formes OFFERTES du KPI —')
{
  const r = un('changer_forme', { forme: 'courbe' })
  ok(r.faites.length === 1 && r.etat.sable.forme === 'courbe', 'forme offerte (courbe) : appliquée')
  const no = un('changer_forme', { forme: 'jauge' }) // jauge non offerte pour amplitude_revenus
  ok(no.faites.length === 0 && /offerte/.test(no.refusees[0].raison), 'forme non offerte : refusée honnêtement')
}

console.log('\n— couleur / renommer / icône : la tuile (scène ou board) —')
{
  const c1 = un('changer_couleur', { couleur: 'vert' })
  ok(c1.etat.widgets[0].accent === '#0f8a5f', 'couleur par id de palette (vert) → hex')
  ok(un('changer_couleur', { couleur: '#123abc' }).etat.widgets[0].accent === '#123abc', 'couleur par hex direct')
  ok(un('changer_couleur', { couleur: 'chartreuse' }).faites.length === 0, 'couleur hors palette : refusée')
  ok(un('renommer', { titre: 'Mon été' }).etat.widgets[0].recette.titre === 'Mon été', 'renommer applique le titre')
  ok(un('renommer', { titre: 'tu devrais épargner' }).faites.length === 0, 'titre jugeant (filtrerFait) : refusé')
  ok(un('changer_icone', { icone: 'soleil' }).etat.widgets[0].icone === 'soleil', 'icône valide appliquée')
  ok(un('changer_icone', { icone: 'licorne' }).faites.length === 0, 'icône inconnue : refusée')
  // ciblage explicite d'une tuile du board (sable fermé)
  const c2 = un('changer_couleur', { couleur: 'cyan', cible: 'w2' }, etatBoard)
  ok(c2.etat.widgets[1].accent === '#00b4d8', 'board : couleur d’une tuile nommée par id')
  ok(un('renommer', { titre: 'x' }, etatBoard).faites.length === 0, 'board sans cible : refus « quelle tuile »')
}

console.log('\n— creer_widget / repondre_kpi : data-aware + anti-doublon —')
{
  const r = un('creer_widget', { kpi: 'valeur_nette' }, etatBoard)
  ok(r.faites.length === 1 && r.etat.widgets.length === 3, 'crée une tuile pour un KPI disponible')
  ok(r.etat.widgets[2].recette.situation === 'kpi_valeur_nette' && r.etat.widgets[2].nouveau === true, 'recette kpi_<id> + marqueur nouveau (elle se pose)')
  const dbl = un('creer_widget', { kpi: 'amplitude_revenus' }, etatBoard) // situation déjà là (w1)
  ok(dbl.faites.length === 0 && /déjà/.test(dbl.refusees[0].raison), 'anti-doublon : « tu as déjà cette vue »')
  // KPI dont la donnée manque (fiscalité absente en snapshot maigre)
  const maigre = un('creer_widget', { kpi: 'taux_effectif' }, etatBoard, { snapshot: snapSaison })
  ok(maigre.faites.length === 0 && /paie|s’allume/.test(maigre.refusees[0].raison), 'KPI sans donnée : refus avec condition « s’allume avec … »', maigre.refusees[0] && maigre.refusees[0].raison)
  const inc = un('creer_widget', { kpi: 'nexiste_pas' }, etatBoard)
  ok(inc.faites.length === 0, 'KPI inconnu : refusé')
  // repondre_kpi : exige une VRAIE réponse (texteFactuel)
  const rep = un('repondre_kpi', { kpi: 'top_categorie' }, etatBoard)
  ok(rep.faites.length === 1 && rep.faites[0].resume === resolveKPI('top_categorie', snapEx).texteFactuel, 'repondre_kpi : la réponse = le fait résolu du KPI')
}

console.log('\n— retirer / redimensionner / ouvrir_sable / epingler —')
{
  ok(un('retirer_widget', { cible: 'w2' }, etatBoard).etat.widgets.length === 1, 'retirer une tuile par id')
  ok(un('retirer_widget', { cible: 'zzz' }, etatBoard).faites.length === 0, 'retirer une tuile absente : refusé')
  ok(un('redimensionner', { cible: 'w1', taille: 'xl' }, etatBoard).etat.widgets[0].taille === 'xl', 'redimensionner à une taille valide')
  ok(un('redimensionner', { cible: 'w1', taille: 'geante' }, etatBoard).faites.length === 0, 'taille invalide : refusée')
  const ouvre = un('ouvrir_sable', { cible: 'w1' }, etatBoard)
  ok(ouvre.etat.sable && ouvre.etat.sable.kpiId === 'amplitude_revenus', 'ouvrir_sable pose la scène depuis la tuile')
  const epingle = executerActions([{ verbe: 'poser_cible', valeur: 3000 }, { verbe: 'ajouter_comparateur', contexte: 'moyenne' }, { verbe: 'epingler' }], ctx, etatSable)
  const b = epingle.etat.widgets[0].recette.blocs[0]
  ok(epingle.etat.widgets[0].epingle === true && b.params.cible === 3000 && b.params.comparaisons.length === 1, 'épingler replie forme+cible+comparaison sur la tuile')
  // épingler PRÉSERVE les params de base (ex. l'objectif d'un KPI de projet)
  const wObj = { id: 'wo', recette: { situation: 'kpi_horizon_objectif', titre: 'x', blocs: [{ KPI: 'horizon_objectif', forme: 'chaine', params: { objectif: { id: 'g', nom: 'Maison', cible: 20000 } } }] } }
  const etatObj = { widgets: [wObj], sable: { widgetId: 'wo', kpiId: 'horizon_objectif', forme: 'chaine', comparaisons: [], cible: null, objectif: { id: 'g', nom: 'Maison', cible: 20000 } } }
  const ep2 = executerActions([{ verbe: 'epingler' }], ctx, etatObj)
  ok(ep2.etat.widgets[0].recette.blocs[0].params.objectif && ep2.etat.widgets[0].recette.blocs[0].params.objectif.cible === 20000, 'épingler NE JETTE PAS params.objectif (cible du projet préservée)')
}

console.log('\n— SALVE multi-actions : validée contre l’état COURANT (ordre) —')
{
  // « en courbe et compare à ma moyenne » : le comparateur voit déjà la forme changée
  const salve = executerActions([{ verbe: 'changer_forme', forme: 'courbe' }, { verbe: 'ajouter_comparateur', contexte: 'moyenne' }, { verbe: 'poser_cible', valeur: 3500 }], ctx, etatSable)
  ok(salve.faites.length === 3 && salve.etat.sable.forme === 'courbe' && salve.etat.sable.comparaisons.length === 1 && salve.etat.sable.cible === 3500, 'trois gestes d’une phrase, tous appliqués')
  const resume = resumeActions(salve.faites)
  ok(/Forme.*Repère.*Cible/.test(resume) && filtrerFait(resume).ok, 'résumé « Fait · … » lisible et filtré', resume)
  // une action invalide au milieu n’empêche pas les autres
  const mixte = executerActions([{ verbe: 'changer_forme', forme: 'nuage' }, { verbe: 'changer_forme', forme: 'jauge' }, { verbe: 'poser_cible', valeur: 4000 }], ctx, etatSable)
  ok(mixte.faites.length === 2 && mixte.refusees.length === 1 && mixte.etat.sable.forme === 'nuage', 'action invalide isolée : les autres passent, la scène reste cohérente')
}

console.log('\n— JSON HOSTILE : jamais d’exception, jamais de prototype récupéré —')
{
  // un verbe nommé comme une clé héritée d'Object ne doit PAS résoudre une fonction
  for (const verbe of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const r = executerActions([{ verbe }], ctx, etatSable)
    ok(r.faites.length === 0 && r.refusees.length === 1, `verbe hérité « ${verbe} » : refusé sans exception`)
  }
  // entrées franchement malformées
  const cochonneries = [null, undefined, 42, 'texte', {}, { verbe: 'poser_cible', valeur: Infinity }, { verbe: 'renommer', titre: { x: 1 } }, { verbe: 'changer_couleur', couleur: { r: 1 } }, { verbe: 'redimensionner', cible: { id: 'x' }, taille: 3 }]
  let leve = false
  let r2
  try { r2 = executerActions(cochonneries, ctx, etatSable) } catch { leve = true }
  ok(!leve, 'executerActions ne LÈVE jamais sur des actions malformées')
  ok(r2 && r2.faites.length === 0, 'toutes les cochonneries refusées (aucune appliquée)')
  ok(JSON.stringify(etatSable) === gele, 'l’état d’entrée reste intact malgré le JSON hostile')
}

console.log('\n— IMMUTABILITÉ (→ Annuler restaure l’état d’avant à l’identique) —')
{
  const avant = JSON.parse(gele)
  const apres = executerActions([{ verbe: 'changer_forme', forme: 'courbe' }, { verbe: 'creer_widget', kpi: 'valeur_nette' }], ctx, avant)
  ok(JSON.stringify(avant) === gele, 'executerActions ne MUTE jamais l’état d’entrée')
  ok(apres.etat !== avant && apres.etat.sable.forme === 'courbe', 'l’état retourné est NEUF (garder la référence d’avant = Annuler)')
}

console.log('\n— TOUS les textes rendus passent filtrerFait —')
{
  const raisons = []
  const resumes = []
  // provoquer chaque refus + chaque succès pour ramasser tous les gabarits
  const essais = [
    ['ajouter_comparateur', { contexte: 'an_passe' }], ['ajouter_comparateur', { contexte: 'moyenne' }],
    ['poser_cible', { valeur: 'x' }], ['changer_forme', { forme: 'jauge' }], ['changer_couleur', { couleur: 'nope' }],
    ['renommer', { titre: '' }], ['changer_icone', { icone: 'nope' }], ['creer_widget', { kpi: 'nexiste' }],
    ['retirer_widget', { cible: 'zzz' }], ['redimensionner', { cible: 'w1', taille: 'g' }], ['ouvrir_sable', { cible: 'zzz' }],
  ]
  for (const [verbe, extra] of essais) {
    const r = un(verbe, extra)
    r.refusees.forEach((x) => raisons.push(x.raison))
    r.faites.forEach((x) => resumes.push(x.resume))
  }
  ok(raisons.length > 0 && raisons.every((t) => filtrerFait(t).ok && t.trim()), `toutes les raisons de refus filtrées + non vides (${raisons.length})`)
  ok(resumes.every((t) => filtrerFait(t).ok), 'tous les résumés filtrés')
}

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ Le registre d’actions tient — 0 échec (fondation du copilote, pure)')
