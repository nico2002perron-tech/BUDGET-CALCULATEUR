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
import Solde from '../blocs/Solde.jsx'
import Repartition from '../blocs/Repartition.jsx'
import Beignet from '../blocs/Beignet.jsx'
import BarreEmpilee from '../blocs/BarreEmpilee.jsx'
import CoussinUrgence from '../blocs/CoussinUrgence.jsx'
import AnatomieDollar from '../blocs/AnatomieDollar.jsx'
import ImpotPalier from '../blocs/ImpotPalier.jsx'
import PatrimoineVie from '../blocs/PatrimoineVie.jsx'
import Horizon from '../blocs/Horizon.jsx'
import Composition from '../blocs/Composition.jsx'
import Chaine from '../blocs/Chaine.jsx'
import BarreProgression from '../blocs/BarreProgression.jsx'
import Chronologie from '../blocs/Chronologie.jsx'
import Liste from '../blocs/Liste.jsx'
import CarteEntite from '../blocs/CarteEntite.jsx'
import Comparaison from '../blocs/Comparaison.jsx'
import Prisme3D from '../blocs/Prisme3D.jsx'
import Bandes from '../blocs/Bandes.jsx'
import Courbe from '../blocs/Courbe.jsx'
import Nuage from '../blocs/Nuage.jsx'

export const REGISTRE = {
  flux_annuel: FluxAnnuel,
  jauge: Jauge,
  stat: Stat,
  fait: Fait,
  calendrier: Calendrier,
  echeancier: Echeancier,
  solde: Solde,
  repartition: Repartition,
  beignet: Beignet,
  barre_empilee: BarreEmpilee,
  coussin_urgence: CoussinUrgence,
  anatomie_dollar: AnatomieDollar,
  impot_palier: ImpotPalier,
  patrimoine_vie: PatrimoineVie,
  horizon: Horizon,
  composition: Composition,
  chaine: Chaine,
  barre_progression: BarreProgression,
  chronologie: Chronologie,
  liste: Liste,
  carte_entite: CarteEntite,
  comparaison: Comparaison,
  prisme3d: Prisme3D,
  bandes: Bandes,
  courbe: Courbe,
  nuage: Nuage,
}

/** Composant pour un type, ou null si inconnu (→ MoteurRendu l'ignore). */
export function composantPour(type) {
  return Object.prototype.hasOwnProperty.call(REGISTRE, type) ? REGISTRE[type] : null
}
