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

/** Formate la VALEUR d'un KPI selon son unité (pour les blocs-formes génériques).
 *  valeur absente/non finie → « — » (jamais un faux chiffre). */
export function formatKPI(valeur, unite) {
  if (valeur == null || typeof valeur === 'object' || (typeof valeur === 'number' && !isFinite(valeur))) return '—'
  switch (unite) {
    case '$': return formatCAD(valeur)
    case '$/mois': return formatCAD(valeur) + '/mois'
    case '%': return formatPct(valeur)
    case 'mois': return `${Number(valeur).toFixed(Number.isInteger(Number(valeur)) ? 0 : 1).replace('.', ',')} mois`
    case 'jour': return `${Math.round(Number(valeur))}`
    case 'jours': return `${Math.round(Number(valeur))} jours`
    case 'x': return `${Number(valeur).toFixed(1).replace('.', ',')} ×`
    default: return typeof valeur === 'number' ? formatNombre(valeur) : String(valeur)
  }
}

/** Nom du mois court (index 0-11), même table que la maquette. */
export const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
