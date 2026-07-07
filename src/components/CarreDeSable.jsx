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
import { useEffect, useRef, useState } from 'react'
import MoteurRendu from '../recettes/MoteurRendu.jsx'
import { kpiPourId, formesPourKPI, nomForme } from '../recettes/bibliotheque-kpis.js'

// Les types canoniques du sable, dans l'ordre de la rangée. Un type incompatible
// avec le KPI courant reste VISIBLE mais grisé (il dit ce que le sable sait faire).
const TYPES_SABLE = ['prisme3d', 'bandes', 'beignet', 'courbe', 'nuage']

const I_RETOUR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
)

export default function CarreDeSable({ widget, snapshot, onFermer }) {
  const racineRef = useRef(null)
  const retourRef = useRef(null)
  const [formeChoisie, setFormeChoisie] = useState(null) // null = le défaut du sable
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

  // Ouverture : focus sur « retour », Échap referme, et Tab RESTE dans le dialogue
  // (aria-modal sans piège à focus laisserait Tab activer des contrôles invisibles
  // sous l'overlay — ex. retirer un widget à l'aveugle).
  useEffect(() => {
    if (!actif) return
    const surTouche = (e) => {
      if (e.key === 'Escape') { onFermerRef.current(); return }
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

  // La page dessous ne défile pas pendant que le sable est ouvert.
  useEffect(() => {
    if (!actif) return
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = avant }
  }, [actif])

  if (!actif) return null

  // LA RANGÉE DE TYPES : seules les formes compatibles avec CE KPI s'offrent
  // (formesPourKPI, data-aware) ; un type canonique sans donnée/sens est grisé.
  // Changer de type = changer la FORME (présentation pure) — resolveKPI et le
  // snapshot restent les seules sources de chiffres.
  const formes = formesPourKPI(kb.KPI, snapshot, kb.params)
  const rangee = [...TYPES_SABLE, ...formes.filter((f) => !TYPES_SABLE.includes(f))]
  const formeDefaut = formes.includes('prisme3d') ? 'prisme3d' : formes.includes(kb.forme) ? kb.forme : formes[0] || null
  const formeActive = formeChoisie && formes.includes(formeChoisie) ? formeChoisie : formeDefaut

  const recetteScene = formeActive
    ? { situation: recette.situation, titre: '', blocs: [{ KPI: kb.KPI, forme: formeActive, params: kb.params || {} }] }
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
      <div className="sable-tete">
        <button ref={retourRef} type="button" className="sable-retour" onClick={onFermer} aria-label="Revenir à ma tour">
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

        <div className="sable-scene">
          <MoteurRendu recette={recetteScene} snapshot={snapshot} key={formeActive || 'tuile'} />
        </div>
        <p className="sable-note">Les commandes du sable (comparaisons, objectif, personnalité) s’assemblent ici, étape par étape.</p>
      </div>
    </div>
  )
}
