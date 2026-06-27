/* ============================================================================
   BarreProgression.jsx — progression LINÉAIRE vers une cible (taille compacte).
   La VALEUR (déjà épargné) vient du snapshot via resolve ; la CIBLE (l'objectif
   CHOISI par l'usager) vient de la recette (params) — une intention, pas un montant
   fabriqué. Faits seulement (aucun jugement).
   props : params { cible, etiquetteGauche, etiquetteDroite } · data { valeur }
   ========================================================================== */
import { formatCAD, formatKPI } from '../lib/format.js'

const I_PROG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16" /><path d="M4 8h10" /><path d="M4 16h7" /></svg>

export default function BarreProgression({ params = {}, data = {}, kpi = null }) {
  // Mode KPI : un KPI en % remplit la barre ; sinon on affiche la valeur + le fait
  // (honnête, jamais une barre trompeuse sans cible).
  if (kpi) {
    const estPct = kpi.unite === '%' && typeof kpi.valeur === 'number' && isFinite(kpi.valeur)
    const pct = estPct ? Math.min(100, Math.max(0, Math.round(kpi.valeur))) : null
    return (
      <section className="card barre-prog">
        <div className="card-title">{I_PROG}Ta progression</div>
        {pct == null ? (
          <p className="bloc-vide">{kpi.texteFactuel || formatKPI(kpi.valeur, kpi.unite)}</p>
        ) : (
          <>
            {kpi.texteFactuel && <div className="bp-rang"><span>{kpi.texteFactuel}</span></div>}
            <div className="bp-piste" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span className="bp-rempli" style={{ width: `${pct}%` }} /></div>
            <div className="bp-pct">{pct}<span> % atteint</span></div>
          </>
        )}
      </section>
    )
  }

  const valeur = Number(data.valeur) || 0
  const cible = Number(params.cible) || 0
  const gauche = params.etiquetteGauche || 'Déjà'
  const droite = params.etiquetteDroite || 'Cible'

  return (
    <section className="card barre-prog">
      <div className="card-title">{I_PROG}Ta progression</div>
      {cible > 0 ? (
        <>
          <div className="bp-rang">
            <span>{gauche} <b>{formatCAD(valeur)}</b></span>
            <span>{droite} <b>{formatCAD(cible)}</b></span>
          </div>
          <div className="bp-piste" role="progressbar" aria-valuenow={Math.min(100, Math.round((valeur / cible) * 100))} aria-valuemin={0} aria-valuemax={100}>
            <span className="bp-rempli" style={{ width: `${Math.min(100, Math.max(0, (valeur / cible) * 100))}%` }} />
          </div>
          <div className="bp-pct">{Math.min(100, Math.max(0, Math.round((valeur / cible) * 100)))}<span> % atteint</span></div>
        </>
      ) : (
        <p className="bloc-vide">Aucune cible fixée pour l’instant.</p>
      )}
    </section>
  )
}
