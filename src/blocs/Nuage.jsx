/* ============================================================================
   Nuage.jsx — bloc `nuage` : une série en NUAGE DE BULLES (les 12 mois du
   snapshot, ou la série de la famille du KPI via serieDuKPI). x = la position
   (axe discret), y = la valeur, taille de bulle ∝ la valeur — le poids de
   chaque point saute aux yeux. Seuil en pointillé, bulles sous le seuil en
   ambre. Les séries comparées ne s'y affichent pas (une bulle par point : ce
   nuage lit UNE série ; bandes/courbe portent la comparaison).
   SVG fait main, zéro lib.

   props : params {} · data (contrat normaliserSerie) · kpi (texteFactuel)
   ========================================================================== */
import { formatCAD } from '../lib/format.js'
import { normaliserSerie, majuscule, etiquetteCourte } from '../lib/serie.js'

const AMBER = '#e0a23c'
const MUTED = '#5a6b8c'

const I_NUAGE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7" cy="15" r="2.4" /><circle cx="13" cy="8" r="3.2" /><circle cx="18" cy="15.5" r="1.8" />
  </svg>
)

export default function Nuage({ params = {}, data = {}, kpi = null }) {
  const S = normaliserSerie(data)
  const serie = S.valeurs
  const labels = S.labels
  const titre = S.titreBase ? `${S.titreBase}, en nuage` : 'Ton année en nuage'

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card bloc-nuage">
        <div className="card-title">{I_NUAGE}{titre}</div>
        <p className="bloc-vide">{S.titreBase ? 'Ce graphique s’allume avec tes vraies données.' : 'Ce graphique s’allume avec tes revenus de saison.'}</p>
      </section>
    )
  }

  const seuil = S.seuil
  const cible = Math.max(0, Number(params.cible) || 0) // TON objectif (intention du stepper)
  const plancher = cible > 0 ? cible : seuil
  const max = Math.max(...serie, seuil, cible, 1) * 1.1
  const W = 640, H = 250, padL = 14, padR = 14, top = 24, baseY = 205
  const xDe = (i) => padL + (i + 0.5) * ((W - padL - padR) / serie.length)
  const maxChars = Math.max(3, Math.floor((W - padL - padR) / serie.length / 6.5))
  const yDe = (v) => baseY - (v / max) * (baseY - top)
  const rDe = (v) => (v > 0 ? 4 + Math.sqrt(v / max) * 13 : 2.5)
  const aDesSous = plancher > 0 && serie.some((v) => v < plancher)
  const aAtteint = cible > 0 && serie.some((v) => v >= cible)

  return (
    <section className="card bloc-nuage">
      <div className="card-title">{I_NUAGE}{titre}</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${S.titreBase ? `${S.titreBase} — ${serie.length} valeurs` : 'Tes 12 mois'} en bulles — plus la valeur pèse, plus la bulle est grosse.`}>
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e7edf6" strokeWidth="1" />
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#cdd6e5" strokeWidth="1.5" />

        {seuil > 0 && (
          <>
            <line x1={padL} y1={yDe(seuil)} x2={W - padR} y2={yDe(seuil)} stroke="#0077b6" strokeWidth="2" strokeDasharray="5 5" />
            <text x={padL + 2} y={yDe(seuil) - 6} textAnchor="start" fontSize="11" fontWeight="700" fill="#0077b6" fontFamily="Montserrat">
              {S.seuilTexte}
            </text>
          </>
        )}
        {cible > 0 && (
          <>
            <line x1={padL} y1={yDe(cible)} x2={W - padR} y2={yDe(cible)} stroke={AMBER} strokeWidth="2" strokeDasharray="6 4" />
            <text x={W - padR - 2} y={yDe(cible) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill="#b8740a" fontFamily="Montserrat">
              objectif {formatCAD(cible)}/mois
            </text>
          </>
        )}

        {serie.map((v, i) => {
          const sous = plancher > 0 && v < plancher
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
              <title>{`${labels[i]} · ${formatCAD(v)}${sous ? (cible > 0 ? ' (sous ton objectif)' : ` (${S.sousTexte})`) : ''}`}</title>
            </circle>
          )
        })}

        {labels.map((m, i) => (
          <text key={m + i} x={xDe(i)} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {etiquetteCourte(m, maxChars)}
          </text>
        ))}
      </svg>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: 'var(--wacc, #00b4d8)' }} />{aAtteint ? 'Objectif atteint (taille = poids du mois)' : S.titreBase ? `${S.legende} (taille = poids)` : 'Revenus (taille = poids du mois)'}</span>
        {aDesSous && <span className="it"><span className="sw" style={{ background: AMBER }} />{cible > 0 ? 'Sous ton objectif' : majuscule(S.sousTexte)}</span>}
      </div>
    </section>
  )
}
