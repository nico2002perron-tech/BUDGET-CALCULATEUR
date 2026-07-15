/* ============================================================================
   intentions.js — ÉTAPE 1 du carré de sable en mode CRÉATION (P4) : « Ta question ».

   Une seule décision demandée : « Qu'aimerais-tu mieux comprendre ? ». Chaque
   intention (dans les mots de tous les jours) mène à des KPI RÉSOLUBLES de son/ses
   domaine(s) — data-aware, jamais un indicateur vide. « Une question libre » sort du
   cadre et rejoint la barre IA.

   PUR : zéro React/DOM, testable (scripts/check-intentions.mjs).
   ========================================================================== */
import { candidatsKPI, resolveKPI } from './bibliotheque-kpis.js'

// L'ordre = l'ordre d'affichage. Trois natures : `domaines` → des cartes-KPI data-aware ;
// `studio` → la conversation qui POSE une cible (un objectif n'existe pas sans projet nommé,
// donc pas de KPI résoluble sans lui — revue nuage P4 : sinon cul-de-sac « Ajoute tes
// données ») ; `libre` → la barre IA (question ouverte, pas un domaine).
export const INTENTIONS = [
  { id: 'reste', label: 'Ce qu’il me reste', domaines: ['budget', 'coussin'] },
  { id: 'argent', label: 'Où va mon argent', domaines: ['budget'] },
  { id: 'change', label: 'Ce qui change', domaines: ['saisonnier', 'patrimoine'] },
  { id: 'echeance', label: 'Une échéance', domaines: ['impot', 'dette'] },
  { id: 'projet', label: 'Un projet', studio: true },
  { id: 'libre', label: 'Une question libre', libre: true },
]

/** Les KPI RÉSOLUBLES (donnée présente ET valeur réelle) d'une intention, du plus
 *  pertinent au moins. `libre`/inconnue → []. PUR.
 *  @returns {Array<{ kpiId, question }>} */
export function kpisPourIntention(intentionId, snapshot) {
  const it = INTENTIONS.find((x) => x.id === intentionId)
  if (!it || it.libre || !Array.isArray(it.domaines)) return []
  const s = snapshot || {}
  const vus = new Set()
  const out = []
  for (const d of it.domaines) {
    for (const k of candidatsKPI(d, s)) {
      if (vus.has(k.id)) continue
      const r = resolveKPI(k.id, s)
      if (!r || !r.disponible || r.valeur == null) continue // jamais un indicateur vide
      vus.add(k.id)
      out.push({ kpiId: k.id, question: k.question })
    }
  }
  return out.slice(0, 6)
}
