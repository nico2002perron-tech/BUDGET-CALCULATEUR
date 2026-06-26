/* ============================================================================
   suggestions.js — « LA TOUR PENSE » : moteur de suggestion d'indicateurs.

   Même patron que le reste du Financial OS — des RÈGLES PURES sur le snapshot —
   mais appliqué aux OPPORTUNITÉS au lieu des problèmes. C'est le moteur d'exception
   de la VISION §7a dans sa version DOUCE : pas « attention, ça déborde » (ambre),
   mais « voici un angle qui t'aiderait » (cyan, calme). La tour initie à la place
   de l'usager — elle répond à la page blanche « je ne sais pas quoi suivre » (§8).

   DISCIPLINE (les pièges à éviter) :
   - Conscient des données, HONNÊTE : une règle ne s'active QUE si le snapshot a la
     donnée. Jamais un indicateur de dette s'il n'y a pas de dette.
   - La `raison` décrit le FAIT détecté, jamais un jugement/conseil → passe par
     `filtrerFait` (rejetée → suggestion omise, jamais affichée brute) (§11).
   - 2-3 max, classées : la plus SPÉCIFIQUE d'abord (saisonnier détecté > budget
     générique) (§2, moins de décisions).
   - Cold start gracieux : snapshot trop vide → [] (la surface n'affiche rien,
     l'entonnoir prend le relais).
   - Jamais une situation non `dispo`. Ne touche JAMAIS aux montants (lecture seule).
   - Réutilise `composerRecette`/`revenuVariable` — aucune composition dupliquée,
     aucun appel IA.

   PUR : zéro React, zéro DOM, testable headless (scripts/check-suggestions.mjs).
   ========================================================================== */
import { SITUATIONS, revenuVariable } from './composer.js'
import { filtrerFait } from './schema.js'
import { formatCAD } from '../lib/format.js'

// Plafond (VISION §2 : pas un mur de propositions).
const MAX_SUGGESTIONS = 3

// Les RÈGLES, de la plus spécifique (pertinence haute) à la plus générique. Chaque
// règle : `test(snap)` (la donnée est-elle là ?), `raison(snap)` (le fait détecté).
// `icon` est une CLÉ (string) — l'écran la traduit en SVG (module pur, pas de JSX).
const REGLES = [
  {
    situation: 'revenu_saisonnier',
    titre: 'Passer une saison à revenus variables', // libellé d'INTENTION (aligné sur l'entonnoir)
    pertinence: 100, // pattern DÉTECTÉ → le plus spécifique
    icon: 'saison',
    test: (snap) => revenuVariable(snap),
    raison: (snap) => {
      const r = snap.saison.revenusMensuels
      return `Tes revenus varient de ${formatCAD(Math.min(...r))} à ${formatCAD(Math.max(...r))} selon les mois.`
    },
  },
  {
    situation: 'ma_vie',
    titre: 'Suivre mon patrimoine à long terme',
    pertinence: 70, // patrimoine saisi → données riches
    icon: 'patrimoine',
    // Donnée RÉELLE exigée : un objet patrimoine vide ({}) ne suffit pas — sinon la
    // raison affirmerait « tu as saisi… » sans rien (faux positif d'honnêteté).
    test: (snap) => !!(snap.patrimoine && (snap.patrimoine.actifs > 0 || snap.patrimoine.passifs > 0)),
    raison: (snap) => {
      const p = snap.patrimoine
      if (p.actifs > 0 && p.passifs > 0) return 'Tu as saisi tes avoirs et tes dettes.'
      if (p.actifs > 0) return 'Tu as saisi tes avoirs.'
      return 'Tu as saisi tes dettes.'
    },
  },
  {
    situation: 'mon_portrait',
    titre: 'Décortiquer mon revenu brut et mes impôts',
    pertinence: 65, // revenu brut saisi → anatomie du dollar possible
    icon: 'portrait',
    test: (snap) => !!(snap.fiscalite && snap.fiscalite.brut > 0),
    raison: (snap) => `Tu as saisi ton revenu brut (${formatCAD(snap.fiscalite.brut)} / an).`,
  },
  {
    situation: 'mon_budget',
    titre: 'Voir où part mon argent ce mois-ci',
    pertinence: 50, // générique → le moins prioritaire
    icon: 'budget',
    test: (snap) => !!(snap.depenses && Array.isArray(snap.depenses.parCategorie) && snap.depenses.parCategorie.length > 0),
    raison: (snap) => {
      const n = snap.depenses.parCategorie.length
      return `Tu as saisi ${n} ${n > 1 ? 'catégories' : 'catégorie'} de dépenses.`
    },
  },
]

/**
 * Suggère des indicateurs pertinents pour le snapshot — la tour qui propose.
 * @param {object} snapshot  sortie de snapshotFromStore() / getSnapshot()
 * @returns {Array<{situation, titre, raison, icon, pertinence}>} classées, ≤ 3.
 *   [] si rien n'est soutenu par les données (cold start).
 */
export function suggererIndicateurs(snapshot) {
  const snap = snapshot || {}
  const out = []

  for (const regle of REGLES) {
    const def = SITUATIONS[regle.situation]
    if (!def || def.dispo !== true) continue // jamais une situation non dispo

    let actif = false
    try { actif = !!regle.test(snap) } catch { actif = false } // donnée absente/malformée → on saute
    if (!actif) continue

    let texte
    try { texte = regle.raison(snap) } catch { continue }
    const f = filtrerFait(texte) // garde-fou conformité : faits seulement
    if (!f.ok || !f.texte) continue // raison rejetée → suggestion omise (jamais brute)

    out.push({
      situation: regle.situation,
      titre: regle.titre, // libellé d'INTENTION, cohérent avec les portes de l'entonnoir
      raison: f.texte,
      icon: regle.icon,
      pertinence: regle.pertinence,
    })
  }

  // La plus spécifique d'abord, puis cap (§2 : moins de décisions).
  out.sort((a, b) => b.pertinence - a.pertinence)
  return out.slice(0, MAX_SUGGESTIONS)
}
