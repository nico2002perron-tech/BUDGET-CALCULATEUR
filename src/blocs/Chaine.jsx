/* ============================================================================
   Chaine.jsx — la CHAÎNE DE COMPRÉHENSION : montre les LIENS, pas des mesures
   isolées. Revenu net − coût de vie = flux disponible → capacité d'épargne →
   horizon de l'objectif. Lit la sortie PURE de evaluerGraphe (lib/graphe.js) ;
   ne calcule rien lui-même.
   props : params {} · data { actif, noeuds, objectif, entrees }  ← graphe.js
   Faits seulement (aucun jugement — VISION §11).
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

const I_CHAINE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9.5 13.5l5-3" />
    <rect x="3" y="11.5" width="6.5" height="5" rx="2.5" transform="rotate(-30 6.25 14)" />
    <rect x="14.5" y="7.5" width="6.5" height="5" rx="2.5" transform="rotate(-30 17.75 10)" />
  </svg>
)

// Montant en $/mois avec signe explicite (le flux peut être négatif).
function montantSigne(v) {
  const x = Number(v) || 0
  return `${x < 0 ? '−' : ''}${formatCAD(Math.abs(x))}`
}

const ORDRE = ['revenuNet', 'fluxDisponible', 'capaciteEpargne', 'objectif']

export default function Chaine({ params = {}, data = {} }) {
  void params

  if (!data.actif) {
    return (
      <section className="card chaine">
        <div className="card-title">{I_CHAINE} Le chemin vers ton objectif</div>
        <p className="bloc-vide">Ajoute ton revenu net dans « Mes données » pour voir comment ton argent mène à ton objectif.</p>
      </section>
    )
  }

  const n = data.noeuds || {}
  const obj = data.objectif || {}
  const fluxNeg = n.fluxDisponible && Number(n.fluxDisponible.valeur) < 0
  const cibleTxt = `« ${obj.nom} » de ${formatCAD(obj.cible)}`
  // Sous-texte du maillon objectif : factuel, jamais de jugement.
  const objSous =
    obj.horizonMois === 0
      ? `ta cible ${cibleTxt} est atteinte`
      : obj.horizonMois == null
        ? `ta cible ${cibleTxt} est hors d’atteinte au rythme actuel`
        : `mois pour ta cible ${cibleTxt}`
  const objVal = obj.horizonMois > 0 ? String(obj.horizonMois) : obj.horizonMois === 0 ? 'Atteint' : '—'

  return (
    <section className="card chaine">
      <div className="card-title">{I_CHAINE} Le chemin vers ton objectif</div>
      <p className="card-sub">Comment ton argent circule, maillon par maillon — de ta paie à ton objectif.</p>

      <ol className="chaine-flux">
        {ORDRE.map((id, i) => {
          const noeud = n[id]
          if (!noeud) return null
          const estObjectif = id === 'objectif'
          const exception = id === 'fluxDisponible' && fluxNeg
          return (
            <li
              className={`chaine-noeud${estObjectif ? ' is-cible' : ''}${exception ? ' is-exception' : ''}`}
              key={id}
              style={{ '--i': i }}
            >
              <span className="chaine-noeud-l">{noeud.label}</span>
              <span className="chaine-noeud-v">{estObjectif ? objVal : montantSigne(noeud.valeur)}</span>
              <span className="chaine-noeud-u">{estObjectif ? objSous : noeud.unite}</span>
            </li>
          )
        })}
      </ol>

      <p className="hz-note">Selon tes chiffres actuels. Outil informatif, pas un conseil.</p>
    </section>
  )
}
