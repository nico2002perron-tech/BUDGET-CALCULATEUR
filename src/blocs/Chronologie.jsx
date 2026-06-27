/* ============================================================================
   Chronologie.jsx — compte à rebours vers une date (taille compacte).
   La date CIBLE vient de la recette (params.dateCible) — jamais inventée : si elle
   est absente/invalide, on l'affiche honnêtement (« pas de date fixée »).
   props : params { label, dateCible } · data {} (rien du snapshot)
   ========================================================================== */
const I = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6" /></svg>
)

export default function Chronologie({ params = {}, data = {}, kpi = null }) {
  void data
  const label = params.label || 'Échéance'

  // Mode KPI : on affiche la valeur résolue (un nombre de mois/jours) + son fait.
  if (kpi) {
    const dispo = typeof kpi.valeur === 'number' && isFinite(kpi.valeur)
    return (
      <section className="card chrono">
        <div className="card-title">{I}{label}</div>
        {dispo ? (
          <>
            <div className="chrono-num">{kpi.valeur}</div>
            <div className="chrono-unite">{kpi.unite || ''}</div>
            {kpi.texteFactuel && <p className="card-sub" style={{ margin: '6px 0 0' }}>{kpi.texteFactuel}</p>}
          </>
        ) : (
          <p className="bloc-vide">{kpi.texteFactuel || 'Pas encore de donnée pour ça.'}</p>
        )}
      </section>
    )
  }

  const cible = params.dateCible ? new Date(params.dateCible) : null
  const valide = cible && !isNaN(cible.getTime())

  if (!valide) {
    return (
      <section className="card chrono">
        <div className="card-title">{I}{label}</div>
        <p className="bloc-vide">Pas de date fixée.</p>
      </section>
    )
  }

  const jours = Math.max(0, Math.ceil((cible.getTime() - new Date().getTime()) / 86400000))
  const enMois = jours > 60
  const grand = enMois ? Math.round(jours / 30) : jours
  const unite = enMois ? 'mois' : jours > 1 ? 'jours' : 'jour'

  return (
    <section className="card chrono">
      <div className="card-title">{I}{label}</div>
      <div className="chrono-num">{grand}</div>
      <div className="chrono-unite">{unite} restants</div>
    </section>
  )
}
