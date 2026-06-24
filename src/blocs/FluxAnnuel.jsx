/* ============================================================================
   FluxAnnuel.jsx — LE bloc-signature (REGISTRE-BLOCS §10). L'ÉTALON de qualité.
   Reproduit le bloc « flux annuel » de la maquette validée (tour-saisonnier-v2.html) :
   12 mois, revenus en barres cyan qui poussent à l'apparition, ligne de dépenses
   pointillée, mois déficitaires soulignés en ambre (« couverts par ton coussin »),
   survol d'un mois → lecture FACTUELLE de ce qu'il puise dans le coussin.

   props :
     params : { souligner: 'mois_deficitaires'|'aucun', vue: 'annuel'|'mensuel' }
     data   : { revenus:[12], depenses:number, coussin:number }  ← du snapshot

   Le param `vue:'mensuel'` réduit le MÊME bloc à une vue solde mois-par-mois :
   preuve qu'un « nouveau cas » = un paramètre, pas un nouveau bloc.
   SVG fait main, zéro lib de graphiques. prefers-reduced-motion respecté.
   ========================================================================== */
import { useState } from 'react'
import { MOIS_COURTS, formatCAD } from '../lib/format.js'

const CYAN = '#00b4d8'
const ACCENT = '#0077b6'
const AMBER = '#e0a23c'
const AMBER_SOFT = '#f6e7c9'
const MUTED = '#5a6b8c'

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function fmt(n) {
  return Math.round(n).toLocaleString('fr-CA')
}

/* -------- Vue annuelle : le flux (barres + ligne de dépenses) -------------- */
function Annuel({ revenus, depenses, souligner }) {
  const [hover, setHover] = useState(null)
  const reduce = reduceMotion()

  const W = 640, H = 250, padL = 10, padR = 10, top = 16, baseY = 205, n = 12
  const slot = (W - padL - padR) / n
  const barW = slot * 0.6
  const maxV = Math.max(Math.max(0, ...revenus), depenses) * 1.06 || 1
  const yDep = baseY - (depenses / maxV) * (baseY - top)
  const drawLean = souligner !== 'aucun'

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 13l3-4 3 3 4-6" />
        </svg>
        Ton année en un coup d&rsquo;œil
      </div>
      <p className="card-sub">Survole un mois d&rsquo;hiver pour voir ce qu&rsquo;il puise dans ton coussin.</p>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* mois déficitaires : rectangle ambre cliquable/survolable */}
        {drawLean &&
          revenus.map((r, i) =>
            r < depenses ? (
              <rect
                key={`lean-${i}`}
                x={padL + i * slot + 1}
                y={top}
                width={slot - 2}
                height={baseY - top}
                fill={AMBER_SOFT}
                opacity={hover === i ? 0.8 : 0.5}
                rx="5"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ) : null,
          )}

        {/* barres de revenus (cyan), poussent de baseY → y */}
        {revenus.map((r, i) => {
          const bh = (r / maxV) * (baseY - top)
          const x = padL + i * slot + (slot - barW) / 2
          const y = baseY - bh
          return (
            <rect key={`bar-${i}`} x={x} y={reduce ? y : baseY} width={barW} height={reduce ? bh : 0} rx="4" fill={CYAN}>
              {!reduce && (
                <>
                  <animate attributeName="height" from="0" to={bh} dur="0.7s" begin={`${i * 40}ms`} fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.2 1" keyTimes="0;1" />
                  <animate attributeName="y" from={baseY} to={y} dur="0.7s" begin={`${i * 40}ms`} fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.2 1" keyTimes="0;1" />
                </>
              )}
            </rect>
          )
        })}

        {/* ligne de dépenses pointillée + étiquette (à gauche, au-dessus, sur la
            zone d'hiver vide → aucun chevauchement avec les barres) */}
        <line x1={padL} y1={yDep} x2={W - padR} y2={yDep} stroke={ACCENT} strokeWidth="2" strokeDasharray="5 5" />
        <text x={padL + 2} y={yDep - 8} textAnchor="start" fontSize="11" fontWeight="700" fill={ACCENT} fontFamily="Montserrat">
          dépenses {fmt(depenses)} $/mois
        </text>

        {/* libellés des mois */}
        {MOIS_COURTS.map((m, i) => (
          <text key={`m-${i}`} x={padL + i * slot + slot / 2} y={baseY + 18} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
            {m}
          </text>
        ))}
      </svg>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: CYAN }} />Revenus</span>
        <span className="it"><span className="ln" />Dépenses</span>
        <span className="it"><span className="sw" style={{ background: '#f0d49a' }} />Couvert par ton coussin</span>
      </div>
      <div className="readout">
        {hover != null && revenus[hover] < depenses
          ? `${MOIS_COURTS[hover]} : ce mois puise ≈ ${formatCAD(depenses - revenus[hover])} dans ton coussin.`
          : ''}
      </div>
    </section>
  )
}

/* -------- Vue mensuelle : le MÊME bloc réduit (solde mois-par-mois) -------- */
function Mensuel({ revenus, depenses }) {
  const reduce = reduceMotion()
  const W = 640, H = 240, padL = 10, padR = 10, mid = 118, n = 12
  const slot = (W - padL - padR) / n
  const barW = slot * 0.6
  const maxAbs = Math.max(1, ...revenus.map((r) => Math.abs(r - depenses))) * 1.05

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 13l3-4 3 3 4-6" />
        </svg>
        Ton solde mois par mois
      </div>
      <p className="card-sub">Ce qu&rsquo;il te reste (cyan) ou ce que tu puises dans ton coussin (ambre).</p>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={padL} y1={mid} x2={W - padR} y2={mid} stroke="#cdd6e5" strokeWidth="1.5" />
        {revenus.map((r, i) => {
          const net = r - depenses
          const h = (Math.abs(net) / maxAbs) * 92
          const x = padL + i * slot + (slot - barW) / 2
          const pos = net >= 0
          const y = pos ? mid - h : mid
          const col = pos ? CYAN : AMBER
          return (
            <g key={`mb-${i}`}>
              <rect x={x} y={reduce ? y : mid} width={barW} height={reduce ? h : 0} rx="4" fill={col}>
                {!reduce && (
                  <>
                    <animate attributeName="height" from="0" to={h} dur="0.6s" begin={`${i * 35}ms`} fill="freeze" />
                    <animate attributeName="y" from={mid} to={y} dur="0.6s" begin={`${i * 35}ms`} fill="freeze" />
                  </>
                )}
              </rect>
              <text x={padL + i * slot + slot / 2} y={H - 12} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={MUTED} fontFamily="Montserrat">
                {MOIS_COURTS[i]}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="legend">
        <span className="it"><span className="sw" style={{ background: CYAN }} />Surplus</span>
        <span className="it"><span className="sw" style={{ background: AMBER }} />À puiser dans le coussin</span>
      </div>
    </section>
  )
}

export default function FluxAnnuel({ params = {}, data = {} }) {
  const revenus = Array.isArray(data.revenus) ? data.revenus.slice(0, 12) : []
  const depenses = Number(data.depenses) || 0
  // 12 mois garantis (complète à 0 si la série est plus courte).
  while (revenus.length < 12) revenus.push(0)

  if (params.vue === 'mensuel') return <Mensuel revenus={revenus} depenses={depenses} />
  return <Annuel revenus={revenus} depenses={depenses} souligner={params.souligner || 'mois_deficitaires'} />
}
