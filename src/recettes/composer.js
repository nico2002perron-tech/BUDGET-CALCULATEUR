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
  mon_budget: { label: 'Où va mon argent', titre: 'Ton mois en un coup d’œil', dispo: true },
  mon_portrait: { label: 'Mon portrait du mois', titre: 'Ton portrait du mois', dispo: true },
  ma_vie: { label: 'Ma vie financière', titre: 'Ta vie financière', dispo: true },
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
      blocs.push({ type: 'stat', params: { ton: 'vert' } }) // coussin = épargne/sécurité (puce verte)
    }
    if (side === 'fait' || side === 'tout') {
      blocs.push({ type: 'fait', params: {} })
    }
    return { situation, titre: def.titre, blocs }
  }

  if (situation === 'mon_budget') {
    return {
      situation,
      titre: def.titre,
      blocs: [
        { type: 'repartition', params: { repere: '50/30/20' } }, // large
        { type: 'beignet', params: {} }, // large
        { type: 'solde', params: {} }, // compacte
        { type: 'barre_empilee', params: {} }, // compacte
      ],
    }
  }

  if (situation === 'mon_portrait') {
    return {
      situation,
      titre: def.titre,
      blocs: [
        { type: 'anatomie_dollar', params: {} }, // large
        { type: 'coussin_urgence', params: {} }, // large
        { type: 'impot_palier', params: {} }, // compacte
        { type: 'solde', params: {} }, // compacte
        { type: 'fait', params: {} }, // compacte
      ],
    }
  }

  if (situation === 'ma_vie') {
    return {
      situation,
      titre: def.titre,
      blocs: [
        { type: 'patrimoine_vie', params: {} }, // large — la courbe
        { type: 'horizon', params: { ajoutMax: 1000, pas: 50 } }, // large — le « et si »
        { type: 'composition', params: {} }, // compacte
        { type: 'fait', params: {} }, // compacte
      ],
    }
  }

  // Situations pas encore outillées → recette vide (le moteur ne rend rien).
  return { situation, titre: (def && def.titre) || '', blocs: [] }
}
