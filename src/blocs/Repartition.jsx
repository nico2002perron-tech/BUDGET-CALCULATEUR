/* ============================================================================
   Repartition.jsx — « où va ton argent » par RÔLE (Besoins / Désirs / Épargne),
   en part du revenu, avec le repère 50/30/20 (à titre indicatif). Faits seulement :
   on affiche la part réelle et un repère neutre, sans juger.
   props : params { repere:'50/30/20'|'aucun' } · data { parClasse, pct, revenu }
   ========================================================================== */
import { CLASSES } from '../lib/depenses.js'
import { formatCAD, formatPct } from '../lib/format.js'

const REPERE = { besoin: 50, envie: 30, epargne: 20 }

export default function Repartition({ params = {}, data = {} }) {
  const parClasse = data.parClasse || { besoin: 0, envie: 0, epargne: 0 }
  const pct = data.pct || null
  const surRevenu = !!pct
  const total = (Number(parClasse.besoin) || 0) + (Number(parClasse.envie) || 0) + (Number(parClasse.epargne) || 0)
  const montrerRepere = surRevenu && params.repere !== 'aucun'

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" /><rect x="12" y="7" width="3" height="11" /><rect x="17" y="4" width="3" height="14" />
        </svg>
        Où va ton argent
      </div>
      <p className="card-sub">
        {surRevenu ? 'Tes dépenses par rôle, en part de ton revenu' : 'Tes dépenses par rôle'}
        {montrerRepere ? ' — le repère gris est 50 / 30 / 20.' : '.'}
      </p>

      <div className="rep-liste">
        {CLASSES.map((cl) => {
          const montant = Number(parClasse[cl.id]) || 0
          const p = surRevenu ? pct[cl.id] : total > 0 ? Math.round((montant / total) * 100) : 0
          const largeur = Math.max(0, Math.min(100, p))
          return (
            <div className="rep-ligne" key={cl.id}>
              <div className="rep-tete">
                <span className="rep-nom"><span className="rep-pastille" style={{ background: cl.couleur }} />{cl.label}</span>
                <span className="rep-val">
                  <b>{formatCAD(montant)}</b> · {formatPct(p)}
                  {montrerRepere ? <span className="rep-cible"> / repère {REPERE[cl.id]} %</span> : null}
                </span>
              </div>
              <div className="rep-piste">
                <div className="rep-jauge" style={{ width: `${largeur}%`, background: cl.couleur }} />
                {montrerRepere ? <span className="rep-repere" style={{ left: `${Math.min(100, REPERE[cl.id])}%` }} /> : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
