/* ============================================================================
   SaisiePatrimoine.jsx — le volet « patrimoine » : avoirs (REER, CELI, non
   enregistré, maison), dettes (hypothèque, autres) et l'horizon (âge, retraite,
   rendement hypothétique). Alimente le moteur de vie (twin → projectLife) pour
   tracer la valeur nette dans le temps. Tout local, jamais envoyé.
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

function toNum(v) {
  if (v === '' || v == null) return null
  const clean = String(v).replace(/[^\d.]/g, '')
  if (clean === '' || clean === '.') return null
  const n = Number(clean)
  return isFinite(n) ? n : null
}
function toInt(v, min, max) {
  const n = toNum(v)
  if (n == null) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

const AVOIRS = [
  { k: 'reer', label: 'REER', ph: '22 000' },
  { k: 'celi', label: 'CELI', ph: '14 000' },
  { k: 'nonEnregistre', label: 'Placements non enregistrés', ph: '6 000' },
  { k: 'maisonValeur', label: 'Valeur de ta maison', ph: '320 000' },
]
const DETTES = [
  { k: 'hypotheque', label: 'Hypothèque', ph: '240 000' },
  { k: 'autresDettes', label: 'Autres dettes', ph: '8 000' },
]

export default function SaisiePatrimoine({ patrimoine, onChange }) {
  const p = patrimoine || {}
  const setN = (k, v) => onChange({ ...p, [k]: toNum(v) })
  const setI = (k, v, min, max) => onChange({ ...p, [k]: toInt(v, min, max) })

  const actifs = AVOIRS.reduce((s, a) => s + (Number(p[a.k]) || 0), 0)
  const passifs = DETTES.reduce((s, d) => s + (Number(p[d.k]) || 0), 0)
  const net = actifs - passifs

  const champ = (item) => (
    <label className="pat-champ" key={item.k}>
      <span className="pat-champ-lbl">{item.label}</span>
      <span className="pat-box">
        <span className="dep-prefix">$</span>
        <input className="pat-input" inputMode="decimal" type="text" placeholder={item.ph} value={p[item.k] ?? ''} onChange={(e) => setN(item.k, e.target.value)} aria-label={item.label} />
      </span>
    </label>
  )

  return (
    <section className="card saisie">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
        </svg>
        Ton patrimoine
      </div>
      <p className="card-sub">Tes avoirs et tes dettes — pour projeter ta valeur nette dans le temps.</p>

      <div className="pat-horizon">
        <label className="pat-mini">
          <span className="pat-champ-lbl">Ton âge</span>
          <input className="jour-input" inputMode="numeric" type="text" value={p.age ?? ''} placeholder="34" onChange={(e) => setI('age', e.target.value, 16, 100)} aria-label="Ton âge" />
        </label>
        <label className="pat-mini">
          <span className="pat-champ-lbl">Retraite à</span>
          <input className="jour-input" inputMode="numeric" type="text" value={p.retraite ?? ''} placeholder="65" onChange={(e) => setI('retraite', e.target.value, 50, 80)} aria-label="Âge de retraite visé" />
        </label>
        <label className="pat-mini">
          <span className="pat-champ-lbl">Rendement <span className="champ-opt">%/an</span></span>
          <input className="jour-input" inputMode="decimal" type="text" value={p.rendement ?? ''} placeholder="5" onChange={(e) => setI('rendement', e.target.value, 0, 15)} aria-label="Rendement annuel hypothétique" />
        </label>
      </div>

      <div className="champ-lbl saisie-soustitre">Tes avoirs</div>
      <div className="pat-grille">{AVOIRS.map(champ)}</div>

      <div className="champ-lbl saisie-soustitre">Tes dettes</div>
      <div className="pat-grille">{DETTES.map(champ)}</div>

      <p className="revenu-calc">
        Valeur nette aujourd&rsquo;hui ≈ <b>{formatCAD(net)}</b>
        <span className="pat-detail"> · avoirs {formatCAD(actifs)} · dettes {formatCAD(passifs)}</span>
      </p>
    </section>
  )
}
