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
import { kpiPourId, formesPourKPI, nomForme, resolveKPI, DONNEE_DISPO } from '../recettes/bibliotheque-kpis.js'
import { resoudreComparaisons } from '../recettes/schema.js'

// Les types canoniques du sable, dans l'ordre de la rangée. Un type incompatible
// avec le KPI courant reste VISIBLE mais grisé (il dit ce que le sable sait faire).
const TYPES_SABLE = ['prisme3d', 'bandes', 'beignet', 'courbe', 'nuage']

// Les formes qui PORTENT des séries de comparaison (le nuage lit une seule série).
const FORMES_COMPARABLES = ['prisme3d', 'bandes', 'courbe']

// Les sujets « Ajouter à comparer » (déterministes, sans clé API). Un sujet dont
// la donnée manque reste visible, grisé, avec sa condition (jamais inventé).
const SUJETS_COMPARER = [
  { contexte: 'moyenne', label: 'ta moyenne' },
  { contexte: 'cout_vie', label: 'ton coût de vie' },
  { contexte: 'an_passe', label: 'l’an passé', condition: 's’allume avec ton historique' },
]

// L'objectif du sable pour les KPIs à SÉRIE : un réglage LOCAL au sable (les
// formes-séries tracent le plan ambre). Il ne s'ajoute pas au registre du KPI —
// l'essayage de la Galerie n'a pas à montrer un stepper que ses formes ignorent.
const REGLAGE_SERIE = { label: 'Ton plancher de revenu', unite: '$/mois', defaut: 3000, min: 500, max: 15000, pas: 250 }

const I_RETOUR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

function reduitMouvement() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function CarreDeSable({ widget, snapshot, origine = null, onFermer, onEpingler }) {
  const racineRef = useRef(null)
  const retourRef = useRef(null)
  const panneauRef = useRef(null)
  const scrimRef = useRef(null)
  const fermetureRef = useRef(false)
  const [formeChoisie, setFormeChoisie] = useState(null) // null = le défaut du sable
  const [comparaisons, setComparaisons] = useState(null) // null = celles de la recette ; [] et + = ton choix
  const [cible, setCible] = useState(null) // null = celle de la recette, sinon le défaut du KPI
  const [persona, setPersona] = useState(null) // null = celle du widget (épinglée), sinon ton choix du moment
  const [iaTexte, setIaTexte] = useState('')
  const [iaCharge, setIaCharge] = useState(false)
  const [iaNote, setIaNote] = useState(null)
  const recette = widget && widget.recette
  const kb = recette && Array.isArray(recette.blocs) ? recette.blocs.find((b) => b && b.KPI) : null
  const def = kb ? kpiPourId(kb.KPI) : null
  // Le sable est l'atelier d'UN KPI CONNU du registre. Sans lui, RIEN ne s'active
  // (ni verrou de défilement, ni listener) — jamais une page figée sous un overlay vide.
  const actif = !!(kb && def)

  // onFermer vit dans une ref → les listeners montés UNE fois voient toujours la
  // dernière closure sans ré-exécuter l'effet (sinon chaque re-rendu d'App —
  // timers nouveauWidget/allumes… — relancerait focus() et l'arracherait au
  // contrôle que l'usager manipule dans la scène).
  const onFermerRef = useRef(onFermer)
  useEffect(() => { onFermerRef.current = onFermer }, [onFermer])

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

  // La page dessous ne défile pas pendant que le sable est ouvert. Verrou posé
  // en LAYOUT effect (avant le FLIP) + gouttière compensée : cacher la barre de
  // défilement ne décale ni le board visible derrière le scrim, ni la géométrie.
  useLayoutEffect(() => {
    if (!actif) return
    const gouttiere = window.innerWidth - document.documentElement.clientWidth
    const avant = document.body.style.overflow
    const avantPad = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (gouttiere > 0) document.body.style.paddingRight = `${gouttiere}px`
    return () => { document.body.style.overflow = avant; document.body.style.paddingRight = avantPad }
  }, [actif])

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

  // « AJOUTER À COMPARER » : tes comparaisons du moment (celles de la recette tant
  // que tu n'y touches pas). Un sujet est offert si sa série se RÉSOUT vraiment.
  const compActives = comparaisons !== null ? comparaisons : (kb.params && Array.isArray(kb.params.comparaisons) ? kb.params.comparaisons : [])
  const comparable = FORMES_COMPARABLES.includes(formeActive)
  const sujetOffert = (ctx) => resoudreComparaisons(snapshot, [{ contexte: ctx }]).length > 0
  const estAjoute = (ctx) => compActives.some((c) => c && c.contexte === ctx)
  const basculerSujet = (s) => {
    setIaNote(null)
    setComparaisons(estAjoute(s.contexte)
      ? compActives.filter((c) => c.contexte !== s.contexte)
      : [...compActives, { contexte: s.contexte, label: s.label }].slice(0, 3))
  }
  // L'IA choisit QUELS contextes ajouter — le payload est la FORME des données
  // (ids, question, clés, booléen) : AUCUN montant ne quitte l'appareil.
  const demanderIA = async (e) => {
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
        signal: AbortSignal.timeout(15000), // jamais une barre IA verrouillée sans issue
        body: JSON.stringify({
          mode: 'comparer',
          texte,
          kpi: kb.KPI,
          question: def.question,
          saisonnier: !!DONNEE_DISPO.saison(snapshot || {}),
          donneesDisponibles: Object.keys(DONNEE_DISPO).filter((k) => DONNEE_DISPO[k](snapshot || {})),
          contextesDisponibles: offerts,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data || !Array.isArray(data.series)) throw new Error('réponse invalide')
      const valides = data.series.filter((s) => s && offerts.includes(s.contexte) && !estAjoute(s.contexte))
      if (valides.length === 0) setIaNote('Rien à ajouter pour cette demande — les sujets offerts sont ci-dessus.')
      else setComparaisons([...compActives, ...valides.map((s) => ({ contexte: s.contexte, label: typeof s.label === 'string' ? s.label : undefined }))].slice(0, 3))
      setIaTexte('')
    } catch {
      setIaNote('Ta tour n’a pas pu traiter la demande. Réessaie, ou tape un sujet ci-dessus.')
    } finally {
      setIaCharge(false)
    }
  }

  // L'OBJECTIF : quand le KPI supporte une cible (son reglage, ou le réglage
  // série du sable), le stepper la pose dans params.cible — une INTENTION.
  // OPT-IN : rien n'est posé tant que TU ne le poses pas (ouvrir le sable ne
  // change jamais la lecture de ta tuile) ; une cible déjà portée par la
  // recette reste honorée (clampée aux bornes). cible=0 → objectif retiré.
  const reglage = def.reglage || (formes.some((f) => FORMES_COMPARABLES.includes(f) || f === 'nuage') ? REGLAGE_SERIE : null)
  const clampCible = (v) => (reglage ? Math.min(reglage.max, Math.max(reglage.min, v)) : v)
  const cibleRecette = kb.params && isFinite(Number(kb.params.cible)) && Number(kb.params.cible) > 0 ? clampCible(Number(kb.params.cible)) : 0
  const cibleActive = reglage ? (cible != null ? cible : cibleRecette) : 0
  const bougeCible = (delta) => {
    if (!reglage || !(cibleActive > 0)) return
    setCible(clampCible(cibleActive + delta))
  }

  const paramsScene = {
    ...(kb.params || {}),
    ...(comparable ? { comparaisons: compActives } : {}),
    // cible posée → transmise ; objectif retiré (0) → on l'enlève même si la recette en portait une.
    ...(reglage ? (cibleActive > 0 ? { cible: cibleActive } : { cible: undefined }) : {}),
  }

  // LA PERSONNALITÉ : celle du widget (épinglée) tant que tu n'y touches pas.
  // Le fait qu'elle énonce = la résolution du KPI avec les params du moment.
  const personaActive = persona || (widget.persona && widget.persona.type ? widget.persona : { type: 'neutre' })
  const kpiResolu = resolveKPI(kb.KPI, snapshot, paramsScene)

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
    onEpingler({
      forme: formeActive,
      params,
      persona: personaActive && personaActive.type !== 'neutre' ? personaActive : null,
    })
    fermer()
  }
  const recetteScene = formeActive
    ? { situation: recette.situation, titre: '', blocs: [{ KPI: kb.KPI, forme: formeActive, params: paramsScene }] }
    : recette

  return (
    <div
      className="sable"
      ref={racineRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Carré de sable — ${def.question}`}
      style={widget.accent ? { '--wacc': widget.accent } : undefined}
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
          <span className="sable-titre">{(recette && recette.titre) || def.question}</span>
          <span className="sable-sous">carré de sable · fabrique ta vue</span>
        </div>
        <span className="sable-badge">IA</span>
      </div>

      <div className="sable-corps">
        {/* LA RANGÉE DE TYPES : choisis l'œil qui regarde ton chiffre. */}
        {formeActive && (
          <div className="sable-types" role="group" aria-label="Type de graphique">
            <span className="sable-types-l">La forme</span>
            {rangee.map((t) => {
              const offert = formes.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  className={`sable-type${t === formeActive ? ' est-actif' : ''}`}
                  disabled={!offert}
                  aria-pressed={t === formeActive}
                  title={offert ? nomForme(t) : `${nomForme(t)} — pas offert pour ce chiffre`}
                  onClick={() => setFormeChoisie(t)}
                >
                  {nomForme(t)}
                </button>
              )
            })}
          </div>
        )}

        {/* AJOUTER À COMPARER : chips tappables (ajouté = pastille retirable ×) +
            la barre « demande à l'IA ». Le nuage lit une seule série → pas de bloc. */}
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
            <form className="sable-ia" onSubmit={demanderIA}>
              <input
                type="text"
                className="sable-ia-input"
                placeholder="demande à l’IA — ex. « compare à ma moyenne »"
                value={iaTexte}
                onChange={(e) => setIaTexte(e.target.value)}
                aria-label="Demander une comparaison à l’IA"
              />
              <button type="submit" className="sable-ia-go" disabled={iaCharge || !iaTexte.trim()}>
                {iaCharge ? '…' : 'IA'}
              </button>
            </form>
            {iaNote && <p className="sable-ia-note" role="status">{iaNote}</p>}
          </div>
        )}

        {/* L'OBJECTIF (opt-in) : rien tant que tu ne le poses pas ; posé → stepper
            −/+ borné aux min/max du KPI, recalcul en direct, retirable. */}
        {formeActive && reglage && (
          <div className="sable-objectif" role="group" aria-label={`${reglage.label} (${reglage.unite})`}>
            <span className="sable-types-l">Objectif</span>
            {cibleActive > 0 ? (
              <>
                <span className="sable-obj-l">{reglage.label}</span>
                <button type="button" className="sable-obj-pas" onClick={() => bougeCible(-reglage.pas)} aria-label={`Moins ${reglage.pas}`}>−</button>
                <span className="sable-obj-val">{cibleActive}<small>{reglage.unite}</small></span>
                <button type="button" className="sable-obj-pas" onClick={() => bougeCible(reglage.pas)} aria-label={`Plus ${reglage.pas}`}>+</button>
                <button type="button" className="sable-obj-retirer" onClick={() => setCible(0)}>Retirer</button>
              </>
            ) : (
              <button type="button" className="sable-type" onClick={() => setCible(cibleRecette || reglage.defaut)}>
                Poser un objectif
              </button>
            )}
          </div>
        )}

        {/* LA PERSONNALITÉ : identité et voix — jamais un jugement (filtrerFait). */}
        {formeActive && (
          <PersonaStrip persona={personaActive} onChange={setPersona} kpi={kpiResolu} kpiId={kb.KPI} domaine={def.domaine} />
        )}

        <div className="sable-scene">
          <MoteurRendu recette={recetteScene} snapshot={snapshot} key={`${formeActive || 'tuile'}:${compActives.map((c) => c.contexte).join('+')}:${cibleActive || ''}`} />
        </div>

        {/* ÉPINGLER : la boucle se referme — la vue fabriquée devient la tuile. */}
        {formeActive && (
          <div className="sable-pied">
            <button type="button" className="sable-epingler" onClick={epingler}>
              Épingler à ma tour
            </button>
            <p className="sable-note">Tout reste retouchable — tape la tuile pour rouvrir son carré de sable.</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
