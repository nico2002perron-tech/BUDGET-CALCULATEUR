/* ============================================================================
   Fait.jsx — bloc « fait » (REGISTRE-BLOCS §17). Un constat FACTUEL (garde-fou
   conformité : aucun jugement). Le texte vient soit du snapshot (data.texte,
   calculé, chiffres vrais), soit de la recette (params.texte, déjà filtré par
   validerRecette → filtrerFait).

   props :
     params : { texte?:string }   ← déjà filtré (interdit → null)
     data   : { texte?:string }   ← calculé du snapshot (prioritaire)
   ========================================================================== */
export default function Fait({ params = {}, data = {} }) {
  const texte = data.texte || params.texte || ''
  if (!texte) return null

  return (
    <div className="fait">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M11 12h1v4h1" />
      </svg>
      <p>{texte}</p>
    </div>
  )
}
