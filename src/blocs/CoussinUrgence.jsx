/* ============================================================================
   CoussinUrgence.jsx — fonds d'urgence : « X mois de besoins essentiels couverts »
   sur une jauge à zones (0–1 / 1–3 / 3–6 / 6+), avec les repères 3 et 6 mois.
   Faits seulement : on SITUE le coussin, on ne juge pas.
   props : params {} · data { montant, essentielles, moisCouverts, zone, cible3, cible6 }
   ========================================================================== */
import { positionPct } from '../lib/coussin.js'
import { formatCAD } from '../lib/format.js'

const ZONES = [
  { de: 0, a: 1, label: '0–1', couleur: '#f4dcdc' },
  { de: 1, a: 3, label: '1–3', couleur: '#f6e7c9' },
  { de: 3, a: 6, label: '3–6', couleur: '#cdeede' }, // bande repère
  { de: 6, a: 7, label: '6+', couleur: '#cfe8f5' },
]

export default function CoussinUrgence({ params = {}, data = {} }) {
  void params
  const montant = Number(data.montant) || 0
  const essentielles = Number(data.essentielles) || 0
  const mois = data.moisCouverts
  const aMois = mois != null && isFinite(mois)
  const pos = positionPct(mois)
  const moisTxt = aMois ? mois.toFixed(1).replace('.', ',') : '—'

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l8 4v5c0 4.4-3.1 7.9-8 9-4.9-1.1-8-4.6-8-9V7z" />
        </svg>
        Ton fonds d&rsquo;urgence
      </div>
      <p className="card-sub">
        {essentielles > 0
          ? `Combien de mois de besoins essentiels (${formatCAD(essentielles)}/mois) ton coussin couvre.`
          : 'Entre tes besoins essentiels dans « Mes données » pour voir combien de mois ton coussin couvre.'}
      </p>

      <div className="cou-num"><b>{moisTxt}</b> mois couverts</div>

      <div className="cou-barre" role="img" aria-label={`${moisTxt} mois couverts sur une échelle de 0 à 7`}>
        {ZONES.map((z) => (
          <div key={z.label} className="cou-zone" style={{ flex: z.a - z.de, background: z.couleur }}>
            <span className="cou-zone-l">{z.label}</span>
          </div>
        ))}
        {aMois && <span className="cou-curseur" style={{ left: `${pos}%` }} />}
      </div>

      <div className="cou-pieds">
        <span>Ton coussin <b>{formatCAD(montant)}</b></span>
        {essentielles > 0 && <span className="cou-repere">bande repère 3–6 mois : {formatCAD(data.cible3)} – {formatCAD(data.cible6)}</span>}
      </div>
    </section>
  )
}
