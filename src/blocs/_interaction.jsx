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
  return { actif: etat.actif, fige: etat.fige, survole, quitte, bascule }
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
 *  comparés, faits), sous (mention ambre — exception négative seulement). */
export function InfoBulle({ x, y, titre, valeur, lignes = [], sous = '' }) {
  const v = useCompteur(valeur)
  return (
    <div
      className="ibulle"
      role="status"
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
