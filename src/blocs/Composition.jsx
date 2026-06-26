/* ============================================================================
   Composition.jsx — la valeur nette aujourd'hui : avoirs (cyan) vs dettes (ambre),
   poste par poste. Faits seulement.
   props : params {} · data { net, actifs, passifs, composition:{reer,celi,nonEnregistre,maison,hypotheque,autresDettes} }
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

const POSTES = [
  { k: 'reer', label: 'REER', type: 'actif' },
  { k: 'celi', label: 'CELI', type: 'actif' },
  { k: 'nonEnregistre', label: 'Non enregistré', type: 'actif' },
  { k: 'maison', label: 'Maison', type: 'actif' },
  { k: 'hypotheque', label: 'Hypothèque', type: 'passif' },
  { k: 'autresDettes', label: 'Autres dettes', type: 'passif' },
]

export default function Composition({ params = {}, data = {} }) {
  void params
  const c = data.composition || {}
  const net = Number(data.net) || 0
  const actifs = Number(data.actifs) || 0
  const passifs = Number(data.passifs) || 0
  const items = POSTES.map((p) => ({ ...p, montant: Math.round(Number(c[p.k]) || 0) })).filter((p) => p.montant > 0)
  const denom = Math.max(actifs, passifs) || 1

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V8l7-4 7 4v13" /><path d="M9 21v-5h6v5" /></svg>
        Ta valeur nette
      </div>
      <div className="comp-net">{formatCAD(net)}</div>
      <div className="comp-sub">{formatCAD(actifs)} d&rsquo;avoirs − {formatCAD(passifs)} de dettes</div>

      <ul className="comp-liste">
        {items.map((it) => (
          <li className="comp-ligne" key={it.k}>
            <span className="comp-pt" style={{ background: it.type === 'actif' ? 'var(--cyan)' : 'var(--amber-2)' }} />
            <span className="comp-lbl">{it.label}</span>
            <span className="comp-piste"><span className="comp-jauge" style={{ width: `${Math.min(100, (it.montant / denom) * 100)}%`, background: it.type === 'actif' ? 'var(--cyan)' : 'var(--amber-2)' }} /></span>
            <b className="comp-montant">{it.type === 'passif' ? '−' : ''}{formatCAD(it.montant)}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}
