/* ============================================================================
   SaisieRevenus.jsx — la saisie des REVENUS, par FRÉQUENCE DE PAIE.
   Régulier : tu choisis ta fréquence (chaque semaine / aux 2 sem / 2× mois /
   mensuel) + le montant PAR PAIE + le(s) jour(s) de paie → l'app calcule ton
   revenu mensuel ET place les paies sur le calendrier (Partie C).
   Saisonnier : un TOTAL annuel réparti sur les mois actifs (somme = total exact,
   chaque mois ajustable). L'app ne fait que la mise en forme — 0 dollar inventé.
   ========================================================================== */
import { repartirSaisonnier, moisActifsDefaut, FREQS, revenuMensuel } from '../lib/revenus.js'
import { MOIS_COURTS, formatCAD } from '../lib/format.js'

const JSEM = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] // getDay 0=dim … 6=sam
const JSEM_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function toNum(v) {
  if (v === '' || v == null) return null
  const clean = String(v).replace(/[^\d.]/g, '')
  if (clean === '' || clean === '.') return null // saisie non numérique → vide (pas un 0 fantôme)
  const n = Number(clean)
  return isFinite(n) ? n : null
}
function clampJour(v) {
  const n = toNum(v) || 1
  return Math.min(31, Math.max(1, Math.round(n)))
}

export default function SaisieRevenus({ revenus, onChange }) {
  const r = revenus || {}
  const saisonnier = r.mode === 'saisonnier'
  const freq = r.freq || 'biweekly'
  const jours = Array.isArray(r.jours) ? r.jours : [1, 15]
  const moisActifs = Array.isArray(r.moisActifs) ? r.moisActifs : moisActifsDefaut()
  const repartition = Array.isArray(r.repartition) ? r.repartition : Array.from({ length: 12 }, () => 0)
  const sommeReparti = repartition.reduce((a, b) => a + (Number(b) || 0), 0)
  // On calcule avec la fréquence EFFECTIVE (celle affichée), pas le `r.freq` brut :
  // ainsi le « net/mois » est juste même si le store n'a pas encore de `freq`.
  const mensuel = revenuMensuel({ ...r, freq })

  // — régulier —
  const setFreq = (id) => onChange({ ...r, mode: 'regulier', freq: id })
  const setMontant = (v) => onChange({ ...r, mode: 'regulier', montantParPaie: toNum(v) })
  const setWeekday = (i) => onChange({ ...r, weekday: i })
  const setAnchor = (v) => onChange({ ...r, anchor: v || null })
  const setJour = (idx, v) => {
    const j = jours.slice()
    j[idx] = clampJour(v)
    onChange({ ...r, jours: j })
  }
  const setCoussin = (v) => onChange({ ...r, coussin: toNum(v) })
  const setBrut = (v) => onChange({ ...r, brutAnnuel: toNum(v) })
  // — saisonnier —
  const basculer = (versSaison) => {
    if (versSaison) {
      const annuel = r.annuel != null ? r.annuel : mensuel ? mensuel * 12 : null
      onChange({ ...r, mode: 'saisonnier', annuel, moisActifs, repartition: repartirSaisonnier(annuel || 0, moisActifs) })
    } else {
      onChange({ ...r, mode: 'regulier' })
    }
  }
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
          <path d="M3 7h18v12H3z" /><path d="M3 11h18M7 15h4" />
        </svg>
        Tes revenus
      </div>
      <p className="card-sub">
        {saisonnier ? 'Ton total annuel, réparti sur tes mois actifs — ajustable.' : 'À quelle fréquence es-tu payé, et combien par paie ?'}
      </p>

      {!saisonnier ? (
        <>
          <label className="champ champ-hero">
            <span className="champ-lbl">Montant par paie (net)</span>
            <span className="champ-box champ-box-hero">
              <span className="champ-prefix">$</span>
              <input className="champ-input" inputMode="decimal" type="text" placeholder="2 000" value={r.montantParPaie ?? ''} onChange={(e) => setMontant(e.target.value)} aria-label="Montant par paie" />
              <span className="champ-suffix">/ paie</span>
            </span>
          </label>

          {/* L'info CLÉ, en évidence : le net mensuel (et l'équivalent annuel) en direct. */}
          <div className="rev-resume" aria-live="polite">
            <span className="rev-resume-main">≈ <b>{formatCAD(mensuel)}</b> net <span className="rev-resume-u">/ mois</span></span>
            <span className="rev-resume-an">soit {formatCAD(mensuel * 12)} / an</span>
          </div>

          <div className="saisie-q">
            <span className="saisie-q-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v0M18 14.5v0" />
              </svg>
            </span>
            <span className="saisie-q-txt"><b>Comment es-tu payé ?</b><em>choisis ta fréquence de paie</em></span>
          </div>
          <div className="freq-cards">
            {FREQS.map((f) => (
              <button key={f.id} type="button" className={`freq-card ${freq === f.id ? 'on' : ''}`} aria-pressed={freq === f.id} onClick={() => setFreq(f.id)}>
                <span className="freq-card-l">{f.label}</span>
                <span className="freq-card-s">{f.sub}</span>
              </button>
            ))}
          </div>

          {(freq === 'weekly' || freq === 'biweekly') && (
            <>
              <div className="champ-lbl saisie-soustitre">Quel jour de paie ?</div>
              <div className="jsem-toggles">
                {JSEM.map((w, i) => (
                  <button key={i} type="button" className={`jsem ${r.weekday === i ? 'on' : ''}`} aria-pressed={r.weekday === i} aria-label={JSEM_FULL[i]} onClick={() => setWeekday(i)}>
                    {w}
                  </button>
                ))}
              </div>
              {freq === 'biweekly' && (
                <label className="champ">
                  <span className="champ-lbl saisie-soustitre">Ta prochaine paie</span>
                  <input className="champ-date" type="date" value={r.anchor || ''} onChange={(e) => setAnchor(e.target.value)} aria-label="Date de ta prochaine paie" />
                </label>
              )}
            </>
          )}
          {freq === 'semimonthly' && (
            <div className="jours-mois">
              <span className="champ-lbl saisie-soustitre">Quels jours du mois ?</span>
              <div className="jours-row">
                le <input className="jour-input" inputMode="numeric" type="text" value={jours[0] ?? 1} onChange={(e) => setJour(0, e.target.value)} aria-label="1er jour de paie" />
                et le <input className="jour-input" inputMode="numeric" type="text" value={jours[1] ?? 15} onChange={(e) => setJour(1, e.target.value)} aria-label="2e jour de paie" />
              </div>
            </div>
          )}
          {freq === 'monthly' && (
            <div className="jours-mois">
              <span className="champ-lbl saisie-soustitre">Quel jour du mois ?</span>
              <div className="jours-row">
                le <input className="jour-input" inputMode="numeric" type="text" value={jours[0] ?? 1} onChange={(e) => setJour(0, e.target.value)} aria-label="Jour de paie" />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="champ">
            <span className="champ-lbl">Revenu net annuel (ton total)</span>
            <span className="champ-box">
              <span className="champ-prefix">$</span>
              <input className="champ-input" inputMode="decimal" type="text" placeholder="42 400" value={r.annuel ?? ''} onChange={(e) => setAnnuel(e.target.value)} aria-label="Revenu net annuel" />
              <span className="champ-suffix">/ an</span>
            </span>
          </label>

          <div className="champ-lbl saisie-soustitre">Tes mois actifs</div>
          <div className="mois-toggles">
            {MOIS_COURTS.map((m, i) => (
              <button key={m} type="button" className={`mois-pill ${moisActifs[i] ? 'on' : ''}`} aria-pressed={moisActifs[i]} onClick={() => toggleMois(i)}>
                {m}
              </button>
            ))}
          </div>

          <div className="champ-lbl saisie-soustitre">Ta répartition — ajuste chaque mois si tu veux</div>
          <div className="mois-grille">
            {MOIS_COURTS.map((m, i) => (
              <label key={m} className={`mois-champ ${moisActifs[i] ? '' : 'inactif'}`}>
                <span className="mois-champ-lbl">{m}</span>
                <input className="mois-champ-input" inputMode="decimal" type="text" value={moisActifs[i] ? repartition[i] || '' : ''} placeholder={moisActifs[i] ? '0' : '—'} disabled={!moisActifs[i]} onChange={(e) => setMoisMontant(i, e.target.value)} aria-label={`Revenu de ${m}`} />
              </label>
            ))}
          </div>
          <p className="reparti">
            Réparti : <b>{formatCAD(sommeReparti)}</b> · à titre indicatif, ajuste-le librement
          </p>
        </>
      )}

      <details className="rev-plus">
        <summary className="rev-plus-sum">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Ajouter des détails <span className="rev-plus-opt">(optionnel)</span>
        </summary>
        <label className="champ champ-coussin">
          <span className="champ-lbl">Ton coussin actuel <span className="champ-opt">épargne de sécurité</span></span>
          <span className="champ-box">
            <span className="champ-prefix">$</span>
            <input className="champ-input" inputMode="decimal" type="text" placeholder="0" value={r.coussin ?? ''} onChange={(e) => setCoussin(e.target.value)} aria-label="Coussin actuel" />
          </span>
        </label>

        <label className="champ champ-coussin">
          <span className="champ-lbl">Ton revenu brut annuel <span className="champ-opt">avant impôt — pour l’anatomie du dollar</span></span>
          <span className="champ-box">
            <span className="champ-prefix">$</span>
            <input className="champ-input" inputMode="decimal" type="text" placeholder="0" value={r.brutAnnuel ?? ''} onChange={(e) => setBrut(e.target.value)} aria-label="Revenu brut annuel" />
            <span className="champ-suffix">/ an</span>
          </span>
        </label>
      </details>

      <label className="bascule">
        <input type="checkbox" checked={saisonnier} onChange={(e) => basculer(e.target.checked)} />
        <span className="bascule-piste" aria-hidden="true"><span className="bascule-bouton" /></span>
        <span className="bascule-lbl">Mon revenu change selon les mois (saisonnier)</span>
      </label>
    </section>
  )
}
