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
import { loadStore, saveStore, emptyStore, exempleStore, loadBaseline, saveBaseline } from './lib/storage.js'
import { revenuMensuel } from './lib/revenus.js'
import MoteurRendu from './recettes/MoteurRendu.jsx'
import { formesPourKPI, nomForme } from './recettes/bibliotheque-kpis.js'
import EvenementsSaillants from './components/EvenementsSaillants.jsx'
import { genererEvenements, evenementsSaillants } from './lib/evenements.js'
import VerdictDuJour from './components/VerdictDuJour.jsx'
import { construireVerdict } from './lib/verdict.js'
import Galerie from './components/Galerie.jsx'
import MissionAllumage from './components/MissionAllumage.jsx'
import { appliquerMission } from './lib/missions.js'
import { construireGalerie } from './lib/galerie.js'
import { iconeKPI, iconeChoisie, ICONES_CHOIX, ICONE_SITUATION, I_VEDETTE, I_ECLAIR } from './components/iconesGalerie.jsx'
import { kpiPourId } from './recettes/bibliotheque-kpis.js'
import SaisieRevenus from './components/SaisieRevenus.jsx'
import SaisieDepenses from './components/SaisieDepenses.jsx'
import SaisiePatrimoine from './components/SaisiePatrimoine.jsx'
import PanneauVivant from './components/PanneauVivant.jsx'
import SousSectionBientot from './components/SousSectionBientot.jsx'
import { totalDepensesVie } from './lib/depenses.js'
import { formatCAD } from './lib/format.js'
import { routerMessage } from './recettes/routeur.js'
import { construireEntite, PALETTE_ACCENTS } from './lib/entites.js'
import StudioConversation from './components/StudioConversation.jsx'

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

  // Fabrication (section « Ma tour ») — LA GALERIE (cartes vivantes + barre « décris-le »).
  const [nouveauWidget, setNouveauWidget] = useState(null) // id du widget à animer (à sa CRÉATION seulement)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [studio, setStudio] = useState(null) // null = fermé ; {} = conversation studio en cours
  const [angleWidget, setAngleWidget] = useState(null) // id du widget dont ChoixAngle est ouvert (porte « après »)

  const snapshot = useMemo(() => snapshotFromStore(store), [store])
  // « DEPUIS TA DERNIÈRE VISITE » (VISION §7a·1) : le repère n'est plus le montage, mais la
  // DERNIÈRE VISITE — persistée dans son propre silo. Lu UNE fois (état précédent de toute la
  // session) ; « ce qui bouge » s'ajoute ensuite en direct à mesure que l'usager édite. Absent
  // (1re visite jamais) → null : seules les échéances parlent, jamais d'événement inventé (§10).
  const baselineRef = useRef(undefined)
  const visiteRef = useRef(null) // horodatage de la dernière visite → « il y a N jours »
  if (baselineRef.current === undefined) {
    const repere = loadBaseline()
    baselineRef.current = (repere && repere.snapshot) || null
    visiteRef.current = (repere && repere.visitedAt) || null
  }
  // La « clé du jour » : le verdict et les échéances lisent l'horloge — un onglet laissé
  // ouvert passé minuit afficherait hier. Rafraîchie au retour d'onglet (visibilitychange).
  const [jourCle, setJourCle] = useState(() => new Date().toDateString())
  const evenementsListe = useMemo(
    () => evenementsSaillants(genererEvenements(snapshot, baselineRef.current), 4),
    [snapshot, jourCle], // eslint-disable-line react-hooks/exhaustive-deps -- jourCle = dépendance temporelle voulue
  )
  // LE HÉROS du cockpit (VISION §7a·2) : le verdict du jour, produit pur du snapshot.
  const verdict = useMemo(() => construireVerdict(snapshot), [snapshot, jourCle]) // eslint-disable-line react-hooks/exhaustive-deps -- idem
  // Une carte givrée → LA MISSION « 2 min » (une question à la fois), pas le
  // formulaire. Les saisies détaillées de « Mes données » restent là pour fignoler.
  const [mission, setMission] = useState(null) // 'revenus' | 'depenses' | 'placements' | null
  const [allumes, setAllumes] = useState(null) // célébration : N outils qui viennent de s'allumer
  const allerSaisie = (sousSec) => setMission(sousSec || 'revenus')
  const finirMission = (reponses) => {
    const avant = construireGalerie(snapshot).totaux.prets
    const storeApres = appliquerMission(mission, reponses, store)
    const apres = construireGalerie(snapshotFromStore(storeApres)).totaux.prets
    setStore(() => storeApres)
    setMission(null)
    if (apres > avant) setAllumes(apres - avant) // célébrer le GESTE, en fait
  }
  useEffect(() => {
    if (allumes == null) return
    const id = setTimeout(() => setAllumes(null), 7000)
    return () => clearTimeout(id)
  }, [allumes])
  // Le snapshot courant devient le repère de la PROCHAINE visite — écrit au DÉPART (onglet
  // caché / pagehide), jamais au démontage React (StrictMode le double → corromprait le repère).
  const snapshotRef = useRef(snapshot)
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => {
    const estamper = () => saveBaseline(snapshotRef.current)
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') estamper()
      else setJourCle(new Date().toDateString()) // retour d'onglet → le « jour » se rafraîchit
    }
    window.addEventListener('pagehide', estamper)
    document.addEventListener('visibilitychange', surVisibilite)
    return () => {
      window.removeEventListener('pagehide', estamper)
      document.removeEventListener('visibilitychange', surVisibilite)
    }
  }, [])
  // Les indicateurs créés (persistés dans le silo) que la tour affiche.
  const widgets = Array.isArray(store.tourWidgets) ? store.tourWidgets : []

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
    setSection('donnees')
    setMenuOuvert(false)
  }

  // Ajoute/retire un indicateur persistant (store.tourWidgets). Les recettes restent
  // composées par composer.js (Galerie) ou par l'IA (barre « décris-le »). `accent` =
  // la couleur choisie à l'essayage (Galerie) — portée par le widget, pas la recette.
  const ajouterWidget = (recette, accent, icone) => {
    if (!recette || !Array.isArray(recette.blocs) || recette.blocs.length === 0) return
    // Anti-doublon : ne pas empiler deux fois la même vue (même situation).
    const dejaLa = (Array.isArray(store.tourWidgets) ? store.tourWidgets : []).some(
      (w) => w.recette && recette.situation && w.recette.situation === recette.situation,
    )
    if (dejaLa) { setErreur('Tu as déjà cette vue dans ta tour.'); return }
    setErreur(null)
    const id = 'w_' + Date.now()
    setStore((s) => ({
      ...s,
      tourWidgets: [...(Array.isArray(s.tourWidgets) ? s.tourWidgets : []), { id, recette, accent: accent || null, icone: icone || null }],
    }))
    setNouveauWidget(id) // → ce widget se CONSTRUIT pièce par pièce
  }
  const retirerWidget = (id) =>
    setStore((s) => ({ ...s, tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).filter((w) => w.id !== id) }))

  // Le héros KPI d'une recette (s'il y en a un) → ce qui peut « se voir autrement ».
  const heroKPI = (recette) => (recette && Array.isArray(recette.blocs) ? recette.blocs.find((b) => b && b.KPI) : null)
  // L'icône d'un widget : TON choix d'abord, sinon celle de son KPI héros, sinon
  // celle de sa situation, sinon l'étincelle.
  const iconeWidget = (w) => {
    const choisie = w && w.icone ? iconeChoisie(w.icone) : null
    if (choisie) return choisie
    const recette = w && w.recette
    const kb = heroKPI(recette)
    if (kb) { const def = kpiPourId(kb.KPI); return iconeKPI(kb.KPI, def && def.domaine) }
    return (recette && ICONE_SITUATION[recette.situation]) || I_VEDETTE
  }
  const changerIcone = (widgetId, iconeId) =>
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) => (w.id === widgetId ? { ...w, icone: iconeId } : w)),
    }))
  const changerTitre = (widgetId, titre) =>
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) =>
        w.id === widgetId && w.recette ? { ...w, recette: { ...w.recette, titre } } : w,
      ),
    }))
  // Porte « après » : échanger la FORME d'un KPI sur un widget persistant. Présentation
  // pure — le KPI est résolu une fois par MoteurRendu ; aucun montant n'est recalculé.
  const changerAngle = (widgetId, kpiId, forme) =>
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) =>
        w.id === widgetId && w.recette
          ? { ...w, recette: { ...w.recette, blocs: w.recette.blocs.map((b) => (b && b.KPI === kpiId ? { ...b, forme } : b)) } }
          : w,
      ),
    }))
  // TAPE LA CARTE → la forme suivante (le widget se métamorphose sous le doigt).
  const cyclerForme = (w) => {
    const kb = heroKPI(w.recette)
    if (!kb) return
    const formes = formesPourKPI(kb.KPI, snapshot, kb.params)
    if (formes.length < 2) return
    const i = formes.indexOf(kb.forme)
    changerAngle(w.id, kb.KPI, formes[(i + 1) % formes.length])
  }
  // Retoucher après coup : la couleur du widget (la promesse « en tout temps » tenue).
  const changerCouleur = (widgetId, hex) =>
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) => (w.id === widgetId ? { ...w, accent: hex } : w)),
    }))

  // Le « BAM » : la conversation studio → une ENTITÉ (silo) + sa tuile carte_entite qui
  // SE POSE dans le dashboard (animée, via nouveauWidget → stagger de MoteurRendu).
  const materialiserEntite = (config) => {
    const eid = 'e_' + Date.now()
    const entite = construireEntite(config, snapshot, eid)
    const wid = 'w_' + Date.now()
    const recette = { situation: 'entite_' + eid, titre: entite.nom, blocs: [{ type: 'carte_entite', params: { id: eid } }] }
    setStore((s) => ({
      ...s,
      entites: [...(Array.isArray(s.entites) ? s.entites : []), entite],
      tourWidgets: [...(Array.isArray(s.tourWidgets) ? s.tourWidgets : []), { id: wid, recette }],
    }))
    setNouveauWidget(wid) // la tuile se pose pièce par pièce
    setStudio(null)
  }

  // Barre « décris-le » (Galerie) : le message est ROUTÉ. « puis-je me le permettre »
  // → studio (canal projet_abordable, zéro IA) ; sinon → l'IA compose une recette.
  async function demanderIA(texte) {
    if (!texte || chargement) return
    if (routerMessage(texte).canal === 'projet_abordable') { setStudio({ texteInitial: texte }); setErreur(null); return }
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
    } catch {
      setErreur("Ta tour n'a pas pu composer ton outil. Réessaie, ou choisis une carte ci-dessous.")
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
              <p className="tour-accroche">Ta tour, tes outils — choisis une carte, tes vrais chiffres sont déjà dedans.</p>
            </div>

            {/* 1re vue sur le primitif événement : ce qui bouge maintenant (data-aware : rien → rien).
                depuis = dernière visite → sous-titre « depuis ta dernière visite » quand un changement est détecté. */}
            <EvenementsSaillants events={evenementsListe} depuis={visiteRef.current} />

            {/* LE HÉROS (VISION §7a·2) : le verdict du jour — la SEULE zone navy→cyan.
                Data-aware : aucun verdict possible → rien (jamais de zéro inventé). */}
            <VerdictDuJour verdict={verdict} />

            {/* La célébration : N outils viennent de s'allumer (un fait, 7 s, jamais un jugement). */}
            {allumes != null && !mission && (
              <div className="tour-allume gal-anim" role="status">
                <span className="gal-ic" aria-hidden="true">{I_ECLAIR}</span>
                <span className="tour-allume-txt">
                  <b>{allumes} outil{allumes > 1 ? 's' : ''}</b> {allumes > 1 ? 'viennent' : 'vient'} de s’allumer dans ton studio.
                </span>
              </div>
            )}

            {/* LE STUDIO GUIDÉ. La mission « 2 min » prend le relais quand on allume une
                famille ; la conversation studio (« puis-je me le permettre ») garde le sien. */}
            {mission ? (
              <MissionAllumage famille={mission} onFini={finirMission} onAnnuler={() => setMission(null)} />
            ) : studio ? (
              <StudioConversation snapshot={snapshot} onFini={materialiserEntite} onAnnuler={() => setStudio(null)} />
            ) : (
              <Galerie
                snapshot={snapshot}
                widgets={widgets}
                chargement={chargement}
                erreur={erreur}
                onDecrire={demanderIA}
                onAjouter={ajouterWidget}
                onAllerSaisie={allerSaisie}
              />
            )}

            {/* LE TABLEAU : les indicateurs déjà créés (persistants). En-tête façon
                salle de contrôle (voyant + « en service ») + tuile fantôme « à bâtir »
                en fin de tableau — on SENT que la tour se construit, pièce par pièce. */}
            {widgets.length > 0 && (
              <div className="tour-board">
                <div className="tour-board-tete">
                  <span className="tb-voyant" aria-hidden="true" />
                  <span className="tb-label">Tes indicateurs</span>
                  <span className="tb-etat">{widgets.length > 1 ? `${widgets.length} en service` : '1 en service'}</span>
                </div>
                {widgets.map((w) => {
                  const anime = w.id === nouveauWidget
                  const kb = heroKPI(w.recette)
                  const formes = kb ? formesPourKPI(kb.KPI, snapshot, kb.params) : []
                  const peutMorpher = formes.length > 1
                  const retoucheOuverte = angleWidget === w.id
                  return (
                    <section
                      className={`tour-widget tour-vues${anime ? ' is-anime' : ''}${w.accent ? ' a-couleur' : ''}`}
                      key={w.id}
                      style={w.accent ? { '--wacc': w.accent } : undefined}
                    >
                      <div className="tour-widget-tete">
                        <span className="tour-widget-ic" aria-hidden="true">{iconeWidget(w)}</span>
                        <span className="tour-widget-titre">{(w.recette && w.recette.titre) || 'Indicateur'}</span>
                        <button
                          type="button"
                          className={`tour-widget-retouche${retoucheOuverte ? ' is-ouverte' : ''}`}
                          onClick={() => setAngleWidget(retoucheOuverte ? null : w.id)}
                          aria-expanded={retoucheOuverte}
                          title="Retoucher (couleur, forme)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-1.6c-1.5 0-2.4 1.6-1.5 2.8.8 1.1.2 3.2-2.9 3.2z" />
                            <circle cx="7.5" cy="10.5" r="1.2" /><circle cx="12" cy="7.5" r="1.2" /><circle cx="16.5" cy="10.5" r="1.2" />
                          </svg>
                          Retoucher
                        </button>
                        <button type="button" className="tour-widget-x" onClick={() => retirerWidget(w.id)} aria-label="Retirer cet indicateur" title="Retirer">×</button>
                      </div>

                      {/* LA RETOUCHE : nom, couleur, forme, icône — TOUT, en tout temps. */}
                      {retoucheOuverte && (
                        <div className="retouche gal-anim" style={{ '--acc': w.accent || '#00b4d8' }}>
                          <div className="retouche-bloc retouche-nom">
                            <span className="gal-essai-l">Son nom</span>
                            <input
                              type="text"
                              className="gal-nom"
                              value={(w.recette && w.recette.titre) || ''}
                              maxLength={60}
                              onChange={(e) => changerTitre(w.id, e.target.value)}
                              aria-label="Renommer cet outil"
                            />
                          </div>
                          <div className="retouche-bloc">
                            <span className="gal-essai-l">Ta couleur</span>
                            <div className="gal-accents">
                              {PALETTE_ACCENTS.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className={`gal-accent${(w.accent || '#00b4d8') === a.hex ? ' is-choisi' : ''}`}
                                  style={{ background: a.hex }}
                                  onClick={() => changerCouleur(w.id, a.hex)}
                                  aria-label={`Couleur ${a.id}`}
                                />
                              ))}
                            </div>
                          </div>
                          {peutMorpher && (
                            <div className="retouche-bloc">
                              <span className="gal-essai-l">Sa forme</span>
                              <div className="gal-formes">
                                {formes.map((f) => (
                                  <button
                                    key={f}
                                    type="button"
                                    className={`gal-forme${f === kb.forme ? ' is-choisie' : ''}`}
                                    onClick={() => changerAngle(w.id, kb.KPI, f)}
                                    aria-pressed={f === kb.forme}
                                  >
                                    {nomForme(f)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="retouche-bloc">
                            <span className="gal-essai-l">Son icône</span>
                            <div className="gal-icones">
                              {ICONES_CHOIX.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className={`gal-icone${w.icone === c.id ? ' is-choisie' : ''}`}
                                  onClick={() => changerIcone(w.id, c.id)}
                                  aria-pressed={w.icone === c.id}
                                  aria-label={`Icône ${c.id}`}
                                >
                                  {c.svg}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAPE LA CARTE → la forme suivante (les contrôles internes gardent la main). */}
                      <div
                        className={`tour-rendu${peutMorpher ? ' est-tappable' : ''}`}
                        key={kb ? `${kb.KPI}:${kb.forme}` : 'fixe'}
                        onClick={
                          peutMorpher
                            ? (e) => { if (e.target.closest('button, input, a, select, textarea, [role="slider"]')) return; cyclerForme(w) }
                            : undefined
                        }
                      >
                        <MoteurRendu recette={w.recette} snapshot={snapshot} anime={anime} />
                        {peutMorpher && (
                          <span className="tour-tap-hint" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>
                            tape&nbsp;: autre forme
                          </span>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
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
