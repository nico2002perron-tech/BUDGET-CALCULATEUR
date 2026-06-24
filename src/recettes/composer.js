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

export const SITUATIONS = {
  revenu_saisonnier: { label: "Passer l'hiver saisonnier", titre: "Passer l'hiver", dispo: true },
  // À venir (nécessitent d'autres blocs / situations) :
  objectif_epargne: { label: "Objectif d'épargne", titre: 'Objectif', dispo: false },
  celiapp: { label: 'Maximiser mon CELIAPP', titre: 'CELIAPP', dispo: false },
}

export const REPONSES_DEFAUT = { vue: 'annuel', mesure: 'mois', side: 'tout' }

export function composerRecette(situation, reponses = {}) {
  const def = SITUATIONS[situation]

  if (situation === 'revenu_saisonnier') {
    const vue = reponses.vue === 'mensuel' ? 'mensuel' : 'annuel'
    const mesure = reponses.mesure === 'montant' ? 'montant' : 'mois'
    const side = reponses.side || 'tout'

    const blocs = [
      { type: 'flux_annuel', params: { souligner: 'mois_deficitaires', vue } },
    ]
    if (side === 'coussin' || side === 'tout') {
      blocs.push({ type: 'jauge', params: { mesure, cible: 5 } })
      blocs.push({ type: 'stat', params: {} })
    }
    if (side === 'fait' || side === 'tout') {
      blocs.push({ type: 'fait', params: {} })
    }
    return { situation, titre: def.titre, blocs }
  }

  // Situations pas encore outillées → recette vide (le moteur ne rend rien).
  return { situation, titre: (def && def.titre) || '', blocs: [] }
}
