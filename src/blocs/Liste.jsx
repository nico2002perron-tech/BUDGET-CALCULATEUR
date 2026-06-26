/* ============================================================================
   Liste.jsx — éléments itemisés (taille compacte). Angle ALTERNATIF de « où va
   l'argent » (et, plus tard, dettes / abonnements). Les items viennent du snapshot
   via resolve (jamais inventés). Faits seulement.
   props : params { titre } · data { items:[{libelle, montant, meta}] }
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

const I = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)

export default function Liste({ params = {}, data = {} }) {
  const items = Array.isArray(data.items) ? data.items : []
  const titre = params.titre || 'Le détail'

  return (
    <section className="card liste">
      <div className="card-title">{I}{titre}</div>
      {items.length === 0 ? (
        <p className="bloc-vide">Rien à lister pour l’instant.</p>
      ) : (
        <ul className="liste-ul">
          {items.map((it, i) => (
            <li className="liste-li" key={i}>
              <span className="liste-lib">{it.libelle}</span>
              {it.meta && <span className="liste-meta">{it.meta}</span>}
              <span className="liste-montant">{formatCAD(it.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
