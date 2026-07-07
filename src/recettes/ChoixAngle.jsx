/* ============================================================================
   ChoixAngle.jsx — la colonne « comment voir ». Pour un KPI DÉJÀ nommé dans la
   recette, laisse choisir parmi ses formes compatibles laquelle l'affiche.

   • Le recommandé (déterministe, posé par composer/la recette) est PRÉ-SÉLECTIONNÉ,
     porte la pastille « Recommandé » + son « pourquoi ». Les autres = « Autre angle »,
     discrets (0.5px vs 2px d'accent). Accepter = un tap ; explorer = optionnel.
   • Sélectionner = onChoisir(forme) → le parent échange `forme` sur la recette → le
     MoteurRendu re-rend. PRÉSENTATION PURE : le KPI est résolu une fois (la courroie),
     changer d'angle ne recalcule aucun chiffre.
   • Data-aware : une forme impossible n'est jamais offerte (formesPourKPI). Une seule
     forme → rien à choisir → le composant ne rend rien.
   • Cyan = toi/maintenant ; JAMAIS d'ambre (un angle n'est pas une alerte). Tap ≥44px.

   props : { kpiId, snapshot, recommande, formeActuelle, onChoisir, formes? }
   ========================================================================== */
import { formesPourKPI, pourquoiForme, nomForme } from './bibliotheque-kpis.js'

// Mini-schémas SVG : chaque forme se reconnaît d'un coup d'œil (chiffre, arc, rebours,
// maillons, deux barres, barre). Présentation seulement.
const GLYPHE = {
  stat: <svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="900" fill="currentColor">12</text></svg>,
  jauge: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 17a8 8 0 0 1 16 0" strokeLinecap="round" /><path d="M12 17l4-4" strokeLinecap="round" /></svg>,
  chronologie: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 1.5" strokeLinecap="round" /></svg>,
  chaine: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="12" r="2.5" /><path d="M7.5 12h9" /></svg>,
  comparaison: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 20V8M16 20V4" strokeLinecap="round" /></svg>,
  barre_progression: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="10" width="18" height="5" rx="2.5" /><rect x="3" y="10" width="11" height="5" rx="2.5" fill="currentColor" stroke="none" /></svg>,
  prisme3d: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>,
  bandes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 20v-8M12 20V5M18 20v-5" strokeLinecap="round" /></svg>,
  courbe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 16c3 0 3-7 6-7s3 5 6 5 2-6 4-8" strokeLinecap="round" /></svg>,
  nuage: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="7" cy="15" r="2.2" /><circle cx="13" cy="8" r="3" /><circle cx="18" cy="15.5" r="1.6" /></svg>,
  beignet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>,
  anneau3d: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="4.5" /><ellipse cx="12" cy="12" rx="4" ry="2" /></svg>,
}

export default function ChoixAngle({ kpiId, snapshot, recommande, formeActuelle, onChoisir, formes, ctx }) {
  const liste = Array.isArray(formes) ? formes : formesPourKPI(kpiId, snapshot, ctx)
  if (!liste || liste.length <= 1) return null // rien à choisir → on n'encombre pas

  return (
    <div className="angles" role="group" aria-label="Choisir comment voir ce chiffre">
      {liste.map((f) => {
        const estReco = f === recommande
        const sel = f === formeActuelle
        return (
          <button
            key={f}
            type="button"
            className={`angle-carte${sel ? ' angle-sel' : ''}${estReco ? ' angle-reco' : ''}`}
            aria-pressed={sel}
            onClick={() => onChoisir && onChoisir(f)}
          >
            <span className="angle-glyphe">{GLYPHE[f] || GLYPHE.stat}</span>
            <span className="angle-nom">{nomForme(f)}</span>
            {estReco ? <span className="angle-pastille">Recommandé</span> : <span className="angle-autre">Autre angle</span>}
            {estReco && <span className="angle-pourquoi">{pourquoiForme(f)}</span>}
          </button>
        )
      })}
    </div>
  )
}
