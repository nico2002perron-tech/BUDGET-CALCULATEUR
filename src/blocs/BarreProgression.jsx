/* ============================================================================
   BarreProgression.jsx — progression LINÉAIRE vers une cible (taille compacte).
   La VALEUR (déjà épargné) vient du snapshot via resolve ; la CIBLE (l'objectif
   CHOISI par l'usager) vient de la recette (params) — une intention, pas un montant
   fabriqué. Faits seulement (aucun jugement).
   props : params { cible, etiquetteGauche, etiquetteDroite } · data { valeur }
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

export default function BarreProgression({ params = {}, data = {} }) {
  const valeur = Number(data.valeur) || 0
  const cible = Number(params.cible) || 0
  const gauche = params.etiquetteGauche || 'Déjà'
  const droite = params.etiquetteDroite || 'Cible'

  return (
    <section className="card barre-prog">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16" /><path d="M4 8h10" /><path d="M4 16h7" /></svg>
        Ta progression
      </div>
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
