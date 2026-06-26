/* ============================================================================
   SousSectionBientot.jsx — l'état « bientôt » PROPRE d'une sous-section de
   « Mes données » pas encore outillée. Juste la PLACE dans la navigation : aucune
   logique, aucun branchement snapshot (ça viendra par vagues). Présentation seule.
   ========================================================================== */
export default function SousSectionBientot({ titre, note, icon }) {
  return (
    <section className="card ss-bientot">
      <span className="ss-bientot-ic" aria-hidden="true">{icon}</span>
      <span className="ss-bientot-badge">Bientôt</span>
      <h2 className="ss-bientot-t">{titre}</h2>
      {note && <p className="ss-bientot-p">{note}</p>}
    </section>
  )
}
