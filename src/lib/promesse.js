/* ============================================================================
   promesse.js — LA TUILE-PROMESSE (P4). Quand un KPI épinglé n'a pas (ou plus) la
   donnée qu'il lui faut, sa tuile ne montre pas un « — » froid : elle devient une
   INVITATION — « cette tuile s'allume avec tes X » + la porte pour donner ce X.

   SOURCE UNIQUE de ce rendu (VITRAIL V4 ne fera que l'habiller) : quel silo remplir,
   quelle phrase. PUR, testable (scripts/check-promesse.mjs).

   CONFORMITÉ : la phrase est un FUTUR FACTUEL (« s'allume avec… »), jamais un
   reproche (« tu n'as pas saisi… ») ; filtrée par filtrerFait, repli sûr sinon.
   ========================================================================== */
import { kpiPourId, DONNEE_DISPO } from '../recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../recettes/schema.js'

// Chaque BESOIN de donnée (requiert) → le silo à remplir (sous-section « Mes données »)
// + le nom courant de ce qui manque. Les besoins « à brancher » (dettes détaillées,
// comptes) pointent vers leur silo de saisie actuel/à venir.
const REQUIERT_INFO = {
  capacite: { silo: 'revenus', quoi: 'tes revenus' },
  saison: { silo: 'revenus', quoi: 'tes revenus' },
  fiscalite: { silo: 'revenus', quoi: 'ton revenu brut' },
  coussin: { silo: 'revenus', quoi: 'ton coussin' },
  depenses: { silo: 'depenses', quoi: 'tes dépenses' },
  categories: { silo: 'depenses', quoi: 'tes dépenses' },
  patrimoine: { silo: 'placements', quoi: 'ton patrimoine' },
  projection: { silo: 'placements', quoi: 'ton patrimoine' },
  dettesDetaillees: { silo: 'placements', quoi: 'tes dettes' },
  comptesEnregistres: { silo: 'placements', quoi: 'tes comptes' },
}

/** La promesse d'un KPI dont la donnée manque, ou null si tout est là / KPI inconnu.
 *  @returns {{ silo, quoi, phrase }|null} `silo` = sous-section « Mes données » à ouvrir. PUR. */
export function promesseKPI(kpiId, snapshot) {
  const def = kpiPourId(kpiId)
  if (!def || !Array.isArray(def.requiert) || def.requiert.length === 0) return null
  const s = snapshot || {}
  // Le PREMIER besoin réellement MANQUANT (celui qu'ouvrir remplira). Si TOUTE la donnée est
  // là → null (le KPI résout, pas de promesse). Un besoin manquant non mappé → null (sûr).
  const manquant = def.requiert.find((r) => !DONNEE_DISPO[r] || !DONNEE_DISPO[r](s))
  if (!manquant) return null
  const info = REQUIERT_INFO[manquant]
  if (!info) return null
  const f = filtrerFait(`Cette tuile s’allume avec ${info.quoi}.`)
  return { silo: info.silo, quoi: info.quoi, phrase: f.ok && f.texte ? f.texte : `Cette tuile s’allume avec ${info.quoi}.` }
}
