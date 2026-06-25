/* ============================================================================
   AnatomieDollar.jsx — « où va chaque dollar gagné » : anneau du revenu BRUT
   réparti en impôts, cotisations, dépenses, épargne, solde libre. SVG fait main.
   props : params { centre } · data { brut, net, segments:[{label,montant,couleur}] }
   ========================================================================== */
import { formatCAD, formatPct } from '../lib/format.js'

function arcPath(cx, cy, r, a0, a1, large) {
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export default function AnatomieDollar({ params = {}, data = {} }) {
  const segs = (Array.isArray(data.segments) ? data.segments : []).filter((s) => Number(s.montant) > 0)
  const brut = Number(data.brut) || segs.reduce((s, x) => s + (Number(x.montant) || 0), 0)
  const net = Number(data.net) || 0
  const centre = typeof params.centre === 'string' ? params.centre : 'brut / an'

  const cx = 90, cy = 90, r = 66, sw = 26
  const seul = segs.length === 1
  let a = -Math.PI / 2
  const arcs = brut > 0
    ? segs.map((s, i) => {
        const frac = (Number(s.montant) || 0) / brut
        const a0 = a
        const a1 = a + frac * Math.PI * 2
        a = a1
        const large = a1 - a0 > Math.PI ? 1 : 0
        return { key: i, couleur: s.couleur, full: seul, d: arcPath(cx, cy, r, a0, Math.max(a0 + 0.001, a1 - 0.02), large) }
      })
    : []

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 4" />
        </svg>
        L&rsquo;anatomie de ton dollar
      </div>
      <p className="card-sub">Où va chaque dollar gagné, avant qu&rsquo;il arrive dans ta poche.</p>

      <div className="bgt-corps">
        <svg className="bgt-svg" viewBox="0 0 180 180" role="img" aria-label="Répartition du revenu brut">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f8" strokeWidth={sw} />
          {arcs.map((s) =>
            s.full ? (
              <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.couleur} strokeWidth={sw} />
            ) : (
              <path key={s.key} d={s.d} fill="none" stroke={s.couleur} strokeWidth={sw} strokeLinecap="butt" />
            ),
          )}
          <text x={cx} y={cy - 3} textAnchor="middle" className="bgt-centre-n">{formatCAD(brut)}</text>
          <text x={cx} y={cy + 15} textAnchor="middle" className="bgt-centre-l">{centre}</text>
        </svg>

        <ul className="bgt-legende">
          {segs.map((s, i) => (
            <li key={i}>
              <span className="bgt-pt" style={{ background: s.couleur }} />
              <span className="bgt-lbl">{s.label}</span>
              <b>{formatCAD(s.montant)}</b>
              <span className="ana-pct">{brut > 0 ? formatPct((s.montant / brut) * 100) : '—'}</span>
            </li>
          ))}
        </ul>
      </div>
      {net > 0 && <p className="ana-net">Il te reste <b>{formatCAD(net)}</b> net dans ta poche.</p>}
    </section>
  )
}
