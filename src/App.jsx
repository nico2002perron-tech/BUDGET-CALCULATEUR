/* ============================================================================
   App.jsx — la coquille single-pane (VISION §5) : LE moment héros (bande
   dégradé + verdict FACTUEL tiré du snapshot) puis une recette de DÉMO rendue
   bout-en-bout par le MoteurRendu. Minimal, mais « designé », pas un graphe nu.
   ========================================================================== */
import { useMemo, useState } from 'react'
import { getSnapshot } from './lib/canonical.js'
import MoteurRendu from './recettes/MoteurRendu.jsx'

// Recette de démonstration (situation « travailleur saisonnier »).
// NB : le 2e bloc a un type INEXISTANT — c'est volontaire : il prouve que le
// moteur l'ignore PROPREMENT (aucun crash), preuve que l'architecture tient.
const RECETTE_DEMO = {
  situation: 'revenu_saisonnier',
  titre: "Passer l'hiver",
  blocs: [
    { type: 'flux_annuel', params: { souligner: 'mois_deficitaires' } }, // colonne principale
    { type: 'jauge', params: { mesure: 'mois', cible: 5 } }, // colonne de droite
    { type: 'stat', params: {} },
    { type: 'fait', params: {} },
    { type: 'bloc_inexistant_xyz', params: {} }, // ← ignoré proprement par le moteur
  ],
}

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
  // Snapshot calculé une fois (lit le silo, sème la démo au 1er passage).
  const [snapshot] = useState(getSnapshot)
  const pctEte = useMemo(() => verdictEte(snapshot), [snapshot])

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
        {pctEte != null && (
          <p className="band-verdict">
            Tes <b>6 mois d&rsquo;été</b> (mai&nbsp;→&nbsp;octobre) génèrent <b>{pctEte}&nbsp;%</b> de
            ton revenu annuel.
          </p>
        )}
      </section>

      <main className="stage">
        <div className="compose-head">
          <div className="ch-l">
            <span className="ch-tag">Ta vue · composée pour toi</span>
            <span className="ch-title">{RECETTE_DEMO.titre}</span>
          </div>
          <span className="ch-note">composée à partir de tes données</span>
        </div>

        <MoteurRendu recette={RECETTE_DEMO} snapshot={snapshot} />
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
