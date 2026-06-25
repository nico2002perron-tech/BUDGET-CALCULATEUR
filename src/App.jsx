/* ============================================================================
   App.jsx — LA COQUILLE single-pane (VISION §5, §9). Nav PERSISTANTE ; le
   contenu change DEDANS, sans rechargement (état React).
     · Desktop : rail latéral gauche (icône + libellé, pilule cyan active).
     · Mobile  : barre d'onglets en bas, façon app native (≥48px, safe-area).
   3 sections : Ma tour · Mes données · Calendrier. + menu Données (JSON).
   Un seul silo (budgetcalc_v1) → un seul snapshot → tout en direct.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { snapshotFromStore } from './lib/canonical.js'
import { loadStore, saveStore, emptyStore, exempleStore } from './lib/storage.js'
import { revenuMensuel } from './lib/revenus.js'
import MoteurRendu from './recettes/MoteurRendu.jsx'
import Entretien from './components/Entretien.jsx'
import SaisieRevenus from './components/SaisieRevenus.jsx'
import SaisieDepenses from './components/SaisieDepenses.jsx'
import { SITUATIONS, REPONSES_DEFAUT, composerRecette } from './recettes/composer.js'

const APERCU = { situation: 'apercu', titre: '', blocs: [{ type: 'flux_annuel', params: { souligner: 'aucun', anime: false } }] }
const RECETTE_CALENDRIER = {
  situation: 'calendrier',
  titre: 'Ton mois',
  blocs: [
    { type: 'calendrier', params: {} },
    { type: 'echeancier', params: { horizon: 30 } },
  ],
}

const I_TOUR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
)
const I_DONNEES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
  </svg>
)
const I_CAL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const SECTIONS = [
  { key: 'tour', label: 'Ma tour', icon: I_TOUR },
  { key: 'donnees', label: 'Mes données', icon: I_DONNEES },
  { key: 'calendrier', label: 'Calendrier', icon: I_CAL },
]

function verdictEte(snapshot) {
  const s = snapshot.saison
  if (!s || !Array.isArray(s.revenusMensuels)) return null
  const annuel = s.revenusMensuels.reduce((a, b) => a + b, 0)
  if (annuel <= 0) return null
  const ete = s.revenusMensuels.slice(4, 10).reduce((a, b) => a + b, 0)
  return Math.round((ete / annuel) * 100)
}
function aDesRevenus(store) {
  return revenuMensuel(store && store.revenus) > 0
}
function aDesDonnees(store) {
  if (!store) return false
  if (revenuMensuel(store.revenus) > 0) return true
  return Array.isArray(store.depenses) && store.depenses.some((d) => Number(d && d.montant) > 0)
}

function App() {
  const [store, setStore] = useState(() => loadStore() || emptyStore())
  const [section, setSection] = useState(() => (aDesRevenus(loadStore()) ? 'tour' : 'donnees'))
  const [menuOuvert, setMenuOuvert] = useState(false)
  const fileRef = useRef(null)

  // Fabrication (section « Ma tour »)
  const [source, setSource] = useState('aucun')
  const [situation, setSituation] = useState(null)
  const [reponses, setReponses] = useState(REPONSES_DEFAUT)
  const [recetteIA, setRecetteIA] = useState(null)
  const [chatText, setChatText] = useState('')
  const [demandeIA, setDemandeIA] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const snapshot = useMemo(() => snapshotFromStore(store), [store])
  const pctEte = useMemo(() => verdictEte(snapshot), [snapshot])
  const recette = useMemo(() => {
    if (source === 'guide' && situation) return composerRecette(situation, reponses)
    if (source === 'ia') return recetteIA
    return null
  }, [source, situation, reponses, recetteIA])

  useEffect(() => {
    const id = setTimeout(() => saveStore(store), 250)
    return () => clearTimeout(id)
  }, [store])

  // setRevenus retire un éventuel `saison` résiduel (seed démo) → la saisie prime.
  const setRevenus = (revenus) =>
    setStore((s) => {
      const { saison, ...reste } = s
      void saison
      return { ...reste, revenus }
    })
  const setDepenses = (depenses) =>
    setStore((s) => {
      const { saison, ...reste } = s
      void saison
      return { ...reste, depenses }
    })
  const chargerExemple = () => setStore(exempleStore())
  const repartirAZero = () => {
    if (aDesDonnees(store) && !window.confirm('Repartir à zéro effacera tes montants saisis. Continuer ?')) return
    setStore(emptyStore())
    setSource('aucun')
  }

  // Menu Données (JSON) — montants jamais envoyés, juste exportés sur l'appareil.
  const onExport = () => {
    try {
      const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ma-tour-budget.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* no-op */ }
    setMenuOuvert(false)
  }
  const onImportFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (file && (!aDesDonnees(store) || window.confirm('Importer ce fichier remplacera tes données actuelles. Continuer ?'))) {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          setStore(JSON.parse(String(reader.result)))
          setSection('donnees')
        } catch { /* fichier invalide */ }
      }
      reader.readAsText(file)
    }
    e.target.value = ''
    setMenuOuvert(false)
  }
  const onReset = () => {
    if (aDesDonnees(store) && !window.confirm('Réinitialiser effacera toutes tes données. Continuer ?')) {
      setMenuOuvert(false)
      return
    }
    setStore(emptyStore())
    setSource('aucun')
    setSection('donnees')
    setMenuOuvert(false)
  }

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
      const res = await fetch('/api/build-tool', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'recette', texte }),
      })
      const data = await res.json()
      if (!res.ok || !data || !Array.isArray(data.blocs)) throw new Error('réponse invalide')
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

  const donneesMenu = (
    <div className="donnees">
      <button type="button" className="donnees-btn" aria-haspopup="menu" aria-expanded={menuOuvert} onClick={() => setMenuOuvert((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" />
        </svg>
        <span className="donnees-lbl">Données</span>
      </button>
      {menuOuvert && (
        <div className="donnees-pop" role="menu">
          <button type="button" role="menuitem" onClick={onExport}>Exporter (JSON)</button>
          <button type="button" role="menuitem" onClick={() => fileRef.current && fileRef.current.click()}>Importer (JSON)</button>
          <button type="button" role="menuitem" className="danger" onClick={onReset}>Réinitialiser</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportFile} />
    </div>
  )

  const navItems = SECTIONS.map((s) => (
    <button
      key={s.key}
      type="button"
      className={`rail-item ${section === s.key ? 'is-active' : ''}`}
      aria-current={section === s.key ? 'page' : undefined}
      onClick={() => setSection(s.key)}
    >
      <span className="rail-ico">{s.icon}</span>
      <span className="rail-txt">{s.label}</span>
    </button>
  ))

  return (
    <div className="shell">
      {/* En-tête mobile (le rail devient barre du bas) */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          Ta tour de contrôle
        </div>
        {donneesMenu}
      </header>

      {/* Nav persistante : rail (desktop) / onglets bas (mobile) */}
      <nav className="rail" aria-label="Navigation">
        <div className="rail-brand">
          <span className="brand-dot" aria-hidden="true" />
          <span className="rail-brand-bloc">
            <span className="rail-brand-txt">Ta tour de contrôle</span>
            <span className="rail-brand-sous">ton espace financier</span>
          </span>
        </div>
        <div className="rail-items">{navItems}</div>
        <div className="rail-foot">{donneesMenu}</div>
      </nav>

      <main className="main">
        {section === 'tour' && (
          <div className="tour">
            <div className="tour-hero">
              <h1 className="tour-bonjour">
                {snapshot.identity.prenom ? `Bonjour, ${snapshot.identity.prenom}` : 'Bon retour'}
              </h1>
              <p className="tour-accroche">Compose une vue de ta situation — décris-la en mots, ou choisis ci-dessous.</p>

              <div className="tour-chatwrap">
                <span className="tour-halo" aria-hidden="true" />
                <form className="chat tour-chat" onSubmit={demanderIA}>
                  <span className="chat-plus" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                </form>
              </div>

              {chargement && <p className="tour-hint">Ta tour compose ta vue…</p>}
              {erreur && <p className="tour-erreur">{erreur}</p>}

              {source === 'aucun' ? (
                <div className="tour-suggs">
                  {Object.entries(SITUATIONS).map(([key, s]) => (
                    <button key={key} type="button" className={`sugg ${s.dispo ? 'primary' : ''}`} disabled={!s.dispo} onClick={() => s.dispo && demarrer(key)}>
                      {s.label}{!s.dispo ? ' · bientôt' : ''}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="tour-active">
                  {source === 'ia' && demandeIA ? (
                    <p className="tour-verdict tour-demande">« {demandeIA} »</p>
                  ) : (
                    situation === 'revenu_saisonnier' && pctEte != null && (
                      <p className="tour-verdict">
                        Tes <b>6 mois d&rsquo;été</b> (mai&nbsp;→&nbsp;octobre) génèrent <b>{pctEte}&nbsp;%</b> de ton revenu annuel.
                      </p>
                    )
                  )}
                  <button type="button" className="tour-reset" onClick={reinitialiser}>↺ Recommencer</button>
                </div>
              )}
            </div>

            {source !== 'aucun' && recette && (
              <div className="tour-vues">
                {source === 'guide' && situation === 'revenu_saisonnier' && <Entretien reponses={reponses} onChange={setReponses} />}
                <div className="compose-head">
                  <div className="ch-l">
                    <span className="ch-tag">Ta vue · composée pour toi</span>
                    <span className="ch-title">{recette.titre}</span>
                  </div>
                  <span className="ch-note">{source === 'ia' ? 'composée par ta tour' : 'composée à partir de tes données'}</span>
                </div>
                <MoteurRendu recette={recette} snapshot={snapshot} />
              </div>
            )}
          </div>
        )}

        {section === 'donnees' && (
          <>
            <div className="section-tete">
              <h1 className="section-titre">Mes données</h1>
              <p className="section-sous">Tes montants restent sur ton appareil. Ta tour se construit pendant que tu écris.</p>
            </div>
            <SaisieRevenus revenus={store.revenus} onChange={setRevenus} />
            <SaisieDepenses depenses={store.depenses} onChange={setDepenses} />
            <div className="apercu">
              <span className="apercu-tag">Aperçu en direct</span>
              <MoteurRendu recette={APERCU} snapshot={snapshot} />
            </div>
            <div className="saisie-actions">
              <button type="button" className="lien-action" onClick={chargerExemple}>Voir un exemple</button>
              <button type="button" className="lien-action" onClick={repartirAZero}>Repartir à zéro</button>
            </div>
          </>
        )}

        {section === 'calendrier' && (
          <>
            <div className="section-tete">
              <h1 className="section-titre">Calendrier</h1>
              <p className="section-sous">Ton journal de bord : l&rsquo;argent qui rentre et qui sort, jour par jour.</p>
            </div>
            {snapshot.calendrier ? (
              <MoteurRendu recette={RECETTE_CALENDRIER} snapshot={snapshot} />
            ) : (
              <div className="card placeholder-card">
                <p>Ajoute un revenu, ou une dépense fixe avec son jour, dans « Mes données » — ton calendrier se remplit tout seul.</p>
              </div>
            )}
          </>
        )}

        <footer className="site-footer">
          <p className="disclaimer">
            Outil informatif basé sur tes données et tes hypothèses. Ne constitue pas un conseil financier personnalisé.
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
