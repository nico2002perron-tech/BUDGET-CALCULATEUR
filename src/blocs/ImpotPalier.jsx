/* ============================================================================
   ImpotPalier.jsx — sur chaque dollar brut : ce qui part en impôts/cotisations et
   ce qui reste net. Barre empilée + taux effectif + jour de libération fiscale.
   Faits seulement (montants calculés par twin.calcTax).
   props : params {} · data { brut, federal, quebec, cotisations, net, tauxEffectif, jourLiberation }
   ========================================================================== */
import { formatCAD, formatPct, MOIS_COURTS } from '../lib/format.js'

function jourVersDate(n) {
  if (!n || !isFinite(n)) return '—'
  const d = new Date(new Date().getFullYear(), 0, Math.max(1, Math.round(n)))
  return `le ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`
}

export default function ImpotPalier({ params = {}, data = {} }) {
  void params
  const brut = Number(data.brut) || 0
  const segs = [
    { label: 'Impôt fédéral', montant: Number(data.federal) || 0, couleur: '#b8740a' },
    { label: 'Impôt Québec', montant: Number(data.quebec) || 0, couleur: '#e0a23c' },
    { label: 'Cotisations', montant: Number(data.cotisations) || 0, couleur: '#caa15a' },
    { label: 'Net dans ta poche', montant: Number(data.net) || 0, couleur: '#0f8a5f' },
  ]
  const pct = (m) => (brut > 0 ? (m / brut) * 100 : 0)

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 4-5" />
        </svg>
        Ton dollar imposé
      </div>
      <p className="card-sub">Sur chaque dollar brut, ce qui part en impôts et cotisations, et ce qui te reste.</p>

      <div className="emp-barre" role="img" aria-label="Répartition impôts et net">
        {brut > 0 ? segs.map((s) => <div key={s.label} className="emp-seg" style={{ width: `${pct(s.montant)}%`, background: s.couleur }} />) : <div className="emp-seg emp-vide" style={{ width: '100%' }} />}
      </div>

      <div className="imp-stats">
        <span>Taux effectif <b>{formatPct(data.tauxEffectif)}</b></span>
        <span>Libération fiscale <b>{jourVersDate(data.jourLiberation)}</b></span>
      </div>

      <ul className="imp-legende">
        {segs.map((s) => (
          <li key={s.label}>
            <span className="emp-pt" style={{ background: s.couleur }} />
            <span className="imp-lbl">{s.label}</span>
            <b>{formatCAD(s.montant)}</b>
            <span className="ana-pct">{formatPct(pct(s.montant))}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
