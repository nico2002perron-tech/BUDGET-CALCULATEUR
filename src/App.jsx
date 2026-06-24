/* ============================================================================
   App.jsx — la coquille single-pane (VISION §5) + l'ENTRETIEN GUIDÉ.
   L'usager choisit une situation puis répond à 2-3 questions tappables ; chaque
   réponse recompose la recette (composer.js) et le MoteurRendu re-rend la vue.
   La recette produite est valide selon schema.js — la même que build-tool (l'IA)
   émettra plus tard, qui se branchera donc sans rien changer au moteur.
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
  const [situation, setSituation] = useState(null) // null = pas encore composée
  const [reponses, setReponses] = useState(REPONSES_DEFAUT)

  const pctEte = useMemo(() => verdictEte(snapshot), [snapshot])
  const recette = useMemo(
    () => (situation ? composerRecette(situation, reponses) : null),
    [situation, reponses],
  )

  const demarrer = (key) => {
    setReponses(REPONSES_DEFAUT)
    setSituation(key)
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

        {!situation ? (
          <>
            <p className="band-verdict">Compose ta vue — choisis une situation pour commencer.</p>
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
            <p className="band-hint">Bientôt : décris ta situation en mots, l&rsquo;IA composera ta vue.</p>
          </>
        ) : (
          <div className="band-active">
            {pctEte != null && (
              <p className="band-verdict">
                Tes <b>6 mois d&rsquo;été</b> (mai&nbsp;→&nbsp;octobre) génèrent <b>{pctEte}&nbsp;%</b> de
                ton revenu annuel.
              </p>
            )}
            <button type="button" className="band-reset" onClick={() => setSituation(null)}>
              ↺ Changer de situation
            </button>
          </div>
        )}
      </section>

      <main className="stage">
        {situation && recette ? (
          <>
            <Entretien reponses={reponses} onChange={setReponses} />
            <div className="compose-head">
              <div className="ch-l">
                <span className="ch-tag">Ta vue · composée pour toi</span>
                <span className="ch-title">{recette.titre}</span>
              </div>
              <span className="ch-note">composée à partir de tes données</span>
            </div>
            <MoteurRendu recette={recette} snapshot={snapshot} />
          </>
        ) : (
          <p className="stage-placeholder">Choisis une situation ci-dessus pour composer ta vue.</p>
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
