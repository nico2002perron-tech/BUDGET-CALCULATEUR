/* ============================================================================
   VerdictDuJour.jsx — LE HÉROS du cockpit (VISION §7a·2). La seule zone en
   dégradé navy→cyan (réutilise .band, le bloc héros de la maquette validée).
   Contient : le verdict du jour (phrase factuelle) + le rythme du mois
   (prorata + sorties datées passées / à venir).

   PRÉSENTATION PURE : reçoit le verdict déjà produit (le parent appelle
   construireVerdict). Ne calcule aucun montant, ne lit aucun snapshot.
   Data-aware : verdict null → ne rend RIEN. Les montants arrivent en segments
   { texte, fort, sens } — la vue les met en évidence, jamais elle ne les
   reformule. Ambre (#ffd9b0) RÉSERVÉ au sens 'neg' (VISION §12).
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

export default function VerdictDuJour({ verdict }) {
  if (!verdict || !Array.isArray(verdict.phrase) || verdict.phrase.length === 0) return null
  const r = verdict.rythme

  return (
    <section className="band verdict" aria-label="Le verdict du jour">
      <div className="band-top">
        <span className="verdict-tag">Le verdict du jour</span>
        {verdict.dateLabel && <span className="who">{verdict.dateLabel}</span>}
      </div>

      <p className="band-verdict">
        {verdict.phrase.map((s, i) =>
          s.fort ? (
            <b key={i} className={s.sens === 'neg' ? 'neg' : undefined}>{s.texte}</b>
          ) : (
            <span key={i}>{s.texte}</span>
          ),
        )}
      </p>

      {r && (
        <div className="vr">
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
        </div>
      )}

      {verdict.note && <p className="band-hint">{verdict.note}</p>}
    </section>
  )
}
