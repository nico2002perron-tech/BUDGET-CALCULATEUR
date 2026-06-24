/* ============================================================================
   Jauge.jsx — bloc « jauge » (REGISTRE-BLOCS §1). Un arc qui montre une valeur
   vers une cible. Ici : le coussin d'hiver (mois couverts ou montant).
   Repris de gaugeBloc() de la maquette validée.

   props :
     params : { mesure: 'mois'|'montant', cible:number }
     data   : { coussin:number, depensesMensuelles:number }  ← du snapshot
   ========================================================================== */
import { useEffect, useRef } from 'react'
import { formatCAD } from '../lib/format.js'

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Jauge({ params = {}, data = {} }) {
  const arcRef = useRef(null)
  const reduce = reduceMotion()

  const coussin = Number(data.coussin) || 0
  const dep = Number(data.depensesMensuelles) || 0
  const cible = Number(params.cible) || 5
  const useMois = params.mesure !== 'montant'

  const couvre = dep > 0 ? coussin / dep : 0
  const f = useMois ? Math.min(1, couvre / cible) : Math.min(1, coussin / (dep * cible || 1))

  const cx = 110, cy = 104, r = 78
  const ang = Math.PI * (1 - f)
  const vx = cx + r * Math.cos(ang)
  const vy = cy - r * Math.sin(ang)

  // Animation de tracé (comme la maquette) : strokeDashoffset de L → 0 au montage.
  useEffect(() => {
    const el = arcRef.current
    if (!el || reduce) return
    try {
      const L = el.getTotalLength()
      el.style.strokeDasharray = String(L)
      el.style.strokeDashoffset = String(L)
      el.getBoundingClientRect() // force reflow
      el.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)'
      el.style.strokeDashoffset = '0'
    } catch {
      /* getTotalLength indisponible (hors navigateur) */
    }
  }, [reduce, f])

  const num = useMois ? `${couvre.toFixed(1).replace('.', ',')} mois` : formatCAD(coussin)
  const lbl = useMois ? `couverts par ton coussin (cible ${cible})` : 'mis de côté pour l’hiver'

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M12 12l5-5" />
        </svg>
        Ton coussin d&rsquo;hiver
      </div>
      <svg viewBox="0 0 220 130" style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', margin: '0 auto 6px' }}>
        <path d={`M${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e7edf6" strokeWidth="15" strokeLinecap="round" />
        <path ref={arcRef} d={`M${cx - r} ${cy} A ${r} ${r} 0 0 1 ${vx.toFixed(1)} ${vy.toFixed(1)}`} fill="none" stroke="#00b4d8" strokeWidth="15" strokeLinecap="round" />
      </svg>
      <div className="gauge-num">{num}</div>
      <div className="gauge-lbl">{lbl}</div>
    </section>
  )
}
