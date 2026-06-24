/* ============================================================================
   MoteurRendu.jsx — le moteur de rendu DATA-DRIVEN (REGISTRE-BLOCS.md §3).

   Reçoit une recette + le snapshot. Pour chaque bloc :
     1. (recette validée par schema.js : params bornés, faits filtrés)
     2. trouve le composant via le REGISTRE ;
        → TYPE INCONNU = ignoré PROPREMENT (jamais de crash). Preuve que
          l'architecture data-driven tient.
     3. résout les DONNÉES depuis le SNAPSHOT (schema BLOCS[type].resolve),
        jamais depuis la recette ;
     4. place le bloc selon sa `taille` : `large` → colonne principale,
        `compacte` → colonne de droite (l'agencement est géré par la tour,
        pas par la recette — VISION §7).
   ========================================================================== */
import { validerRecette, BLOCS } from './schema.js'
import { composantPour } from './registre.js'

export default function MoteurRendu({ recette, snapshot }) {
  const r = validerRecette(recette)

  const mains = []
  const sides = []

  r.blocs.forEach((bloc, i) => {
    const Composant = composantPour(bloc.type)

    // Type inconnu (ou non implémenté) → ignoré proprement.
    if (!Composant) {
      if (import.meta.env && import.meta.env.DEV) {
        console.warn(`[MoteurRendu] bloc ignoré (type inconnu) : « ${bloc.type} »`)
      }
      return
    }

    const cfg = BLOCS[bloc.type]
    // Les CHIFFRES viennent du snapshot, jamais de la recette.
    const data = cfg && typeof cfg.resolve === 'function' ? cfg.resolve(snapshot) : {}
    const el = <Composant key={i} params={bloc.params} data={data} />

    if (cfg && cfg.taille === 'compacte') sides.push(el)
    else mains.push(el)
  })

  // Pas de colonne de droite → pleine largeur.
  if (sides.length === 0) return <div className="grid-main">{mains}</div>

  return (
    <div className="grid">
      <div className="grid-main">{mains}</div>
      <div className="grid-side">{sides}</div>
    </div>
  )
}
