/* ============================================================================
   VerdictDuJour.jsx — LE RYTHME DU MOIS, en carte CALME (LOT 2 « lecture en Z »).

   La phrase-verdict a migré dans l'EN-TÊTE (ligne d'état sous le « Bonjour ») — elle
   se lit sans défiler. Ici reste le rythme du mois : le prorata écoulé face aux
   sorties datées. Carte de tokens (fond surface + liseré cyan), zéro dégradé qui
   crie, zéro animation. Data-aware : pas de rythme → ne rend RIEN.

   PRÉSENTATION PURE : reçoit le verdict déjà produit. Ne calcule aucun montant.
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

export default function VerdictDuJour({ verdict }) {
  const r = verdict && verdict.rythme
  if (!r) return null

  return (
    <section className="rythme-carte" aria-label="Le rythme du mois">
      <div className="vr-tete">
        <span className="vr-titre">Le rythme du mois</span>
        <span className="vr-detail">
          {r.fixesAVenir > 0
            ? `${formatCAD(r.fixesAVenir)} de sorties datées à venir`
            : 'sorties datées du mois toutes passées'}
        </span>
      </div>
      {/* DEUX axes : le remplissage = la part de l'argent daté déjà sorti ;
          le curseur = le prorata du mois écoulé. Leur écart EST le rythme. */}
      <div
        className="vr-piste"
        role="img"
        aria-label={`Jour ${r.jour} sur ${r.nDays} — ${formatCAD(r.fixesPassees)} de sorties datées passées sur ${formatCAD(r.fixesTotal)}`}
      >
        <div className="vr-ecoule" style={{ width: `${r.sortiPct}%` }} />
        {r.marqueurs.map((m, i) => (
          <span
            key={i}
            className={`vr-pt${m.passe ? ' is-passe' : ''}`}
            style={{ left: `${(m.jour / r.nDays) * 100}%` }}
            title={`${m.label} · ${formatCAD(m.montant)} · le ${m.jour}`}
          />
        ))}
        <span className="vr-auj" style={{ left: `${r.prorataPct}%` }} />
      </div>
      <div className="vr-bornes">
        <span>1er</span>
        <span>{r.nDays}</span>
      </div>
      {verdict.note && <p className="rythme-note">{verdict.note}</p>}
    </section>
  )
}
