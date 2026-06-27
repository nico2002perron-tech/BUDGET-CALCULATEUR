/* ============================================================================
   composer.js — RÉPONSES (entretien) → RECETTE valide selon schema.js.

   C'est l'analogue exact de ce que `build-tool` (l'IA) émettra plus tard :
   il prend une INTENTION (ici : les réponses tappables de l'usager) et produit
   une recette `{ situation, titre, blocs:[{type,params}] }`. Le moteur ne voit
   AUCUNE différence selon que la recette vient d'ici ou de l'IA → le chat se
   branchera sans rien changer en aval. PUR (zéro React, zéro DOM).

   Réponses pour `revenu_saisonnier` :
     vue    : 'annuel' | 'mensuel'   → param du flux_annuel
     mesure : 'mois'   | 'montant'   → param de la jauge
     side   : 'tout'   | 'coussin' | 'fait'  → quels blocs de la colonne droite
   ========================================================================== */

import { candidatsValides, filtrerFait } from './schema.js'

export const SITUATIONS = {
  revenu_saisonnier: { label: "Passer l'hiver saisonnier", titre: "Passer l'hiver", dispo: true },
  mon_budget: { label: 'Où va mon argent', titre: 'Ton mois en un coup d’œil', dispo: true },
  mon_portrait: { label: 'Mon portrait du mois', titre: 'Ton portrait du mois', dispo: true },
  ma_vie: { label: 'Ma vie financière', titre: 'Ta vie financière', dispo: true },
  objectif_epargne: { label: "Objectif d'épargne", titre: 'Le chemin vers ton objectif', dispo: true },
  // À venir (nécessitent d'autres blocs / situations) :
  celiapp: { label: 'Maximiser mon CELIAPP', titre: 'CELIAPP', dispo: false },
}

export const REPONSES_DEFAUT = { vue: 'annuel', mesure: 'mois', side: 'tout' }

// Le revenu est-il VARIABLE (saisonnier) ? On regarde les 12 mois du snapshot : s'ils
// varient nettement, le cadre saisonnier (flux souligné « mois déficitaires », coussin
// d'hiver) a du sens ; s'ils sont ~égaux (revenu STABLE), il n'en a pas.
export function revenuVariable(snapshot) {
  const r = snapshot && snapshot.saison && snapshot.saison.revenusMensuels
  if (!Array.isArray(r) || r.length < 12) return false
  const max = Math.max(...r)
  const min = Math.min(...r)
  return max > 0 && (max - min) / max > 0.15
}

// Les objectifs d'épargne CHOISIS dans l'entonnoir → nom + cible. La personnalisation
// vit ICI (plus aucune cible codée en dur dans la chaîne) ; le build-tool posera ceci
// plus tard. Le déjà-épargné reste lu du snapshot (coussin) par graphe.js.
const OBJECTIFS = {
  maison: { nom: 'Maison', cible: 20000 },
  voyage: { nom: 'Voyage', cible: 5000 },
  auto: { nom: 'Auto', cible: 12000 },
  fonds_urgence: { nom: 'Fonds d’urgence', cible: 8000 },
}

// Échéance « cette année » → fin de l'année courante. PAS une date fabriquée : c'est
// l'interprétation directe du choix de l'usager (sinon chronologie ≈ « pas de date »).
function finAnneeCourante() {
  return `${new Date().getFullYear()}-12-31`
}

// DATA-AWARE : un bloc dont la donnée manque dans le snapshot est OMIS (jamais un bloc
// vide). Les blocs qui gèrent eux-mêmes leur état vide (chaine, barre_progression,
// chronologie, fait) passent toujours.
function aDonnee(type, snap) {
  const s = snap || {}
  switch (type) {
    case 'patrimoine_vie':
    case 'composition': return !!s.patrimoine
    case 'horizon': return !!s.projection
    case 'anatomie_dollar':
    case 'impot_palier': return !!s.fiscalite
    case 'beignet':
    case 'solde':
    case 'barre_empilee':
    case 'repartition':
    case 'liste': return !!s.depenses
    case 'flux_annuel': return !!s.saison
    case 'jauge':
    case 'stat':
    case 'coussin_urgence': return !!s.coussin || !!s.saison
    default: return true
  }
}

// Le « pourquoi » d'un angle : une phrase FACTUELLE décrivant ce que le graphique met
// en valeur (la forme, jamais une conclusion). Passe par filtrerFait à la pose.
export const POURQUOI = {
  beignet: 'Le beignet met en évidence quelle catégorie pèse le plus.',
  barre_empilee: 'La barre empilée montre la part fixe et la part variable de tes dépenses.',
  repartition: 'La répartition situe tes dépenses face au repère 50/30/20.',
  liste: 'La liste détaille chaque poste, du plus grand au plus petit.',
}

// Recommandation DÉTERMINISTE + data-aware selon la FORME des données (zéro IA) :
// beaucoup de catégories → beignet ; peu de postes → liste ; sinon l'enjeu fixe/variable.
function recommandeBudget(snapshot) {
  const d = snapshot && snapshot.depenses
  const n = d && Array.isArray(d.parCategorie) ? d.parCategorie.length : 0
  if (n >= 4) return 'beignet'
  if (n >= 1 && n <= 3) return 'liste'
  return 'barre_empilee'
}

// Pose un emplacement à CANDIDATS si ≥2 angles montrent vraiment la même donnée ;
// sinon le bloc simple qui a du sens ; sinon null (data-aware). Pur.
function poseSlotGraphique(types, snapshot) {
  const valides = candidatsValides({ recommande: types[0], alternatives: types.slice(1) }, snapshot)
  if (valides.length === 0) return null
  if (valides.length === 1) return { type: valides[0], params: {} }
  const reco = valides.includes(recommandeBudget(snapshot)) ? recommandeBudget(snapshot) : valides[0]
  const f = filtrerFait(POURQUOI[reco] || '')
  return {
    slot: 'graphique',
    recommande: reco,
    alternatives: valides.filter((t) => t !== reco),
    choisi: reco,
    pourquoi: f.ok && f.texte ? f.texte : 'Cet angle présente la même donnée autrement.',
  }
}

export function composerRecette(situation, reponses = {}, snapshot = null) {
  const def = SITUATIONS[situation]
  // Règle data-aware : on n'offre jamais un bloc non soutenu PAR LES DONNÉES. Sans
  // snapshot fourni (appels de structure), on ne filtre pas — on ne peut pas savoir.
  const garder = (blocs) => (snapshot ? blocs.filter((b) => aDonnee(b.type, snapshot)) : blocs)

  // RÈGLE 1 : un HÉROS distinct par situation (jamais partagé). RÈGLE 2 : les réponses
  // permutent les blocs de SOUTIEN, pas le héros. RÈGLE 3 : on termine par un fait.

  if (situation === 'revenu_saisonnier') {
    const vue = reponses.vue === 'mensuel' ? 'mensuel' : 'annuel'
    const mesure = reponses.mesure === 'montant' ? 'montant' : 'mois'
    const side = reponses.side || 'tout'
    const souligner = revenuVariable(snapshot) ? 'mois_deficitaires' : 'aucun'
    const blocs = [{ type: 'flux_annuel', params: { souligner, vue } }] // HÉROS
    if (side === 'coussin' || side === 'tout') blocs.push({ type: 'jauge', params: { mesure, cible: 5 } })
    if (side === 'fait' || side === 'tout') blocs.push({ type: 'fait', params: {} })
    return { situation, titre: def.titre, blocs: garder(blocs) }
  }

  if (situation === 'mon_budget') {
    // HÉROS = emplacement à CANDIDATS : beignet / barre_empilee / repartition / liste
    // montrent « où va l'argent » sous des angles différents. La tour recommande, offre
    // les autres. Le fait clôt. (Le solde reste un soutien fixe.)
    const heros = poseSlotGraphique(['beignet', 'barre_empilee', 'repartition', 'liste'], snapshot)
    const blocs = [heros, { type: 'solde', params: {} }, { type: 'fait', params: {} }].filter(Boolean)
    return { situation, titre: def.titre, blocs: garder(blocs) }
  }

  if (situation === 'mon_portrait') {
    return { situation, titre: def.titre, blocs: garder([
      { type: 'anatomie_dollar', params: {} }, // HÉROS
      { type: 'impot_palier', params: {} },
      { type: 'solde', params: {} },
      { type: 'fait', params: {} },
    ]) }
  }

  if (situation === 'ma_vie') {
    return { situation, titre: def.titre, blocs: garder([
      { type: 'patrimoine_vie', params: {} }, // HÉROS — la courbe
      { type: 'horizon', params: { ajoutMax: 1000, pas: 50 } },
      { type: 'composition', params: {} },
      { type: 'fait', params: {} },
    ]) }
  }

  if (situation === 'objectif_epargne') {
    const cle = OBJECTIFS[reponses.objectif] ? reponses.objectif : 'maison'
    const obj = OBJECTIFS[cle]
    const estFonds = cle === 'fonds_urgence'
    const courtTerme = reponses.echeance ? reponses.echeance === 'cette_annee' : true

    const blocs = []
    if (estFonds) blocs.push({ type: 'coussin_urgence', params: {} }) // HÉROS du fonds d'urgence
    // HÉROS (maison/auto/voyage) = un KPI NOMMÉ (horizon_objectif), forme recommandée = la
    // chaîne (elle montre d'où vient le chiffre). La tour pourra l'afficher autrement
    // (ChoixAngle : chronologie, stat…) sans recalculer — c'est la même métrique.
    blocs.push({ KPI: 'horizon_objectif', forme: 'chaine', recommande: 'chaine', params: { objectif: { id: cle, nom: obj.nom, cible: obj.cible } } })
    blocs.push({ type: 'barre_progression', params: { cible: obj.cible, etiquetteGauche: 'Déjà', etiquetteDroite: obj.nom } })
    // SOUTIEN qui VARIE selon l'échéance : court terme → compte à rebours ; long terme → « et si ».
    if (courtTerme) blocs.push({ type: 'chronologie', params: { label: `Cap ${obj.nom}`, dateCible: finAnneeCourante() } })
    else blocs.push({ type: 'horizon', params: { ajoutMax: 1000, pas: 50 } })
    blocs.push({ type: 'fait', params: {} })
    return { situation, titre: `Objectif ${obj.nom}`, blocs: garder(blocs) }
  }

  // Situations pas encore outillées → recette vide (le moteur ne rend rien).
  return { situation, titre: (def && def.titre) || '', blocs: [] }
}
