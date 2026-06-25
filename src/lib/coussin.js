/* ============================================================================
   coussin.js — fonds d'urgence : convertit un MONTANT ponctuel en « X mois de
   dépenses essentielles couverts », le situe dans une zone, et donne les repères
   3 et 6 mois. Logique reprise de l'ancien budget.js (emergencyHealth), réécrite
   pure. RÈGLE : le coussin est un montant PONCTUEL, jamais multiplié par 12.
   Faits seulement : on situe, on ne juge pas.
   ========================================================================== */

export const ECHELLE_MOIS = 7 // l'axe de la jauge va de 0 à 7 mois
export const SEUILS = [1, 3, 6] // bornes des zones (faible / moyen / repère / plus)

/** Nombre de mois de dépenses essentielles couverts (null si pas d'essentielles). */
export function moisCouverts(montant, essentielles) {
  const m = Math.max(0, Number(montant) || 0)
  const e = Math.max(0, Number(essentielles) || 0)
  if (e <= 0) return null
  return m / e
}

/** Zone d'un nombre de mois : 'vide' | 'faible' | 'moyen' | 'repere' | 'plus'. */
export function zoneDe(mois) {
  if (mois == null || !isFinite(mois)) return 'vide'
  if (mois < SEUILS[0]) return 'faible'
  if (mois < SEUILS[1]) return 'moyen'
  if (mois < SEUILS[2]) return 'repere'
  return 'plus'
}

/** Repères 3 et 6 mois en dollars. */
export function cibles(essentielles) {
  const e = Math.max(0, Number(essentielles) || 0)
  return { cible3: Math.round(e * 3), cible6: Math.round(e * 6) }
}

/** Position du curseur sur l'axe 0-ECHELLE_MOIS, en % (borné 0-100). */
export function positionPct(mois) {
  if (mois == null || !isFinite(mois)) return 0
  return Math.min(100, Math.max(0, (mois / ECHELLE_MOIS) * 100))
}
