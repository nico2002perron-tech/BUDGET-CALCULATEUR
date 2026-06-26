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
import SaisiePatrimoine from './components/SaisiePatrimoine.jsx'
import PanneauVivant from './components/PanneauVivant.jsx'
import SousSectionBientot from './components/SousSectionBientot.jsx'
import { totalDepensesVie } from './lib/depenses.js'
import { formatCAD } from './lib/format.js'
import { SITUATIONS, REPONSES_DEFAUT, composerRecette } from './recettes/composer.js'

const RECETTE_CALENDRIER = {
  situation: 'calendrier',
  titre: 'Ton mois',
  blocs: [
    { type: 'calendrier', params: {} },
    { type: 'echeancier', params: { horizon: 30 } },
  ],
}

// Le PORTRAIT DE BASE — composé AUTOMATIQUEMENT dès qu'il y a des données (jamais
// l'IA). Le chat/les suggestions AJOUTENT des vues par-dessus. Blocs existants ; les
// chiffres viennent du snapshot via leurs resolve() (flux_annuel→saison, solde &
// barre_empilee→depenses, fait→saison). flux_annuel: vue annuelle, sans surlignage.
// « Mes données » en sous-sections groupées en 4 familles (séparateurs visuels, PAS
// des accordéons). Seuls Revenus/Dépenses sont outillés ; Placements rend la saisie
// patrimoine existante (transitoire) ; le reste = état « bientôt » (juste la place).
const SS = {
  revenus:    { label: 'Revenus',    kind: 'revenus',    icon: (<><path d="M3 8h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /><path d="M3 8l13-3v3" /><circle cx="16" cy="13.5" r="1.3" /></>) },
  depenses:   { label: 'Dépenses',   kind: 'depenses',   icon: (<><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18" /></>) },
  epargne:    { label: 'Épargne',    kind: 'bientot',    note: 'Mettre de côté ≠ dépenser. Cette sous-section sortira tes épargnes des dépenses — elle arrive par vagues.', icon: (<><path d="M4 13c0-2.5 2.6-4.5 6-4.5h3c3.4 0 6 2 6 4.5 0 1.1-.5 2.1-1.3 2.9V18h-2.4l-.6-1.4c-.5.2-1.1.3-1.7.3H10l-.7 1.4H7v-2.1C5.5 15.1 4 14.2 4 13z" /><circle cx="8.5" cy="12.5" r=".9" /></>) },
  placements: { label: 'Placements', kind: 'patrimoine', icon: (<><path d="M3 17l6-6 4 4 7-7" /><path d="M17 8h4v4" /></>) },
  immobilier: { label: 'Immobilier', kind: 'bientot',    note: 'Maison, immeubles. Pour l’instant, ça se saisit dans « Placements ». Une section dédiée arrive par vagues.', icon: (<><rect x="4" y="3.5" width="16" height="17" rx="1.5" /><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M9 15.5h2M13 15.5h2" /></>) },
  dettes:     { label: 'Dettes',     kind: 'bientot',    note: 'Carte, marge, prêts (solde + taux) — distinct des dépenses. Pour l’instant dans « Placements ». Section dédiée par vagues.', icon: (<><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8" /></>) },
  assurances: { label: 'Assurances', kind: 'bientot',    note: 'Habitation, auto, vie/santé. Une section dédiée arrive par vagues.', icon: (<><path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.2-7 8.5-4-1.3-7-4.1-7-8.5V6.1l7-2.6z" /></>) },
  hypotheque: { label: 'Hypothèque', kind: 'bientot',    note: 'Solde, taux, échéance. Pour l’instant dans « Placements ». Section dédiée par vagues.', icon: (<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>) },
  objectifs:  { label: 'Objectifs',  kind: 'bientot',    note: 'Voyage, mise de fonds, fonds d’urgence. Une section dédiée arrive par vagues.', icon: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>) },
}
const FAMILLES = [
  { id: 'quotidien', label: 'Le quotidien', items: ['revenus', 'depenses', 'epargne'] },
  { id: 'patrimoine', label: 'Le patrimoine', items: ['placements', 'immobilier', 'dettes'] },
  { id: 'engagements', label: 'Les engagements', items: ['assurances', 'hypotheque'] },
  { id: 'projets', label: 'Les projets', items: ['objectifs'] },
]

// Indicateur « cette sous-section est remplie » (+ petit total si pertinent). Lecture
// seule du store ; ne touche pas au snapshot. Les sous-sections « bientôt » restent vides.
function ssRemplie(id, store) {
  const s = store || {}
  if (id === 'revenus') { const m = revenuMensuel(s.revenus); return { rempli: m > 0, total: m > 0 ? `${formatCAD(m)}/mo` : null } }
  if (id === 'depenses') { const t = Math.round(totalDepensesVie(s.depenses)); return { rempli: t > 0, total: t > 0 ? `${formatCAD(t)}/mo` : null } }
  if (id === 'placements') {
    const p = s.patrimoine || {}
    const t = ['reer', 'celi', 'nonEnregistre', 'maisonValeur', 'hypotheque', 'autresDettes'].reduce((acc, k) => acc + (Number(p[k]) || 0), 0)
    return { rempli: t > 0, total: null }
  }
  return { rempli: false, total: null }
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

function aDesRevenus(store) {
  return revenuMensuel(store && store.revenus) > 0
}
function aDesDonnees(store) {
  if (!store) return false
  if (revenuMensuel(store.revenus) > 0) return true
  return Array.isArray(store.depenses) && store.depenses.some((d) => Number(d && d.montant) > 0)
}

// Fusionne un silo chargé/importé avec les valeurs par défaut → un store PARTIEL ou
// ANCIEN (ex. revenus sans `freq`/`mode`, ou silo de démo sans clé `revenus`) retrouve
// des champs valides et le calcul « net/mois » repart correctement. Présentation/robustesse.
function normaliser(store) {
  const base = emptyStore()
  if (!store || typeof store !== 'object') return base
  return {
    ...base,
    ...store,
    revenus: { ...base.revenus, ...(store.revenus || {}) },
    patrimoine: { ...base.patrimoine, ...(store.patrimoine || {}) },
    depenses: Array.isArray(store.depenses) ? store.depenses : base.depenses,
  }
}

function App() {
  const [store, setStore] = useState(() => normaliser(loadStore()))
  const [section, setSection] = useState(() => (aDesRevenus(normaliser(loadStore())) ? 'tour' : 'donnees'))
  const [sousSection, setSousSection] = useState('revenus') // sous-section active de « Mes données »
  const [menuDonneesOuvert, setMenuDonneesOuvert] = useState(() => !aDesRevenus(normaliser(loadStore()))) // accordéon du rail
  const [menuOuvert, setMenuOuvert] = useState(false)
  const fileRef = useRef(null)

  // Fabrication (section « Ma tour ») — chat libre + entretien guidé via emplacements « + créer ».
  const [creation, setCreation] = useState(null) // null = fermé ; { situation, reponses } = création en cours
  const [nouveauWidget, setNouveauWidget] = useState(null) // id du widget à animer (à sa CRÉATION seulement)
  const [chatText, setChatText] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)

  const snapshot = useMemo(() => snapshotFromStore(store), [store])
  // Les indicateurs créés (persistés dans le silo) que la tour affiche.
  const widgets = Array.isArray(store.tourWidgets) ? store.tourWidgets : []
  // L'aperçu de l'indicateur en cours de création (entretien guidé → recette, blocs du registre).
  const apercu = creation && creation.situation ? composerRecette(creation.situation, creation.reponses) : null

  useEffect(() => {
    const id = setTimeout(() => saveStore(store), 250)
    return () => clearTimeout(id)
  }, [store])

  // Après l'animation de construction, on oublie « le nouveau widget » → il ne se
  // ré-animera plus (ni au reload, ni en revenant sur la tour). L'anim = à la création.
  useEffect(() => {
    if (!nouveauWidget) return
    const id = setTimeout(() => setNouveauWidget(null), 4000)
    return () => clearTimeout(id)
  }, [nouveauWidget])

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
  const setPatrimoine = (patrimoine) => setStore((s) => ({ ...s, patrimoine }))
  const chargerExemple = () => setStore(exempleStore())
  const repartirAZero = () => {
    if (aDesDonnees(store) && !window.confirm('Repartir à zéro effacera tes montants saisis. Continuer ?')) return
    setStore(emptyStore())
    setCreation(null)
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
          setStore(normaliser(JSON.parse(String(reader.result))))
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
    setCreation(null)
    setSection('donnees')
    setMenuOuvert(false)
  }

  // Ouvre un emplacement de création (entretien guidé) ; ajoute/retire un indicateur
  // persistant (store.tourWidgets). Les recettes restent composées par composer.js / l'IA.
  const ouvrirCreation = () => { setErreur(null); setCreation({ situation: null, reponses: REPONSES_DEFAUT }) }
  const ajouterWidget = (recette) => {
    if (!recette || !Array.isArray(recette.blocs) || recette.blocs.length === 0) return
    const id = 'w_' + Date.now()
    setStore((s) => ({ ...s, tourWidgets: [...(Array.isArray(s.tourWidgets) ? s.tourWidgets : []), { id, recette }] }))
    setNouveauWidget(id) // → ce widget se CONSTRUIT pièce par pièce
    setCreation(null)
  }
  const retirerWidget = (id) =>
    setStore((s) => ({ ...s, tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).filter((w) => w.id !== id) }))

  // Chat libre : l'IA compose une recette à partir des 16 blocs → un indicateur de plus.
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
      ajouterWidget(data)
      setChatText('')
    } catch {
      setErreur("Ta tour n'a pas pu composer ton indicateur. Réessaie, ou crée-en un ci-dessous.")
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

  // Navigation rail : « Mes données » est un parent déroulant ; Ma tour / Calendrier
  // restent simples. Sur mobile, l'accordéon devient une feuille du bas (dd-sheet).
  const estMobile = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
  const allerSection = (key) => { setSection(key); if (key !== 'donnees') setMenuDonneesOuvert(false) }
  const ouvrirMesDonnees = () => {
    if (section !== 'donnees') { setSection('donnees'); setMenuDonneesOuvert(true) }
    else setMenuDonneesOuvert((o) => !o)
  }
  const allerSousSection = (id) => { setSection('donnees'); setSousSection(id); if (estMobile()) setMenuDonneesOuvert(false) }

  // La liste des sous-sections, groupée par famille — réutilisée dans le rail
  // (accordéon desktop) ET dans la feuille du bas (mobile).
  const sousMenuListe = FAMILLES.map((fam) => (
    <div className="rail-fam" key={fam.id}>
      <span className="rail-fam-l">{fam.label}</span>
      {fam.items.map((id) => {
        const s = SS[id]
        const { rempli, total } = ssRemplie(id, store)
        const bientot = s.kind === 'bientot'
        const actif = section === 'donnees' && sousSection === id
        return (
          <button
            key={id}
            type="button"
            className={`rail-sous${actif ? ' is-active' : ''}${rempli ? ' is-rempli' : ''}${bientot ? ' is-bientot' : ''}`}
            aria-current={actif ? 'page' : undefined}
            onClick={() => allerSousSection(id)}
          >
            <span className="rail-sous-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg></span>
            <span className="rail-sous-l">{s.label}</span>
            {rempli && <span className="rail-sous-ok" aria-hidden="true">✓</span>}
            {total && <span className="rail-sous-tot">{total}</span>}
            {bientot && !rempli && <span className="rail-sous-soon">bientôt</span>}
          </button>
        )
      })}
    </div>
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
        <div className="rail-items">
          <button type="button" className={`rail-item ${section === 'tour' ? 'is-active' : ''}`} aria-current={section === 'tour' ? 'page' : undefined} onClick={() => allerSection('tour')}>
            <span className="rail-ico">{I_TOUR}</span>
            <span className="rail-txt">Ma tour</span>
          </button>

          <button type="button" className={`rail-item rail-parent ${section === 'donnees' ? 'is-active' : ''}`} aria-current={section === 'donnees' ? 'page' : undefined} aria-expanded={menuDonneesOuvert} onClick={ouvrirMesDonnees}>
            <span className="rail-ico">{I_DONNEES}</span>
            <span className="rail-txt">Mes données</span>
            <svg className="rail-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div className={`rail-sousmenu ${menuDonneesOuvert ? 'is-open' : ''}`}>{sousMenuListe}</div>

          <button type="button" className={`rail-item ${section === 'calendrier' ? 'is-active' : ''}`} aria-current={section === 'calendrier' ? 'page' : undefined} onClick={() => allerSection('calendrier')}>
            <span className="rail-ico">{I_CAL}</span>
            <span className="rail-txt">Calendrier</span>
          </button>
        </div>
        <div className="rail-foot">{donneesMenu}</div>
      </nav>

      {/* Mobile : feuille du bas des sous-sections (le rail est la barre du bas). */}
      <div className={`dd-sheet ${menuDonneesOuvert ? 'is-open' : ''}`} role="dialog" aria-label="Sections de Mes données" aria-hidden={!menuDonneesOuvert}>
        <div className="dd-sheet-tete">
          <span>Mes données</span>
          <button type="button" className="dd-sheet-x" onClick={() => setMenuDonneesOuvert(false)} aria-label="Fermer">×</button>
        </div>
        {sousMenuListe}
      </div>
      {menuDonneesOuvert && <div className="dd-fond" onClick={() => setMenuDonneesOuvert(false)} aria-hidden="true" />}

      <main className="main">
        {section === 'tour' && (
          <div className="tour">
            <div className="tour-hero">
              <h1 className="tour-bonjour">
                {snapshot.identity.prenom ? `Bonjour, ${snapshot.identity.prenom}` : 'Bon retour'}
              </h1>
              <p className="tour-accroche">Décris ce que tu veux suivre, ou crée un indicateur ci-dessous — ta tour le compose à partir de tes données.</p>

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

              {chargement && <p className="tour-hint">Ta tour compose ton indicateur…</p>}
              {erreur && <p className="tour-erreur">{erreur}</p>}
            </div>

            {/* LE TABLEAU : les indicateurs créés (persistants) + des emplacements « + créer ». */}
            <div className="tour-board">
              {widgets.map((w) => {
                const anime = w.id === nouveauWidget
                return (
                  <section className={`tour-widget tour-vues${anime ? ' is-anime' : ''}`} key={w.id}>
                    <div className="tour-widget-tete">
                      <span className="tour-widget-tag">Ton indicateur</span>
                      <span className="tour-widget-titre">{(w.recette && w.recette.titre) || 'Indicateur'}</span>
                      <button type="button" className="tour-widget-x" onClick={() => retirerWidget(w.id)} aria-label="Retirer cet indicateur" title="Retirer">×</button>
                    </div>
                    <MoteurRendu recette={w.recette} snapshot={snapshot} anime={anime} />
                  </section>
                )
              })}

              {creation ? (
                <div className="tour-creation card">
                  <div className="tour-creation-tete">
                    <span className="tour-creation-t">Crée un indicateur</span>
                    <button type="button" className="tour-creation-x" onClick={() => setCreation(null)} aria-label="Annuler">×</button>
                  </div>

                  {!creation.situation ? (
                    <div className="tour-creation-step">
                      <p className="tour-creation-q">Que veux-tu suivre&nbsp;? Choisis — ta tour compose le reste à partir de tes données.</p>
                      <div className="tour-creation-chips">
                        {Object.entries(SITUATIONS).map(([key, s]) => (
                          <button key={key} type="button" className={`tour-chip ${s.dispo ? '' : 'is-bientot'}`} disabled={!s.dispo} onClick={() => s.dispo && setCreation((c) => ({ ...c, situation: key }))}>
                            {s.label}{!s.dispo ? ' · bientôt' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="tour-creation-step">
                      {creation.situation === 'revenu_saisonnier' && (
                        <Entretien reponses={creation.reponses} onChange={(r) => setCreation((c) => ({ ...c, reponses: r }))} />
                      )}
                      {apercu && (
                        <div className="tour-creation-apercu tour-vues is-anime" key={creation.situation}>
                          <span className="tour-creation-apercu-tag">Aperçu — ta tour a composé ceci</span>
                          <MoteurRendu key={creation.situation} recette={apercu} snapshot={snapshot} anime />
                        </div>
                      )}
                      <div className="tour-creation-actions">
                        <button type="button" className="tour-creation-back" onClick={() => setCreation((c) => ({ ...c, situation: null }))}>← Changer</button>
                        <button type="button" className="tour-creation-add" onClick={() => ajouterWidget(apercu)}>Ajouter à ma tour</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="tour-slots">
                  <button type="button" className="tour-slot" onClick={ouvrirCreation}>
                    <span className="tour-slot-plus" aria-hidden="true">+</span>
                    <span className="tour-slot-l">Crée un indicateur</span>
                    <span className="tour-slot-s">Réponds à 2-3 questions, ta tour le compose</span>
                  </button>
                  {widgets.length === 0 && (
                    <button type="button" className="tour-slot" onClick={ouvrirCreation}>
                      <span className="tour-slot-plus" aria-hidden="true">+</span>
                      <span className="tour-slot-l">Ajoute une vue</span>
                      <span className="tour-slot-s">à partir de tes vraies données</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {section === 'donnees' && (
          <div className="donnees-wrap">
            <div className="section-tete">
              <h1 className="section-titre">Mes données <span className="section-fil">› {SS[sousSection].label}</span></h1>
              <p className="section-sous">Tes montants restent sur ton appareil. Choisis une section dans le menu de gauche — ton tableau de bord se met à jour à droite.</p>
            </div>

            <div className="donnees-layout">
              <div className="donnees-forms">
                {sousSection === 'revenus' && <SaisieRevenus revenus={store.revenus} onChange={setRevenus} />}
                {sousSection === 'depenses' && <SaisieDepenses depenses={store.depenses} onChange={setDepenses} />}
                {SS[sousSection].kind === 'patrimoine' && (
                  <>
                    <div className="ss-banniere">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v.01M11 12h1v4h1" /></svg>
                      <span>Saisie patrimoine <b>combinée</b> (transitoire) — placements, immobilier, dettes et hypothèque se saisissent ici pour l’instant. On les séparera par vagues.</span>
                    </div>
                    <SaisiePatrimoine patrimoine={store.patrimoine} onChange={setPatrimoine} />
                  </>
                )}
                {SS[sousSection].kind === 'bientot' && (
                  <SousSectionBientot
                    titre={SS[sousSection].label}
                    note={SS[sousSection].note}
                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{SS[sousSection].icon}</svg>}
                  />
                )}
                <div className="saisie-actions">
                  <button type="button" className="lien-action" onClick={chargerExemple}>Voir un exemple</button>
                  <button type="button" className="lien-action" onClick={repartirAZero}>Repartir à zéro</button>
                </div>
              </div>
              <aside className="donnees-panel">
                <PanneauVivant store={store} />
              </aside>
            </div>
          </div>
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
