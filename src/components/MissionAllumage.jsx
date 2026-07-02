/* ============================================================================
   MissionAllumage.jsx — LA MISSION « 2 MIN » (style Duolingo). Une question à
   la fois, une barre de progression qui avance, des choix joufflus, des
   montants à steppers — et à la fin, la famille s'allume dans le studio.

   PRÉSENTATION PURE au-dessus de lib/missions.js (étapes data-driven +
   appliquerMission). Le parent applique les réponses au silo (onFini).
   « Passer » sur une étape optionnelle n'écrit RIEN (jamais de zéro inventé).
   ========================================================================== */
import { useMemo, useState } from 'react'
import { MISSIONS, etapesVisibles } from '../lib/missions.js'

const I_RETOUR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
)

export default function MissionAllumage({ famille, onFini, onAnnuler }) {
  const mission = MISSIONS[famille]
  const [reponses, setReponses] = useState({})
  const [idx, setIdx] = useState(0)
  const [saisie, setSaisie] = useState('')
  const etapes = useMemo(() => etapesVisibles(famille, reponses), [famille, reponses])
  if (!mission || etapes.length === 0) return null

  const e = etapes[Math.min(idx, etapes.length - 1)]
  const derniere = idx >= etapes.length - 1
  const montant = Number(String(saisie).replace(',', '.'))
  const montantOk = isFinite(montant) && montant > 0

  const suivant = (valeur) => {
    const r = valeur === undefined ? reponses : { ...reponses, [e.id]: valeur }
    setReponses(r)
    setSaisie('')
    // les `si` peuvent changer la liste : on recalcule la fin sur les étapes À JOUR
    if (idx >= etapesVisibles(famille, r).length - 1) onFini(r)
    else setIdx(idx + 1)
  }
  const precedent = () => {
    if (idx === 0) onAnnuler()
    else { setIdx(idx - 1); setSaisie('') }
  }
  const bouge = (delta) => {
    const base = montantOk ? montant : 0
    setSaisie(String(Math.max(0, base + delta)))
  }

  return (
    <section className="mission" aria-label={mission.titre}>
      <div className="mis-tete">
        <button type="button" className="gal-retour" onClick={precedent} aria-label={idx === 0 ? 'Quitter la mission' : 'Question précédente'}>{I_RETOUR}</button>
        <div className="mis-prog" role="progressbar" aria-valuenow={idx + 1} aria-valuemin={1} aria-valuemax={etapes.length} aria-label="Progression de la mission">
          <div className="mis-prog-fill" style={{ width: `${((idx + 1) / etapes.length) * 100}%` }} />
        </div>
        <span className="mis-compte">{idx + 1}/{etapes.length}</span>
      </div>

      <div className="mis-corps" key={e.id}>
        <h2 className="mis-question">{e.question}</h2>
        {e.sous && <p className="mis-sous">{e.sous}</p>}

        {e.type === 'chips' ? (
          <div className="mis-choix-liste">
            {e.options.map((o) => (
              <button key={o.id} type="button" className="mis-choix" onClick={() => suivant(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mis-montant">
              <button type="button" className="mis-pas" onClick={() => bouge(-(e.pas || 10))} aria-label={`Moins ${e.pas || 10}`}>−</button>
              <div className="mis-champ">
                <input
                  type="text"
                  inputMode="decimal"
                  className="mis-input"
                  value={saisie}
                  placeholder="0"
                  onChange={(ev) => setSaisie(ev.target.value.replace(/[^0-9.,]/g, ''))}
                  aria-label={e.question}
                  autoFocus
                />
                <span className="mis-unite" aria-hidden="true">{e.id === 'age' ? 'ans' : '$'}</span>
              </div>
              <button type="button" className="mis-pas" onClick={() => bouge(e.pas || 10)} aria-label={`Plus ${e.pas || 10}`}>+</button>
            </div>

            <div className="mis-actions">
              <button type="button" className="gal-ajouter mis-continuer" disabled={!montantOk} onClick={() => suivant(montant)}>
                {derniere ? 'Terminer' : 'Continuer'}
              </button>
              {e.optionnel && (
                <button type="button" className="mis-passer" onClick={() => suivant(undefined)}>
                  Passer — je le mettrai plus tard
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <p className="mis-note">{mission.sousTitre}</p>
    </section>
  )
}
