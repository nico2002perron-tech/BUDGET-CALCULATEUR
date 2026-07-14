/* ============================================================================
   App.jsx — LA COQUILLE single-pane (VISION §5, §9). Nav PERSISTANTE ; le
   contenu change DEDANS, sans rechargement (état React).
     · Desktop : rail latéral gauche (icône + libellé, pilule cyan active).
     · Mobile  : barre d'onglets en bas, façon app native (≥48px, safe-area).
   3 sections : Ma tour · Mes données · Calendrier. + menu Données (JSON).
   Un seul silo (budgetcalc_v1) → un seul snapshot → tout en direct.
   ========================================================================== */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { snapshotFromStore } from './lib/canonical.js'
import { loadStore, saveStore, emptyStore, exempleStore, loadBaseline, saveBaseline } from './lib/storage.js'
import { revenuMensuel } from './lib/revenus.js'
import MoteurRendu from './recettes/MoteurRendu.jsx'
import { formesPourKPI, nomForme } from './recettes/bibliotheque-kpis.js'
import EvenementsSaillants from './components/EvenementsSaillants.jsx'
import { genererEvenements, evenementsSaillants } from './lib/evenements.js'
import VerdictDuJour from './components/VerdictDuJour.jsx'
import { construireVerdict } from './lib/verdict.js'
import MissionAllumage from './components/MissionAllumage.jsx'
import { appliquerMission, MISSIONS } from './lib/missions.js'
import { construireGalerie, DOMAINES } from './lib/galerie.js'
import { iconeKPI, iconeChoisie, ICONES_CHOIX, ICONE_SITUATION, I_VEDETTE, I_ECLAIR } from './components/iconesGalerie.jsx'
import { kpiPourId, formeAdaptee, REGISTRE_KPIS, resolveKPI, statutCible, kpiABouge, deltaKPI, candidatsKPI, resoudreForme } from './recettes/bibliotheque-kpis.js'
import { composerVueObjectif } from './recettes/vue-objectif.js'
import { executerActions, resumeActions } from './recettes/actions.js'
import { perchesBoard, gestesDe } from './recettes/perches.js'
import BoardCopilote from './components/BoardCopilote.jsx'
import SaisieRevenus from './components/SaisieRevenus.jsx'
import SaisieDepenses from './components/SaisieDepenses.jsx'
import SaisiePatrimoine from './components/SaisiePatrimoine.jsx'
import PanneauVivant from './components/PanneauVivant.jsx'
import SousSectionBientot from './components/SousSectionBientot.jsx'
import { totalDepensesVie } from './lib/depenses.js'
import { formatCAD } from './lib/format.js'
import { routerMessage } from './recettes/routeur.js'
import { tailleWidget } from './recettes/schema.js'
import { construireEntite, PALETTE_ACCENTS, photoBornee } from './lib/entites.js'
import StudioConversation from './components/StudioConversation.jsx'
import CarreDeSable from './components/CarreDeSable.jsx'
import { VOIX_MENTOR } from './lib/personas.js'
import { PEAUX, peauValide, classePeau } from './lib/peaux.js'
import { sons, reglerSons } from './lib/sons.js'
import { useTheme, usePassage } from './lib/vivant.js'
import AnneauModeles from './components/AnneauModeles.jsx'

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
function reduitMouvement() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
    // « Mes vues » : des modèles de tuile réutilisables (structure seulement) —
    // gardé Array + entrées valides (un silo importé hostile repart propre).
    mesVues: Array.isArray(store.mesVues) ? store.mesVues.filter((v) => v && v.recette && Array.isArray(v.recette.blocs)) : [],
  }
}

function App() {
  const [peau, basculerPeau] = useTheme() // sombre par défaut ; le clair reste servi
  const [store, setStore] = useState(() => normaliser(loadStore()))
  const [section, setSection] = useState(() => (aDesRevenus(normaliser(loadStore())) ? 'tour' : 'donnees'))
  const [sousSection, setSousSection] = useState('revenus') // sous-section active de « Mes données »
  const [menuDonneesOuvert, setMenuDonneesOuvert] = useState(() => !aDesRevenus(normaliser(loadStore()))) // accordéon du rail
  const [menuOuvert, setMenuOuvert] = useState(false)
  const fileRef = useRef(null)

  // L'ATELIER (passage tour→atelier + anneau). Le passage n'est ACTIF que sur la
  // tour ; ailleurs il reste à plat. La barre IA a son propre champ/état.
  const refAtelier = useRef(null)
  const iaRef = useRef(null)
  const [iaTexte, setIaTexte] = useState('')
  usePassage(refAtelier, section === 'tour')
  // Focalise la barre IA de l'atelier (le focus fait défiler la scène jusqu'à elle).
  // Si une mission/le studio occupe l'atelier (iaRef absent), on y DESCEND quand même
  // plutôt que de ne rien faire (bouton muet).
  const focusIA = () => {
    if (iaRef.current) { iaRef.current.focus(); return }
    if (refAtelier.current) refAtelier.current.scrollIntoView({ behavior: reduitMouvement() ? 'auto' : 'smooth' })
  }
  // PIÈGE A : le scroll-snap ne vit QUE sur l'écran tour (sinon la SAISIE DE DONNÉES
  // se calerait bizarrement). On (dé)pose la classe sur <html> selon la section.
  useEffect(() => {
    document.documentElement.classList.toggle('scene-active', section === 'tour')
    return () => document.documentElement.classList.remove('scene-active')
  }, [section])

  // Fabrication (section « Ma tour ») — LA GALERIE (cartes vivantes + barre « décris-le »).
  const [nouveauWidget, setNouveauWidget] = useState(null) // id du widget à animer (à sa CRÉATION seulement)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [studio, setStudio] = useState(null) // null = fermé ; {} = conversation studio en cours
  const [angleWidget, setAngleWidget] = useState(null) // id du widget dont ChoixAngle est ouvert (porte « après »)
  const [peauSurvol, setPeauSurvol] = useState(null) // LE VIVANT : { id, peau } — la peau survolée en aperçu sur SA tuile
  const [vueSauvee, setVueSauvee] = useState(false) // toast transitoire « sauvée dans Mes vues »
  const [sable, setSable] = useState(null) // { id, rect } du widget ouvert dans le carré de sable (null = fermé)
  const [reorganise, setReorganise] = useState(false) // mode « Réorganiser » du board

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
  // Défense en profondeur : une clé de section sans mission réelle blanchirait
  // l'atelier (MissionAllumage rend null) → repli sur « revenus ».
  const allerSaisie = (sousSec) => setMission(MISSIONS[sousSec] ? sousSec : 'revenus')
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
  useEffect(() => {
    if (!vueSauvee) return
    const id = setTimeout(() => setVueSauvee(false), 4000)
    return () => clearTimeout(id)
  }, [vueSauvee])
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
  // Ref des tuiles la PLUS RÉCENTE → le copilote applique contre l'état FRAIS
  // (une tuile ajoutée pendant le fetch n'est jamais écrasée). Cf. sable A2.
  const widgetsRef = useRef(widgets)
  widgetsRef.current = widgets
  // Les départs tappables (data-aware) — calculés UNE fois par rendu (fonction PURE) ;
  // réutilisés par la barre-copilote compacte ET le strip d'onboarding.
  const perchesTour = perchesBoard(widgets, snapshot)
  // LA CASCADE D'ARRIVÉE : à l'entrée sur « Ma tour », les tuiles se posent une à une
  // (chorégraphie d'accueil, éphémère ~1,5s). La classe tombe ensuite : le FLIP, le
  // pulse « a bougé » et la pose du copilote gardent leurs propres animations.
  // État SEMÉ à true si on démarre sur la tour → la 1re frame peinte porte déjà la
  // cascade (pas de flash « board complet » avant qu'un effet passif l'arme). useLayout
  // (pas useEffect) : le setCascade(true) au retour sur la tour est flushé AVANT peinture.
  const [cascade, setCascade] = useState(() => section === 'tour')
  useLayoutEffect(() => {
    if (section !== 'tour') return
    setCascade(true)
    // 1200ms couvre la dernière tuile (--casc plafonné à 8 → 560ms de délai + 550ms
    // d'anim ≈ 1110ms) ; on ne prolonge pas l'état non-interactif inutilement.
    const id = setTimeout(() => setCascade(false), 1200)
    return () => { clearTimeout(id); setCascade(false) }
  }, [section])
  // Une salve du copilote a une chip « Annuler » en cours → garder le tableau
  // (et donc la barre + la chip) monté même si la salve a VIDÉ le board, sinon
  // l'Annuler se démonterait avec lui.

  // ── MODE « RÉORGANISER » : glisser pour réordonner (pointer events maison,
  // zéro dépendance). La tuile tirée suit le doigt (style direct, pas de
  // re-rendu par frame) ; les voisines GLISSENT à leur place (FLIP via WAAPI) ;
  // l'ordre est persisté dans store.tourWidgets (debounce existant).
  const tuilesRef = useRef(new Map()) // id → élément .tour-widget
  const dragRef = useRef(null) // le geste en cours { id, pointerId, px, py, tx, ty, derniereCible, tCible, surMove, surFin }
  const rectsAvantRef = useRef(null) // photos des rects AVANT un réordonnancement (FLIP)
  const flipEnCoursRef = useRef(false) // vrai pendant l'anim FLIP → le tilt (verre 3D) se coupe
  const tuileTilteeRef = useRef(null) // la tuile actuellement inclinée sous le curseur

  // LE VERRE 3D au survol — DÉLÉGUÉ sur le board (plutôt que useVerre3D par tuile,
  // qui exigerait d'extraire chaque tuile en composant et risquerait le FLIP/drag/
  // retouche). Même logique : la tuile sous le curseur s'incline et un reflet
  // (--mx/--my) suit le pointeur. COUPÉ en Réorganiser ET pendant le FLIP (PIÈGE 1 :
  // le transform inline se battrait avec le drag et l'anim FLIP). reduced-motion → rien.
  const resetTilt = () => {
    const el = tuileTilteeRef.current
    if (!el) return
    el.style.transition = 'transform .7s cubic-bezier(.22, .61, .36, 1)'
    el.style.transform = ''
    el.style.removeProperty('--mx')
    el.style.removeProperty('--my')
    tuileTilteeRef.current = null
  }
  const surBoardMove = (e) => {
    if (reorganise || flipEnCoursRef.current || reduitMouvement()) return
    const el = e.target.closest ? e.target.closest('.tour-widget') : null
    if (!el || el.classList.contains('is-anime') || el.classList.contains('est-tiree')) { resetTilt(); return }
    if (tuileTilteeRef.current && tuileTilteeRef.current !== el) resetTilt()
    tuileTilteeRef.current = el
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    el.style.transition = 'transform .12s linear'
    el.style.transform = `perspective(1200px) rotateY(${((px - 0.5) * 12).toFixed(2)}deg) rotateX(${(-(py - 0.5) * 12).toFixed(2)}deg) translateY(-4px)`
  }
  // Entrer en Réorganiser efface un tilt résiduel (sinon la tuile resterait inclinée
  // pendant le drag). eslint-disable : resetTilt ne touche que des refs.
  useEffect(() => { if (reorganise) resetTilt() }, [reorganise]) // eslint-disable-line react-hooks/exhaustive-deps
  const [tireeId, setTireeId] = useState(null) // la tuile soulevée — PILOTÉE par React (jamais classList : un re-rendu l'effacerait)
  const poseTuile = (id) => (n) => { if (n) tuilesRef.current.set(id, n); else tuilesRef.current.delete(id) }
  const reordonnerWidgets = (deId, versId) => {
    setStore((s) => {
      const liste = Array.isArray(s.tourWidgets) ? [...s.tourWidgets] : []
      const de = liste.findIndex((w) => w.id === deId)
      const vers = liste.findIndex((w) => w.id === versId)
      if (de < 0 || vers < 0 || de === vers) return s
      const [bouge] = liste.splice(de, 1)
      liste.splice(vers, 0, bouge)
      return { ...s, tourWidgets: liste }
    })
  }
  // Fin de geste (relâché, annulé, sortie de mode, démontage) : TOUJOURS nettoyer.
  const finirDrag = (annule) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    document.removeEventListener('pointermove', d.surMove)
    document.removeEventListener('pointerup', d.surFin)
    document.removeEventListener('pointercancel', d.surFin)
    setTireeId(null)
    const el = tuilesRef.current.get(d.id)
    if (!el) return
    const t = el.style.transform
    el.style.transform = ''
    if (t && !annule && !reduitMouvement()) {
      try { el.animate([{ transform: t }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }) } catch { /* décoratif */ }
    }
  }
  const finirDragRef = useRef(finirDrag)
  finirDragRef.current = finirDrag
  const bougeDrag = (e, d) => {
    const el = tuilesRef.current.get(d.id)
    if (!el) return
    d.tx += e.clientX - d.px
    d.ty += e.clientY - d.py
    d.px = e.clientX
    d.py = e.clientY
    // auto-scroll doux près des bords (au doigt, touch-action:none bloque le défilement natif)
    if (e.clientY < 90) { window.scrollBy(0, -16); d.ty -= 16 }
    else if (e.clientY > window.innerHeight - 90) { window.scrollBy(0, 16); d.ty += 16 }
    el.style.transform = `translate(${d.tx}px, ${d.ty}px) scale(1.04)`
    // la tuile SOUS le pointeur devient la destination ; hors cible → on débloque
    // (le retour en arrière re-marche) ; 120 ms entre deux échanges (anti ping-pong).
    let cible = null
    tuilesRef.current.forEach((n, oid) => {
      if (oid === d.id || !n) return
      const r = n.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) cible = oid
    })
    if (!cible) { d.derniereCible = null; return }
    const maintenant = performance.now()
    if (cible === d.derniereCible || maintenant - d.tCible < 120) return
    d.derniereCible = cible
    d.tCible = maintenant
    rectsAvantRef.current = new Map([...tuilesRef.current].map(([oid, n]) => [oid, n.getBoundingClientRect()]))
    reordonnerWidgets(d.id, cible)
  }
  // Le geste vit sur DOCUMENT (pas de capture d'élément : React déplace les nœuds
  // au reorder et la capture se perdrait ; un 2e pointeur est ignoré).
  const surTuilePointerDown = (e, id) => {
    if (!reorganise || dragRef.current || e.button > 0) return
    if (e.target.closest('button, input, a, select, textarea')) return
    const d = { id, pointerId: e.pointerId, px: e.clientX, py: e.clientY, tx: 0, ty: 0, derniereCible: null, tCible: 0 }
    d.surMove = (ev) => { if (ev.pointerId === d.pointerId) bougeDrag(ev, d) }
    d.surFin = (ev) => { if (ev.pointerId === d.pointerId) finirDragRef.current(false) }
    dragRef.current = d
    document.addEventListener('pointermove', d.surMove)
    document.addEventListener('pointerup', d.surFin)
    document.addEventListener('pointercancel', d.surFin)
    setTireeId(id)
  }
  // Sortie du mode ou démontage en plein geste → jamais une tuile figée « soulevée ».
  useEffect(() => {
    if (!reorganise) finirDragRef.current(true)
  }, [reorganise])
  useEffect(() => () => finirDragRef.current(true), [])

  // LA POIGNÉE DE TAILLE : cycle s → m → l (→ xl pour les vues complètes),
  // persistée sur le widget ; les voisines glissent (même FLIP que le drag).
  const cyclerTaille = (w) => {
    sons.tap()
    const multi = w.recette && Array.isArray(w.recette.blocs) && w.recette.blocs.filter(Boolean).length > 1
    const cycle = multi ? ['s', 'm', 'l', 'xl'] : ['s', 'm', 'l']
    const prochaine = cycle[(cycle.indexOf(tailleWidget(w)) + 1) % cycle.length]
    rectsAvantRef.current = new Map([...tuilesRef.current].map(([oid, n]) => [oid, n.getBoundingClientRect()]))
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((x) => (x.id === w.id ? { ...x, taille: prochaine } : x)),
    }))
  }

  // La recette AFFICHÉE s'adapte à la taille de la tuile (S → forme compacte,
  // L/XL → forme large) — présentation pure, la recette STOCKÉE reste intacte.
  const recetteAffichee = (w) => {
    const kb = heroKPI(w.recette)
    if (!kb) return w.recette
    const forme = formeAdaptee(kb.KPI, kb.forme, tailleWidget(w), snapshot, kb.params)
    if (forme === kb.forme) return w.recette
    return { ...w.recette, blocs: w.recette.blocs.map((b) => (b && b.KPI === kb.KPI ? { ...b, forme } : b)) }
  }
  // FLIP : après un réordonnancement, chaque tuile part de son ANCIENNE place et
  // glisse vers la nouvelle. La tuile tirée, elle, reste collée au pointeur
  // (on compense le saut de mise en page dans son transform manuel).
  const ordreCle = widgets.map((w) => `${w.id}:${w.taille || ''}`).join('|') // ordre ET taille → FLIP
  useLayoutEffect(() => {
    // Tout changement d'ordre/taille/membres du tableau efface un tilt résiduel —
    // AVANT le early-return, car le copilote (retrait, redimension, réordonnancement
    // au clavier via « / ») reflue SANS mouvement de souris et ne pose pas de rects
    // AVANT : sans ça, une tuile survolée resterait figée inclinée jusqu'au prochain
    // pointermove.
    resetTilt()
    const avant = rectsAvantRef.current
    rectsAvantRef.current = null
    if (!avant) return
    // PIÈGE 1 : pendant le FLIP, le tilt du verre 3D doit se taire (transform inline
    // qui se battrait avec l'anim). On le rétablit après (~220ms > durée 190ms).
    flipEnCoursRef.current = true
    setTimeout(() => { flipEnCoursRef.current = false }, 220)
    const reduce = reduitMouvement()
    const d = dragRef.current
    tuilesRef.current.forEach((el, id) => {
      const oa = avant.get(id)
      if (!el || !oa) return
      const na = el.getBoundingClientRect()
      const dx = oa.left - na.left
      const dy = oa.top - na.top
      if (d && id === d.id) {
        d.tx += dx
        d.ty += dy
        el.style.transform = `translate(${d.tx}px, ${d.ty}px) scale(1.04)`
        return
      }
      if ((dx || dy) && !reduce) {
        try { el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 190, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }) } catch { /* décoratif */ }
      }
    })
  }, [ordreCle]) // eslint-disable-line react-hooks/exhaustive-deps -- rejoue au changement d'ORDRE seulement

  // Les sons discrets suivent la préférence persistée (défaut : activés).
  useEffect(() => { reglerSons(store.sons !== false) }, [store.sons])

  // La persistance peut ÉCHOUER (quota localStorage plein — photos base64…) :
  // jamais en silence. saveStore retourne false → alerte visible.
  const [sauvegardeKO, setSauvegardeKO] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSauvegardeKO(!saveStore(store)), 250)
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
    sons.pose()
    // Id UNIQUE même pour des ajouts rapprochés dans la même milliseconde (le
    // pré-remplissage en pose plusieurs d'affilée) : Date.now() seul entrerait en
    // collision → clés React dupliquées.
    const id = 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    setStore((s) => ({
      ...s,
      // Dès qu'une tuile est posée (par l'usager OU par l'amorçage), le pré-remplissage
      // ne pourra plus jamais revenir — même si la tour est ensuite vidée. C'est
      // l'invariant « une tuile retirée ne revient jamais », verrouillé à l'action.
      amorcee: true,
      tourWidgets: [...(Array.isArray(s.tourWidgets) ? s.tourWidgets : []), { id, recette, accent: accent || null, icone: icone || null }],
    }))
    setNouveauWidget(id) // → ce widget se CONSTRUIT pièce par pièce
  }
  const retirerWidget = (id) =>
    setStore((s) => ({ ...s, tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).filter((w) => w.id !== id) }))

  // PRÉ-REMPLISSAGE (VISION §8 : « réarranger un dashboard VIDE est un piège — le
  // bon truc doit déjà être à la bonne place »). Au TOUT premier chargement où des
  // revenus existent et où la tour est encore vide, on POSE 2-3 indicateurs budget
  // par le chemin NORMAL (ajouterWidget), jamais en écrivant tourWidgets à la main.
  // On ne pose QUE des KPIs dont la donnée existe (candidatsKPI) — jamais une tuile
  // éteinte sur le poste (l'éteint vit dans l'atelier). Le drapeau `amorcee` est
  // posé une seule fois : une tuile retirée par l'usager ne revient JAMAIS.
  const amorceFaite = useRef(false) // verrou synchrone : survit au double-invoke de StrictMode
  useEffect(() => {
    if (amorceFaite.current || store.amorcee || widgets.length > 0 || !aDesRevenus(store)) return
    const cands = candidatsKPI('budget', snapshot).slice(0, 3)
    if (cands.length === 0) return // aucune donnée prête → on n'amorce pas (on réessaiera au prochain rendu)
    amorceFaite.current = true // pose le verrou AVANT de semer (le 2e passage StrictMode ressort ici)
    cands.forEach((k) => {
      const forme = resoudreForme(k.id, null, snapshot, {})
      if (!forme) return
      ajouterWidget({ situation: `kpi_${k.id}`, titre: k.question, blocs: [{ KPI: k.id, forme, params: {} }] })
    })
    setStore((s) => ({ ...s, amorcee: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, snapshot, widgets.length])

  // DUPLIQUER une tuile en VARIANTE : un clone profond (recette + blocs + params,
  // JSON-sérialisable → isolation totale), posé JUSTE APRÈS l'original, animé. On
  // garde la MÊME `situation` (progression.js mappe situation→étage : la variante
  // compte pour son étage ; les clés React sont l'id, jamais la situation). C'est
  // le geste « plus de pouvoir » : on part d'une base et on la fait diverger.
  const dupliquerWidget = (id) => {
    const base = Array.isArray(store.tourWidgets) ? store.tourWidgets : []
    const src = base.find((w) => w.id === id)
    if (!src || !src.recette || !Array.isArray(src.recette.blocs)) return
    let recette
    try { recette = JSON.parse(JSON.stringify(src.recette)) } catch { return }
    const t = src.recette.titre || 'Ta tuile'
    recette.titre = `${t.length > 52 ? t.slice(0, 52) : t} (copie)`
    const neufId = 'w_' + Date.now()
    const neuf = { id: neufId, recette, accent: src.accent || null, icone: src.icone || null }
    if (src.taille) neuf.taille = src.taille
    sons.pose()
    setStore((s) => {
      const arr = Array.isArray(s.tourWidgets) ? s.tourWidgets : []
      const j = arr.findIndex((w) => w.id === id) // index FRAIS (l'état a pu bouger)
      if (j < 0) return s
      return { ...s, tourWidgets: [...arr.slice(0, j + 1), neuf, ...arr.slice(j + 1)] }
    })
    setNouveauWidget(neufId) // la variante SE POSE (le « bam »)
    setAngleWidget(null) // ferme la retouche de l'original
  }

  // « MES VUES » : sauver une tuile configurée comme MODÈLE réutilisable — STRUCTURE
  // seulement (recette + style), JAMAIS un montant (la recette ne porte que des
  // intentions : forme, mesure, découpe, cible, comparaisons). On part de ce qu'on
  // a fabriqué et on peut le re-poser quand on veut. Anti-doublon par signature.
  const sauverVue = (id) => {
    const w = (Array.isArray(store.tourWidgets) ? store.tourWidgets : []).find((x) => x.id === id)
    if (!w || !w.recette || !Array.isArray(w.recette.blocs)) return
    let recette
    try { recette = JSON.parse(JSON.stringify(w.recette)) } catch { return }
    const nom = (w.recette.titre || 'Ma vue').slice(0, 60)
    const vue = { id: 'v_' + Date.now(), nom, recette, accent: w.accent || null, icone: w.icone || null, peau: w.peau || null, persona: w.persona || null }
    const sig = (v) => JSON.stringify([v.recette.situation, v.recette.blocs, v.accent, v.peau])
    setStore((s) => {
      const arr = Array.isArray(s.mesVues) ? s.mesVues : []
      if (arr.some((v) => sig(v) === sig(vue))) return s // déjà sauvée à l'identique
      return { ...s, mesVues: [vue, ...arr].slice(0, 12) } // plus récente en tête, cap 12
    })
    sons.pose()
    setVueSauvee(true)
  }
  const supprimerVue = (vid) =>
    setStore((s) => ({ ...s, mesVues: (Array.isArray(s.mesVues) ? s.mesVues : []).filter((v) => v.id !== vid) }))
  // L'ADVISOR CONFORME : un but → une VUE COMPOSÉE de FAITS. Depuis une tuile-objectif
  // (héros d'un projet, ex. « Maison »), un geste déploie le tableau complet — où j'en
  // suis, ce qu'il manque, l'effort, le réalisme À MON RYTHME. Jamais un conseil : ce
  // sont les KPI objectif (déjà conformes), résolus data-aware sur la MÊME cible.
  const monterVueObjectif = (id) => {
    const w = (Array.isArray(store.tourWidgets) ? store.tourWidgets : []).find((x) => x.id === id)
    const kb = w && heroKPI(w.recette)
    const objectif = kb && kb.params && kb.params.objectif
    if (!objectif || !(Number(objectif.cible) > 0)) return
    const recettes = composerVueObjectif(objectif, snapshot, kb.KPI)
    const dejaLa = new Set((Array.isArray(store.tourWidgets) ? store.tourWidgets : []).map((x) => x.recette && x.recette.situation))
    const neufs = recettes.filter((r) => !dejaLa.has(r.situation)).map((r, i) => ({ id: `w_${Date.now()}_${i}`, recette: r, accent: w.accent || null }))
    if (!neufs.length) { setAngleWidget(null); return }
    sons.pose()
    setStore((s) => ({ ...s, tourWidgets: [...(Array.isArray(s.tourWidgets) ? s.tourWidgets : []), ...neufs] }))
    setNouveauWidget(neufs[neufs.length - 1].id) // le dernier SE POSE (le « bam »)
    setAngleWidget(null)
  }

  // Re-poser un modèle : une tuile NEUVE (nouvel id) depuis la vue sauvée, animée.
  const appliquerVue = (vue) => {
    if (!vue || !vue.recette || !Array.isArray(vue.recette.blocs)) return
    let recette
    try { recette = JSON.parse(JSON.stringify(vue.recette)) } catch { return }
    const id = 'w_' + Date.now()
    const neuf = { id, recette, accent: vue.accent || null, icone: vue.icone || null }
    if (vue.peau) neuf.peau = vue.peau
    if (vue.persona) neuf.persona = vue.persona
    sons.pose()
    setStore((s) => ({ ...s, tourWidgets: [...(Array.isArray(s.tourWidgets) ? s.tourWidgets : []), neuf] }))
    setNouveauWidget(id)
    setSection('tour') // aller voir la tuile se poser
  }

  // ÉPINGLER depuis le carré de sable : la vue fabriquée (forme, comparaisons,
  // cible, personnalité) devient LA tuile — mise à jour EN PLACE (même id,
  // jamais un doublon), persistée par le debounce existant.
  const [epingleFete, setEpingleFete] = useState(false) // célébration factuelle après un épinglage
  useEffect(() => {
    if (!epingleFete) return
    const id = setTimeout(() => setEpingleFete(false), 6000)
    return () => clearTimeout(id)
  }, [epingleFete])
  const epinglerSable = (maj) => {
    if (!sable) return
    sons.pose()
    setEpingleFete(true)
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) => {
        if (w.id !== sable.id || !w.recette || !Array.isArray(w.recette.blocs)) return w
        const params = { ...(maj.params || {}) }
        Object.keys(params).forEach((k) => { if (params[k] === undefined) delete params[k] })
        const blocs = w.recette.blocs.map((b) => (b && b.KPI ? { ...b, forme: maj.forme || b.forme, params } : b))
        // titre/couleur changés dans le sable (par le copilote) → repliés ici aussi.
        const recette = typeof maj.titre === 'string' && maj.titre.trim() ? { ...w.recette, titre: maj.titre, blocs } : { ...w.recette, blocs }
        const w2 = { ...w, recette, epingle: true }
        if (maj.couleur) w2.accent = maj.couleur
        if (maj.persona) w2.persona = maj.persona
        else delete w2.persona
        return w2
      }),
    }))
  }

  // Le héros KPI d'une recette (s'il y en a un) → ce qui peut « se voir autrement ».
  const heroKPI = (recette) => (recette && Array.isArray(recette.blocs) ? recette.blocs.find((b) => b && b.KPI) : null)
  // L'icône d'un widget : la PERSONNALITÉ épinglée d'abord (photo d'entité,
  // initiale, initiales du mentor), puis TON choix, puis celle de son KPI
  // héros, puis celle de sa situation, sinon l'étincelle.
  const iconeWidget = (w) => {
    const p = w && w.persona
    const photo = p && p.type === 'entite' ? photoBornee(p.photo) : null // re-borné au rendu (jamais d'URL réseau)
    if (photo) return <span className="twic-photo" style={{ backgroundImage: `url(${photo})` }} />
    if (p && p.type === 'entite') return <span className="twic-init">{String(p.nom || 'E').trim().charAt(0).toUpperCase() || 'E'}</span>
    if (p && p.type === 'mentor') {
      const voix = VOIX_MENTOR.find((v) => v.id === p.voix) || VOIX_MENTOR[0]
      return <span className="twic-init">{voix.nom.split(' ').map((m) => m[0]).slice(0, 2).join('').toUpperCase()}</span>
    }
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
  // Retoucher après coup : la couleur du widget (la promesse « en tout temps » tenue).
  const changerCouleur = (widgetId, hex) =>
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) => (w.id === widgetId ? { ...w, accent: hex } : w)),
    }))
  // La PEAU (fini de la carte) : style seulement, teinté de ta couleur. 'defaut' → on
  // retire la clé (le look de base est l'absence de peau).
  const changerPeau = (widgetId, peauId) =>
    setStore((s) => ({
      ...s,
      tourWidgets: (Array.isArray(s.tourWidgets) ? s.tourWidgets : []).map((w) => {
        if (w.id !== widgetId) return w
        if (peauId === 'defaut' || !peauValide(peauId)) { const { peau: _drop, ...reste } = w; return reste }
        return { ...w, peau: peauId }
      }),
    }))

  // ── LA BARRE-COPILOTE DU BOARD : ta phrase → des ACTIONS de tableau (créer,
  //    répondre, retirer, redimensionner, ouvrir). Payload = FORME seulement
  //    (ids + questions, JAMAIS un montant). executerActions (A1) VALIDE +
  //    applique ; « Annuler » (closure) restaure les tuiles d'avant.
  const VERBES_BOARD = ['creer_widget', 'repondre_kpi', 'retirer_widget', 'redimensionner', 'ouvrir_sable']
  const DOMAINES_GALERIE = new Set(DOMAINES.map((d) => d.id)) // ce que la Galerie sait bâtir (pas 'objectif'/'dette')
  // ENSEIGNEMENT PROGRESSIF : les GESTES du copilote déjà utilisés (persistés →
  // on ne réenseigne pas ce qu'on sait). Juste des clés de capacité, aucun montant.
  const appris = Array.isArray(store.copiloteAppris) ? store.copiloteAppris : []
  const marquerAppris = (gestes) => {
    const neufs = (Array.isArray(gestes) ? gestes : []).filter((g) => g && !appris.includes(g))
    if (!neufs.length) return
    // garde locale UNIQUE (base du spread ET source du .includes) : un silo
    // importé hostile (copiloteAppris = nombre/objet/string) repart proprement.
    setStore((s) => {
      const cop = Array.isArray(s.copiloteAppris) ? s.copiloteAppris : []
      return { ...s, copiloteAppris: [...cop, ...neufs.filter((g) => !cop.includes(g))] }
    })
  }
  const sansNeuf = (w) => { const c = { ...w }; delete c.nouveau; return c } // enlève le drapeau transitoire de pose
  async function piloterBoard(texte) {
    // Les indicateurs OFFERTS = ceux des 5 domaines de la Galerie ET résolubles :
    // le copilote ne fait naître QUE ce que la tour sait bâtir (jamais une tuile vide).
    const kpisOfferts = REGISTRE_KPIS
      .filter((k) => DOMAINES_GALERIE.has(k.domaine))
      .filter((k) => { const r = resolveKPI(k.id, snapshot); return r && r.disponible })
      .map((k) => ({ id: k.id, question: k.question }))
    const tuiles = widgetsRef.current.map((w) => { const kb = heroKPI(w.recette); return { id: w.id, kpi: kb ? kb.KPI : '', taille: tailleWidget(w) } })
    const res = await fetch('/api/build-tool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ mode: 'piloter', surface: 'board', texte, tuiles, kpisOfferts }),
    })
    const data = await res.json()
    if (!res.ok || !data || !Array.isArray(data.actions)) throw new Error('réponse invalide')
    const filtrees = data.actions.filter((a) => a && VERBES_BOARD.includes(a.verbe))
    return appliquerBoard(filtrees)
  }
  // Applique une salve d'actions board sur l'état FRAIS (relu ICI, jamais la
  // closure du submit) → persiste + pose la tuile + Annuler. Partagé par la
  // barre (après le fetch) ET par les perches tappables (exécution directe).
  function appliquerBoard(actions) {
    const filtrees = (Array.isArray(actions) ? actions : []).filter((a) => a && VERBES_BOARD.includes(a.verbe))
    const base = widgetsRef.current
    const { etat, faites, refusees } = executerActions(filtrees, { snapshot, nouvelId: () => 'w_' + Date.now() }, { widgets: base, sable: null })
    if (!faites.length && !refusees.length) return {} // rien surfacé → la barre affiche sa note
    if (faites.length) marquerAppris(gestesDe(faites.map((f) => ({ verbe: f.verbe })))) // la capacité est apprise
    const crees = etat.widgets.filter((w) => w.nouveau).map((w) => w.id)
    setStore((s) => ({ ...s, tourWidgets: etat.widgets.map(sansNeuf) }))
    if (crees.length) { sons.pose(); setNouveauWidget(crees[crees.length - 1]) } // la tuile SE POSE (le « bam »)
    let ouvert = false
    if (etat.sable && etat.sable.widgetId) { setSable({ id: etat.sable.widgetId, rect: null }); ouvert = true }
    const annuler = () => { setStore((s) => ({ ...s, tourWidgets: base })); if (ouvert) setSable(null) }
    return {
      resume: faites.length ? resumeActions(faites) : null,
      refus: refusees.length ? refusees[0].raison : null,
      annuler: faites.length ? annuler : null,
    }
  }

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

  // La bascule de peau — un fait, pas un réglage caché. Montre l'icône de la peau
  // vers laquelle on VA (soleil en sombre, lune en clair). Vit dans le rail (desktop)
  // et la topbar (mobile) : toujours à portée.
  const basculePeau = (
    <button
      type="button"
      className="peau-bascule"
      onClick={basculerPeau}
      aria-label={peau === 'sombre' ? 'Passer en peau claire' : 'Passer en peau sombre'}
      title={peau === 'sombre' ? 'Peau claire' : 'Peau sombre'}
    >
      {peau === 'sombre' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
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
        <div className="topbar-actions">{basculePeau}{donneesMenu}</div>
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
        <div className="rail-foot">{basculePeau}{donneesMenu}</div>
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
        {/* L'exception (ambre légitime) : la sauvegarde locale a échoué. */}
        {sauvegardeKO && (
          <div className="alerte-silo" role="alert">
            Tes derniers changements n’ont pas pu être sauvegardés — l’espace local de ton navigateur est plein.
            Exporte tes données (menu Données) ou retire une photo d’entité.
          </div>
        )}

        {section === 'tour' && (
          <>
          <section className="scene-tour">
          {/* LE BANDEAU : le bloc de couleur derrière le haut de la tour. Les tuiles du
              board (juste dessous) le CHEVAUCHENT → leur verre a de la couleur à réfracter. */}
          <div className="bandeau" aria-hidden="true"><i className="bandeau-lueur" /></div>
          <div className="tour-corps">
          <div className="tour">
            {/* L'EN-TÊTE — UNE barre SUR le bandeau : salutation à gauche, barre-copilote
                à droite (margin-left:auto). Tout ce qui repose sur la couleur cyan est en
                BLANC EN DUR (le bandeau est cyan dans LES DEUX peaux). */}
            <div className="tour-entete">
              <div className="tour-hero">
                <h1 className="tour-bonjour">
                  {snapshot.identity.prenom ? `Bonjour, ${snapshot.identity.prenom}` : 'Bon retour'}
                </h1>
                {/* LA LIGNE D'ÉTAT (LOT 2) : le verdict du jour se lit ICI, sans défiler.
                    Blanc EN DUR (bandeau cyan) ; montants en cyan-soft, exception négative
                    en ambre. À défaut de verdict, l'accroche-slogan — mais seulement quand
                    la tour est encore vide (une tour habitée n'a plus à se vendre). */}
                {verdict && Array.isArray(verdict.phrase) && verdict.phrase.length > 0 ? (
                  <p className="tour-verdict-ligne">
                    {verdict.phrase.map((s, i) => (s.fort
                      ? <b key={i} className={s.sens === 'neg' ? 'neg' : undefined}>{s.texte}</b>
                      : <span key={i}>{s.texte}</span>))}
                  </p>
                ) : widgets.length === 0 ? (
                  <p className="tour-accroche">Tes vrais chiffres sont déjà dedans — demande, ou choisis une carte.</p>
                ) : null}
              </div>
              <BoardCopilote compact onPiloter={piloterBoard} onPerche={appliquerBoard} perches={perchesTour} appris={appris} />
            </div>
            {/* LES DÉPARTS (onboarding) : SOUS le bandeau, seulement quand la tour est vide.
                Ils disparaissent dès qu'un indicateur existe (choix explicite : le board
                straddle le bandeau juste dessous, aucune place pour eux au-dessus). */}
            {widgets.length === 0 && perchesTour.length > 0 && (
              <div className="tour-departs">
                <span className="tour-departs-l">Pour commencer</span>
                <div className="tour-departs-liste">
                  {perchesTour.map((p) => (
                    <button key={p.label} type="button" className="cop-perche" onClick={() => appliquerBoard(p.actions)}>{p.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* La célébration d'épinglage : ta tuile vient d'être mise à jour (un fait, 6 s). */}
            {epingleFete && !mission && (
              <div className="tour-allume gal-anim" role="status">
                <span className="gal-ic" aria-hidden="true">{I_ECLAIR}</span>
                <span className="tour-allume-txt"><b>Épinglée.</b> Ta tuile est à jour — tape-la pour la retoucher quand tu veux.</span>
              </div>
            )}

            {vueSauvee && !mission && (
              <div className="tour-allume gal-anim" role="status">
                <span className="gal-ic" aria-hidden="true">{I_ECLAIR}</span>
                <span className="tour-allume-txt"><b>Sauvée dans « Mes vues ».</b> Re-pose-la quand tu veux depuis l&rsquo;atelier (descends).</span>
              </div>
            )}

            {/* La célébration : N outils viennent de s'allumer (un fait, 7 s, jamais un jugement). */}
            {allumes != null && !mission && (
              <div className="tour-allume gal-anim" role="status">
                <span className="gal-ic" aria-hidden="true">{I_ECLAIR}</span>
                <span className="tour-allume-txt">
                  <b>{allumes} outil{allumes > 1 ? 's' : ''}</b> {allumes > 1 ? 'viennent' : 'vient'} de s’allumer dans ton studio.
                </span>
              </div>
            )}

            {/* LA FABRICATION (barre IA + anneau de modèles, ou la mission/le studio
                guidés) vit dans la SCÈNE-ATELIER plus bas — atteinte en DESCENDANT. */}

            {/* LE TABLEAU : les indicateurs déjà créés (persistants). En-tête façon
                salle de contrôle (voyant + « en service ») + tuile fantôme « à bâtir »
                en fin de tableau — on SENT que la tour se construit, pièce par pièce. */}
            {widgets.length > 0 && (
              <div className="tour-tableau">
                {/* LA GRILLE LIBRE : chaque tuile porte sa taille (s/m/l/xl — persistée
                    ou dérivée de sa recette) ; `dense` remplit les trous. */}
                <div className={`tour-board${reorganise ? ' est-reorg' : ''}${cascade ? ' est-arrivee' : ''}${widgets.length <= 2 ? ' est-naissant' : ''}`} onPointerMove={surBoardMove} onPointerLeave={resetTilt}>
                {(() => {
                  // La 1re tuile SABLE-ABLE (KPI héros connu) porte l'indice d'apprentissage
                  // tactile — pas forcément l'index 0 (une carte_entite/objectif n'a pas de sable).
                  const premierSableIdx = widgets.findIndex((w) => { const k = heroKPI(w.recette); return !!(k && kpiPourId(k.KPI)) })
                  return widgets.map((w, idx) => {
                  const anime = w.id === nouveauWidget
                  const kb = heroKPI(w.recette)
                  const rAff = recetteAffichee(w) // la forme suit la taille de la tuile
                  const kbAff = heroKPI(rAff)
                  // Le sable ne s'offre que pour un KPI CONNU du registre (un id disparu —
                  // vieux silo, import — laisserait sinon une tuile « tappable » vers rien).
                  const kpiSable = kb && kpiPourId(kb.KPI) ? kb : null
                  // La pastille de statut : factuelle, seulement si une cible SÛRE est atteignable
                  // (sinon null — jamais un jugement inventé). Voir statutCible (data-aware).
                  const statut = kb && kb.params ? statutCible(kb.KPI, snapshot, kb.params.cible) : null
                  // Tuile-OBJECTIF (héros d'un projet, ex. « Maison ») → on peut déployer sa VUE composée de faits.
                  const estObjectif = !!(kb && (kpiPourId(kb.KPI) || {}).domaine === 'objectif' && kb.params && kb.params.objectif && Number(kb.params.objectif.cible) > 0)
                  // LE VIVANT : ce KPI a-t-il bougé depuis ta dernière visite ? (pulse d'accueil,
                  // pas sur une tuile qu'on vient de créer). 1re visite → aucun repère → rien.
                  const aBouge = !anime && kb ? kpiABouge(kb.KPI, baselineRef.current, snapshot, kb.params || {}) : false
                  // LA TENDANCE (LOT 3) : l'écart chiffré depuis la dernière visite, affiché en
                  // permanence sous le chiffre (le pulse a-bouge est le signal d'arrivée, le delta
                  // la trace). null pour un KPI non scalaire / donnée absente / 1re visite.
                  // ET null si une DÉRIVÉE est active (« en % de ton revenu ») : le chiffre affiché
                  // change alors d'unité (%), mais deltaKPI mesure la valeur BRUTE ($) — afficher
                  // « +275 $ » sous un « 46 % » serait un fait incohérent (revue nuage, majeur).
                  const derActive = !!(kbAff && kbAff.params && kbAff.params.derivation && kbAff.params.derivation !== 'brut')
                  const deltaW = !anime && kbAff && !derActive ? deltaKPI(kbAff.KPI, baselineRef.current, snapshot, kbAff.params || {}) : null
                  const formes = kb ? formesPourKPI(kb.KPI, snapshot, kb.params) : []
                  const peutMorpher = formes.length > 1
                  const retoucheOuverte = angleWidget === w.id
                  return (
                    <section
                      className={`tour-widget tour-vues taille-${tailleWidget(w)}${anime ? ' is-anime' : ''}${aBouge ? ' a-bouge' : ''}${w.accent ? ' a-couleur' : ''}${tireeId === w.id ? ' est-tiree' : ''}${(() => { const p = peauSurvol && peauSurvol.id === w.id && angleWidget === w.id ? peauSurvol.peau : w.peau; const c = classePeau(p); return c ? ` ${c}` : '' })()}`}
                      key={w.id}
                      ref={poseTuile(w.id)}
                      style={{ ...(w.accent ? { '--wacc': w.accent } : null), '--casc': Math.min(idx, 8) }}
                      onPointerDown={reorganise ? (e) => surTuilePointerDown(e, w.id) : undefined}
                    >
                      <div className="tour-widget-tete">
                        {reorganise && (
                          <span className="tw-poignee" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" /><circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" /><circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" /></svg>
                          </span>
                        )}
                        <span className="tour-widget-ic" aria-hidden="true">{iconeWidget(w)}</span>
                        <span className="tour-widget-titre">{(w.recette && w.recette.titre) || 'Ta tuile'}</span>
                        {statut && statut.atteint && (
                          <span className="tw-statut" role="img" aria-label={`Cible de ${statut.cible}${statut.unite === '%' ? ' %' : ' ' + statut.unite} atteinte`} title="Cible atteinte">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
                          </span>
                        )}
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
                        <button type="button" className="tour-widget-x" onClick={() => retirerWidget(w.id)} aria-label="Retirer cette tuile" title="Retirer">×</button>
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
                            <span className="gal-essai-l">Son style</span>
                            <div className="gal-formes">
                              {PEAUX.map((p) => {
                                const actif = (w.peau && peauValide(w.peau) ? w.peau : 'defaut') === p.id
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className={`gal-forme${actif ? ' is-choisie' : ''}`}
                                    onClick={() => { setPeauSurvol(null); changerPeau(w.id, p.id) }}
                                    onMouseEnter={() => setPeauSurvol({ id: w.id, peau: p.id })}
                                    onMouseLeave={() => setPeauSurvol((s) => (s && s.id === w.id ? null : s))}
                                    onFocus={() => setPeauSurvol({ id: w.id, peau: p.id })}
                                    onBlur={() => setPeauSurvol((s) => (s && s.id === w.id ? null : s))}
                                    aria-pressed={actif}
                                  >
                                    {p.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
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
                          {/* DUPLIQUER : pars d'une base, fais-en une variante — puis diverge
                              (autre forme, autre couleur, autre cible) dans son carré de sable. */}
                          <div className="retouche-bloc retouche-actions">
                            <div className="retouche-actions-rangee">
                              <button type="button" className="retouche-dupli" onClick={() => dupliquerWidget(w.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" />
                                </svg>
                                Dupliquer cette tuile
                              </button>
                              {/* MES VUES : sauver cette configuration comme modèle réutilisable. */}
                              <button type="button" className="retouche-dupli" onClick={() => sauverVue(w.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M5 3h11l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M8 3v5h7" /><path d="M8 14h8" />
                                </svg>
                                Sauver comme modèle
                              </button>
                              {/* L'ADVISOR CONFORME : un but → le tableau complet de faits (tuiles-objectif seulement). */}
                              {estObjectif && (
                                <button type="button" className="retouche-dupli retouche-vue-projet" onClick={() => monterVueObjectif(w.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
                                  </svg>
                                  Monte le tableau du projet
                                </button>
                              )}
                            </div>
                            <span className="retouche-dupli-note">{estObjectif ? 'Déploie où tu en es, ce qu’il manque, l’effort — rien que des faits.' : 'Une copie à faire diverger, ou un modèle pour « Mes vues ».'}</span>
                          </div>
                        </div>
                      )}

                      {/* TAPE LA CARTE → le carré de sable de son KPI (les contrôles internes gardent la main). */}
                      <div
                        className={`tour-rendu${kpiSable ? ' est-tappable' : ''}`}
                        key={kbAff ? `${kbAff.KPI}:${kbAff.forme}` : 'fixe'}
                        onClick={
                          kpiSable && !reorganise
                            ? (e) => {
                                if (e.target.closest('button, input, a, select, textarea, [role="slider"]')) return
                                // le rect de la tuile = point de départ du FLIP (le sable grandit sur place)
                                sons.ouvre()
                                const el = tuilesRef.current.get(w.id)
                                const r = el ? el.getBoundingClientRect() : null
                                setSable({ id: w.id, rect: r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null })
                                // Le sable a été découvert une fois → l'indice tactile se tait pour toujours.
                                if (!store.sableVu) setStore((s) => (s.sableVu ? s : { ...s, sableVu: true }))
                              }
                            : undefined
                        }
                      >
                        <MoteurRendu recette={rAff} snapshot={snapshot} anime={anime} delta={deltaW} />
                        {kpiSable && (
                          <span className={`tour-tap-hint${idx === premierSableIdx && !store.sableVu ? ' tour-tap-hint--apprend' : ''}`} aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>
                            tape&nbsp;: carré de sable
                          </span>
                        )}
                      </div>

                      {/* LA POIGNÉE DE TAILLE (mode réorganiser) : S → M → L (→ XL). */}
                      {reorganise && (
                        <button
                          type="button"
                          className="tw-taille"
                          onClick={() => cyclerTaille(w)}
                          title={`Taille : ${tailleWidget(w).toUpperCase()} — taper pour changer`}
                          aria-label={`Taille de la tuile : ${tailleWidget(w).toUpperCase()} — changer`}
                        >
                          {tailleWidget(w).toUpperCase()}
                        </button>
                      )}
                    </section>
                  )
                })
                })()}
                {/* LA TUILE « À BÂTIR » : la prochaine pièce de la tour, en pointillés.
                    Tape → la barre IA de l'atelier se focalise (le focus fait défiler la
                    scène jusqu'à elle). Retirée en Réorganiser (elle n'est pas déplaçable). */}
                {!reorganise && (
                  <button type="button" className="tour-batir" style={{ '--casc': Math.min(widgets.length, 9) }} onClick={() => { sons.tap(); focusIA() }}>
                    <span className="batir-plus" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                    <span className="batir-t">À bâtir</span>
                    <span className="batir-s">Décris ton prochain indicateur</span>
                  </button>
                )}
                </div>
                {/* LA BARRE D'OUTILS DU TABLEAU — SOUS le board (sur le fond nu, lisible dans
                    les deux peaux) : le voyant « en service », Réorganiser et les sons. On la
                    garde ICI : au-dessus, elle tombait sur le bandeau fadé et perdait l'AA en
                    peau sombre, et elle mangeait le chevauchement des tuiles. */}
                <div className="tour-board-tete">
                  <span className="tb-voyant" aria-hidden="true" />
                  <span className="tb-label">Tes indicateurs</span>
                  <span className="tb-etat">{widgets.length > 1 ? `${widgets.length} en service` : '1 en service'}</span>
                  <button
                    type="button"
                    className={`tb-reorg${reorganise ? ' est-actif' : ''}`}
                    aria-pressed={reorganise}
                    onClick={() => { sons.tap(); setReorganise((v) => !v) }}
                  >
                    {reorganise ? 'Terminé' : 'Réorganiser'}
                  </button>
                  {/* Les sons discrets : activés par défaut, coupables d'un tap. */}
                  <button
                    type="button"
                    className="tb-sons"
                    aria-pressed={store.sons !== false}
                    aria-label="Sons"
                    title={store.sons !== false ? 'Sons : activés' : 'Sons : coupés'}
                    onClick={() => setStore((s) => ({ ...s, sons: s.sons === false }))}
                  >
                    {store.sons !== false ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M16 9l5 6M21 9l-5 6" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Ce qui BOUGE maintenant + le verdict du jour : SOUS le board (le haut de
                la tour appartient aux instruments, qui chevauchent le bandeau). */}
            <EvenementsSaillants events={evenementsListe} depuis={visiteRef.current} />
            <VerdictDuJour verdict={verdict} />
          </div>
          </div>
          <div className="scene-indice" aria-hidden="true">
            <span>L&rsquo;atelier</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </div>
          </section>

          {/* SCÈNE 2 — L'ATELIER. Atteinte en DESCENDANT : la tour recule, cette feuille
              de verre glisse par-dessus et la floute (usePassage → --p). Deux portes :
              décrire à l'IA, ou prendre un modèle sur l'anneau. La mission/le studio
              guidés prennent le relais ici quand ils sont actifs. */}
          <section className="scene-atelier" ref={refAtelier}>
            <div className="couture" aria-hidden="true" />
            <div className="couture-lueur" aria-hidden="true" />
            {mission ? (
              <MissionAllumage famille={mission} onFini={finirMission} onAnnuler={() => setMission(null)} />
            ) : studio ? (
              <StudioConversation snapshot={snapshot} onFini={materialiserEntite} onAnnuler={() => setStudio(null)} />
            ) : (
              <>
                <div className="at-tete at-bloc" style={{ '--s': 0, '--e': 0.55 }}>
                  <span className="at-eyebrow">{I_VEDETTE} L&rsquo;atelier</span>
                  <h2 className="at-t">Un instrument de plus pour ta tour ?</h2>
                  <p className="at-s">Décris ce que tu veux suivre, ou prends un modèle sur l&rsquo;anneau — tes vrais chiffres sont déjà dedans.</p>
                </div>
                <form
                  className="ia-wrap at-bloc"
                  style={{ '--s': 0.1, '--e': 0.6 }}
                  onSubmit={(e) => { e.preventDefault(); const t = iaTexte.trim(); if (t) { demanderIA(t); setIaTexte('') } }}
                >
                  <div className="ia-halo" aria-hidden="true" />
                  <div className="ia-barre">
                    <span className="ia-etincelle" aria-hidden="true">{I_VEDETTE}</span>
                    <input
                      ref={iaRef}
                      className="ia-input"
                      value={iaTexte}
                      onChange={(e) => setIaTexte(e.target.value)}
                      placeholder="Décris un indicateur — ex. « combien il me reste ce mois-ci »"
                      aria-label="Décris l&rsquo;indicateur à créer"
                    />
                    <button type="submit" className="ia-go" disabled={chargement || !iaTexte.trim()} aria-label="Composer l&rsquo;indicateur">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </button>
                  </div>
                </form>
                {erreur && <p className="at-erreur at-bloc" role="alert" style={{ '--s': 0.1, '--e': 0.6 }}>{erreur}</p>}
                {/* MES VUES : les modèles que l'usager a sauvés — re-posables ici (leur
                    seule porte de sortie, sinon le tiroir serait en écriture seule). */}
                {Array.isArray(store.mesVues) && store.mesVues.length > 0 && (
                  <div className="at-mesvues at-bloc" style={{ '--s': 0.14, '--e': 0.7 }}>
                    <span className="at-mesvues-l">Mes vues</span>
                    <div className="at-mesvues-liste">
                      {store.mesVues.map((v) => (
                        <span key={v.id} className="at-vue">
                          <button type="button" className="at-vue-poser" onClick={() => appliquerVue(v)} title="Re-poser ce modèle sur ta tour">
                            {(v.recette && v.recette.titre) || 'Ma vue'}
                          </button>
                          <button type="button" className="at-vue-x" onClick={() => supprimerVue(v.id)} aria-label="Retirer ce modèle">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="at-bloc at-anneau" style={{ '--s': 0.2, '--e': 0.85 }}>
                  <AnneauModeles snapshot={snapshot} widgets={widgets} onAjouter={ajouterWidget} onAllerSaisie={allerSaisie} onCreer={focusIA} />
                </div>
              </>
            )}
          </section>
          </>
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

      {/* LE CARRÉ DE SABLE : la MÊME tuile, agrandie sur place (FLIP depuis son rect),
          au-dessus d'un scrim qui laisse le board visible. Widget retiré pendant
          qu'il est ouvert → se referme seul. */}
      {(() => {
        const w = sable ? widgets.find((x) => x.id === sable.id) : null
        return w ? <CarreDeSable widget={w} snapshot={snapshot} origine={sable.rect} onFermer={() => setSable(null)} onEpingler={epinglerSable} appris={appris} onAppris={marquerAppris} /> : null
      })()}
    </div>
  )
}

export default App
