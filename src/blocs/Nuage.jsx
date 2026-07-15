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
import { useId, useState } from 'react'
import { formatCAD } from '../lib/format.js'
import { normaliserSerie, majuscule, etiquetteCourte, abregerMontant } from '../lib/serie.js'
import { useSelection, InfoBulle, BoutonRejouer, reduceMotion } from './_interaction.jsx'
import { sons } from '../lib/sons.js'

const AMBER = '#e0a23c'
const MUTED = '#5a6b8c'

const I_NUAGE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7" cy="15" r="2.4" /><circle cx="13" cy="8" r="3.2" /><circle cx="18" cy="15.5" r="1.8" />
  </svg>
)

export default function Nuage({ params = {}, data = {}, kpi = null, projecteur = false }) {
  const sel = useSelection() // le survol vivant (hover + tap projecteur)
  const gid = useId().replace(/:/g, '') // les deux-points cassent url(#…)
  const [prise, setPrise] = useState(0) // Rejouer : remonte le svg (les billes se reposent)
  const animer = !reduceMotion()
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
      <div className="card-title">{I_NUAGE}{titre}{animer && <BoutonRejouer onClick={() => { setPrise((p) => p + 1); sel.libere() }} />}</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <div className="graf-zone">
      <svg key={prise} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${S.titreBase ? `${S.titreBase} — ${serie.length} valeurs` : 'Tes 12 mois'} en bulles — plus la valeur pèse, plus la bulle est grosse.`}>
        <defs>
          {/* le reflet des billes : un éclat en haut-gauche, l'accent en masse */}
          <radialGradient id={`nug-${gid}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" style={{ stopColor: '#ffffff', stopOpacity: 0.6 }} />
            <stop offset="0.4" style={{ stopColor: 'var(--wacc, #00b4d8)', stopOpacity: 0.5 }} />
            <stop offset="1" style={{ stopColor: 'var(--wacc, #00b4d8)', stopOpacity: 0.82 }} />
          </radialGradient>
        </defs>
        {/* la ligne-guide de la valeur regardée */}
        {sel.actif != null && sel.actif < serie.length && (
          <line className="graf-guide" x1={xDe(sel.actif)} y1={top} x2={xDe(sel.actif)} y2={baseY} />
        )}
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          const colle = (seuil > 0 && Math.abs(y - yDe(seuil)) < 13) || (cible > 0 && Math.abs(y - yDe(cible)) < 13)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line-fort)" strokeWidth="1" />
              {!colle && (
                <text x={padL + 2} y={y - 4} textAnchor="start" fontSize="9" fontWeight="600" fill="var(--muted)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
                  {abregerMontant(max * (i / 4))}
                </text>
              )}
            </g>
          )
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="var(--line-fort)" strokeWidth="1.5" />

        {seuil > 0 && (
          <>
            <line x1={padL} y1={yDe(seuil)} x2={W - padR} y2={yDe(seuil)} stroke="var(--acc)" strokeWidth="2" strokeDasharray="5 5" />
            <text x={padL + 2} y={yDe(seuil) - 6} textAnchor="start" fontSize="11" fontWeight="700" fill="var(--acc)" fontFamily="Montserrat">
              {S.seuilTexte}
            </text>
          </>
        )}
        {cible > 0 && (
          <>
            <line x1={padL} y1={yDe(cible)} x2={W - padR} y2={yDe(cible)} stroke={AMBER} strokeWidth="2" strokeDasharray="6 4" />
            <text x={W - padR - 2} y={yDe(cible) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--amber-fort)" fontFamily="Montserrat">
              objectif {formatCAD(cible)}/mois
            </text>
          </>
        )}

        {serie.map((v, i) => {
          const sous = plancher > 0 && v < plancher
          return (
            <circle
              key={i}
              className={`nug-b${sel.actif === i ? ' est-vise' : ''}${sel.actif != null && sel.actif !== i ? ' est-eteint' : ''}`}
              cx={xDe(i)}
              cy={yDe(v)}
              r={sel.actif === i ? rDe(v) * 1.15 : rDe(v)}
              style={sous
                ? { fill: 'rgba(224, 162, 60, 0.45)', stroke: AMBER, '--i': i }
                : { fill: `url(#nug-${gid})`, stroke: 'var(--wacc, #00b4d8)', '--i': i }}
              strokeWidth="1.6"
            />
          )
        })}
        {/* l'anneau de la bulle regardée */}
        {sel.actif != null && sel.actif < serie.length && (
          <circle
            cx={xDe(sel.actif)}
            cy={yDe(serie[sel.actif])}
            r={rDe(serie[sel.actif]) * 1.15 + 5}
            fill="none"
            style={{ stroke: serie[sel.actif] < plancher && plancher > 0 ? AMBER : 'var(--wacc, #00b4d8)' }}
            strokeWidth="1.4"
            strokeDasharray="3 4"
          />
        )}

        {labels.map((m, i) => (
          <text key={m + i} x={xDe(i)} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {etiquetteCourte(m, maxChars)}
          </text>
        ))}

        {/* zones de frappe GÉNÉREUSES (toute la colonne), par-dessus tout —
            le tap-projecteur et le clavier n'existent que dans le sable */}
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
            onClick={() => { if (projecteur && sel.bascule(i)) sons.tap() }}
            {...(projecteur ? {
              tabIndex: 0,
              role: 'button',
              'aria-label': `${labels[i]} · ${formatCAD(v)}`,
              'aria-pressed': sel.fige && sel.actif === i,
              onFocus: () => sel.survole(i),
              onBlur: sel.quitte,
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (sel.bascule(i)) sons.tap() } },
            } : {})}
          />
        ))}
      </svg>

      {sel.actif != null && sel.actif < serie.length && (
        <InfoBulle
          key={sel.actif}
          x={xDe(sel.actif) / W}
          y={Math.max(0.14, yDe(serie[sel.actif]) / H)}
          titre={labels[sel.actif]}
          valeur={serie[sel.actif]}
          sous={plancher > 0 && serie[sel.actif] < plancher ? (cible > 0 ? 'sous ton objectif' : S.sousTexte) : ''}
        />
      )}
      </div>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: 'var(--wacc, #00b4d8)' }} />{aAtteint ? 'Objectif atteint (taille = poids du mois)' : S.titreBase ? `${S.legende} (taille = poids)` : 'Revenus (taille = poids du mois)'}</span>
        {aDesSous && <span className="it"><span className="sw" style={{ background: AMBER }} />{cible > 0 ? 'Sous ton objectif' : majuscule(S.sousTexte)}</span>}
      </div>
    </section>
  )
}
