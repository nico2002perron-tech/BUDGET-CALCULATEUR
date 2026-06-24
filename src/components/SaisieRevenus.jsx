/* ============================================================================
   SaisieRevenus.jsx — la saisie des REVENUS (l'écran le plus utilisé).
   Simple par défaut (une case mensuelle pour le 90 %). Bascule « saisonnier »
   pour qui en a besoin : total annuel → réparti sur les mois actifs (cloche),
   CHAQUE mois ajustable. Le TOTAL vient de l'usager ; l'app ne fait que la forme.
   props : { revenus, onChange(nouveauModele) }
   ========================================================================== */
import { repartirSaisonnier, moisActifsDefaut } from '../lib/revenus.js'
import { MOIS_COURTS, formatCAD } from '../lib/format.js'

function toNum(v) {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  return isFinite(n) ? n : null
}

export default function SaisieRevenus({ revenus, onChange }) {
  const r = revenus || { mode: 'stable' }
  const saisonnier = r.mode === 'saisonnier'
  const moisActifs = Array.isArray(r.moisActifs) ? r.moisActifs : moisActifsDefaut()
  const repartition = Array.isArray(r.repartition) ? r.repartition : Array.from({ length: 12 }, () => 0)
  const sommeReparti = repartition.reduce((a, b) => a + (Number(b) || 0), 0)

  const basculer = (versSaison) => {
    if (versSaison) {
      const annuel = r.annuel != null ? r.annuel : r.mensuel ? r.mensuel * 12 : null
      onChange({ ...r, mode: 'saisonnier', annuel, moisActifs, repartition: repartirSaisonnier(annuel || 0, moisActifs) })
    } else {
      onChange({ ...r, mode: 'stable' })
    }
  }
  const setMensuel = (v) => onChange({ ...r, mode: 'stable', mensuel: toNum(v) })
  const setAnnuel = (v) => {
    const annuel = toNum(v)
    onChange({ ...r, annuel, moisActifs, repartition: repartirSaisonnier(annuel || 0, moisActifs) })
  }
  const toggleMois = (i) => {
    const next = moisActifs.slice()
    next[i] = !next[i]
    onChange({ ...r, moisActifs: next, repartition: repartirSaisonnier(r.annuel || 0, next) })
  }
  const setMoisMontant = (i, v) => {
    const next = repartition.slice()
    next[i] = toNum(v) || 0
    onChange({ ...r, repartition: next })
  }

  return (
    <section className="card saisie">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7h18v12H3z" />
          <path d="M3 11h18M7 15h4" />
        </svg>
        Tes revenus
      </div>
      <p className="card-sub">
        {saisonnier ? 'Ton total annuel, réparti sur tes mois actifs — ajustable.' : 'Combien tu gagnes, net. Un montant par mois suffit.'}
      </p>

      {!saisonnier ? (
        <label className="champ">
          <span className="champ-lbl">Revenu mensuel net</span>
          <span className="champ-box">
            <span className="champ-prefix">$</span>
            <input
              className="champ-input"
              inputMode="decimal"
              type="text"
              placeholder="3 200"
              value={r.mensuel ?? ''}
              onChange={(e) => setMensuel(e.target.value)}
              aria-label="Revenu mensuel net"
            />
            <span className="champ-suffix">/ mois</span>
          </span>
        </label>
      ) : (
        <>
          <label className="champ">
            <span className="champ-lbl">Revenu net annuel (ton total)</span>
            <span className="champ-box">
              <span className="champ-prefix">$</span>
              <input
                className="champ-input"
                inputMode="decimal"
                type="text"
                placeholder="42 400"
                value={r.annuel ?? ''}
                onChange={(e) => setAnnuel(e.target.value)}
                aria-label="Revenu net annuel"
              />
              <span className="champ-suffix">/ an</span>
            </span>
          </label>

          <div className="champ-lbl saisie-soustitre">Tes mois actifs</div>
          <div className="mois-toggles">
            {MOIS_COURTS.map((m, i) => (
              <button
                key={m}
                type="button"
                className={`mois-pill ${moisActifs[i] ? 'on' : ''}`}
                aria-pressed={moisActifs[i]}
                onClick={() => toggleMois(i)}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="champ-lbl saisie-soustitre">Ta répartition — ajuste chaque mois si tu veux</div>
          <div className="mois-grille">
            {MOIS_COURTS.map((m, i) => (
              <label key={m} className={`mois-champ ${moisActifs[i] ? '' : 'inactif'}`}>
                <span className="mois-champ-lbl">{m}</span>
                <input
                  className="mois-champ-input"
                  inputMode="decimal"
                  type="text"
                  value={moisActifs[i] ? repartition[i] || '' : ''}
                  placeholder={moisActifs[i] ? '0' : '—'}
                  disabled={!moisActifs[i]}
                  onChange={(e) => setMoisMontant(i, e.target.value)}
                  aria-label={`Revenu de ${m}`}
                />
              </label>
            ))}
          </div>
          <p className="reparti">
            Réparti : <b>{formatCAD(sommeReparti)}</b> · à titre indicatif, ajuste-le librement
          </p>
        </>
      )}

      <label className="bascule">
        <input type="checkbox" checked={saisonnier} onChange={(e) => basculer(e.target.checked)} />
        <span className="bascule-piste" aria-hidden="true"><span className="bascule-bouton" /></span>
        <span className="bascule-lbl">Mon revenu change selon les mois (saisonnier)</span>
      </label>
    </section>
  )
}
