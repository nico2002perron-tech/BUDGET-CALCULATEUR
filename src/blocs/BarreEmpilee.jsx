/* ============================================================================
   BarreEmpilee.jsx — part ENGAGÉE (dépenses fixes) vs LIBRE (variables) de ton
   coût de vie. Montre la « rigidité » du budget. Faits seulement.
   props : params {} · data { engageLibre: { fixe, variable } }  ← snapshot.depenses
   ========================================================================== */
import { formatCAD, formatPct } from '../lib/format.js'

export default function BarreEmpilee({ params = {}, data = {} }) {
  void params
  const el = data.engageLibre || { fixe: 0, variable: 0 }
  const fixe = Number(el.fixe) || 0
  const variable = Number(el.variable) || 0
  const total = fixe + variable
  const pFixe = total > 0 ? Math.round((fixe / total) * 100) : 0

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="9" width="18" height="6" rx="1.5" /><path d="M9 9v6" />
        </svg>
        Engagé vs libre
      </div>
      <p className="card-sub">La part de ton coût de vie déjà engagée (fixe) et celle qui reste souple (variable).</p>

      <div className="emp-barre" role="img" aria-label={`Engagé ${pFixe} %, libre ${100 - pFixe} %`}>
        {total > 0 ? (
          <>
            <div className="emp-seg emp-fixe" style={{ width: `${pFixe}%` }} />
            <div className="emp-seg emp-libre" style={{ width: `${100 - pFixe}%` }} />
          </>
        ) : (
          <div className="emp-seg emp-vide" style={{ width: '100%' }} />
        )}
      </div>
      <div className="emp-legende">
        <span><span className="emp-pt emp-pt-fixe" /> Engagé <b>{formatCAD(fixe)}</b>{total > 0 ? ` · ${formatPct(pFixe)}` : ''}</span>
        <span><span className="emp-pt emp-pt-libre" /> Libre <b>{formatCAD(variable)}</b></span>
      </div>
    </section>
  )
}
