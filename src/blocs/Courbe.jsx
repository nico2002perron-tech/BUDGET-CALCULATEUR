/* ============================================================================
   Courbe.jsx — bloc `courbe` : une série en AIRE + LIGNE (le mouvement d'un
   seul trait — les 12 mois du snapshot, ou la série de la famille du KPI via
   serieDuKPI : projection par âge, coussin projeté…). Seuil en pointillé,
   points sous le seuil en ambre, séries comparées en lignes grises. Tracé
   animé à l'apparition (patron Jauge : dashoffset), coupé sous
   prefers-reduced-motion. SVG fait main, zéro lib.

   props : params { comparaisons? (structure) } · data (contrat normaliserSerie)
           kpi (texteFactuel en sous-titre)
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { formatCAD } from '../lib/format.js'
import { normaliserSerie, majuscule, etiquetteCourte, abregerMontant } from '../lib/serie.js'
import { useSelection, InfoBulle, lignesComparees, BoutonRejouer } from './_interaction.jsx'
import { sons } from '../lib/sons.js'

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
  const sel = useSelection() // le survol vivant (hover + tap projecteur)
  const [prise, setPrise] = useState(0) // Rejouer : remonte le svg (la ligne se retrace)
  const S = normaliserSerie(data)
  const serie = S.valeurs
  const labels = S.labels
  const titre = S.titreBase ? `${S.titreBase}, en courbe` : 'Ton année en courbe'
  const comparaisons = (Array.isArray(data.comparaisons) ? data.comparaisons : [])
    .filter((c) => c && Array.isArray(c.valeurs))
    .map((c, k) => ({ label: c.label || 'repère', couleur: GRIS_SERIES[k % GRIS_SERIES.length], valeurs: c.valeurs.slice(0, serie.length).map((v) => Math.max(0, Number(v) || 0)) }))
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
  }, [reduce, prise, serie.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps -- retracer quand la série change OU au Rejouer (svg re-keyé = path neuf)

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card bloc-courbe">
        <div className="card-title">{I_COURBE}{titre}</div>
        <p className="bloc-vide">{S.titreBase ? 'Ce graphique s’allume avec tes vraies données.' : 'Ce graphique s’allume avec tes revenus de saison.'}</p>
      </section>
    )
  }

  const seuil = S.seuil
  const cible = Math.max(0, Number(params.cible) || 0) // TON objectif (intention du stepper)
  const plancher = cible > 0 ? cible : seuil
  const enComparaison = comparaisons.length > 0
  const max = Math.max(...serie, ...comparaisons.flatMap((c) => c.valeurs), seuil, cible, 1) * 1.08
  const W = 640, H = 250, padL = 14, padR = 14, top = 16, baseY = 205
  const xDe = (i) => padL + (i + 0.5) * ((W - padL - padR) / serie.length)
  const maxChars = Math.max(3, Math.floor((W - padL - padR) / serie.length / 6.5))
  const yDe = (v) => baseY - (v / max) * (baseY - top)
  const chemin = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xDe(i).toFixed(1)} ${yDe(v).toFixed(1)}`).join(' ')
  const aDesSous = plancher > 0 && serie.some((v) => v < plancher)
  const aAtteint = cible > 0 && serie.some((v) => v >= cible)

  return (
    <section className="card bloc-courbe">
      <div className="card-title">{I_COURBE}{titre}{!reduce && <BoutonRejouer onClick={() => setPrise((p) => p + 1)} />}</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <div className="graf-zone">
      <svg key={prise} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${S.titreBase ? `${S.titreBase} — ${serie.length} valeurs` : 'Tes 12 mois'} en courbe${enComparaison ? `, comparés à ${comparaisons.map((c) => c.label).join(' et ')}` : ''}.`}>
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          const colle = (seuil > 0 && Math.abs(y - yDe(seuil)) < 13) || (cible > 0 && Math.abs(y - yDe(cible)) < 13)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e7edf6" strokeWidth="1" />
              {!colle && (
                <text x={padL + 2} y={y - 4} textAnchor="start" fontSize="9" fontWeight="600" fill="#9aa8c0" fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
                  {abregerMontant(max * (i / 4))}
                </text>
              )}
            </g>
          )
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#cdd6e5" strokeWidth="1.5" />

        {/* la ligne-guide de la valeur regardée (sous la courbe) */}
        {sel.actif != null && (
          <line className="graf-guide" x1={xDe(sel.actif)} y1={top} x2={xDe(sel.actif)} y2={baseY} />
        )}

        {/* l'aire sous TA courbe (teintée de l'accent) */}
        <path
          d={`${chemin(serie)} L ${xDe(serie.length - 1).toFixed(1)} ${baseY} L ${xDe(0).toFixed(1)} ${baseY} Z`}
          style={{ fill: 'color-mix(in srgb, var(--wacc, #00b4d8) 16%, transparent)' }}
        />

        {/* les repères comparés : lignes grises fines */}
        {comparaisons.map((c, k) => (
          <path key={k} d={chemin(c.valeurs)} fill="none" stroke={c.couleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* TA ligne (tracée à l'apparition, halo doux via CSS) + les points */}
        <path ref={ligneRef} className="crb-ligne" d={chemin(serie)} fill="none" style={{ stroke: 'var(--wacc, #00b4d8)' }} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {/* la valeur du POINT FINAL (là où la trajectoire aboutit) — retirée si
            elle entrerait en collision avec l'étiquette de la cible */}
        {(cible <= 0 || Math.abs(yDe(serie[serie.length - 1]) - yDe(cible)) > 18) && (
          <text
            x={Math.min(xDe(serie.length - 1) + 4, W - padR - 2)}
            y={Math.max(12, yDe(serie[serie.length - 1]) - 12)}
            textAnchor="end"
            fontSize="11"
            fontWeight="800"
            style={{ fill: 'var(--wacc, #00b4d8)' }}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          >
            {formatCAD(serie[serie.length - 1])}
          </text>
        )}
        {sel.actif != null && (
          <circle cx={xDe(sel.actif)} cy={yDe(serie[sel.actif])} r="9" style={{ fill: 'color-mix(in srgb, var(--wacc, #00b4d8) 18%, transparent)', stroke: 'var(--wacc, #00b4d8)' }} strokeWidth="1" />
        )}
        {serie.map((v, i) => {
          const sous = plancher > 0 && v < plancher
          return (
            <circle
              key={i}
              className={`crb-pt${sel.actif === i ? ' est-vise' : ''}${sel.actif != null && sel.actif !== i ? ' est-eteint' : ''}`}
              cx={xDe(i)}
              cy={yDe(v)}
              r={sel.actif === i ? 5.2 : 3.4}
              style={{ fill: sous ? AMBER : 'var(--wacc, #00b4d8)' }}
              stroke="#fff"
              strokeWidth="1.4"
            />
          )
        })}

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

        {labels.map((m, i) => (
          <text key={m + i} x={xDe(i)} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {etiquetteCourte(m, maxChars)}
          </text>
        ))}

        {/* zones de frappe GÉNÉREUSES (toute la colonne), par-dessus tout */}
        {serie.map((v, i) => (
          <rect
            key={`h-${i}`}
            className="graf-hit"
            x={padL + i * ((W - padL - padR) / serie.length)}
            y={top - 8}
            width={(W - padL - padR) / serie.length}
            height={baseY - top + 12}
            fill="transparent"
            onMouseEnter={() => sel.survole(i)}
            onMouseLeave={sel.quitte}
            onClick={() => { if (sel.bascule(i)) sons.tap() }}
          />
        ))}
      </svg>

      {sel.actif != null && (
        <InfoBulle
          x={xDe(sel.actif) / W}
          y={Math.max(0.14, yDe(serie[sel.actif]) / H)}
          titre={labels[sel.actif]}
          valeur={serie[sel.actif]}
          lignes={lignesComparees(serie[sel.actif], comparaisons, sel.actif)}
          sous={plancher > 0 && serie[sel.actif] < plancher ? (cible > 0 ? 'sous ton objectif' : S.sousTexte) : ''}
        />
      )}
      </div>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: 'var(--wacc, #00b4d8)' }} />{enComparaison ? 'cette année' : aAtteint ? 'Objectif atteint' : S.legende}</span>
        {comparaisons.map((c, k) => (
          <span className="it" key={k}><span className="sw" style={{ background: c.couleur }} />{c.label}</span>
        ))}
        {aDesSous && <span className="it"><span className="sw" style={{ background: AMBER }} />{cible > 0 ? 'Sous ton objectif' : majuscule(S.sousTexte)}</span>}
      </div>
    </section>
  )
}
