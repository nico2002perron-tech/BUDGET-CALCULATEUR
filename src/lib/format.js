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

/** Comme formatKPI, mais DÉCOUPÉE en pièces pour l'affichage « joaillerie » (V1) :
 *  { nombre, unite, suffixe }. L'unité forte ($, %, ×) devient un exposant coloré ;
 *  les mots (mois, jours, /mois) deviennent un suffixe discret. valeur absente →
 *  nombre « — » (jamais un faux chiffre). PURE — aucun DOM, aucun thème. */
export function formatKPIparts(valeur, unite) {
  if (valeur == null || typeof valeur === 'object' || (typeof valeur === 'number' && !isFinite(valeur))) {
    return { nombre: '—', unite: '', suffixe: '' }
  }
  const v = Number(valeur)
  // Une entrée non numérique ne fabrique JAMAIS un « NaN % » (revue nuage V1) :
  // une chaîne-libellé passe telle quelle (l'esprit du défaut de formatKPI), le reste → « — ».
  if (!isFinite(v)) {
    return { nombre: typeof valeur === 'string' && valeur.trim() !== '' ? valeur : '—', unite: '', suffixe: '' }
  }
  switch (unite) {
    case '$': return { nombre: formatNombre(v), unite: '$', suffixe: '' }
    case '$/mois': return { nombre: formatNombre(v), unite: '$', suffixe: '/mois' }
    case '%': return { nombre: String(Math.round(v)), unite: '%', suffixe: '' }
    case 'mois': return { nombre: v.toFixed(Number.isInteger(v) ? 0 : 1).replace('.', ','), unite: '', suffixe: 'mois' }
    case 'jour': return { nombre: String(Math.round(v)), unite: '', suffixe: '' }
    case 'jours': return { nombre: String(Math.round(v)), unite: '', suffixe: 'jours' }
    case 'x': return { nombre: v.toFixed(1).replace('.', ','), unite: '×', suffixe: '' }
    default: return { nombre: formatNombre(v), unite: '', suffixe: '' }
  }
}

/** Nom du mois court (index 0-11), même table que la maquette. */
export const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
