/* ============================================================================
   Horizon.jsx — « le télescope du et si » : glisse une épargne mensuelle de plus,
   et la valeur finale projetée bouge. On ajoute au socle (dernière année de la
   courbe) la valeur future d'une annuité — on ne re-roule PAS toute la projection.
   Étiqueté « selon tes hypothèses » : projection, pas une promesse.
   props : params { ajoutMax, pas } · data { annees:[{age, patrimoineNet}] }
   ========================================================================== */
import { useState } from 'react'
import { etSi, socleCourbe } from '../lib/horizon.js'
import { formatCAD, formatPct } from '../lib/format.js'

export default function Horizon({ params = {}, data = {} }) {
  const annees = Array.isArray(data.annees) ? data.annees : []
  const socle = socleCourbe(annees)
  const [extra, setExtra] = useState(0)
  const ajoutMax = [500, 1000, 2000].includes(params.ajoutMax) ? params.ajoutMax : 1000
  const pas = [50, 100].includes(params.pas) ? params.pas : 50

  if (!socle) {
    return (
      <section className="card">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
          L&rsquo;Horizon — le « et si »
        </div>
        <p className="bloc-vide">Ajoute ton patrimoine dans « Mes données » pour explorer ton avenir.</p>
      </section>
    )
  }

  const total = etSi(socle.baseEnd, extra, socle.rate, socle.years)
  const gain = total - socle.baseEnd

  return (
    <section className="card horizon">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
        L&rsquo;Horizon — le « et si »
      </div>
      <p className="card-sub">Et si tu mettais un peu plus de côté chaque mois ? Glisse, et regarde ton avenir bouger.</p>

      <div className="hz-total">
        En {socle.annee} : <b>{formatCAD(total)}</b>
      </div>
      <div className="hz-gain">{gain > 0 ? `dont +${formatCAD(gain)} grâce à ${formatCAD(extra)} / mois de plus` : 'à ton rythme actuel'}</div>

      <input className="hz-range" type="range" min="0" max={ajoutMax} step={pas} value={extra} onChange={(e) => setExtra(Number(e.target.value))} aria-label="Épargne mensuelle supplémentaire" />
      <div className="hz-echelle"><span>+0 $ / mois</span><span>+{formatCAD(ajoutMax)} / mois</span></div>

      <p className="hz-note">Selon tes hypothèses · rendement estimé {formatPct(socle.rate * 100)} / an. Projection à titre indicatif, pas une promesse.</p>
    </section>
  )
}
