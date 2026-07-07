/* ============================================================================
   Nuage.jsx — bloc `nuage` : la série des 12 mois en NUAGE DE BULLES.
   x = le mois (axe discret), y = la valeur, taille de bulle ∝ la valeur — le
   poids de chaque mois saute aux yeux. Seuil en pointillé, bulles sous le
   seuil en ambre. Les séries comparées ne s'y affichent pas (une bulle par
   mois : ce nuage lit UNE série ; bandes/courbe portent la comparaison).
   SVG fait main, zéro lib. Données : resolveSerie (snapshot).

   props : params {} · data { serie, seuil } · kpi (texteFactuel en sous-titre)
   ========================================================================== */
import { MOIS_COURTS, formatCAD } from '../lib/format.js'

const AMBER = '#e0a23c'
const MUTED = '#5a6b8c'

const I_NUAGE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7" cy="15" r="2.4" /><circle cx="13" cy="8" r="3.2" /><circle cx="18" cy="15.5" r="1.8" />
  </svg>
)

export default function Nuage({ params = {}, data = {}, kpi = null }) {
  void params
  const serie = (Array.isArray(data.serie) ? data.serie : [])
    .slice(0, 12)
    .map((v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0 })
  while (serie.length < 12) serie.push(0)

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card bloc-nuage">
        <div className="card-title">{I_NUAGE}Ton année en nuage</div>
        <p className="bloc-vide">Ce graphique s’allume avec tes revenus de saison.</p>
      </section>
    )
  }

  const seuil = Number(data.seuil) || 0
  const max = Math.max(...serie, seuil, 1) * 1.1
  const W = 640, H = 250, padL = 14, padR = 14, top = 24, baseY = 205
  const xDe = (i) => padL + (i + 0.5) * ((W - padL - padR) / 12)
  const yDe = (v) => baseY - (v / max) * (baseY - top)
  const rDe = (v) => (v > 0 ? 4 + Math.sqrt(v / max) * 13 : 2.5)
  const aDesSous = seuil > 0 && serie.some((v) => v < seuil)

  return (
    <section className="card bloc-nuage">
      <div className="card-title">{I_NUAGE}Ton année en nuage</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Tes 12 mois en bulles — plus le mois pèse, plus la bulle est grosse.">
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e7edf6" strokeWidth="1" />
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#cdd6e5" strokeWidth="1.5" />

        {seuil > 0 && (
          <>
            <line x1={padL} y1={yDe(seuil)} x2={W - padR} y2={yDe(seuil)} stroke="#0077b6" strokeWidth="2" strokeDasharray="5 5" />
            <text x={padL + 2} y={yDe(seuil) - 6} textAnchor="start" fontSize="11" fontWeight="700" fill="#0077b6" fontFamily="Montserrat">
              coût de vie {formatCAD(seuil)}/mois
            </text>
          </>
        )}

        {serie.map((v, i) => {
          const sous = seuil > 0 && v < seuil
          return (
            <circle
              key={i}
              cx={xDe(i)}
              cy={yDe(v)}
              r={rDe(v)}
              style={sous
                ? { fill: 'rgba(224, 162, 60, 0.45)', stroke: AMBER }
                : { fill: 'color-mix(in srgb, var(--wacc, #00b4d8) 45%, transparent)', stroke: 'var(--wacc, #00b4d8)' }}
              strokeWidth="1.6"
            >
              <title>{`${MOIS_COURTS[i]} · ${formatCAD(v)}${sous ? ' (sous ton coût de vie)' : ''}`}</title>
            </circle>
          )
        })}

        {MOIS_COURTS.map((m, i) => (
          <text key={m + i} x={xDe(i)} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {m}
          </text>
        ))}
      </svg>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: 'var(--wacc, #00b4d8)' }} />Revenus (taille = poids du mois)</span>
        {aDesSous && <span className="it"><span className="sw" style={{ background: AMBER }} />Sous ton coût de vie</span>}
      </div>
    </section>
  )
}
