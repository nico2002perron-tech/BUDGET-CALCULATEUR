/* ============================================================================
   Bandes.jsx — bloc `bandes` : une série en barres 2D NETTES (les 12 mois du
   snapshot, ou la série de la famille du KPI via serieDuKPI — postes, âges…).
   Lignes de grille + baseline, seuil en pointillé, valeurs sous le seuil en
   ambre (l'exception), séries comparées en barres grises accolées.
   SVG fait main, zéro lib (patron FluxAnnuel).

   props : params { comparaisons? (structure) } · data (contrat normaliserSerie)
           kpi (texteFactuel en sous-titre)
   ========================================================================== */
import { useId, useState } from 'react'
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

const I_BANDES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" /><path d="M7 17V9M12 17V5M17 17v-6" strokeLinecap="round" />
  </svg>
)

export default function Bandes({ params = {}, data = {}, kpi = null }) {
  const sel = useSelection() // le survol vivant (hover + tap projecteur)
  const gid = useId().replace(/:/g, '') // les deux-points cassent url(#…)
  const [prise, setPrise] = useState(0) // Rejouer : remonte le svg (les barres repoussent)
  const S = normaliserSerie(data)
  const serie = S.valeurs
  const labels = S.labels
  const titre = S.titreBase ? `${S.titreBase}, en bandes` : 'Tes mois en bandes'
  const comparaisons = (Array.isArray(data.comparaisons) ? data.comparaisons : [])
    .filter((c) => c && Array.isArray(c.valeurs))
    .map((c, k) => ({ label: c.label || 'repère', couleur: GRIS_SERIES[k % GRIS_SERIES.length], valeurs: c.valeurs.slice(0, serie.length).map((v) => Math.max(0, Number(v) || 0)) }))
  const animer = !reduceMotion()

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card bloc-bandes">
        <div className="card-title">{I_BANDES}{titre}</div>
        <p className="bloc-vide">{S.titreBase ? 'Ce graphique s’allume avec tes vraies données.' : 'Ce graphique s’allume avec tes revenus de saison.'}</p>
      </section>
    )
  }

  const seuil = S.seuil
  const cible = Math.max(0, Number(params.cible) || 0) // TON objectif (intention du stepper)
  const plancher = cible > 0 ? cible : seuil // posé → l'ambre marque l'objectif, sinon le seuil de la famille
  const enComparaison = comparaisons.length > 0
  const max = Math.max(...serie, ...comparaisons.flatMap((c) => c.valeurs), seuil, cible, 1) * 1.06
  const W = 640, H = 250, padL = 10, padR = 10, top = 16, baseY = 205
  const slot = (W - padL - padR) / serie.length
  const maxChars = Math.max(3, Math.floor(slot / 6.5)) // l'étiquette d'axe tient dans son créneau
  const nBarres = 1 + comparaisons.length
  const groupeW = slot * 0.66
  const barW = Math.max(2, groupeW / nBarres - (nBarres > 1 ? 1.5 : 0))
  const yDe = (v) => baseY - (v / max) * (baseY - top)
  const aDesSous = plancher > 0 && serie.some((v) => v < plancher)
  const aAtteint = cible > 0 && serie.some((v) => v >= cible)

  // `style` et non l'attribut fill : var() n'est pas résolu dans les attributs de
  // présentation SVG hors Chromium (barres noires en Firefox/Safari sinon).
  const barre = (v, x, couleur, cle, delai) => {
    const bh = baseY - yDe(v)
    return (
      <rect key={cle} x={x} y={animer ? baseY : yDe(v)} width={barW} height={animer ? 0 : bh} rx="3" style={{ fill: couleur }}>
        {animer && (
          <>
            <animate attributeName="height" from="0" to={bh} dur="0.6s" begin={`${delai}ms`} fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.2 1" keyTimes="0;1" />
            <animate attributeName="y" from={baseY} to={yDe(v)} dur="0.6s" begin={`${delai}ms`} fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.2 1" keyTimes="0;1" />
          </>
        )}
      </rect>
    )
  }

  return (
    <section className="card bloc-bandes">
      <div className="card-title">{I_BANDES}{titre}{animer && <BoutonRejouer onClick={() => setPrise((p) => p + 1)} />}</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <div className="graf-zone">
      <svg key={prise} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${S.titreBase ? `${S.titreBase} — ${serie.length} valeurs` : 'Tes 12 mois'} en barres${enComparaison ? `, comparés à ${comparaisons.map((c) => c.label).join(' et ')}` : ''}.`}>
        <defs>
          {/* dégradé vertical de TA série (les repères gris et l'ambre restent pleins) */}
          <linearGradient id={`bnd-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--wacc, #00b4d8)' }} />
            <stop offset="1" style={{ stopColor: 'var(--wacc, #00b4d8)', stopOpacity: 0.55 }} />
          </linearGradient>
        </defs>
        {/* grille : 4 niveaux discrets, CHIFFRÉS (l'échelle se lit) + baseline */}
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          const v = max * (i / 4)
          const colle = (seuil > 0 && Math.abs(y - yDe(seuil)) < 13) || (cible > 0 && Math.abs(y - yDe(cible)) < 13)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e7edf6" strokeWidth="1" />
              {!colle && (
                <text x={padL + 2} y={y - 4} textAnchor="start" fontSize="9" fontWeight="600" fill="#9aa8c0" fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
                  {abregerMontant(v)}
                </text>
              )}
            </g>
          )
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#cdd6e5" strokeWidth="1.5" />

        {/* la ligne-guide de la valeur regardée (sous les barres) */}
        {sel.actif != null && (
          <line className="graf-guide" x1={padL + sel.actif * slot + slot / 2} y1={top} x2={padL + sel.actif * slot + slot / 2} y2={baseY} />
        )}

        {serie.map((v, i) => {
          const sous = plancher > 0 && v < plancher
          const x0 = padL + i * slot + (slot - groupeW) / 2
          return (
            <g key={i} className={`bnd-g${sel.actif === i ? ' est-vise' : ''}${sel.actif != null && sel.actif !== i ? ' est-eteint' : ''}`}>
              {barre(v, x0, sous ? AMBER : `url(#bnd-${gid})`, `a-${i}`, i * 35)}
              {comparaisons.map((c, k) => barre(c.valeurs[i] || 0, x0 + (k + 1) * (barW + 1.5), c.couleur, `c-${i}-${k}`, i * 35 + 20))}
            </g>
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
          <text key={m + i} x={padL + i * slot + slot / 2} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {etiquetteCourte(m, maxChars)}
          </text>
        ))}

        {/* zones de frappe GÉNÉREUSES (toute la colonne), par-dessus tout */}
        {serie.map((v, i) => (
          <rect
            key={`h-${i}`}
            className="graf-hit"
            x={padL + i * slot}
            y={top - 8}
            width={slot}
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
          x={(padL + sel.actif * slot + slot / 2) / W}
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
