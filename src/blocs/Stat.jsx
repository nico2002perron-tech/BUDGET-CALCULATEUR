/* ============================================================================
   Stat.jsx — bloc « stat » (REGISTRE-BLOCS §8). Un gros chiffre + contexte.
   Ici : le montant du coussin. Compte de 0 → valeur au montage (comme la maquette).

   props :
     params : { ton?: 'cyan'|'bleu'|'ambre'|'vert'|'cyan_clair' }  ← teinte de la puce
     data   : { valeur:number, label:string }  ← du snapshot
   ========================================================================== */
import { useEffect, useState } from 'react'
import { formatCAD, formatKPI } from '../lib/format.js'

// Teinte de puce → classe CSS (présentation seulement ; défaut cyan).
const TON_CLASSE = {
  cyan: '',
  bleu: ' stat-ic--bleu',
  ambre: ' stat-ic--ambre',
  vert: ' stat-ic--vert',
  cyan_clair: ' stat-ic--cyanclair',
}

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Stat({ params = {}, data = {}, kpi = null, delta = null, repere = null }) {
  // Mode KPI : on AFFICHE la valeur résolue par la bibliothèque (jamais recalculée ici).
  const enKpi = !!kpi
  const dispoKpi = enKpi && typeof kpi.valeur === 'number' && isFinite(kpi.valeur)
  const cible = enKpi ? (dispoKpi ? kpi.valeur : 0) : Number(data.valeur) || 0
  const tonClasse = TON_CLASSE[params.ton] || ''
  const reduce = reduceMotion()
  const [n, setN] = useState(reduce || (enKpi && !dispoKpi) ? cible : 0)

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
        <span className={`stat-ic${tonClasse}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
        </span>
        <div>
          <div className="stat-v">{enKpi ? (dispoKpi ? formatKPI(n, kpi.unite) : '—') : formatCAD(n)}</div>
          <div className="stat-l">{enKpi ? kpi.texteFactuel || (dispoKpi ? '' : 'Pas encore de donnée pour ça.') : data.label || ''}</div>
          {/* LA TENDANCE FACTUELLE (LOT 3) : l'écart depuis la dernière visite — un FAIT,
              jamais un jugement. On NE pose PAS de classe par sens (--hausse/--baisse) :
              ce serait un crochet muet invitant un futur dev à recolorer par valence et
              à briser la neutralité AMF. La DIRECTION vit dans la flèche (choisie ici en
              JSX), la couleur reste NEUTRE dans les deux sens. Jamais d'ambre. */}
          {delta && enKpi && dispoKpi && (
            <div className="stat-delta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {delta.sens === 'hausse' ? <path d="M7 17L17 7M9 7h8v8" /> : <path d="M7 7l10 10M17 9v8H9" />}
              </svg>
              <span>{(delta.delta > 0 ? '+' : '−') + formatKPI(Math.abs(delta.delta), delta.unite)} depuis ta dernière visite</span>
            </div>
          )}
          {/* LE REPÈRE (K4) : la balise usuelle qui répond au « et alors ? » — un FAIT
              neutre (« Repère usuel : 3 à 6 mois »), jamais une cible morale. Il chuchote
              tout en bas ; il cède la place au delta sur une petite tuile (priorité :
              chiffre > phrase > delta > repère). */}
          {repere && repere.texte && enKpi && dispoKpi && !delta && (
            <div className="stat-repere">{repere.texte}</div>
          )}
        </div>
      </div>
    </section>
  )
}
