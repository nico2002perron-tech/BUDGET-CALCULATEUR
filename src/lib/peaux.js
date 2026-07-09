/* ============================================================================
   peaux.js — LES PEAUX D'UNE CARTE : le « fini » qu'on donne à une tuile
   (Classique / Verre / Mat / Relief). C'est du STYLE seulement — jamais un
   chiffre, jamais un choix de donnée. Chaque peau se teinte de TA couleur
   (--wacc) via le CSS. SOURCE UNIQUE (registre + validation), PUR, testable.
   ========================================================================== */

// L'ordre = l'ordre d'affichage. 'defaut' = le look joufflu actuel (aucune
// classe ajoutée) ; les trois autres posent une classe `peau-<id>`.
export const PEAUX = [
  { id: 'defaut', label: 'Classique' },
  { id: 'verre', label: 'Verre' },
  { id: 'mat', label: 'Mat' },
  { id: 'relief', label: 'Relief' },
]

const IDS = new Set(PEAUX.map((p) => p.id))

/** Un id de peau connu ? (un silo importé hostile ne pose jamais une classe folle) */
export function peauValide(id) {
  return typeof id === 'string' && IDS.has(id)
}

/** La classe CSS de la peau, ou '' (defaut/absente/inconnue → le look de base). PUR. */
export function classePeau(id) {
  return peauValide(id) && id !== 'defaut' ? `peau-${id}` : ''
}
