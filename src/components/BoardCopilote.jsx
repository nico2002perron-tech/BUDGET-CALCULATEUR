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

export default function BoardCopilote({ onPiloter, onChip }) {
  const [texte, setTexte] = useState('')
  const [charge, setCharge] = useState(false)
  const [note, setNote] = useState(null)
  const [fait, setFait] = useState(null) // { resume, refus, annuler }
  const inputRef = useRef(null)
  const timerRef = useRef(0)

  useEffect(() => () => clearTimeout(timerRef.current), [])
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

  const soumettre = async (e) => {
    e.preventDefault()
    const t = texte.trim()
    if (!t || charge) return
    setCharge(true)
    setNote(null)
    try {
      const r = await onPiloter(t)
      if (r && (r.resume || r.refus)) {
        clearTimeout(timerRef.current)
        setFait({ resume: r.resume || null, refus: r.refus || null, annuler: r.annuler || null })
        timerRef.current = setTimeout(() => setFait(null), 8000)
        setTexte('')
      } else if (r && r.note) {
        setNote(r.note)
      } else {
        setNote('Je n’ai pas trouvé d’action pour cette demande — essaie « ajoute mon coussin » ou « c’est quoi mon plus gros poste ? ».')
      }
    } catch {
      setNote('Ta tour n’a pas pu traiter la demande. Réessaie.')
    } finally {
      setCharge(false)
    }
  }

  const annuler = () => {
    if (fait && typeof fait.annuler === 'function') fait.annuler()
    clearTimeout(timerRef.current)
    setFait(null)
  }

  return (
    <div className="board-copilote">
      <form className="sable-ia" onSubmit={soumettre}>
        <input
          ref={inputRef}
          type="text"
          className="sable-ia-input"
          placeholder="demande à ta tour — ex. « ajoute mon coussin » · touche /"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          aria-label="Demander une action à ta tour"
        />
        <button type="submit" className="sable-ia-go" disabled={charge || !texte.trim()}>
          {charge ? '…' : 'IA'}
        </button>
      </form>
      {fait && (
        <div className="sable-fait" role="status">
          {fait.resume ? <span className="sable-fait-t">{fait.resume}</span> : null}
          {fait.refus ? <span className="sable-fait-r">{fait.refus}</span> : null}
          {fait.resume && fait.annuler ? <button type="button" className="sable-fait-annul" onClick={annuler}>Annuler</button> : null}
        </div>
      )}
      {note && <p className="sable-ia-note" role="status">{note}</p>}
    </div>
  )
}
