/* ============================================================================
   entonnoir.js — Pas 3a : L'ARBRE DE L'ENTONNOIR (données pures, testable).

   L'atelier « Crée un indicateur » devient une conversation en entonnoir : une
   question à la fois, des réponses tappables, l'entonnoir se resserre jusqu'à une
   feuille. Ce module ne contient QUE la structure de navigation + un résolveur.

   PRINCIPE (le piège à éviter) : l'entonnoir n'est PAS une nouvelle intelligence
   et n'appelle PAS l'IA. C'est de la mise en scène par-dessus `composerRecette`.
   Une suite de réponses → { situation, reponses } → la recette EXISTANTE. Le
   moteur ne voit aucune différence. On ne duplique aucune logique de composition.

   Forme d'un nœud :
     { id, question, reponses: [ Réponse ] }
   Forme d'une réponse :
     { id, label, set?: {clef:valeur}, vers?: idNoeud }
       · `set` accumule l'intention : la clef réservée `situation` fixe la
         situation ; toute autre clef alimente l'objet `reponses`.
       · `vers` = nœud suivant. Absent → la réponse est une FEUILLE (fin du chemin).

   PUR : zéro React, zéro DOM, testable headless (scripts/check-entonnoir.mjs).
   ========================================================================== */

export const RACINE = 'racine'

export const ENTONNOIR = {
  racine: {
    id: 'racine',
    // Libellés volontairement DISTINCTS d'intention : « ce mois-ci » (argent) vs
    // « la paie / l'impôt » (portrait) vs « le long terme » (vie) — pour qu'un
    // débutant ne voie pas trois portes qui semblent répondre à la même question.
    question: 'Que veux-tu suivre ?',
    reponses: [
      { id: 'objectif', label: 'Atteindre un objectif d’épargne', set: { situation: 'objectif_epargne' }, vers: 'obj_type' },
      { id: 'argent', label: 'Voir où part mon argent ce mois-ci', set: { situation: 'mon_budget' } }, // feuille
      { id: 'portrait', label: 'Décortiquer mon revenu brut et mes impôts', set: { situation: 'mon_portrait' } }, // feuille
      { id: 'vie', label: 'Suivre mon patrimoine à long terme', set: { situation: 'ma_vie' } }, // feuille
      { id: 'saison', label: 'Passer une saison à revenus variables', set: { situation: 'revenu_saisonnier' }, vers: 'saison_focus' },
    ],
  },

  obj_type: {
    id: 'obj_type',
    question: 'Quel objectif vises-tu ?',
    reponses: [
      { id: 'maison', label: 'Une maison', set: { objectif: 'maison' }, vers: 'obj_echeance' },
      { id: 'voyage', label: 'Un voyage', set: { objectif: 'voyage' }, vers: 'obj_echeance' },
      { id: 'auto', label: 'Une auto', set: { objectif: 'auto' }, vers: 'obj_echeance' },
      { id: 'fonds', label: 'Un fonds d’urgence', set: { objectif: 'fonds_urgence' }, vers: 'obj_echeance' },
    ],
  },

  obj_echeance: {
    id: 'obj_echeance',
    question: 'Pour quand ?',
    reponses: [
      { id: 'cette_annee', label: 'Cette année', set: { echeance: 'cette_annee' } }, // feuille
      { id: 'moyen', label: 'Dans 2-3 ans', set: { echeance: 'moyen' } }, // feuille
      { id: 'long', label: 'Plus tard', set: { echeance: 'long' } }, // feuille
    ],
  },

  saison_focus: {
    id: 'saison_focus',
    question: 'Pendant ta saison creuse, qu’est-ce qui t’aide le plus ?',
    reponses: [
      { id: 'tout', label: 'Mon coussin et mes mois creux', set: { side: 'tout' } }, // feuille
      { id: 'coussin', label: 'Surtout mon coussin d’hiver', set: { side: 'coussin' } }, // feuille
      { id: 'constat', label: 'Surtout le constat factuel', set: { side: 'fait' } }, // feuille
    ],
  },
}

/** Le nœud dont il faut poser la question, vu le chemin déjà parcouru.
 *  Retourne null quand le chemin est complet (feuille atteinte) — plus de question.
 *  (Sert à l'écran 3b : « quelle question afficher maintenant ? ».) */
export function noeudCourant(chemin = []) {
  let noeudId = RACINE
  for (const repId of chemin) {
    const noeud = ENTONNOIR[noeudId]
    if (!noeud) return null
    const rep = noeud.reponses.find((r) => r.id === repId)
    if (!rep || !rep.vers) return null // réponse inconnue, ou feuille → plus de question
    noeudId = rep.vers
  }
  return ENTONNOIR[noeudId] || null
}

/** Transforme une suite de réponses (ids) en { situation, reponses } prêt pour
 *  composerRecette. `complet` indique qu'une feuille a bien été atteinte.
 *  AUCUNE logique de composition ici : on ne fait qu'assembler l'intention. */
export function resoudreEntonnoir(chemin = []) {
  let noeudId = RACINE
  let situation = null
  const reponses = {}
  let complet = false

  for (const repId of chemin) {
    const noeud = ENTONNOIR[noeudId]
    if (!noeud) break
    const rep = noeud.reponses.find((r) => r.id === repId)
    if (!rep) break // réponse inconnue → chemin invalide, on s'arrête proprement
    if (rep.set) {
      for (const [clef, valeur] of Object.entries(rep.set)) {
        if (clef === 'situation') situation = valeur
        else reponses[clef] = valeur
      }
    }
    if (!rep.vers) { complet = true; break } // feuille atteinte
    noeudId = rep.vers
  }

  return { situation, reponses, complet }
}

/** Le fil d'Ariane LISIBLE d'un chemin : une étape par réponse choisie, avec sa
 *  question et son libellé. Sert au breadcrumb de l'écran (« Objectif › Maison »)
 *  et aux étiquettes des pièces de l'établi. Pur. */
export function cheminLisible(chemin = []) {
  const etapes = []
  let noeudId = RACINE
  for (const repId of chemin) {
    const noeud = ENTONNOIR[noeudId]
    if (!noeud) break
    const rep = noeud.reponses.find((r) => r.id === repId)
    if (!rep) break
    etapes.push({ noeud: noeudId, question: noeud.question, repId: rep.id, label: rep.label })
    if (!rep.vers) break // feuille
    noeudId = rep.vers
  }
  return etapes
}

/** Énumère TOUS les chemins complets (racine → feuille). Sert au test à prouver
 *  qu'aucune branche ne mène à un cul-de-sac et que chacune résout en recette. */
export function cheminsComplets() {
  const out = []
  const dfs = (noeudId, chemin) => {
    const noeud = ENTONNOIR[noeudId]
    if (!noeud) return
    for (const rep of noeud.reponses) {
      const suite = [...chemin, rep.id]
      if (rep.vers) dfs(rep.vers, suite)
      else out.push(suite) // feuille
    }
  }
  dfs(RACINE, [])
  return out
}
