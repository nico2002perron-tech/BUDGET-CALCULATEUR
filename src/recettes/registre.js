/* ============================================================================
   registre.js — LE REGISTRE : map type de bloc → composant React.

   « Les blocs ne sont pas les cas » (REGISTRE-BLOCS.md). Ajouter un bloc = une
   ligne ici (additif). Les bornes de params + le résolveur de données + la
   taille (mise en grille) vivent dans schema.js (pur, testable hors React).
   ========================================================================== */
import FluxAnnuel from '../blocs/FluxAnnuel.jsx'
import Jauge from '../blocs/Jauge.jsx'
import Stat from '../blocs/Stat.jsx'
import Fait from '../blocs/Fait.jsx'
import Calendrier from '../blocs/Calendrier.jsx'
import Echeancier from '../blocs/Echeancier.jsx'

export const REGISTRE = {
  flux_annuel: FluxAnnuel,
  jauge: Jauge,
  stat: Stat,
  fait: Fait,
  calendrier: Calendrier,
  echeancier: Echeancier,
}

/** Composant pour un type, ou null si inconnu (→ MoteurRendu l'ignore). */
export function composantPour(type) {
  return Object.prototype.hasOwnProperty.call(REGISTRE, type) ? REGISTRE[type] : null
}
