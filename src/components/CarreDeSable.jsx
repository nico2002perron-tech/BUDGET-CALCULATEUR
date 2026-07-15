/* ============================================================================
   CarreDeSable.jsx — LE CARRÉ DE SABLE : l'atelier immersif d'UN seul KPI.

   Étape 1 (coquille) : une surface sombre plein écran PAR-DESSUS l'app — le
   reste garde son thème clair ; c'est la SEULE zone spectaculaire. Retour
   (chevron / Échap) sans aucune perte ; en-tête = titre du KPI + « carré de
   sable · fabrique ta vue » + badge IA. La scène rend la vue ACTUELLE de la
   tuile via MoteurRendu — mêmes recette/snapshot que le board, aucun chiffre
   recalculé ici. Les commandes (type, comparer, objectif, persona, épingler)
   s'ajouteront par étapes ; ce fichier est leur socle d'orchestration.
   ========================================================================== */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import MoteurRendu from '../recettes/MoteurRendu.jsx'
import PersonaStrip from './PersonaStrip.jsx'
import GlypheForme from './GlypheForme.jsx'
import { kpiPourId, formesPourKPI, nomForme, resolveKPI, FORMES_COMPARABLES, reglageCible, expliqueKPI } from '../recettes/bibliotheque-kpis.js'
import { etatFraicheur } from '../lib/fraicheur.js'
import { deltaLong } from '../lib/historique.js'
import { formatKPI } from '../lib/format.js'
import { DERIVATIONS, derivationsPourKPI, deriver, derivationValide, FORMES_SCALAIRES } from '../recettes/derivations.js'
import { DECOUPES, decoupesPourKPI, decoupeValide } from '../recettes/decoupes.js'
import { resoudreComparaisons } from '../recettes/schema.js'
import { executerActions, resumeActions } from '../recettes/actions.js'
import { perchesSable, PLACEHOLDERS_SABLE, gestesDe, prochainePerche } from '../recettes/perches.js'
import { PALETTE_ACCENTS } from '../lib/entites.js'
import { sons } from '../lib/sons.js'

// Les verbes que la barre-copilote pilote DANS le sable (forme/comparateurs/
// cible/couleur/titre — tout a un aperçu vivant ici). Les verbes du board
// (créer/retirer/redimensionner) vivent sur la barre du tableau (A3).
const VERBES_SABLE = ['changer_forme', 'changer_mesure', 'changer_decoupe', 'ajouter_comparateur', 'retirer_comparateur', 'poser_cible', 'retirer_cible', 'changer_couleur', 'renommer']

// Les types canoniques du sable, dans l'ordre de la rangée. Un type incompatible
// avec le KPI courant reste VISIBLE mais grisé (il dit ce que le sable sait faire).
const TYPES_SABLE = ['prisme3d', 'bandes', 'beignet', 'anneau3d', 'courbe', 'nuage']

// FORMES_COMPARABLES et le réglage de cible (reglageCible) vivent désormais dans
// la bibliothèque — SOURCE UNIQUE partagée avec la barre-copilote (actions.js).

// Les sujets « Ajouter à comparer » (déterministes, sans clé API). Un sujet dont
// la donnée manque reste visible, grisé, avec sa condition (jamais inventé).
const SUJETS_COMPARER = [
  { contexte: 'moyenne', label: 'ta moyenne' },
  { contexte: 'cout_vie', label: 'ton coût de vie' },
  { contexte: 'an_passe', label: 'l’an passé', condition: 's’allume avec ton historique' },
]

const I_RETOUR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

function reduitMouvement() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function CarreDeSable({ widget, mode = 'edition', snapshot, historique = [], origine = null, onFermer, onEpingler, appris = [], onAppris }) {
  // P4 — modes « suggestion » / « création » : la tuile n'est encore qu'un BROUILLON (pas
  // posée). Le sable est le même ; seul le pied change (elle n'existe pas encore sur la tour).
  const estBrouillon = mode === 'suggestion' || mode === 'creation'
  const racineRef = useRef(null)
  const retourRef = useRef(null)
  const panneauRef = useRef(null)
  const scrimRef = useRef(null)
  const fermetureRef = useRef(false)
  const [comprendreOuvert, setComprendreOuvert] = useState(false) // K4 : le volet « Comprendre »
  const [formeChoisie, setFormeChoisie] = useState(null) // null = le défaut du sable
  const [comparaisons, setComparaisons] = useState(null) // null = celles de la recette ; [] et + = ton choix
  const [cible, setCible] = useState(null) // null = celle de la recette, sinon le défaut du KPI
  const [persona, setPersona] = useState(null) // null = celle du widget (épinglée), sinon ton choix du moment
  const [couleurScene, setCouleurScene] = useState(null) // null = l'accent du widget ; sinon la couleur du copilote (repliée à l'épinglage)
  const [titreScene, setTitreScene] = useState(null) // null = le titre du widget ; sinon le renommage du copilote
  const [derivationChoisie, setDerivationChoisie] = useState(null) // null = celle de la recette ; sinon ton choix (atelier de composition)
  const [formeSurvol, setFormeSurvol] = useState(null) // LE VIVANT : la forme SURVOLÉE (aperçu direct), null = aucun survol
  const [derivationSurvol, setDerivationSurvol] = useState(null) // LE VIVANT : la mesure survolée (aperçu de la dérivée)
  const [decoupeChoisie, setDecoupeChoisie] = useState(null) // null = celle de la recette ; sinon ton choix (découpe)
  const [decoupeSurvol, setDecoupeSurvol] = useState(null) // LE VIVANT : la découpe survolée (aperçu)
  const [iaTexte, setIaTexte] = useState('')
  const [iaCharge, setIaCharge] = useState(false)
  const [iaNote, setIaNote] = useState(null)
  const [fait, setFait] = useState(null) // { resume, refus, avant } — la chip « Fait · Annuler »
  const faitTimerRef = useRef(0)
  const [phIdx, setPhIdx] = useState(0) // l'exemple qui TOURNE dans le placeholder
  // L'état de scène le PLUS RÉCENT (mis à jour à chaque rendu) : le copilote lit
  // CETTE ref au moment d'APPLIQUER (après le fetch), jamais la closure du submit
  // — une retouche faite pendant la requête n'est donc jamais écrasée.
  const sceneEtatRef = useRef(null)
  const recette = widget && widget.recette
  const kb = recette && Array.isArray(recette.blocs) ? recette.blocs.find((b) => b && b.KPI) : null
  const def = kb ? kpiPourId(kb.KPI) : null
  // Le sable est l'atelier d'UN KPI CONNU du registre. Sans lui, RIEN ne s'active (aucun
  // listener, aucun overlay). Le verrou de défilement vit dans App (verrouScroll), gardé sur
  // la MÊME condition (App n'ouvre sableW que si le KPI est au registre) → jamais figé sous vide.
  const actif = !!(kb && def)

  // onFermer vit dans une ref → les listeners montés UNE fois voient toujours la
  // dernière closure sans ré-exécuter l'effet (sinon chaque re-rendu d'App —
  // timers nouveauWidget/allumes… — relancerait focus() et l'arracherait au
  // contrôle que l'usager manipule dans la scène).
  const onFermerRef = useRef(onFermer)
  useEffect(() => { onFermerRef.current = onFermer }, [onFermer])

  // Nettoyage du timer de la chip « Fait » au démontage (hook inconditionnel,
  // avant tout return — jamais après le garde `if (!actif)`).
  useEffect(() => () => clearTimeout(faitTimerRef.current), [])

  // LE VIVANT (garde) : changer de forme (clic OU copilote → formeChoisie) démonte
  // la rangée « La lecture » si la nouvelle forme n'est pas scalaire ; onMouseLeave/
  // onBlur ne se déclenchent alors JAMAIS → un derivationSurvol resterait collé et
  // rallumerait un aperçu FANTÔME au retour d'une forme scalaire. On le réinitialise.
  useEffect(() => { setDerivationSurvol(null); setDecoupeSurvol(null) }, [formeChoisie])

  // Le placeholder TOURNE (exemples) — figé sous prefers-reduced-motion.
  useEffect(() => {
    if (reduitMouvement()) return
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS_SABLE.length), 4000)
    return () => clearInterval(id)
  }, [])

  // La tuile d'origine devient PÉRIMÉE si la fenêtre change (rotation, resize)
  // pendant que le sable est ouvert → la fermeture dégrade en fondu simple.
  const origineInvalideRef = useRef(false)
  useEffect(() => {
    const invalide = () => { origineInvalideRef.current = true }
    window.addEventListener('resize', invalide)
    return () => window.removeEventListener('resize', invalide)
  }, [])

  // FERMETURE = l'inverse de l'ouverture : le panneau RÉTRÉCIT vers la tuile
  // d'origine, le scrim s'éteint, puis on démonte. Ré-entrance gardée ; le
  // panneau devient inerte (rien ne se clique/tape pendant qu'il rétrécit).
  const fermer = () => {
    if (fermetureRef.current) return
    fermetureRef.current = true
    const p = panneauRef.current
    if (!p || !origine || origineInvalideRef.current || reduitMouvement()) {
      // repli : fondu court (ou rien sous reduced-motion / sans origine valide)
      if (p && !reduitMouvement()) {
        try {
          p.setAttribute('inert', '')
          const a = p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' })
          if (scrimRef.current) scrimRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' })
          a.finished.then(() => onFermerRef.current()).catch(() => onFermerRef.current())
          return
        } catch { /* démontage direct */ }
      }
      onFermerRef.current()
      return
    }
    try {
      p.setAttribute('inert', '')
      p.style.pointerEvents = 'none'
      // Fermé PENDANT l'ouverture : on repart de la matrice COURANTE (jamais un
      // saut plein écran) et on mesure le rect NON transformé (anims annulées).
      const depart = getComputedStyle(p).transform
      const opDepart = getComputedStyle(p).opacity
      p.getAnimations().forEach((a) => { try { a.cancel() } catch { /* no-op */ } })
      const f = p.getBoundingClientRect()
      const sx = Math.max(0.04, origine.width / Math.max(1, f.width))
      const sy = Math.max(0.04, origine.height / Math.max(1, f.height))
      const cible = `translate(${origine.left - f.left}px, ${origine.top - f.top}px) scale(${sx}, ${sy})`
      if (scrimRef.current) {
        const opScrim = getComputedStyle(scrimRef.current).opacity
        scrimRef.current.getAnimations().forEach((a) => { try { a.cancel() } catch { /* no-op */ } })
        scrimRef.current.animate([{ opacity: opScrim }, { opacity: 0 }], { duration: 280, easing: 'ease', fill: 'forwards' })
      }
      const anim = p.animate(
        [{ transform: depart === 'none' ? 'none' : depart, opacity: opDepart }, { transform: cible, opacity: 0.5 }],
        { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
      )
      anim.finished.then(() => onFermerRef.current()).catch(() => onFermerRef.current())
    } catch {
      onFermerRef.current()
    }
  }
  const fermerRef = useRef(fermer)
  fermerRef.current = fermer

  // OUVERTURE FLIP : le panneau PART du rect de la tuile (translate + scale,
  // origin 0 0) et grandit jusqu'à sa place ; le scrim s'allume en parallèle.
  useLayoutEffect(() => {
    const p = panneauRef.current
    if (!p || !origine || reduitMouvement()) return
    try {
      const f = p.getBoundingClientRect()
      const sx = Math.max(0.04, origine.width / Math.max(1, f.width))
      const sy = Math.max(0.04, origine.height / Math.max(1, f.height))
      p.animate(
        [
          { transform: `translate(${origine.left - f.left}px, ${origine.top - f.top}px) scale(${sx}, ${sy})`, opacity: 0.65 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 340, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
      )
      if (scrimRef.current) scrimRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease' })
    } catch { /* décoratif */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- au montage seulement

  // Ouverture : focus sur « retour », Échap referme, et Tab RESTE dans le dialogue
  // (aria-modal sans piège à focus laisserait Tab activer des contrôles invisibles
  // sous l'overlay — ex. retirer un widget à l'aveugle).
  useEffect(() => {
    if (!actif) return
    const surTouche = (e) => {
      if (e.key === 'Escape') { fermerRef.current(); return }
      if (e.key !== 'Tab' || !racineRef.current) return
      const focusables = racineRef.current.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const premier = focusables[0]
      const dernier = focusables[focusables.length - 1]
      const dedans = racineRef.current.contains(document.activeElement)
      if (e.shiftKey && (!dedans || document.activeElement === premier)) { e.preventDefault(); dernier.focus() }
      else if (!e.shiftKey && (!dedans || document.activeElement === dernier)) { e.preventDefault(); premier.focus() }
    }
    window.addEventListener('keydown', surTouche)
    if (retourRef.current) retourRef.current.focus()
    return () => window.removeEventListener('keydown', surTouche)
  }, [actif])

  // Le verrou de défilement de la page vit désormais dans App (`verrouScroll`, UNE seule
  // source pour la surcouche ET le sable) : le poser ici aussi le faisait se chevaucher
  // avec celui de l'atelier pendant la transition atelier→sable et figeait la page (revue
  // nuage P4). App garde le fond bloqué tant que le sable (ou l'atelier) est présent.

  if (!actif) return null

  // LA RANGÉE DE TYPES : seules les formes compatibles avec CE KPI s'offrent
  // (formesPourKPI, data-aware) ; un type canonique sans donnée/sens est grisé.
  // Changer de type = changer la FORME (présentation pure) — resolveKPI et le
  // snapshot restent les seules sources de chiffres.
  const formes = formesPourKPI(kb.KPI, snapshot, kb.params)
  const rangee = [...TYPES_SABLE, ...formes.filter((f) => !TYPES_SABLE.includes(f))]
  // Une tuile ÉPINGLÉE rouvre sur TON choix ; jamais épinglée → le défaut
  // spectaculaire (prisme 3D quand la série l'offre).
  const formeDefaut = widget.epingle && formes.includes(kb.forme)
    ? kb.forme
    : formes.includes('prisme3d') ? 'prisme3d' : formes.includes(kb.forme) ? kb.forme : formes[0] || null
  const formeActive = formeChoisie && formes.includes(formeChoisie) ? formeChoisie : formeDefaut
  // LE VIVANT : la scène montre la forme SURVOLÉE (aperçu avec TES données) tant
  // que le curseur/focus y est ; sinon la forme choisie. « Voir avant l'effort. »
  const formeApercu = formeSurvol && formes.includes(formeSurvol) ? formeSurvol : formeActive

  // « AJOUTER À COMPARER » : tes comparaisons du moment (celles de la recette tant
  // que tu n'y touches pas). Un sujet est offert si sa série se RÉSOUT vraiment.
  const compActives = comparaisons !== null ? comparaisons : (kb.params && Array.isArray(kb.params.comparaisons) ? kb.params.comparaisons : [])
  // Comparer = les sujets de la SAISON (moyenne, coût de vie, an passé) : ils ne
  // se résolvent que pour la famille saisonnier. Ailleurs, le bloc entier reste
  // absent — pas une rangée de chips toutes grises + une barre IA sans issue.
  const comparable = FORMES_COMPARABLES.includes(formeActive) && def.domaine === 'saisonnier'
  const sujetOffert = (ctx) => resoudreComparaisons(snapshot, [{ contexte: ctx }]).length > 0
  const estAjoute = (ctx) => compActives.some((c) => c && c.contexte === ctx)
  const basculerSujet = (s) => {
    sons.tap()
    setIaNote(null)
    setFait(null) // une retouche manuelle ferme la chip « Annuler » (plus d'instantané périmé)
    setComparaisons(estAjoute(s.contexte)
      ? compActives.filter((c) => c.contexte !== s.contexte)
      : [...compActives, { contexte: s.contexte, label: s.label }].slice(0, 3))
  }

  // L'OBJECTIF : quand le KPI supporte une cible (son reglage, ou le réglage
  // série du sable), le stepper la pose dans params.cible — une INTENTION.
  // OPT-IN : rien n'est posé tant que TU ne le poses pas (ouvrir le sable ne
  // change jamais la lecture de ta tuile) ; une cible déjà portée par la
  // recette reste honorée (clampée aux bornes). cible=0 → objectif retiré.
  // Le réglage série (« plancher de revenu, $/mois ») ne parle que de la famille
  // saisonnier — un KPI patrimoine/impôt qui débloque le prisme via serieDuKPI
  // ne reçoit pas un stepper étranger à sa donnée.
  const reglage = reglageCible(kb.KPI, snapshot, kb.params)
  const clampCible = (v) => (reglage ? Math.min(reglage.max, Math.max(reglage.min, v)) : v)
  const cibleRecette = kb.params && isFinite(Number(kb.params.cible)) && Number(kb.params.cible) > 0 ? clampCible(Number(kb.params.cible)) : 0
  const cibleActive = reglage ? (cible != null ? cible : cibleRecette) : 0
  const bougeCible = (delta) => {
    if (!reglage || !(cibleActive > 0)) return
    sons.tap()
    setFait(null)
    setCible(clampCible(cibleActive + delta))
  }

  // La couleur / le titre du moment (le copilote peut les changer ; repliés à
  // l'épinglage, comme la forme). Aperçu vivant : la scène se teinte en direct.
  const couleurActive = couleurScene || widget.accent || null
  const titreActif = titreScene != null ? titreScene : (recette && recette.titre) || def.question

  // LES PERCHES : des suggestions tappables (data-aware) qui règlent la page
  // blanche — on tape, ça s'exécute (le même executerActions que la barre).
  const perches = perchesSable(
    { widgetId: widget.id, kpiId: kb.KPI, forme: formeActive, comparaisons: compActives, cible: cibleActive > 0 ? cibleActive : null, objectif: kb.params && kb.params.objectif },
    { ...widget, accent: couleurActive },
    snapshot,
  )
  // L'ENSEIGNEMENT PROGRESSIF : après une action, la tour souffle le prochain
  // geste pas encore appris (Duolingo — les pouvoirs se déverrouillent un à un).
  const prochain = prochainePerche(perches, appris)

  // LA MESURE (atelier de composition) : la LECTURE de la valeur (« montant » ou
  // « en % de ton revenu »). Ton INTENTION (derivationVoulue) survit à un
  // changement de forme ; ce qui est OFFERT/appliqué dépend de la forme scalaire.
  const derivsOffertes = derivationsPourKPI(kb.KPI, snapshot, formeActive)
  const dvBrute = derivationChoisie != null ? derivationChoisie : (kb.params && kb.params.derivation) || 'brut'
  const derivationVoulue = derivationValide(dvBrute) ? dvBrute : 'brut' // neutralise une valeur hostile d'un silo importé
  const derivationActive = derivsOffertes.includes(derivationVoulue) ? derivationVoulue : 'brut'
  // LE VIVANT : la mesure SURVOLÉE prévisualise dans la scène ; sinon la choisie.
  const derivationApercu = derivationSurvol && derivsOffertes.includes(derivationSurvol) ? derivationSurvol : derivationActive

  // LA DÉCOUPE (atelier de composition) : trancher le TOUT autrement (parts). Même
  // patron que la mesure ; l'intention survit, l'offre dépend de la forme-parts.
  const decoupsOffertes = decoupesPourKPI(kb.KPI, snapshot, formeActive)
  const dcBrute = decoupeChoisie != null ? decoupeChoisie : (kb.params && kb.params.decoupe) || 'par_categorie'
  const decoupeVoulue = decoupeValide(dcBrute) ? dcBrute : 'par_categorie' // neutralise une valeur hostile
  const decoupeActive = decoupsOffertes.includes(decoupeVoulue) ? decoupeVoulue : 'par_categorie'
  const decoupeApercu = decoupeSurvol && decoupsOffertes.includes(decoupeSurvol) ? decoupeSurvol : decoupeActive

  // La scène est en mode APERÇU si la forme, la mesure OU la découpe survolée diffère du choix.
  const enApercu = formeApercu !== formeActive || derivationApercu !== derivationActive || decoupeApercu !== decoupeActive

  // On PUBLIE l'état de scène courant dans la ref à CHAQUE rendu → le copilote
  // (qui applique APRÈS le fetch) lit toujours l'état le plus frais.
  sceneEtatRef.current = {
    formeActive, compActives, cibleActive, couleurActive, titreActif,
    formeChoisie, comparaisons, cible, couleurScene, titreScene,
    derivationActive, decoupeActive, derivationChoisie, decoupeChoisie,
  }

  // ── LA BARRE-COPILOTE « Demande à ta tour » : ta phrase → des ACTIONS. L'IA ne
  //    fait que CHOISIR dans le vocabulaire fermé (actions.js) parmi les options
  //    OFFERTES (payload = forme des données seulement, AUCUN montant du silo) ;
  //    ici on VALIDE + applique chaque action, et « Annuler » restaure l'avant.
  const appliquerActions = (actions) => {
    const S = sceneEtatRef.current // l'état FRAIS au moment d'appliquer (pas la closure du submit)
    // seul le vocabulaire du sable ; un verbe du board renvoyé par l'IA est écarté.
    const filtrees = (Array.isArray(actions) ? actions : []).filter((a) => a && VERBES_SABLE.includes(a.verbe))
    const widgetCourant = { ...widget, accent: S.couleurActive, recette: { ...recette, titre: S.titreActif } }
    const objectif = kb.params && kb.params.objectif ? kb.params.objectif : undefined
    const dCur = S.derivationActive !== 'brut' ? S.derivationActive : undefined // la dérivée courante (undefined = montant nu)
    const kCur = S.decoupeActive !== 'par_categorie' ? S.decoupeActive : undefined // la découpe courante (undefined = par catégorie)
    const etatCourant = {
      widgets: [widgetCourant],
      sable: { widgetId: widget.id, kpiId: kb.KPI, forme: S.formeActive, comparaisons: S.compActives, cible: S.cibleActive > 0 ? S.cibleActive : null, objectif, derivation: dCur, decoupe: kCur },
    }
    const avant = { formeChoisie: S.formeChoisie, comparaisons: S.comparaisons, cible: S.cible, couleurScene: S.couleurScene, titreScene: S.titreScene, derivationChoisie: S.derivationChoisie, decoupeChoisie: S.decoupeChoisie }
    const { etat, faites, refusees } = executerActions(filtrees, { snapshot }, etatCourant)
    // Mapper l'état-scène résultant vers l'état local (seulement ce qui a changé).
    const s2 = etat.sable
    if (s2.forme !== S.formeActive) setFormeChoisie(s2.forme)
    if (s2.comparaisons !== S.compActives) setComparaisons(s2.comparaisons)
    if (s2.cible !== (S.cibleActive > 0 ? S.cibleActive : null)) setCible(s2.cible == null ? 0 : s2.cible)
    if (s2.derivation !== dCur) setDerivationChoisie(s2.derivation || 'brut')
    if (s2.decoupe !== kCur) setDecoupeChoisie(s2.decoupe || 'par_categorie')
    const w2 = etat.widgets.find((w) => w.id === widget.id) || widgetCourant
    if ((w2.accent || null) !== S.couleurActive) setCouleurScene(w2.accent || null)
    const t2 = w2.recette ? w2.recette.titre : S.titreActif
    if (t2 !== S.titreActif) setTitreScene(t2)
    // La chip « Fait · Annuler » (les refus sont énoncés honnêtement).
    if (faites.length) { sons.pose(); if (onAppris) onAppris(gestesDe(faites.map((f) => ({ verbe: f.verbe })))) }
    const resume = resumeActions(faites)
    const refus = refusees.length ? refusees[0].raison : null
    clearTimeout(faitTimerRef.current)
    setFait(faites.length || refus ? { resume, refus, avant } : null)
    if (faites.length || refus) faitTimerRef.current = setTimeout(() => setFait(null), 8000)
    return { faites: faites.length, refusees: refusees.length }
  }
  const annuler = () => {
    if (!fait) return
    sons.tap()
    const a = fait.avant
    setFormeChoisie(a.formeChoisie); setComparaisons(a.comparaisons); setCible(a.cible)
    setCouleurScene(a.couleurScene); setTitreScene(a.titreScene)
    setDerivationChoisie(a.derivationChoisie); setDecoupeChoisie(a.decoupeChoisie)
    clearTimeout(faitTimerRef.current)
    setFait(null)
  }
  const piloter = async (e) => {
    e.preventDefault()
    const texte = iaTexte.trim()
    if (!texte || iaCharge) return
    setIaCharge(true)
    setIaNote(null)
    try {
      const offerts = SUJETS_COMPARER.filter((s) => sujetOffert(s.contexte)).map((s) => s.contexte)
      const res = await fetch('/api/build-tool', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(15000), // jamais une barre verrouillée sans issue
        body: JSON.stringify({
          mode: 'piloter',
          texte,
          surface: 'sable',
          kpi: kb.KPI,
          question: def.question,
          formeActive,
          formesOffertes: formes,
          contextesOfferts: offerts,
          couleurs: PALETTE_ACCENTS.map((c) => c.id),
          cible: { present: !!reglage, unite: reglage ? reglage.unite : '', posee: cibleActive > 0 },
          // LA COMPOSITION : les lectures et découpes RÉELLEMENT offertes (ids seulement,
          // aucune valeur du silo) → l'IA choisit dedans, comme pour la forme.
          mesuresOffertes: derivsOffertes,
          decoupesOffertes: decoupsOffertes,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data || !Array.isArray(data.actions)) throw new Error('réponse invalide')
      const { faites, refusees } = appliquerActions(data.actions)
      // Rien surfacé (ni fait ni refusé — salve vide OU entièrement hors sable) → on le DIT.
      if (!faites && !refusees) setIaNote('Je n’ai pas trouvé d’action pour cette demande — essaie « en courbe », « cible 4 000 », « en vert ».')
      setIaTexte('')
    } catch {
      setIaNote('Ta tour n’a pas pu traiter la demande. Réessaie.')
    } finally {
      setIaCharge(false)
    }
  }

  const paramsScene = {
    ...(kb.params || {}),
    ...(comparable ? { comparaisons: compActives } : {}),
    // cible posée → transmise ; objectif retiré (0) → on l'enlève même si la recette en portait une.
    ...(reglage ? (cibleActive > 0 ? { cible: cibleActive } : { cible: undefined }) : {}),
    // la dérivée d'APERÇU voyage dans les params (le moteur ne l'applique que sur une forme scalaire).
    ...(derivationApercu && derivationApercu !== 'brut' ? { derivation: derivationApercu } : { derivation: undefined }),
    // la découpe d'APERÇU voyage aussi (le moteur ne l'applique que sur une forme-parts, revalidée).
    ...(decoupeApercu && decoupeApercu !== 'par_categorie' ? { decoupe: decoupeApercu } : { decoupe: undefined }),
  }

  // LA PERSONNALITÉ : celle du widget (épinglée) tant que tu n'y touches pas.
  // Le fait qu'elle énonce = la résolution du KPI avec les params du moment,
  // dérivée comprise (cohérent avec ce que la scène scalaire affiche).
  const personaActive = persona || (widget.persona && widget.persona.type ? widget.persona : { type: 'neutre' })
  // Persona cohérente avec la SCÈNE : dérivée seulement si la forme d'aperçu est scalaire.
  const kpiResolu = deriver(FORMES_SCALAIRES.has(formeApercu) ? derivationApercu : 'brut', resolveKPI(kb.KPI, snapshot, paramsScene), snapshot, kb.KPI)

  // ÉPINGLER À MA TOUR : la vue fabriquée devient LA tuile (mise à jour en
  // place — jamais un doublon) : forme + comparaisons + cible + personnalité.
  // Le « bam » = la fermeture FLIP : la vue rétrécit vers sa tuile.
  const epingler = () => {
    if (!onEpingler || !formeActive) { fermer(); return }
    const params = { ...(kb.params || {}) }
    if (comparable) {
      if (compActives.length > 0) params.comparaisons = compActives
      else delete params.comparaisons
    }
    if (reglage && cibleActive > 0) params.cible = cibleActive
    else delete params.cible
    // la dérivée OFFERTE (derivationActive, pas seulement voulue) se replie ; 'brut'
    // → on retire la clé. On n'épingle jamais une dérivée non offerte pour ce KPI/forme.
    if (derivationActive && derivationActive !== 'brut') params.derivation = derivationActive
    else delete params.derivation
    // la découpe OFFERTE se replie ; 'par_categorie' (défaut) → on retire la clé.
    if (decoupeActive && decoupeActive !== 'par_categorie') params.decoupe = decoupeActive
    else delete params.decoupe
    onEpingler({
      forme: formeActive,
      params,
      persona: personaActive && personaActive.type !== 'neutre' ? personaActive : null,
      // couleur/titre changés par le copilote → repliés sur la tuile (comme la forme).
      ...(couleurScene ? { couleur: couleurScene } : {}),
      ...(titreScene != null && titreScene !== ((recette && recette.titre) || '') ? { titre: titreScene } : {}),
    })
    fermer()
  }
  const recetteScene = formeApercu
    ? { situation: recette.situation, titre: '', blocs: [{ KPI: kb.KPI, forme: formeApercu, params: paramsScene }] }
    : recette

  return (
    <div
      className="sable"
      ref={racineRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Carré de sable — ${def.question}`}
      style={couleurActive ? { '--wacc': couleurActive } : undefined}
    >
      {/* LE SCRIM : le board reste visible derrière (~55 %) ; taper à côté referme. */}
      <div className="sable-scrim" ref={scrimRef} onClick={fermer} aria-hidden="true" />

      {/* LE PANNEAU : la tuile agrandie — c'est LUI qui part du rect de la tuile. */}
      <div className="sable-panneau" ref={panneauRef}>
      <div className="sable-tete">
        <button ref={retourRef} type="button" className="sable-retour" onClick={fermer} aria-label="Revenir à ma tour">
          {I_RETOUR}
        </button>
        <div className="sable-tete-txt">
          {/* Le TITRE éditable en place : renommer là où l'on modifie tout le reste
              (replié sur la tuile à l'épinglage, comme le renommage du copilote). */}
          <span className="sable-titre-champ">
            <input
              type="text"
              className="sable-titre-input"
              value={titreActif}
              maxLength={60}
              onChange={(e) => { setFait(null); setTitreScene(e.target.value) }}
              aria-label="Renommer ta tuile"
              spellCheck={false}
            />
            <svg className="sable-titre-crayon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
          <span className="sable-sous">carré de sable · fabrique ta vue</span>
        </div>
        <span className="sable-badge">IA</span>
      </div>

      <div className="sable-corps">
        {/* LA RANGÉE DE TYPES : choisis l'œil qui regarde ton chiffre. */}
        {formeActive && (
          <div className="sable-formes" role="group" aria-label="Type de graphique">
            <span className="sable-types-l">La forme</span>
            <div className="sable-types-cartes">
              {rangee.map((t) => {
                const offert = formes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    className={`sable-type-carte${t === formeActive ? ' est-actif' : ''}${t === formeSurvol && t !== formeActive ? ' est-survol' : ''}`}
                    disabled={!offert}
                    aria-pressed={t === formeActive}
                    title={offert ? nomForme(t) : `${nomForme(t)} — pas offert pour ce chiffre`}
                    onClick={() => { sons.tap(); setFait(null); setFormeSurvol(null); setFormeChoisie(t) }}
                    onMouseEnter={offert ? () => setFormeSurvol(t) : undefined}
                    onMouseLeave={offert ? () => setFormeSurvol((s) => (s === t ? null : s)) : undefined}
                    onFocus={offert ? () => setFormeSurvol(t) : undefined}
                    onBlur={offert ? () => setFormeSurvol((s) => (s === t ? null : s)) : undefined}
                  >
                    <GlypheForme forme={t} />
                    <span className="sable-type-nom">{nomForme(t)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* LA BARRE-COPILOTE : une phrase → des actions (forme, comparaison,
            cible, couleur, renommage). Toujours là ; l'IA choisit dans le
            vocabulaire offert, on applique, « Annuler » défait la salve. */}
        {formeActive && (
          <div className="sable-copilote">
            <form className="sable-ia" onSubmit={piloter}>
              <input
                type="text"
                className="sable-ia-input"
                placeholder={`demande à ta tour — ${PLACEHOLDERS_SABLE[phIdx]}`}
                value={iaTexte}
                onChange={(e) => setIaTexte(e.target.value)}
                aria-label="Demander une action à ta tour"
              />
              <button type="submit" className="sable-ia-go" disabled={iaCharge || !iaTexte.trim()}>
                {iaCharge ? '…' : 'IA'}
              </button>
            </form>
            {/* La tour tend des PERCHES tappables (data-aware) + une réassurance —
                plus de page blanche. Visibles même sous une note d'échec : le
                dead-end devient une redirection (on tape, ça s'exécute). */}
            {!fait && perches.length > 0 && (
              <div className="cop-perches">
                <span className="cop-perches-l">Essaie :</span>
                {perches.map((p) => (
                  <button key={p.label} type="button" className="cop-perche" onClick={() => { setIaNote(null); appliquerActions(p.actions) }}>
                    {p.label}
                  </button>
                ))}
                <span className="cop-aide">j’essaie ta demande — rien n’est définitif.</span>
              </div>
            )}
            {fait && (
              <div className="sable-fait" role="status">
                {fait.resume ? <span className="sable-fait-t">{fait.resume}</span> : null}
                {fait.refus ? <span className="sable-fait-r">{fait.refus}</span> : null}
                {fait.resume ? <button type="button" className="sable-fait-annul" onClick={annuler}>Annuler</button> : null}
              </div>
            )}
            {/* Le NUDGE : après un vrai geste, la tour déverrouille le suivant. */}
            {fait && fait.resume && prochain && (
              <div className="cop-prochain" role="status">
                <span className="cop-prochain-l">Et aussi :</span>
                <button type="button" className="cop-perche" onClick={() => { setIaNote(null); appliquerActions(prochain.actions) }}>{prochain.label}</button>
              </div>
            )}
            {iaNote && <p className="sable-ia-note" role="status">{iaNote}</p>}
          </div>
        )}

        {/* AJOUTER À COMPARER : chips tappables (ajouté = pastille retirable ×).
            Le nuage lit une seule série → pas de bloc ; saisonnier seulement. */}
        {formeActive && comparable && (
          <div className="sable-comparer" role="group" aria-label="Ajouter à comparer">
            <span className="sable-types-l">Comparer</span>
            {SUJETS_COMPARER.map((s) => {
              const offert = sujetOffert(s.contexte)
              const ajoute = estAjoute(s.contexte)
              return (
                <button
                  key={s.contexte}
                  type="button"
                  className={`sable-type sable-chip${ajoute ? ' est-ajoute' : ''}`}
                  disabled={!offert}
                  aria-pressed={ajoute}
                  title={offert ? (ajoute ? `Retirer « ${s.label} »` : `Comparer à ${s.label}`) : `${s.label} — ${s.condition || 'pas de donnée pour l’instant'}`}
                  onClick={() => basculerSujet(s)}
                >
                  {s.label}
                  {ajoute && <span className="sable-chip-x" aria-hidden="true">×</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* LA MESURE (atelier de composition) : la lecture de la valeur — montant
            ou « en % de ton revenu ». N'apparaît que si une dérivée est OFFERTE
            (forme scalaire + KPI en $ + revenu connu) ; sinon rien (honnête). */}
        {formeActive && derivsOffertes.length > 1 && (
          <div className="sable-mesure" role="group" aria-label="La lecture">
            <span className="sable-types-l">La lecture</span>
            {DERIVATIONS.filter((d) => derivsOffertes.includes(d.id)).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`sable-type${d.id === derivationActive ? ' est-actif' : ''}${d.id === derivationSurvol && d.id !== derivationActive ? ' est-survol' : ''}`}
                aria-pressed={d.id === derivationActive}
                onClick={() => { sons.tap(); setFait(null); setDerivationSurvol(null); setDerivationChoisie(d.id) }}
                onMouseEnter={() => setDerivationSurvol(d.id)}
                onMouseLeave={() => setDerivationSurvol((s) => (s === d.id ? null : s))}
                onFocus={() => setDerivationSurvol(d.id)}
                onBlur={() => setDerivationSurvol((s) => (s === d.id ? null : s))}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* LA DÉCOUPE (atelier de composition) : trancher le TOUT autrement — par
            catégorie (défaut) ou fixe/variable. N'apparaît que sur une forme-parts
            (beignet/anneau) d'un poste budget avec une vraie alternative ; sinon rien. */}
        {formeActive && decoupsOffertes.length > 1 && (
          <div className="sable-mesure" role="group" aria-label="La découpe">
            <span className="sable-types-l">La découpe</span>
            {DECOUPES.filter((d) => decoupsOffertes.includes(d.id)).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`sable-type${d.id === decoupeActive ? ' est-actif' : ''}${d.id === decoupeSurvol && d.id !== decoupeActive ? ' est-survol' : ''}`}
                aria-pressed={d.id === decoupeActive}
                onClick={() => { sons.tap(); setFait(null); setDecoupeSurvol(null); setDecoupeChoisie(d.id) }}
                onMouseEnter={() => setDecoupeSurvol(d.id)}
                onMouseLeave={() => setDecoupeSurvol((s) => (s === d.id ? null : s))}
                onFocus={() => setDecoupeSurvol(d.id)}
                onBlur={() => setDecoupeSurvol((s) => (s === d.id ? null : s))}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* L'OBJECTIF (opt-in) : rien tant que tu ne le poses pas ; posé → stepper
            −/+ borné aux min/max du KPI, recalcul en direct, retirable. */}
        {formeActive && reglage && (
          <div className="sable-objectif" role="group" aria-label={`${reglage.label} (${reglage.unite})`}>
            <span className="sable-types-l">Ta cible</span>
            {cibleActive > 0 ? (
              <>
                {/* pas de doublon : on ne répète pas « Ta cible » sous le libellé de section. */}
                {reglage.label !== 'Ta cible' && <span className="sable-obj-l">{reglage.label}</span>}
                <button type="button" className="sable-obj-pas" onClick={() => bougeCible(-reglage.pas)} aria-label={`Moins ${reglage.pas}`}>−</button>
                <span className="sable-obj-val">{cibleActive}<small>{reglage.unite}</small></span>
                <button type="button" className="sable-obj-pas" onClick={() => bougeCible(reglage.pas)} aria-label={`Plus ${reglage.pas}`}>+</button>
                <button type="button" className="sable-obj-retirer" onClick={() => { sons.tap(); setFait(null); setCible(0) }}>Retirer</button>
              </>
            ) : (
              <button type="button" className="sable-type" onClick={() => { sons.tap(); setFait(null); setCible(cibleRecette || reglage.defaut) }}>
                Poser une cible
              </button>
            )}
          </div>
        )}

        {/* LA PERSONNALITÉ : identité et voix — jamais un jugement (filtrerFait). */}
        {formeActive && (
          <PersonaStrip persona={personaActive} onChange={(p) => { setFait(null); setPersona(p) }} kpi={kpiResolu} kpiId={kb.KPI} domaine={def.domaine} />
        )}

        {/* K4 — COMPRENDRE : la réponse au « et alors ? », en trois volets repliés —
            c'est quoi · d'où ça vient (+ la fraîcheur du silo) · le repère. Des FAITS,
            jamais un conseil. La 1re ouverture apprend le geste (enseignement progressif). */}
        {formeActive && def && (() => {
          const pedago = expliqueKPI(kb.KPI)
          if (!pedago || (!pedago.explique && !pedago.depend)) return null
          const fr = etatFraicheur(snapshot, def.requiert)
          const chiffre = kpiResolu && typeof kpiResolu.valeur === 'number' && isFinite(kpiResolu.valeur) ? formatKPI(kpiResolu.valeur, kpiResolu.unite) : null
          const evo = deltaLong(kb.KPI, historique, snapshot) // K7 — ta trajectoire
          return (
            <div className="sable-comprendre">
              <button
                type="button"
                className={`sable-comprendre-t${comprendreOuvert ? ' est-ouvert' : ''}`}
                onClick={() => { sons.tap(); const o = !comprendreOuvert; setComprendreOuvert(o); if (o && onAppris && !appris.includes('comprendre')) onAppris('comprendre') }}
                aria-expanded={comprendreOuvert}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" /></svg>
                Comprendre
                <svg className="sable-comprendre-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {comprendreOuvert && (
                <div className="sable-comprendre-corps">
                  {pedago.explique && (
                    <div className="sable-comp-volet"><span className="sable-comp-l">C’est quoi</span><p>{pedago.explique}</p></div>
                  )}
                  {pedago.depend && (
                    <div className="sable-comp-volet"><span className="sable-comp-l">D’où ça vient</span><p>{pedago.depend}</p>{fr && <span className="sable-comp-age">{fr.texte}</span>}</div>
                  )}
                  {pedago.repere && pedago.repere.texte && (
                    <div className="sable-comp-volet"><span className="sable-comp-l">Le repère</span><p>{pedago.repere.texte}{chiffre ? ` — toi : ${chiffre}` : ''}</p></div>
                  )}
                  {/* K7 — TON ÉVOLUTION : ta vraie trajectoire depuis tes photos mensuelles. */}
                  {evo && (
                    <div className="sable-comp-volet">
                      <span className="sable-comp-l">Ton évolution</span>
                      <p>{`${evo.delta > 0 ? '+' : '−'}${formatKPI(Math.abs(evo.delta), evo.unite)} depuis ${evo.mois} mois`}</p>
                      <span className="sable-comp-age">Ton historique vit sur ton appareil.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        <div className={`sable-scene${enApercu ? ' est-apercu' : ''}`}>
          {enApercu && (
            <span className="sable-apercu-tag" aria-hidden="true">aperçu · clique pour garder</span>
          )}
          <MoteurRendu recette={recetteScene} snapshot={snapshot} projecteur key={`${formeApercu || 'tuile'}:${compActives.map((c) => c.contexte).join('+')}:${cibleActive || ''}:${derivationApercu}:${decoupeApercu}`} />
        </div>

        {/* ÉPINGLER : la boucle se referme — la vue fabriquée devient la tuile. */}
        {formeActive && (
          <div className="sable-pied">
            <button type="button" className="sable-epingler" onClick={epingler}>
              {estBrouillon ? 'Épingler sur ma tour' : 'Épingler à ma tour'}
            </button>
            <p className="sable-note">{estBrouillon ? 'Cette tuile n’est pas encore sur ta tour — l’épingler la pose. Tout reste retouchable ensuite.' : 'Tout reste retouchable — tape la tuile pour rouvrir son carré de sable.'}</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
