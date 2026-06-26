/* ============================================================================
   PanneauVivant.jsx — le tableau de bord KPI EN DIRECT à côté de la saisie.
   À mesure que tu remplis revenus/dépenses, chaque chiffre s'anime (tween de
   l'ancienne valeur vers la nouvelle) et les barres glissent. Lecture seule,
   FAITS seulement (aucun conseil) : reste du mois, revenu, coût de vie, épargne,
   et la part FIXE vs VARIABLE de ton coût de vie.

   Données LIVE depuis le store (pas le snapshot null-gardé) pour partir de 0 et
   monter en direct : revenuMensuel + helpers dépenses + engageLibre.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { revenuMensuel } from '../lib/revenus.js'
import { totalDepensesVie, totalClasse } from '../lib/depenses.js'
import { engageLibre } from '../lib/budget.js'
import { formatCAD } from '../lib/format.js'

function prefersReduce() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Compteur animé : tween de la valeur AFFICHÉE vers la nouvelle cible (ease-out cubique). */
function useCompteur(valeur, dur = 600) {
  const reduce = prefersReduce()
  const [n, setN] = useState(() => (reduce ? valeur : 0))
  const fromRef = useRef(reduce ? valeur : 0)
  const rafRef = useRef(0)
  useEffect(() => {
    if (reduce) { fromRef.current = valeur; setN(valeur); return }
    const from = fromRef.current
    const to = valeur
    if (Math.round(from) === Math.round(to)) { fromRef.current = to; setN(to); return }
    let t0 = null
    cancelAnimationFrame(rafRef.current)
    const tick = (ts) => {
      if (t0 == null) t0 = ts
      const p = Math.min(1, (ts - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = from + (to - from) * eased
      fromRef.current = cur
      setN(cur)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else { fromRef.current = to; setN(to) }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [valeur, reduce, dur])
  return n
}

export default function PanneauVivant({ store }) {
  const revenus = (store && store.revenus) || {}
  const depenses = (store && store.depenses) || []

  const revenu = Math.round(revenuMensuel(revenus))
  const coutVie = Math.round(totalDepensesVie(depenses))
  const epargne = Math.round(totalClasse(depenses, 'epargne'))
  const reste = revenu - coutVie - epargne
  const { engage: fixe, libre: variable, total: totalFV } = engageLibre({ depenses })

  const pFixe = totalFV > 0 ? Math.round((fixe / totalFV) * 100) : 0
  const pUtilise = revenu > 0 ? Math.min(100, Math.round(((coutVie + epargne) / revenu) * 100)) : 0
  const tauxEpargne = revenu > 0 ? Math.round((epargne / revenu) * 100) : 0

  const cReste = useCompteur(Math.abs(reste))
  const cRevenu = useCompteur(revenu)
  const cCoutVie = useCompteur(coutVie)
  const cEpargne = useCompteur(epargne)
  const cFixe = useCompteur(fixe)
  const cVariable = useCompteur(variable)

  const positif = reste >= 0
  const aDesDonnees = revenu > 0 || coutVie > 0 || epargne > 0

  return (
    <div className="pv" aria-live="polite">
      <span className="pv-tag"><span className="pv-tag-dot" aria-hidden="true" /> En direct</span>

      <div className={`pv-reste ${positif ? 'is-pos' : 'is-neg'}`}>
        <span className="pv-reste-l">{!aDesDonnees ? 'Ton mois' : positif ? 'Il te reste' : 'Il te manque'}</span>
        <span className="pv-reste-v">{formatCAD(cReste)}<span className="pv-reste-mo"> /mois</span></span>
        <div className="pv-jauge" role="img" aria-label={`${pUtilise} % du revenu assigné`}>
          <div className="pv-jauge-fill" style={{ width: `${pUtilise}%` }} />
        </div>
        <span className="pv-reste-s">{aDesDonnees ? `${pUtilise} % de ton revenu déjà assigné` : 'remplis tes données — ça se construit ici'}</span>
      </div>

      <div className="pv-stats">
        <div className="pv-stat">
          <span className="pv-dot pv-dot-rev" aria-hidden="true" />
          <span className="pv-stat-l">Revenu net</span>
          <span className="pv-stat-v">{formatCAD(cRevenu)}</span>
        </div>
        <div className="pv-stat">
          <span className="pv-dot pv-dot-vie" aria-hidden="true" />
          <span className="pv-stat-l">Coût de vie</span>
          <span className="pv-stat-v">{formatCAD(cCoutVie)}</span>
        </div>
        <div className="pv-stat">
          <span className="pv-dot pv-dot-ep" aria-hidden="true" />
          <span className="pv-stat-l">Épargne</span>
          <span className="pv-stat-v">{formatCAD(cEpargne)}</span>
        </div>
      </div>

      <div className="pv-bloc">
        <div className="pv-bloc-tete">
          <span className="pv-bloc-t">Fixe vs variable</span>
          <span className="pv-bloc-pct">{totalFV > 0 ? `${pFixe} % fixe` : '—'}</span>
        </div>
        <div className="pv-barre" role="img" aria-label={`Fixe ${pFixe} %, variable ${100 - pFixe} %`}>
          {totalFV > 0 ? (
            <>
              <div className="pv-seg pv-seg-fixe" style={{ width: `${pFixe}%` }} />
              <div className="pv-seg pv-seg-var" style={{ width: `${100 - pFixe}%` }} />
            </>
          ) : (
            <div className="pv-seg pv-seg-vide" style={{ width: '100%' }} />
          )}
        </div>
        <div className="pv-legende">
          <span><i className="pv-pt pv-pt-fixe" aria-hidden="true" />Fixe <b>{formatCAD(cFixe)}</b></span>
          <span><i className="pv-pt pv-pt-var" aria-hidden="true" />Variable <b>{formatCAD(cVariable)}</b></span>
        </div>
      </div>

      <div className="pv-bloc">
        <div className="pv-bloc-tete">
          <span className="pv-bloc-t">Taux d&rsquo;épargne</span>
          <span className="pv-bloc-pct">{revenu > 0 ? `${tauxEpargne} %` : '—'}</span>
        </div>
        <div className="pv-barre pv-barre-solo">
          <div className="pv-seg pv-seg-ep" style={{ width: `${Math.min(100, tauxEpargne)}%` }} />
        </div>
        <p className="pv-note">part de ton revenu mise de côté</p>
      </div>

      <p className="pv-pied">Tes montants restent sur ton appareil.</p>
    </div>
  )
}
