/* ============================================================================
   GlypheForme.jsx — le MINI-APERÇU d'un type de graphique : un petit dessin
   SVG qui dit d'un coup d'œil la FORME (bandes, courbe, nuage, beignet, relief…)
   sans recalculer aucune donnée. Purement présentationnel : `currentColor` →
   le glyphe suit la couleur de sa carte (accent au repos, blanc quand active).
   « Voir la forme avant de la choisir » sans monter six graphiques vivants.
   ========================================================================== */

// Chaque glyphe = un archétype de la forme (pas les vraies valeurs — la scène
// vivante s'en charge). viewBox commun 40×28, fill/stroke = currentColor.
const GLYPHES = {
  bandes: (
    <>
      <rect x="4" y="16" width="6" height="10" rx="1.5" opacity="0.85" />
      <rect x="13" y="9" width="6" height="17" rx="1.5" />
      <rect x="22" y="13" width="6" height="13" rx="1.5" opacity="0.85" />
      <rect x="31" y="4" width="6" height="22" rx="1.5" />
    </>
  ),
  courbe: (
    <>
      <polyline points="3,22 12,15 21,18 30,7 37,11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="7" r="2.6" />
    </>
  ),
  nuage: (
    <>
      <circle cx="7" cy="20" r="2.3" opacity="0.7" />
      <circle cx="14" cy="12" r="2.3" />
      <circle cx="20" cy="18" r="2.3" opacity="0.85" />
      <circle cx="26" cy="8" r="2.3" />
      <circle cx="31" cy="15" r="2.3" opacity="0.85" />
      <circle cx="36" cy="21" r="2.3" opacity="0.7" />
    </>
  ),
  beignet: (
    <circle cx="20" cy="14" r="9" fill="none" stroke="currentColor" strokeWidth="5.5" strokeDasharray="40 16" strokeLinecap="round" transform="rotate(-90 20 14)" />
  ),
  anneau3d: (
    <>
      <ellipse cx="20" cy="15.5" rx="9.5" ry="8.5" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.35" />
      <path d="M20 7 a9.5 8.5 0 0 1 8.4 12.6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  prisme3d: (
    <>
      <polygon points="20,4 31,10.5 20,17 9,10.5" opacity="0.95" />
      <polygon points="9,10.5 20,17 20,25.5 9,19" opacity="0.55" />
      <polygon points="31,10.5 20,17 20,25.5 31,19" opacity="0.35" />
    </>
  ),
  jauge: (
    <>
      <path d="M6 23 A14 14 0 0 1 34 23" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" opacity="0.32" />
      <path d="M6 23 A14 14 0 0 1 16 9.6" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="20" y1="23" x2="28" y2="14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="23" r="2.4" />
    </>
  ),
  coussin_urgence: (
    <>
      <path d="M6 23 A14 14 0 0 1 34 23" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="11 3.5" opacity="0.7" />
      <line x1="20" y1="23" x2="26" y2="13" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="23" r="2.2" />
    </>
  ),
  barre_progression: (
    <>
      <rect x="4" y="12" width="32" height="8" rx="4" opacity="0.28" />
      <rect x="4" y="12" width="20" height="8" rx="4" />
    </>
  ),
  barre_empilee: (
    <>
      <rect x="15" y="4" width="10" height="6.5" rx="1.5" opacity="0.5" />
      <rect x="15" y="11.5" width="10" height="6" rx="1.5" opacity="0.8" />
      <rect x="15" y="18" width="10" height="6" rx="1.5" />
    </>
  ),
}

// Des formes proches partagent un glyphe (même archétype visuel).
const ALIAS = { flux_annuel: 'bandes', repartition: 'beignet', composition: 'beignet' }

// La forme « chiffre nu » (stat/fait/jauge…) : un bloc-nombre net.
const GLYPHE_STAT = (
  <>
    <rect x="6" y="9" width="21" height="5.5" rx="2.75" />
    <rect x="6" y="18" width="12" height="4" rx="2" opacity="0.6" />
  </>
)

export default function GlypheForme({ forme, className = '' }) {
  const dessin = GLYPHES[forme] || GLYPHES[ALIAS[forme]] || GLYPHE_STAT
  return (
    <svg className={`glyphe${className ? ` ${className}` : ''}`} viewBox="0 0 40 28" fill="currentColor" aria-hidden="true" focusable="false">
      {dessin}
    </svg>
  )
}
