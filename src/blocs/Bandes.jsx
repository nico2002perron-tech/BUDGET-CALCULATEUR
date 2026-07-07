/* ============================================================================
   Bandes.jsx — bloc `bandes` : la série des 12 mois en barres 2D NETTES.
   Lignes de grille + baseline, seuil (coût de vie) en pointillé, mois sous le
   seuil en ambre (l'exception), séries comparées en barres grises accolées.
   SVG fait main, zéro lib (patron FluxAnnuel). Données : resolveSerie (snapshot).

   props : params { comparaisons? (structure) } · data { serie, seuil, comparaisons }
           kpi (texteFactuel en sous-titre)
   ========================================================================== */
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

const I_BANDES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" /><path d="M7 17V9M12 17V5M17 17v-6" strokeLinecap="round" />
  </svg>
)

export default function Bandes({ params = {}, data = {}, kpi = null }) {
  void params
  const serie = (Array.isArray(data.serie) ? data.serie : [])
    .slice(0, 12)
    .map((v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0 })
  while (serie.length < 12) serie.push(0)
  const comparaisons = (Array.isArray(data.comparaisons) ? data.comparaisons : [])
    .filter((c) => c && Array.isArray(c.valeurs))
    .map((c, k) => ({ label: c.label || 'repère', couleur: GRIS_SERIES[k % GRIS_SERIES.length], valeurs: c.valeurs.slice(0, 12).map((v) => Math.max(0, Number(v) || 0)) }))
  const animer = !reduceMotion()

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card bloc-bandes">
        <div className="card-title">{I_BANDES}Tes mois en bandes</div>
        <p className="bloc-vide">Ce graphique s’allume avec tes revenus de saison.</p>
      </section>
    )
  }

  const seuil = Number(data.seuil) || 0
  const enComparaison = comparaisons.length > 0
  const max = Math.max(...serie, ...comparaisons.flatMap((c) => c.valeurs), seuil, 1) * 1.06
  const W = 640, H = 250, padL = 10, padR = 10, top = 16, baseY = 205
  const slot = (W - padL - padR) / 12
  const nBarres = 1 + comparaisons.length
  const groupeW = slot * 0.66
  const barW = Math.max(2, groupeW / nBarres - (nBarres > 1 ? 1.5 : 0))
  const yDe = (v) => baseY - (v / max) * (baseY - top)
  const aDesSous = seuil > 0 && serie.some((v) => v < seuil)

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
      <div className="card-title">{I_BANDES}Tes mois en bandes</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub">{kpi.texteFactuel}</p> : null}

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Tes 12 mois en barres${enComparaison ? `, comparés à ${comparaisons.map((c) => c.label).join(' et ')}` : ''}.`}>
        {/* grille : 4 niveaux discrets + baseline */}
        {[1, 2, 3, 4].map((i) => {
          const y = baseY - (i / 4) * (baseY - top)
          return <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e7edf6" strokeWidth="1" />
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#cdd6e5" strokeWidth="1.5" />

        {serie.map((v, i) => {
          const sous = seuil > 0 && v < seuil
          const x0 = padL + i * slot + (slot - groupeW) / 2
          return (
            <g key={i}>
              <title>{`${MOIS_COURTS[i]} · ${enComparaison ? 'cette année ' : ''}${formatCAD(v)}${sous ? ' (sous ton coût de vie)' : ''}${comparaisons.map((c) => ` · ${c.label} ${formatCAD(c.valeurs[i] || 0)}`).join('')}`}</title>
              {barre(v, x0, sous ? AMBER : 'var(--wacc, #00b4d8)', `a-${i}`, i * 35)}
              {comparaisons.map((c, k) => barre(c.valeurs[i] || 0, x0 + (k + 1) * (barW + 1.5), c.couleur, `c-${i}-${k}`, i * 35 + 20))}
            </g>
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

        {MOIS_COURTS.map((m, i) => (
          <text key={m + i} x={padL + i * slot + slot / 2} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {m}
          </text>
        ))}
      </svg>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: 'var(--wacc, #00b4d8)' }} />{enComparaison ? 'cette année' : 'Revenus'}</span>
        {comparaisons.map((c, k) => (
          <span className="it" key={k}><span className="sw" style={{ background: c.couleur }} />{c.label}</span>
        ))}
        {aDesSous && <span className="it"><span className="sw" style={{ background: AMBER }} />Sous ton coût de vie</span>}
      </div>
    </section>
  )
}
