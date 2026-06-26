/* ============================================================================
   PatrimoineVie.jsx — la trajectoire de la valeur nette dans le temps (projectLife
   du twin), avec la ligne de retraite. SVG fait main (axe des âges), survol →
   lecture factuelle. Faits seulement : « à X ans : Y $ ».
   props : params {} · data { annees:[{age, patrimoineNet, isRetired}], retraiteAge }
   ========================================================================== */
import { useState } from 'react'
import { formatCAD } from '../lib/format.js'

const W = 640, H = 250, PAD = 34

export default function PatrimoineVie({ params = {}, data = {} }) {
  void params
  const annees = Array.isArray(data.annees) ? data.annees : []
  const [hover, setHover] = useState(null)

  if (annees.length < 2) {
    return (
      <section className="card">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M19 9l-5 5-3-3-4 4" /></svg>
          Ta valeur nette dans le temps
        </div>
        <p className="bloc-vide">Ajoute ton patrimoine dans « Mes données » pour voir ta trajectoire se dessiner.</p>
      </section>
    )
  }

  const ageMin = annees[0].age
  const ageMax = annees[annees.length - 1].age
  const nets = annees.map((a) => a.patrimoineNet)
  const maxV = Math.max(...nets, 0)
  const minV = Math.min(...nets, 0)
  const spanV = maxV - minV || 1
  const x = (age) => PAD + ((age - ageMin) / ((ageMax - ageMin) || 1)) * (W - 2 * PAD)
  const y = (v) => H - PAD - ((v - minV) / spanV) * (H - 2 * PAD)
  const pts = annees.map((a) => ({ x: x(a.age), y: y(a.patrimoineNet), a }))
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ')
  const yBase = y(minV < 0 ? 0 : minV)
  const area = `M${pts[0].x.toFixed(1)} ${yBase.toFixed(1)} ` + pts.map((p) => 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') + ` L${pts[pts.length - 1].x.toFixed(1)} ${yBase.toFixed(1)} Z`

  const retraiteAge = data.retraiteAge
  const xr = retraiteAge != null && retraiteAge >= ageMin && retraiteAge <= ageMax ? x(retraiteAge) : null
  const zeroY = minV < 0 ? y(0) : null
  const hv = hover != null ? pts[hover] : null

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let best = 0, bd = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - relX)
      if (d < bd) { bd = d; best = i }
    }
    setHover(best)
  }

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M19 9l-5 5-3-3-4 4" /></svg>
        Ta valeur nette dans le temps
      </div>
      <p className="card-sub">La trajectoire projetée de ton patrimoine, selon tes hypothèses.</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="pv-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Valeur nette projetée dans le temps">
        <defs>
          <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0077b6" stopOpacity="0.32" />
            <stop offset="0.5" stopColor="#00b4d8" stopOpacity="0.15" />
            <stop offset="1" stopColor="#00b4d8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pvLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0077b6" />
            <stop offset="1" stopColor="#00b4d8" />
          </linearGradient>
          <filter id="pvGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#00b4d8" floodOpacity="0.30" />
          </filter>
        </defs>
        {zeroY != null && <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#c8d2e0" strokeWidth="1" strokeDasharray="3 4" />}
        <path d={area} fill="url(#pvFill)" />
        <path d={line} fill="none" stroke="url(#pvLine)" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" filter="url(#pvGlow)" />
        {xr != null && (
          <>
            <line x1={xr} y1={PAD - 4} x2={xr} y2={H - PAD} stroke="#0077b6" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={xr} y={PAD - 9} textAnchor="middle" className="pv-jalon">retraite</text>
          </>
        )}
        {hv && (
          <>
            <line x1={hv.x} y1={PAD} x2={hv.x} y2={H - PAD} stroke="#03045e" strokeWidth="1" opacity="0.25" />
            <circle cx={hv.x} cy={hv.y} r="4.5" fill="#fff" stroke="#00b4d8" strokeWidth="2.5" />
          </>
        )}
      </svg>

      <div className="pv-readout">
        {hv
          ? `À ${hv.a.age} ans : ${formatCAD(hv.a.patrimoineNet)}${hv.a.isRetired ? ' · à la retraite' : ''}`
          : `De ${ageMin} à ${ageMax} ans : ${formatCAD(annees[0].patrimoineNet)} → ${formatCAD(annees[annees.length - 1].patrimoineNet)}`}
      </div>
    </section>
  )
}
