/* ============================================================================
   personas.js — les IDENTITÉS de la personnalité d'un KPI (données pures).
   Un personnage par catégorie (mascotte) et trois voix (mentor) : des NOMS
   curés — une identité, jamais une évaluation de l'usager. Testable headless
   (check-carre-de-sable.mjs vérifie que tout passe filtrerFait).
   ========================================================================== */

export const MASCOTTES = {
  objectif: 'Le Cap',
  budget: 'Le Compteur',
  coussin: 'Le Gardien',
  saisonnier: 'Le Veilleur',
  impot: 'Le Percepteur',
  patrimoine: 'Le Bâtisseur',
  dette: 'Le Libéré',
}
export const MASCOTTE_REPLI = 'Le Témoin'

export const VOIX_MENTOR = [
  { id: 'prudent', nom: 'Le Prudent' },
  { id: 'stratege', nom: 'La Stratège' },
  { id: 'complice', nom: 'Le Complice' },
]
