/* ============================================================================
   Solde.jsx — bloc « solde du mois » : revenu − dépenses = marge (surplus) ou
   dépassement. Gros chiffre coloré. Faits seulement (aucun jugement).
   props : params {} · data { revenu, total, reste }  ← snapshot.depenses
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

export default function Solde({ params = {}, data = {} }) {
  void params
  const revenu = Number(data.revenu) || 0
  const total = Number(data.total) || 0
  const reste = Number.isFinite(Number(data.reste)) ? Number(data.reste) : revenu - total
  const positif = reste >= 0

  return (
    <section className="card solde">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        Ton solde du mois
      </div>
      <div className={`solde-num ${positif ? 'pos' : 'neg'}`}>
        {positif ? '+' : '−'}{formatCAD(Math.abs(reste))}
      </div>
      <div className="solde-lbl">{positif ? 'de marge après tes dépenses' : 'de plus que ton revenu ce mois'}</div>
      <div className="solde-detail">
        <span>Revenu <b>{formatCAD(revenu)}</b></span>
        <span>Dépenses <b>{formatCAD(total)}</b></span>
      </div>
    </section>
  )
}
