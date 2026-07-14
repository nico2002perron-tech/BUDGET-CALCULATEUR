/* ============================================================================
   BoardCopilote.jsx — LA BARRE-COPILOTE du tableau (« Demande à ta tour »).

   Présentiel : une phrase → `onPiloter(texte)` (dans App, qui possède les
   setters : store, sable, célébration). Le résultat pilote la chip
   « Fait · Annuler » (l'Annuler est une closure fournie par App qui restaure
   l'état d'avant). Raccourci « / » : focalise la barre de n'importe où.
   Les refus honnêtes et la note « pas trouvé » viennent d'App (faits filtrés).
   Zéro logique métier ici → l'exécution/validation vit dans actions.js.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { PLACEHOLDERS_BOARD, prochainePerche } from '../recettes/perches.js'

function reduitMouvement() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function BoardCopilote({ onPiloter, onPerche, perches = [], appris = [], onChip, compact = false }) {
  const [texte, setTexte] = useState('')
  const [charge, setCharge] = useState(false)
  const [note, setNote] = useState(null)
  const [fait, setFait] = useState(null) // { resume, refus, annuler }
  const [phIdx, setPhIdx] = useState(0) // l'exemple qui TOURNE dans le placeholder
  const inputRef = useRef(null)
  const timerRef = useRef(0)

  useEffect(() => () => clearTimeout(timerRef.current), [])
  useEffect(() => {
    if (reduitMouvement()) return
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS_BOARD.length), 4000)
    return () => clearInterval(id)
  }, [])
  // Signaler à la tour qu'une chip est en cours (elle garde le tableau monté →
  // l'Annuler survit même si la salve a vidé le board). false au démontage.
  useEffect(() => { if (onChip) onChip(!!(fait && fait.annuler)) }, [fait, onChip])
  useEffect(() => () => { if (onChip) onChip(false) }, [onChip])

  // « / » focalise la barre (sauf si on tape déjà dans un champ).
  useEffect(() => {
    const surTouche = (e) => {
      if (e.key !== '/' || e.defaultPrevented) return
      const t = e.target
      const dansChamp = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (dansChamp) return
      // Une modale ouverte (carré de sable) a sa PROPRE barre — ne pas voler le
      // focus vers la barre du board cachée derrière l'overlay.
      if (document.querySelector('.sable')) return
      e.preventDefault()
      if (inputRef.current) inputRef.current.focus()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [])

  // Affiche l'issue d'une salve (barre OU perche) : chip « Fait · Annuler », ou note.
  const montrer = (r) => {
    if (r && (r.resume || r.refus)) {
      clearTimeout(timerRef.current)
      setFait({ resume: r.resume || null, refus: r.refus || null, annuler: r.annuler || null })
      timerRef.current = setTimeout(() => setFait(null), 8000)
      return true
    }
    setNote('Je n’ai pas trouvé d’action pour cette demande — essaie « ajoute mon coussin » ou « c’est quoi mon plus gros poste ? ».')
    return false
  }
  const soumettre = async (e) => {
    e.preventDefault()
    const t = texte.trim()
    if (!t || charge) return
    setCharge(true)
    setNote(null)
    try {
      const r = await onPiloter(t)
      if (montrer(r)) setTexte('')
    } catch {
      setNote('Ta tour n’a pas pu traiter la demande. Réessaie.')
    } finally {
      setCharge(false)
    }
  }
  // Une PERCHE tappée : exécution DIRECTE (zéro IA) → même chip « Fait · Annuler ».
  const taperPerche = (actions) => {
    setNote(null)
    try { montrer(onPerche(actions)) } catch { setNote('Ta tour n’a pas pu faire ça.') }
  }
  // L'ENSEIGNEMENT PROGRESSIF : le prochain geste pas encore appris (déverrouillé un à un).
  const prochain = prochainePerche(perches, appris)

  const annuler = () => {
    if (fait && typeof fait.annuler === 'function') fait.annuler()
    clearTimeout(timerRef.current)
    setFait(null)
  }

  return (
    <div className={`board-copilote${compact ? ' est-compact' : ''}`}>
      <form className="sable-ia" onSubmit={soumettre}>
        <input
          ref={inputRef}
          type="text"
          className="sable-ia-input"
          placeholder={`demande à ta tour — ${PLACEHOLDERS_BOARD[phIdx]} · touche /`}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          aria-label="Demander une action à ta tour"
        />
        <button type="submit" className="sable-ia-go" disabled={charge || !texte.trim()}>
          {charge ? '…' : 'IA'}
        </button>
      </form>
      {/* La tour tend des DÉPARTS tappables (data-aware) + réassurance. Visibles
          même sous une note : le dead-end devient une redirection. En mode COMPACT
          (barre d'en-tête, sur le bandeau), les départs vivent SOUS le bandeau — pas ici. */}
      {!compact && !fait && perches.length > 0 && (
        <div className="cop-perches">
          <span className="cop-perches-l">Pour commencer :</span>
          {perches.map((p) => (
            <button key={p.label} type="button" className="cop-perche" onClick={() => taperPerche(p.actions)}>
              {p.label}
            </button>
          ))}
          <span className="cop-aide">j’essaie ta demande — tu peux toujours annuler.</span>
        </div>
      )}
      {fait && (
        <div className="sable-fait" role="status">
          {fait.resume ? <span className="sable-fait-t">{fait.resume}</span> : null}
          {fait.refus ? <span className="sable-fait-r">{fait.refus}</span> : null}
          {fait.resume && fait.annuler ? <button type="button" className="sable-fait-annul" onClick={annuler}>Annuler</button> : null}
        </div>
      )}
      {/* Le NUDGE : après un vrai geste, la tour déverrouille le suivant. */}
      {fait && fait.resume && prochain && (
        <div className="cop-prochain" role="status">
          <span className="cop-prochain-l">Et aussi :</span>
          <button type="button" className="cop-perche" onClick={() => taperPerche(prochain.actions)}>{prochain.label}</button>
        </div>
      )}
      {note && <p className="sable-ia-note" role="status">{note}</p>}
    </div>
  )
}
