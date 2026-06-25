/* ============================================================================
   depenses.js — modèle des DÉPENSES (catégories pré-remplies, fixe/variable,
   jour du mois). Repris de l'ancien budget.js (NEED/WANT/SAVE_FIELDS,
   FIXED_CAT_IDS, DEFAULT_PAY_DAYS) puis réécrit propre, sans DOM.

   Une dépense = { id, label, classe, type, montant, jour }
     · classe : 'besoin' | 'envie' | 'epargne'   (le « pourquoi »)
     · type   : 'fixe' | 'variable'               (récurrent daté vs souple)
     · montant: number | null  (null = placeholder, rien d'inventé)
     · jour   : 1-31 | null    (jour du mois pour les fixes ; null si variable)
   ========================================================================== */

export const CLASSES = [
  { id: 'besoin', label: 'Besoins', sous: 'le nécessaire', couleur: '#0077b6' },
  { id: 'envie', label: 'Désirs', sous: 'le plaisir', couleur: '#00b4d8' },
  { id: 'epargne', label: 'Épargne', sous: 'mis de côté', couleur: '#0f8a5f' },
]

/** Couleur d'une classe ('besoin'|'envie'|'epargne'). */
export function couleurClasse(classe) {
  const c = CLASSES.find((x) => x.id === classe)
  return c ? c.couleur : '#5a6b8c'
}

// Catégories pré-remplies (montant null = placeholder ; jour par défaut pour les fixes).
export const CATEGORIES_DEPENSES = [
  { id: 'cat_logement', label: 'Logement', classe: 'besoin', type: 'fixe', montant: null, jour: 1 },
  { id: 'cat_transport', label: 'Transport', classe: 'besoin', type: 'variable', montant: null, jour: null },
  { id: 'cat_alimentation', label: 'Alimentation', classe: 'besoin', type: 'variable', montant: null, jour: null },
  { id: 'cat_protection', label: 'Assurances', classe: 'besoin', type: 'fixe', montant: null, jour: 8 },
  { id: 'cat_dettes_impots', label: 'Dettes & impôts', classe: 'besoin', type: 'fixe', montant: null, jour: 21 },
  { id: 'wcat_sorties', label: 'Sorties & restos', classe: 'envie', type: 'variable', montant: null, jour: null },
  { id: 'wcat_abonnements', label: 'Abonnements', classe: 'envie', type: 'fixe', montant: null, jour: 15 },
  { id: 'wcat_shopping', label: 'Shopping', classe: 'envie', type: 'variable', montant: null, jour: null },
  { id: 'wcat_voyages', label: 'Voyages & loisirs', classe: 'envie', type: 'variable', montant: null, jour: null },
  { id: 'wcat_autres', label: 'Autres', classe: 'envie', type: 'variable', montant: null, jour: null },
  { id: 'fix_epargne', label: 'Épargne (REER, CELI, REEE)', classe: 'epargne', type: 'fixe', montant: null, jour: 1 },
]

// Abonnements rapides (un clic = poste pré-rempli dans les Désirs).
export const ABONNEMENTS_RAPIDES = [
  { id: 'netflix', label: 'Netflix', montant: 17 },
  { id: 'spotify', label: 'Spotify', montant: 11 },
  { id: 'disney', label: 'Disney+', montant: 12 },
  { id: 'apple', label: 'Apple', montant: 13 },
  { id: 'chatgpt', label: 'ChatGPT', montant: 28 },
  { id: 'amazon', label: 'Amazon', montant: 10 },
  { id: 'gym', label: 'Gym', montant: 50 },
]

/** Gabarit de départ : toutes les catégories à 0 (copie, jamais la constante). */
export function depensesParDefaut() {
  return CATEGORIES_DEPENSES.map((c) => ({ ...c }))
}

/** Total mensuel d'une classe ('besoin'|'envie'|'epargne'). */
export function totalClasse(depenses, classe) {
  return (Array.isArray(depenses) ? depenses : [])
    .filter((d) => d && d.classe === classe)
    .reduce((s, d) => s + (Number(d.montant) || 0), 0)
}

/** Coût de vie mensuel = tout SAUF l'épargne (ce qui « part » vraiment). */
export function totalDepensesVie(depenses) {
  return (Array.isArray(depenses) ? depenses : [])
    .filter((d) => d && d.classe !== 'epargne')
    .reduce((s, d) => s + (Number(d.montant) || 0), 0)
}

/** Tout ce qui sort, épargne incluse (pour le calendrier). */
export function totalSorties(depenses) {
  return (Array.isArray(depenses) ? depenses : []).reduce((s, d) => s + (Number(d && d.montant) || 0), 0)
}
