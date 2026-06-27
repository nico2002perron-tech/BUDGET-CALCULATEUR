/* ============================================================================
   Comparaison.jsx — une FORME de plus pour un KPI : deux valeurs du MÊME KPI
   côte à côte + leur écart factuel (avant/après, réel vs repère, scénario A vs B).

   La métrique est résolue DEUX fois par la bibliothèque (deux ctx) en amont
   (MoteurRendu) ; ce bloc ne fait QU'AFFICHER — il ne recalcule aucun montant.
   props : params { etiquetteA, etiquetteB } · kpi { a, b, etiquetteA, etiquetteB }
     où a/b = { valeur, unite, texteFactuel } (une résolution de KPI chacun).

   Data-aware : une des deux valeurs absente → état honnête (pas de « +null », pas
   de faux écart). Cyan = toi/maintenant ; aucun ambre (un angle n'est PAS une alerte).
   ========================================================================== */
import { formatKPI } from '../lib/format.js'
import { filtrerFait } from '../recettes/schema.js'

const I = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M12 20V4M20 20v-7" /></svg>
)

function dispo(v) {
  return v && typeof v.valeur === 'number' && isFinite(v.valeur)
}

export default function Comparaison({ params = {}, data = {}, kpi = null }) {
  void data
  const a = kpi && kpi.a
  const b = kpi && kpi.b
  const eA = (kpi && kpi.etiquetteA) || params.etiquetteA || 'Option A'
  const eB = (kpi && kpi.etiquetteB) || params.etiquetteB || 'Option B'
  const dA = dispo(a)
  const dB = dispo(b)

  if (!dA && !dB) {
    return (
      <section className="card cmp">
        <div className="card-title">{I}Comparaison</div>
        <p className="bloc-vide">Rien à comparer pour l’instant.</p>
      </section>
    )
  }

  const unite = (dA && a.unite) || (dB && b.unite) || null
  const vA = dA ? a.valeur : 0
  const vB = dB ? b.valeur : 0
  const max = Math.max(Math.abs(vA), Math.abs(vB), 1)
  const largeur = (ok, v) => (ok ? `${Math.round((Math.abs(v) / max) * 100)}%` : '0%')

  // Écart factuel — uniquement si les DEUX valeurs existent (jamais un « +null »).
  let ecartTexte = null
  if (dA && dB) {
    const f = filtrerFait(`Écart : ${formatKPI(Math.abs(vA - vB), unite)} entre « ${eA} » et « ${eB} ».`)
    ecartTexte = f.ok ? f.texte : `Écart : ${formatKPI(Math.abs(vA - vB), unite)}.`
  }

  return (
    <section className="card cmp">
      <div className="card-title">{I}Comparaison</div>

      <div className="cmp-rang">
        <span className="cmp-l">{eA}</span>
        <span className="cmp-v">{dA ? formatKPI(vA, unite) : '—'}</span>
      </div>
      <div className="cmp-piste"><span className="cmp-rempli cmp-a" style={{ width: largeur(dA, vA) }} /></div>

      <div className="cmp-rang">
        <span className="cmp-l">{eB}</span>
        <span className="cmp-v">{dB ? formatKPI(vB, unite) : '—'}</span>
      </div>
      <div className="cmp-piste"><span className="cmp-rempli cmp-b" style={{ width: largeur(dB, vB) }} /></div>

      {ecartTexte ? (
        <p className="cmp-ecart">{ecartTexte}</p>
      ) : (
        <p className="cmp-ecart cmp-ecart-vide">Une seule valeur disponible — pas d’écart calculable.</p>
      )}
    </section>
  )
}
