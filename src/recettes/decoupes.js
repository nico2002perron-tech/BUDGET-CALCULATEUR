/* ============================================================================
   decoupes.js — L'ATELIER DE COMPOSITION (B5), 2e axe : LA DÉCOUPE. Un même
   TOUT peut se trancher autrement — « par catégorie » (le défaut) ou
   « fixe / variable ». DÉCLARATIF (registre fermé), HONNÊTE (les parts viennent
   du snapshot, jamais inventées ; null si la donnée manque), data-aware.

   Comme la dérivée, on N'APPLIQUE une découpe que là où elle a un sens : les
   formes en PARTS (beignet / anneau 3D). MoteurRendu remplacera partsDuKPI par
   partsDecoupe quand `params.decoupe` est posée sur une forme-parts. PUR.
   ========================================================================== */
import { kpiPourId, FORMES_PARTS } from './bibliotheque-kpis.js'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const PARTS = new Set(FORMES_PARTS) // beignet, anneau3d

// Registre FERMÉ. 'par_categorie' = la découpe par DÉFAUT (partsDuKPI) — jamais
// calculée ici ; les autres proposent une vraie alternative.
export const DECOUPES = [
  { id: 'par_categorie', label: 'Par catégorie' },
  { id: 'fixe_variable', label: 'Fixe / variable' },
]
const IDS = new Set(DECOUPES.map((d) => d.id))
export function decoupeValide(id) { return typeof id === 'string' && IDS.has(id) }

// Y a-t-il une vraie découpe fixe/variable dans le snapshot ?
function aFixeVariable(snapshot) {
  const el = snapshot && snapshot.depenses && snapshot.depenses.engageLibre
  return !!el && num(el.fixe) + num(el.variable) > 0
}

/** Les PARTS d'une découpe (contrat beignet/anneau : { parCategorie, total, titre,
 *  sous, centre }). Rend null si la donnée manque ou si c'est la découpe par
 *  défaut (celle-là passe par partsDuKPI). PUR. */
export function partsDecoupe(decoupeId, snapshot) {
  if (decoupeId === 'fixe_variable') {
    const el = (snapshot && snapshot.depenses && snapshot.depenses.engageLibre) || {}
    const fixe = num(el.fixe)
    const variable = num(el.variable)
    const total = fixe + variable
    if (total <= 0) return null
    return {
      parCategorie: [
        { id: 'fixe', label: 'Fixe (engagé)', classe: 'besoin', montant: fixe },
        { id: 'variable', label: 'Variable', classe: 'envie', montant: variable },
      ],
      total,
      titre: 'Fixe vs variable',
      sous: 'Ce qui part tout seul contre ce que tu pilotes.',
      centre: 'par mois',
    }
  }
  return null
}

/** Les découpes OFFERTES pour un KPI dans une forme donnée (data-aware). On ne
 *  propose le CHOIX que sur une forme-parts (beignet/anneau), un KPI budget, ET
 *  s'il existe une VRAIE alternative à la découpe par défaut. Sinon [] (pas de
 *  rangée « La découpe » — jamais un choix vide). PUR. */
export function decoupesPourKPI(kpiId, snapshot, forme) {
  if (!PARTS.has(forme)) return []
  const def = kpiPourId(kpiId)
  if (!def || def.domaine !== 'budget') return []
  if (!aFixeVariable(snapshot)) return []
  return ['par_categorie', 'fixe_variable']
}
