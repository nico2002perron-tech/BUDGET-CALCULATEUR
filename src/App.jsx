/* ============================================================================
   App.jsx — la coquille single-pane (VISION §5).
   Deux façons de FABRIQUER une vue, branchées sur le MÊME moteur :
     · le CHAT (IA) : texte → /api/build-tool (mode recette) → recette ;
     · l'ENTRETIEN guidé : situation + questions tappables → composer.js → recette.
   Le MoteurRendu valide (schema.js) puis rend ; il ignore d'où vient la recette.
   ========================================================================== */
import { useMemo, useState } from 'react'
import { getSnapshot } from './lib/canonical.js'
import MoteurRendu from './recettes/MoteurRendu.jsx'
import Entretien from './components/Entretien.jsx'
import { SITUATIONS, REPONSES_DEFAUT, composerRecette } from './recettes/composer.js'

// Verdict FACTUEL (conformité §11) : part des 6 mois d'été (mai→octobre).
function verdictEte(snapshot) {
  const s = snapshot.saison
  if (!s || !Array.isArray(s.revenusMensuels)) return null
  const annuel = s.revenusMensuels.reduce((a, b) => a + b, 0)
  if (annuel <= 0) return null
  const ete = s.revenusMensuels.slice(4, 10).reduce((a, b) => a + b, 0) // mai..octobre
  return Math.round((ete / annuel) * 100)
}

function App() {
  const [snapshot] = useState(getSnapshot)
  const [source, setSource] = useState('aucun') // 'aucun' | 'guide' | 'ia'
  const [situation, setSituation] = useState(null)
  const [reponses, setReponses] = useState(REPONSES_DEFAUT)
  const [recetteIA, setRecetteIA] = useState(null)
  const [chatText, setChatText] = useState('')
  const [demandeIA, setDemandeIA] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const pctEte = useMemo(() => verdictEte(snapshot), [snapshot])
  const recette = useMemo(() => {
    if (source === 'guide' && situation) return composerRecette(situation, reponses)
    if (source === 'ia') return recetteIA
    return null
  }, [source, situation, reponses, recetteIA])

  const reinitialiser = () => {
    setSource('aucun')
    setSituation(null)
    setRecetteIA(null)
    setReponses(REPONSES_DEFAUT)
    setErreur(null)
  }

  const demarrer = (key) => {
    setReponses(REPONSES_DEFAUT)
    setSituation(key)
    setRecetteIA(null)
    setErreur(null)
    setSource('guide')
  }

  async function demanderIA(e) {
    e.preventDefault()
    const texte = chatText.trim()
    if (!texte || chargement) return
    setChargement(true)
    setErreur(null)
    try {
      const r = await fetch('/api/build-tool', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'recette', texte }),
      })
      const data = await r.json()
      if (!r.ok || !data || !Array.isArray(data.blocs)) throw new Error('réponse invalide')
      setRecetteIA(data)
      setDemandeIA(texte)
      setSituation(null)
      setSource('ia')
    } catch {
      setErreur("Ta tour n'a pas pu composer ta vue. Réessaie, ou choisis une situation ci-dessous.")
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="app">
      {/* LE moment héros — la seule zone en dégradé (VISION §12) */}
      <section className="band">
        <div className="band-top">
          <div className="brand">
            <span className="brand-dot" aria-hidden="true" />
            Ta tour de contrôle
          </div>
          <div className="who">
            {snapshot.identity.prenom}
            {snapshot.identity.metier ? ` · ${snapshot.identity.metier}` : ''}
          </div>
        </div>

        {/* Le chat (IA) — fabrique une vue à partir d'une phrase */}
        <form className="chat" onSubmit={demanderIA}>
          <span className="chat-plus" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <input
            className="chat-input"
            type="text"
            placeholder="Demande à ta tour…  (ex. « je suis paysagiste, je gagne rien l'hiver »)"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            aria-label="Décris ta situation"
          />
          <button className="chat-go" type="submit" disabled={chargement} aria-label="Composer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>

        {chargement && <p className="band-hint">Ta tour compose ta vue…</p>}
        {erreur && <p className="band-erreur">{erreur}</p>}

        {source === 'aucun' ? (
          <>
            <div className="suggs">
              {Object.entries(SITUATIONS).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  className={`sugg ${s.dispo ? 'primary' : ''}`}
                  disabled={!s.dispo}
                  onClick={() => s.dispo && demarrer(key)}
                >
                  {s.label}
                  {!s.dispo ? ' · bientôt' : ''}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="band-active">
            {source === 'ia' && demandeIA ? (
              <p className="band-verdict band-demande">« {demandeIA} »</p>
            ) : (
              pctEte != null && (
                <p className="band-verdict">
                  Tes <b>6 mois d&rsquo;été</b> (mai&nbsp;→&nbsp;octobre) génèrent <b>{pctEte}&nbsp;%</b> de
                  ton revenu annuel.
                </p>
              )
            )}
            <button type="button" className="band-reset" onClick={reinitialiser}>
              ↺ Recommencer
            </button>
          </div>
        )}
      </section>

      <main className="stage">
        {source !== 'aucun' && recette ? (
          <>
            {source === 'guide' && <Entretien reponses={reponses} onChange={setReponses} />}
            <div className="compose-head">
              <div className="ch-l">
                <span className="ch-tag">Ta vue · composée pour toi</span>
                <span className="ch-title">{recette.titre}</span>
              </div>
              <span className="ch-note">
                {source === 'ia' ? 'composée par ta tour' : 'composée à partir de tes données'}
              </span>
            </div>
            <MoteurRendu recette={recette} snapshot={snapshot} />
          </>
        ) : (
          <p className="stage-placeholder">
            Décris ta situation à ta tour, ou choisis une situation ci-dessus, pour composer ta vue.
          </p>
        )}
      </main>

      <footer className="site-footer">
        <p className="disclaimer">
          Outil informatif basé sur tes données et tes hypothèses. Ne constitue pas
          un conseil financier personnalisé.
        </p>
      </footer>
    </div>
  )
}

export default App
