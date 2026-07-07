/* ============================================================================
   Courbe.jsx — bloc `courbe` : la série des 12 mois en AIRE + LIGNE (le
   mouvement de l'année d'un seul trait). Seuil en pointillé, points sous le
   seuil en ambre, séries comparées en lignes grises. Tracé animé à
   l'apparition (patron Jauge : dashoffset), coupé sous prefers-reduced-motion.
   SVG fait main, zéro lib. Données : resolveSerie (snapshot).

   props : params { comparaisons? (structure) } · data { serie, seuil, comparaisons }
           kpi (texteFactuel en sous-titre)
   ========================================================================== */
import { useEffect, useRef } from 'react'
import { MOIS_COURTS, formatCAD } from '../lib/format.js'

const GRIS_SERIES = ['#5A6480', '#8a93a8', '#3e4658']
const AMBER = '#e0a23c'
const MUTED = '#5a6b8c'

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const I_COURBE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" /><path d="M6 15c2.5 0 2.5-6 5-6s2.5 4 5 4 2-5 4-7" strokeLinecap="round" />
  </svg>
)

export default function Courbe({ params = {}, data = {}, kpi = null }) {
  const ligneRef = useRef(null)
  const serie = (Array.isArray(data.serie) ? data.serie : [])
    .slice(0, 12)
    .map((v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0 })
  while (serie.length < 12) serie.push(0)
  const comparaisons = (Array.isArray(data.comparaisons) ? data.comparaisons : [])
    .filter((c) => c && Array.isArray(c.valeurs))
    .map((c, k) => ({ label: c.label || 'repère', couleur: GRIS_SERIES[k % GRIS_SERIES.length], valeurs: c.valeurs.slice(0, 12).map((v) => Math.max(0, Number(v) || 0)) }))
  const reduce = reduceMotion()

  // Tracé de la ligne : dashoffset L → 0 à l'apparition (comme l'arc de la jauge).
  useEffect(() => {
    const el = ligneRef.current
    if (!el || reduce) return
    try {
      const L = el.getTotalLength()
      el.style.transition = 'none' // repartir de L d'un SAUT (sinon le 2e tracé ne rejoue pas)
      el.style.strokeDasharray = String(L)
      el.style.strokeDashoffset = String(L)
      el.getBoundingClientRect()
      el.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)'
      el.style.strokeDashoffset = '0'
    } catch { /* hors navigateur */ }
  }, [reduce, serie.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps -- retracer quand la série change

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card bloc-courbe">
        <div className="card-title">{I_COURBE}Ton année en courbe</div>
        <p className="bloc-vide">Ce graphique s’allume avec tes revenus de saison.</p>
      </section>
    )
  }

  const seuil = Number(data.seuil) || 0
  const cible = Math.max(0, Number(params.cible) || 0) // TON objectif (intention du stepper)
  const plancher = cible > 0 ? cible : seuil
  const enComparaison = comparaisons.length > 0
  const max = Math.max(...serie, ...comparaisons.flatMap((c) => c.valeurs), seuil, cible, 1) * 1.08
  const W = 640, H = 250, padL = 14, padR = 14, top = 16, baseY = 205
  const xDe = (i) => padL + (i + 0.5) * ((W - padL - padR) / 12)
  const yDe = (v) => baseY - (v / max) * (baseY - top)
  const chemin = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xDe(i).toFixed(1)} ${yDe(v).toFixed(1)}`).join(' ')
  const aDesSous = plancher > 0 && serie.some((v) => v < plancher)
  const aAtteint = cible > 0 && serie.some((v) => v >= cible)

  return (
    <section className="card bloc-courbe">
      <div className="card-title">{I_COURBE}Ton année en courbe</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Tes 12 mois en courbe${enComparaison ? `, comparés à ${comparaisons.map((c) => c.label).join(' et ')}` : ''}.`}>
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e7edf6" strokeWidth="1" />
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#cdd6e5" strokeWidth="1.5" />

        {/* l'aire sous TA courbe (teintée de l'accent) */}
        <path
          d={`${chemin(serie)} L ${xDe(11).toFixed(1)} ${baseY} L ${xDe(0).toFixed(1)} ${baseY} Z`}
          style={{ fill: 'color-mix(in srgb, var(--wacc, #00b4d8) 16%, transparent)' }}
        />

        {/* les repères comparés : lignes grises fines */}
        {comparaisons.map((c, k) => (
          <path key={k} d={chemin(c.valeurs)} fill="none" stroke={c.couleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* TA ligne (tracée à l'apparition) + les points */}
        <path ref={ligneRef} d={chemin(serie)} fill="none" style={{ stroke: 'var(--wacc, #00b4d8)' }} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((v, i) => {
          const sous = plancher > 0 && v < plancher
          return (
            <circle key={i} cx={xDe(i)} cy={yDe(v)} r="3.4" style={{ fill: sous ? AMBER : 'var(--wacc, #00b4d8)' }} stroke="#fff" strokeWidth="1.4">
              <title>{`${MOIS_COURTS[i]} · ${formatCAD(v)}${sous ? (cible > 0 ? ' (sous ton objectif)' : ' (sous ton coût de vie)') : ''}`}</title>
            </circle>
          )
        })}

        {seuil > 0 && (
          <>
            <line x1={padL} y1={yDe(seuil)} x2={W - padR} y2={yDe(seuil)} stroke="#0077b6" strokeWidth="2" strokeDasharray="5 5" />
            <text x={padL + 2} y={yDe(seuil) - 6} textAnchor="start" fontSize="11" fontWeight="700" fill="#0077b6" fontFamily="Montserrat">
              coût de vie {formatCAD(seuil)}/mois
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

        {MOIS_COURTS.map((m, i) => (
          <text key={m + i} x={xDe(i)} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {m}
          </text>
        ))}
      </svg>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: 'var(--wacc, #00b4d8)' }} />{enComparaison ? 'cette année' : aAtteint ? 'Objectif atteint' : 'Revenus'}</span>
        {comparaisons.map((c, k) => (
          <span className="it" key={k}><span className="sw" style={{ background: c.couleur }} />{c.label}</span>
        ))}
        {aDesSous && <span className="it"><span className="sw" style={{ background: AMBER }} />{cible > 0 ? 'Sous ton objectif' : 'Sous ton coût de vie'}</span>}
      </div>
    </section>
  )
}
