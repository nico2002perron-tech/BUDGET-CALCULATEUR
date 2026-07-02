/* ============================================================================
   iconesGalerie.jsx — les icônes de la Galerie : de vraies lignes SVG (style
   lucide, trait régulier 1.9, coins ronds), JAMAIS d'emoji ni d'image. Chaque
   catégorie a la sienne ; quelques KPIs ont la leur propre pour la variété.
   Toutes en currentColor — la couleur vient de la pastille qui les porte.
   ========================================================================== */

const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const ICONE_DOMAINE = {
  budget: ( // portefeuille
    <svg {...S}><path d="M3 8h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /><path d="M3 8l13-3v3" /><circle cx="16" cy="13.5" r="1.3" /></svg>
  ),
  coussin: ( // bouclier
    <svg {...S}><path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.2-7 8.5-4-1.3-7-4.1-7-8.5V6.1l7-2.6z" /><path d="M9 11.5l2 2 4-4.5" /></svg>
  ),
  saisonnier: ( // vagues
    <svg {...S}><path d="M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /><path d="M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>
  ),
  impot: ( // reçu + pourcentage
    <svg {...S}><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3z" /><path d="M9.5 9.5l5 5" /><circle cx="9.7" cy="9.4" r="1" /><circle cx="14.3" cy="14.6" r="1" /></svg>
  ),
  patrimoine: ( // courbe qui monte
    <svg {...S}><path d="M3 17l6-6 4 4 7-7" /><path d="M17 8h4v4" /></svg>
  ),
}

// Quelques KPIs avec leur icône propre (variété sans zoo) ; repli = l'icône du domaine.
export const ICONE_KPI = {
  solde_mois: (<svg {...S}><circle cx="9" cy="12" r="5.5" /><circle cx="15.5" cy="12" r="5.5" /></svg>), // deux pièces
  mois_couverts: (<svg {...S}><path d="M4 13c0-2.5 2.6-4.5 6-4.5h4c3.4 0 6 2 6 4.5s-2.6 4.5-6 4.5h-4c-3.4 0-6-2-6-4.5z" /><path d="M8 13h.01M12 13h.01M16 13h.01" /></svg>), // coussin
  mois_le_plus_serre: (<svg {...S}><path d="M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" /><path d="M12 4v8M9 9l3 3 3-3" /></svg>), // creux de vague
  patrimoine_retraite: (<svg {...S}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>), // horloge
  valeur_nette: (<svg {...S}><path d="M12 3v18M8 7.5h6.5a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 0 0 5h7" /></svg>), // $
  jour_liberation_fiscale: (<svg {...S}><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>), // calendrier coché
}

export const ICONE_SITUATION = {
  mon_budget: (<svg {...S}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12l6 6" /></svg>), // camembert
  mon_portrait: ICONE_DOMAINE.impot,
  ma_vie: ICONE_DOMAINE.patrimoine,
  revenu_saisonnier: ICONE_DOMAINE.saisonnier,
}

export const I_VEDETTE = (
  <svg {...S}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" /></svg>
)
export const I_ECLAIR = (
  <svg {...S}><path d="M13 2.5L4.5 14H10l-1 7.5L17.5 10H12l1-7.5z" /></svg>
)

/** L'icône d'une carte-indicateur : la sienne, sinon celle de sa catégorie. */
export function iconeKPI(id, domaine) {
  return ICONE_KPI[id] || ICONE_DOMAINE[domaine] || ICONE_DOMAINE.budget
}

/* LE CHOIX D'ICÔNES (créer SON kpi) : une douzaine de lignes claires, tappables
   à l'essayage et à la retouche. `iconeChoisie(id)` → le SVG, ou null. */
export const ICONES_CHOIX = [
  { id: 'portefeuille', svg: ICONE_DOMAINE.budget },
  { id: 'bouclier', svg: ICONE_DOMAINE.coussin },
  { id: 'vagues', svg: ICONE_DOMAINE.saisonnier },
  { id: 'recu', svg: ICONE_DOMAINE.impot },
  { id: 'courbe', svg: ICONE_DOMAINE.patrimoine },
  { id: 'pieces', svg: ICONE_KPI.solde_mois },
  { id: 'coussin', svg: ICONE_KPI.mois_couverts },
  { id: 'cible', svg: (<svg {...S}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>) },
  { id: 'eclair', svg: I_ECLAIR },
  { id: 'etoile', svg: (<svg {...S}><path d="M12 3l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7L12 3z" /></svg>) },
  { id: 'coeur', svg: (<svg {...S}><path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.5 3.6 4.5 6.8 4.5c2 0 3.6 1.1 4.4 2.7.8-1.6 2.4-2.7 4.4-2.7 3.2 0 5.3 3 4.1 6.2C17.5 15.4 12 20 12 20z" /></svg>) },
  { id: 'drapeau', svg: (<svg {...S}><path d="M5 21V4" /><path d="M5 4c4-2 7 2 11 0v9c-4 2-7-2-11 0" /></svg>) },
  { id: 'maison', svg: (<svg {...S}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></svg>) },
  { id: 'soleil', svg: (<svg {...S}><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>) },
]
export function iconeChoisie(id) {
  const c = ICONES_CHOIX.find((x) => x.id === id)
  return c ? c.svg : null
}
