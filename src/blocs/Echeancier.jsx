/* ============================================================================
   Echeancier.jsx — bloc compact « À venir » : les échéances datées des prochains
   jours (anti-surprise). Lit snapshot.aVenir ({date,type,label,montant}), filtre
   sur params.horizon. Faits seulement.
   props : params { horizon:7|14|30|60|90 } · data { echeances:[…] }  ← snapshot
   ========================================================================== */
import { formatCAD, MOIS_COURTS } from '../lib/format.js'

function joursAvant(iso, base) {
  const p = String(iso || '').split('-')
  if (p.length !== 3) return 9999
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  const t = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  return Math.round((d - t) / 86400000)
}
function libelleJour(iso) {
  const p = String(iso || '').split('-')
  if (p.length !== 3) return ''
  return `${Number(p[2])} ${MOIS_COURTS[Number(p[1]) - 1] || ''}`
}

export default function Echeancier({ params = {}, data = {} }) {
  const horizon = [7, 14, 30, 60, 90].includes(params.horizon) ? params.horizon : 30
  const base = new Date()
  const items = (Array.isArray(data.echeances) ? data.echeances : [])
    .filter((e) => e && e.type === 'sortie')
    .filter((e) => {
      const j = joursAvant(e.date, base)
      return j >= 0 && j <= horizon
    })
    .slice(0, 8)

  return (
    <section className="card ech">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        À venir
      </div>
      <p className="card-sub">Les sorties fixes des {horizon} prochains jours.</p>

      {items.length === 0 ? (
        <p className="ech-vide">Aucune sortie fixe d&rsquo;ici là.</p>
      ) : (
        <ul className="ech-liste">
          {items.map((e, i) => {
            const j = joursAvant(e.date, base)
            return (
              <li className="ech-item" key={i}>
                <span className="ech-date">
                  <b>{libelleJour(e.date)}</b>
                  <span className="ech-dans">{j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : `dans ${j} j`}</span>
                </span>
                <span className="ech-l">{e.label}</span>
                <span className="ech-m">−{formatCAD(e.montant)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
