/* ============================================================================
   historique.js — LE FIL DU TEMPS (K7). Des PHOTOS mensuelles LÉGÈRES des valeurs
   des KPIs → ta VRAIE trajectoire, la tienne. Local (localStorage), inclus dans
   l'export/import. PUR, zéro DOM.

   Une photo = { mois:'AAAA-MM', valeurs:{ kpiId: number } } — seulement des valeurs
   RÉSOLUES et finies (jamais un silo vide). Une par mois (la 1re sauvegarde du mois),
   plafonnée en FIFO. Un KPI retiré du board garde ses vieilles photos (elles
   réapparaissent s'il revient) : on photographie TOUT le registre résoluble.
   ========================================================================== */
import { resolveKPI, REGISTRE_KPIS } from '../recettes/bibliotheque-kpis.js'

export const MAX_PHOTOS = 24 // ~2 ans de photos (quelques centaines d'octets)

/** Le mois du snapshot ('AAAA-MM') — PUR (le « maintenant » = meta.generatedAt). */
export function moisDe(snapshot) {
  const iso = snapshot && snapshot.meta && snapshot.meta.generatedAt
  const d = iso ? new Date(iso) : new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Une photo des valeurs numériques résolues de TOUS les KPIs résolubles ce mois-ci. */
export function capturerPhoto(snapshot, mois) {
  const valeurs = {}
  for (const k of REGISTRE_KPIS) {
    const r = resolveKPI(k.id, snapshot)
    if (r && r.disponible && typeof r.valeur === 'number' && isFinite(r.valeur)) valeurs[k.id] = r.valeur
  }
  return { mois, valeurs }
}

/** Ajoute la photo du mois si elle manque. Retourne le nouvel historique (FIFO
 *  plafonné) ou null si rien à faire (mois déjà pris / aucune valeur résoluble). */
export function ajouterPhoto(historique, snapshot) {
  const hist = Array.isArray(historique) ? historique.filter((p) => p && typeof p.mois === 'string' && p.valeurs) : []
  const mois = moisDe(snapshot)
  if (hist.some((p) => p.mois === mois)) return null
  const photo = capturerPhoto(snapshot, mois)
  if (!Object.keys(photo.valeurs).length) return null
  return [...hist, photo].slice(-MAX_PHOTOS)
}

/** Le delta LONG d'un KPI : depuis la plus VIEILLE photo qui le contient jusqu'à sa
 *  valeur actuelle. { delta, mois, unite } ou null (< 1 photo, valeur absente, écart nul).
 *  Un FAIT (jamais un jugement) — c'est ta trajectoire, pas une note. PUR. */
export function deltaLong(kpiId, historique, snapshot) {
  const hist = (Array.isArray(historique) ? historique : []).filter((p) => p && p.valeurs && typeof p.valeurs[kpiId] === 'number' && isFinite(p.valeurs[kpiId]))
  if (!hist.length) return null
  const r = resolveKPI(kpiId, snapshot)
  if (!r || !r.disponible || typeof r.valeur !== 'number' || !isFinite(r.valeur)) return null
  const vieille = hist.reduce((a, b) => (a.mois <= b.mois ? a : b))
  if (vieille.mois === moisDe(snapshot)) return null // même mois → pas de recul
  const delta = r.valeur - vieille.valeurs[kpiId]
  if (delta === 0) return null
  const [ya, ma] = vieille.mois.split('-').map(Number)
  const [yb, mb] = moisDe(snapshot).split('-').map(Number)
  const nMois = Math.max(1, (yb - ya) * 12 + (mb - ma))
  return { delta, mois: nMois, unite: r.unite || null }
}
