/* ============================================================================
   _interaction.jsx — LE SURVOL VIVANT partagé des blocs-graphiques (préfixe
   « _ » : pas un bloc, jamais au registre).

   useSelection() : UN état pour « la valeur qu'on regarde » — le survol de la
   souris + le MODE PROJECTEUR (un tap la FIGE : la fiche reste, on lit le
   graphique point par point ; re-tap → libérée ; le survol n'écrase jamais un
   figé). Au doigt (pas de survol), le tap est le seul geste — même état.

   useCompteur(valeur) : la valeur affichée SE COMPTE vers la cible (~380 ms,
   rAF, easing cubic-out) — saut instantané sous prefers-reduced-motion.

   InfoBulle : la fiche flottante d'un point — du HTML au-dessus de la scène
   (jamais le `title` natif, lent et gris), positionnée en fractions du
   conteneur (x/y ∈ 0..1), bornée aux bords, pointer-events: none.
   Contenu = des FAITS : étiquette, montant, repères comparés, mention ambre
   (l'exception négative) — aucun jugement.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { formatCAD } from '../lib/format.js'
import { sons } from '../lib/sons.js'

export function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useSelection() {
  // UN seul état + mises à jour FONCTIONNELLES : la libération d'une capture
  // pointeur rejoue enter/leave avec des closures périmées — un leave parasite
  // ne doit jamais écraser un figé posé dans le même lot d'événements.
  const [etat, setEtat] = useState({ actif: null, fige: false })
  const survole = (i) => setEtat((e) => (e.fige ? e : { actif: i, fige: false }))
  const quitte = () => setEtat((e) => (e.fige ? e : { actif: null, fige: false }))
  // tap : fige ici ; re-tap au même endroit : libère. Rend true si on vient de figer.
  const bascule = (i) => {
    const vaFiger = !(etat.fige && etat.actif === i)
    setEtat((e) => (e.fige && e.actif === i ? { actif: null, fige: false } : { actif: i, fige: true }))
    return vaFiger
  }
  // libération INCONDITIONNELLE (quitte() est volontairement sans effet quand
  // figé) : un vrai glisser de rotation ou un Rejouer relâche le projecteur —
  // la fiche ne dérive jamais sur une scène qui a bougé/rejoué.
  const libere = () => setEtat({ actif: null, fige: false })
  return { actif: etat.actif, fige: etat.fige, survole, quitte, bascule, libere }
}

export function useCompteur(cible) {
  const n = Number(cible)
  const [affiche, setAffiche] = useState(n)
  const courantRef = useRef(n)
  useEffect(() => {
    if (!isFinite(n) || reduceMotion()) { courantRef.current = n; setAffiche(n); return }
    const depart = courantRef.current
    if (depart === n) return
    const t0 = performance.now()
    const DUREE = 380
    let raf
    const pas = (t) => {
      const p = Math.min(1, (t - t0) / DUREE)
      const v = depart + (n - depart) * (1 - Math.pow(1 - p, 3))
      courantRef.current = v
      setAffiche(v)
      if (p < 1) raf = requestAnimationFrame(pas)
    }
    raf = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(raf)
  }, [n])
  return affiche
}

/** props : x/y = fractions 0..1 du conteneur POSITIONNÉ le plus proche ;
 *  titre (étiquette), valeur (nombre → formatCAD, compté), lignes (repères
 *  comparés, faits), sous (mention ambre — exception négative seulement) ;
 *  sens : 'haut' (au-dessus de l'ancre) ou 'bas' (SE RETOURNE sous l'ancre
 *  quand il n'y a pas la place au-dessus — un conteneur à overflow clip,
 *  comme la scène 3D, couperait la fiche d'une barre haute). */
export function InfoBulle({ x, y, titre, valeur, lignes = [], sous = '', sens = 'haut' }) {
  const v = useCompteur(valeur)
  return (
    // aria-hidden : la fiche est purement VISUELLE (pointer-events none, jamais
    // focusable) — un role="status" annoncerait chaque survol aux lecteurs
    // d'écran ; l'info vit dans l'aria-label des cibles interactives.
    <div
      className={`ibulle${sens === 'bas' ? ' ibulle--bas' : ''}`}
      aria-hidden="true"
      style={{ left: `${Math.min(90, Math.max(10, x * 100))}%`, top: `${Math.min(96, Math.max(2, y * 100))}%` }}
    >
      <span className="ibulle-t">{titre}</span>
      <span className="ibulle-v">{formatCAD(Math.round(v))}</span>
      {lignes.map((l, k) => (
        <span className="ibulle-l" key={k}>{l}</span>
      ))}
      {sous ? <span className="ibulle-sous">{sous}</span> : null}
    </div>
  )
}

/** Le bouton « Rejouer l'animation » (coin du titre de carte) : remonter le
 *  conteneur animé rejoue croissance/tracé/pose — le moment satisfaisant, à
 *  volonté. À CACHER sous prefers-reduced-motion (rien à rejouer). */
export function BoutonRejouer({ onClick }) {
  return (
    <button
      type="button"
      className="graf-rejouer"
      aria-label="Rejouer l’animation"
      title="Rejouer l’animation"
      onClick={() => { sons.tap(); onClick() }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  )
}

/** Les lignes de repères d'un point comparé : chaque série + l'écart en dollars
 *  quand il n'y a qu'UN repère (un fait, pas un verdict). PUR. */
export function lignesComparees(valeur, comparaisons, i) {
  const lignes = comparaisons.map((c) => `${c.label} · ${formatCAD(Math.round(c.valeurs[i] || 0))}`)
  if (comparaisons.length === 1) {
    const ecart = Math.round(valeur - (comparaisons[0].valeurs[i] || 0))
    lignes.push(`écart · ${ecart >= 0 ? '+' : '−'}${formatCAD(Math.abs(ecart))}`)
  }
  return lignes
}
