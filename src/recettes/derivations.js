/* ============================================================================
   derivations.js — L'ATELIER DE COMPOSITION (B5), première pierre : une DÉRIVÉE
   BORNÉE transforme la valeur résolue d'un KPI en une autre LECTURE factuelle
   (« en % de ton revenu »). DÉCLARATIF, jamais une formule libre : un registre
   fermé de transformations, chacune calculée à partir de valeurs QUI EXISTENT
   dans le snapshot (jamais inventée). HONNÊTE : si la dérivée ne s'applique pas
   (mauvaise unité, revenu absent), on rend la valeur D'ORIGINE inchangée. PUR.
   ========================================================================== */
import { resolveKPI, kpiPourId } from './bibliotheque-kpis.js'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// Les formes qui affichent DIRECTEMENT la valeur scalaire du KPI — les seules où
// une dérivée « % » a un sens visuel (une série en $ resterait, elle, en $).
export const FORMES_SCALAIRES = new Set(['stat', 'fait'])

// Le registre FERMÉ. 'brut' = la valeur telle quelle (le défaut, aucune dérivée).
export const DERIVATIONS = [
  { id: 'brut', label: 'Montant' },
  { id: 'pct_revenu', label: 'En % de ton revenu' },
  { id: 'pct_depenses', label: 'En % de tes dépenses' },
]
const IDS = new Set(DERIVATIONS.map((d) => d.id))
export function derivationValide(id) { return typeof id === 'string' && IDS.has(id) }

// Deux dénominateurs, tous deux DU SNAPSHOT (jamais inventés) — 0 si absents.
function revenuMensuel(snapshot) {
  return num(snapshot && snapshot.depenses && snapshot.depenses.revenu)
}
function depensesMensuelles(snapshot) {
  return num(snapshot && snapshot.depenses && snapshot.depenses.coutVie)
}

/** Transforme une résolution scalaire de KPI selon la dérivée. Rend la résolution
 *  D'ORIGINE inchangée si la dérivée ne s'applique pas (unité ≠ $, revenu absent,
 *  valeur non finie) — jamais un chiffre inventé. Texte factuel (à filtrer). PUR. */
export function deriver(derivationId, kpiResolu, snapshot) {
  if (!derivationId || derivationId === 'brut' || !kpiResolu) return kpiResolu
  const enDollars = kpiResolu.disponible && kpiResolu.unite === '$' && typeof kpiResolu.valeur === 'number' && Number.isFinite(kpiResolu.valeur)
  if (derivationId === 'pct_revenu') {
    if (!enDollars) return kpiResolu
    const rev = revenuMensuel(snapshot)
    if (!(rev > 0)) return kpiResolu
    const pct = Math.round((kpiResolu.valeur / rev) * 100)
    return { ...kpiResolu, valeur: pct, unite: '%', texteFactuel: `Ça représente ${pct} % de ton revenu mensuel.` }
  }
  if (derivationId === 'pct_depenses') {
    if (!enDollars) return kpiResolu
    const dep = depensesMensuelles(snapshot)
    if (!(dep > 0)) return kpiResolu
    const pct = Math.round((kpiResolu.valeur / dep) * 100)
    return { ...kpiResolu, valeur: pct, unite: '%', texteFactuel: `Ça représente ${pct} % de tes dépenses du mois.` }
  }
  return kpiResolu
}

/** Les dérivées OFFERTES pour un KPI dans une forme donnée (data-aware) : 'brut'
 *  toujours ; 'pct_revenu' seulement sur une forme scalaire, un KPI en $ résolu,
 *  et un revenu connu > 0. PUR. */
export function derivationsPourKPI(kpiId, snapshot, forme) {
  const out = ['brut']
  if (!FORMES_SCALAIRES.has(forme)) return out
  const r = resolveKPI(kpiId, snapshot)
  if (!r || !r.disponible || r.unite !== '$') return out
  if (revenuMensuel(snapshot) > 0) out.push('pct_revenu')
  // « % de tes dépenses » : seulement pour un poste de DÉPENSE (domaine budget) — pas
  // pour une épargne/un patrimoine (part-des-dépenses n'y aurait pas de sens).
  const def = kpiPourId(kpiId)
  if (def && def.domaine === 'budget' && depensesMensuelles(snapshot) > 0) out.push('pct_depenses')
  return out
}
