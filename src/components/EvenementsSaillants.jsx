/* ============================================================================
   EvenementsSaillants.jsx — PREMIÈRE VUE sur le primitif événement (evenements.js).
   « Ce qui bouge maintenant » : la Tour surface les événements les plus saillants —
   échéances qui approchent, seuils franchis, changements de trajectoire.

   PRÉSENTATION PURE : reçoit déjà la liste (le parent appelle genererEvenements +
   evenementsSaillants). Ne calcule aucun montant, ne lit aucun snapshot. Data-aware :
   aucun événement → ne rend RIEN (pas de boîte vide). COULEUR = SENS (VISION §12) :
   exception = ambre (réservé), attention = cyan, info = neutre. Chaque texte vient
   déjà filtré par filtrerFait (côté evenements.js).
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

const I_CLOCHE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

// « il y a N jours » à partir d'un horodatage ISO. Factuel, jamais de faux précis.
function ilYA(iso) {
  const t = Date.parse(iso)
  if (!isFinite(t)) return null
  const jours = Math.floor((Date.now() - t) / 86400000)
  if (jours <= 0) return "aujourd’hui"
  if (jours === 1) return 'hier'
  if (jours < 7) return `il y a ${jours} jours`
  if (jours < 31) { const s = Math.floor(jours / 7); return s === 1 ? 'il y a 1 semaine' : `il y a ${s} semaines` }
  const m = Math.floor(jours / 30)
  return m === 1 ? 'il y a 1 mois' : `il y a ${m} mois`
}

// Les conséquences chiffrées (impact propagé) → puces lisibles. Jamais « +null ».
function puces(c) {
  const out = []
  if (c && typeof c.deltaFlux === 'number' && c.deltaFlux !== 0) {
    out.push(`${c.deltaFlux > 0 ? '+' : '−'}${formatCAD(Math.abs(c.deltaFlux))}/mois`)
  }
  if (c && typeof c.deltaHorizon === 'number' && c.deltaHorizon !== 0) {
    out.push(`${c.deltaHorizon < 0 ? '−' : '+'}${Math.abs(c.deltaHorizon)} mois`)
  }
  return out
}

export default function EvenementsSaillants({ events, depuis }) {
  const liste = Array.isArray(events) ? events : []
  if (liste.length === 0) return null // data-aware : rien à dire → rien à l'écran

  // Sous-titre « depuis ta dernière visite » UNIQUEMENT s'il y a un changement DÉTECTÉ (seuil
  // franchi / trajectoire) et qu'on sait quand — une échéance à venir n'est pas « depuis ».
  const aDetecte = liste.some((e) => e.quand === 'detecte')
  const quand = aDetecte && depuis ? ilYA(depuis) : null

  return (
    <section className="evts" aria-label="Ce qui bouge">
      <div className="evts-tete">
        <span className="evts-ic" aria-hidden="true">{I_CLOCHE}</span>
        <div className="evts-tete-txt">
          <h2 className="evts-titre">Ce qui bouge</h2>
          {quand && <p className="evts-sous">Depuis ta dernière visite · {quand}</p>}
        </div>
      </div>
      <ul className="evts-liste">
        {liste.map((e) => {
          const ch = puces(e.consequence)
          return (
            <li key={e.id} className={`evt evt--${e.severite || 'info'}`}>
              <span className="evt-dot" aria-hidden="true" />
              <div className="evt-corps">
                <p className="evt-titre">{e.titre}</p>
                {e.consequence && e.consequence.texte && <p className="evt-conseq">{e.consequence.texte}</p>}
                {ch.length > 0 && (
                  <div className="evt-chips">
                    {ch.map((c, i) => <span className="evt-chip" key={i}>{c}</span>)}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
