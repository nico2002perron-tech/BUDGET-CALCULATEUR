/* ============================================================================
   derivations.js — L'ATELIER DE COMPOSITION (B5), première pierre : une DÉRIVÉE
   BORNÉE transforme la valeur résolue d'un KPI en une autre LECTURE factuelle
   (« en % de ton revenu »). DÉCLARATIF, jamais une formule libre : un registre
   fermé de transformations, chacune calculée à partir de valeurs QUI EXISTENT
   dans le snapshot (jamais inventée). HONNÊTE : si la dérivée ne s'applique pas
   (mauvaise unité, revenu absent), on rend la valeur D'ORIGINE inchangée. PUR.
   ========================================================================== */
import { resolveKPI } from './bibliotheque-kpis.js'

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// Les formes qui affichent DIRECTEMENT la valeur scalaire du KPI — les seules où
// une dérivée « % » a un sens visuel (une série en $ resterait, elle, en $).
export const FORMES_SCALAIRES = new Set(['stat', 'fait'])

// Le registre FERMÉ. 'brut' = la valeur telle quelle (le défaut, aucune dérivée).
export const DERIVATIONS = [
  { id: 'brut', label: 'Montant' },
  { id: 'pct_revenu', label: 'En % de ton revenu' },
]
const IDS = new Set(DERIVATIONS.map((d) => d.id))
export function derivationValide(id) { return typeof id === 'string' && IDS.has(id) }

// Le revenu mensuel, depuis le snapshot (jamais inventé) — 0 si absent.
function revenuMensuel(snapshot) {
  return num(snapshot && snapshot.depenses && snapshot.depenses.revenu)
}

/** Transforme une résolution scalaire de KPI selon la dérivée. Rend la résolution
 *  D'ORIGINE inchangée si la dérivée ne s'applique pas (unité ≠ $, revenu absent,
 *  valeur non finie) — jamais un chiffre inventé. Texte factuel (à filtrer). PUR. */
export function deriver(derivationId, kpiResolu, snapshot) {
  if (!derivationId || derivationId === 'brut' || !kpiResolu) return kpiResolu
  if (derivationId === 'pct_revenu') {
    if (!kpiResolu.disponible || kpiResolu.unite !== '$' || typeof kpiResolu.valeur !== 'number' || !Number.isFinite(kpiResolu.valeur)) return kpiResolu
    const rev = revenuMensuel(snapshot)
    if (!(rev > 0)) return kpiResolu
    const pct = Math.round((kpiResolu.valeur / rev) * 100)
    return { ...kpiResolu, valeur: pct, unite: '%', texteFactuel: `Ça représente ${pct} % de ton revenu mensuel.` }
  }
  return kpiResolu
}

/** Les dérivées OFFERTES pour un KPI dans une forme donnée (data-aware) : 'brut'
 *  toujours ; 'pct_revenu' seulement sur une forme scalaire, un KPI en $ résolu,
 *  et un revenu connu > 0. PUR. */
export function derivationsPourKPI(kpiId, snapshot, forme) {
  const out = ['brut']
  if (FORMES_SCALAIRES.has(forme)) {
    const r = resolveKPI(kpiId, snapshot)
    if (r && r.disponible && r.unite === '$' && revenuMensuel(snapshot) > 0) out.push('pct_revenu')
  }
  return out
}
