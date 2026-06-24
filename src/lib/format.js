/* ============================================================================
   format.js — formats fr-CA partagés. Aligné sur la maquette validée
   (Math.round(n).toLocaleString('fr-CA') + ' $').
   ========================================================================== */

/** Montant en dollars canadiens, sans décimales : 1 234 $ */
export function formatCAD(n) {
  const v = Number(n)
  if (!isFinite(v)) return '—'
  return Math.round(v).toLocaleString('fr-CA') + ' $'
}

/** Nombre fr-CA sans unité (séparateur de milliers). */
export function formatNombre(n) {
  const v = Number(n)
  if (!isFinite(v)) return '—'
  return Math.round(v).toLocaleString('fr-CA')
}

/** Pourcentage entier : 38 % (l'espace insécable est volontaire, norme fr). */
export function formatPct(n) {
  const v = Number(n)
  if (!isFinite(v)) return '—'
  return Math.round(v) + ' %'
}

/** Nom du mois court (index 0-11), même table que la maquette. */
export const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
