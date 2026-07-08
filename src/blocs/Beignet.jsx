/* ============================================================================
   Beignet.jsx — « où part chaque dollar » en anneau, par catégorie (couleur =
   rôle). SVG fait main, zéro lib. Légende des principaux postes + « Autres ».
   props : params { centre } · data { parCategorie, total, titre?, sous?, centre? }
   ← snapshot.depenses, OU les parts de la famille du KPI (partsDuKPI : segments
   du brut, actifs du patrimoine…) qui apportent alors leurs propres titres.
   ========================================================================== */
import { couleurClasse } from '../lib/depenses.js'
import { formatCAD } from '../lib/format.js'

// `large` (large-arc-flag) est passé par l'appelant et calculé sur l'angle RÉEL
// du segment — pas sur l'angle réduit par le jeu visuel — sinon un secteur juste
// au-dessus de 50 % serait tracé par le petit côté.
function arcPath(cx, cy, r, a0, a1, large) {
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export default function Beignet({ params = {}, data = {} }) {
  const cats = (Array.isArray(data.parCategorie) ? data.parCategorie : []).filter((c) => Number(c.montant) > 0)
  const total = cats.reduce((s, c) => s + (Number(c.montant) || 0), 0)
  const centre = typeof params.centre === 'string' ? params.centre : typeof data.centre === 'string' && data.centre ? data.centre : 'par mois'
  const titre = typeof data.titre === 'string' && data.titre ? data.titre : 'Où part chaque dollar'
  const sous = typeof data.sous === 'string' && data.sous ? data.sous : 'La part de chaque poste dans tes dépenses du mois.'

  const cx = 90, cy = 90, r = 66, sw = 26
  const seul = cats.length === 1 // un seul poste → cercle plein (sinon arcs)
  let a = -Math.PI / 2
  const segs = total > 0
    ? cats.map((c) => {
        const frac = c.montant / total
        const a0 = a
        const a1 = a + frac * Math.PI * 2
        a = a1
        const large = a1 - a0 > Math.PI ? 1 : 0 // sur l'angle RÉEL du segment
        return { id: c.id, couleur: couleurClasse(c.classe), full: seul, d: arcPath(cx, cy, r, a0, Math.max(a0 + 0.001, a1 - 0.02), large) }
      })
    : []

  const top = cats.slice(0, 6)
  const resteMontant = cats.slice(6).reduce((s, c) => s + c.montant, 0)

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.4" />
        </svg>
        {titre}
      </div>
      <p className="card-sub">{sous}</p>

      <div className="bgt-corps">
        <svg className="bgt-svg" viewBox="0 0 180 180" role="img" aria-label={sous}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f8" strokeWidth={sw} />
          {segs.map((s) =>
            s.full ? (
              <circle key={s.id} cx={cx} cy={cy} r={r} fill="none" stroke={s.couleur} strokeWidth={sw} />
            ) : (
              <path key={s.id} d={s.d} fill="none" stroke={s.couleur} strokeWidth={sw} strokeLinecap="butt" />
            ),
          )}
          <text x={cx} y={cy - 3} textAnchor="middle" className="bgt-centre-n">{formatCAD(total)}</text>
          <text x={cx} y={cy + 15} textAnchor="middle" className="bgt-centre-l">{centre}</text>
        </svg>

        <ul className="bgt-legende">
          {top.map((c) => (
            <li key={c.id}>
              <span className="bgt-pt" style={{ background: couleurClasse(c.classe) }} />
              <span className="bgt-lbl">{c.label}</span>
              <b>{formatCAD(c.montant)}</b>
            </li>
          ))}
          {resteMontant > 0 ? (
            <li>
              <span className="bgt-pt" style={{ background: '#cbd5e1' }} />
              <span className="bgt-lbl">Autres</span>
              <b>{formatCAD(resteMontant)}</b>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}
