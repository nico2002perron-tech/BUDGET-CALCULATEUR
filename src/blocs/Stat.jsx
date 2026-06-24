/* ============================================================================
   Stat.jsx — bloc « stat » (REGISTRE-BLOCS §8). Un gros chiffre + contexte.
   Ici : le montant du coussin. Compte de 0 → valeur au montage (comme la maquette).

   props :
     params : {}
     data   : { valeur:number, label:string }  ← du snapshot
   ========================================================================== */
import { useEffect, useState } from 'react'
import { formatCAD } from '../lib/format.js'

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Stat({ data = {} }) {
  const cible = Number(data.valeur) || 0
  const reduce = reduceMotion()
  const [n, setN] = useState(reduce ? cible : 0)

  useEffect(() => {
    if (reduce) {
      setN(cible)
      return
    }
    let raf = 0
    let t0 = null
    const dur = 900
    const step = (ts) => {
      if (t0 == null) t0 = ts
      const p = Math.min(1, (ts - t0) / dur)
      setN(cible * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [cible, reduce])

  return (
    <section className="card">
      <div className="stat">
        <span className="stat-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
        </span>
        <div>
          <div className="stat-v">{formatCAD(n)}</div>
          <div className="stat-l">{data.label || ''}</div>
        </div>
      </div>
    </section>
  )
}
