/* ============================================================================
   CarteEntite.jsx — Tranche studio, ÉTAGE D2 : LA TUILE « c'est à moi » (bloc #21).
   Rend une entité-objectif : photo en bandeau, accent de couleur (sur la TUILE seule,
   §12), barre de progression (déjà/cible + %), horizon, et le scénario choisi dans la
   VOIX verrouillée. Faits seulement. Photo absente → état propre, pas de trou.
   props : params { id } · data = l'entité (resolve depuis snapshot.entites)
   ========================================================================== */
import { accentValide } from '../lib/entites.js'
import { formatCAD } from '../lib/format.js'
import { filtrerFait } from '../recettes/schema.js'

// Petites icônes par type d'objectif (la perso vit sur la tuile, pas le chrome).
const ICONES = {
  plane: <path d="M10 3l11 9-11 9-1-6-6-3 6-3 1-6z" />,
  home: <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />,
  car: <path d="M5 13l1.5-4.5h11L19 13M5 13h14v4H5zM7 17v2M17 17v2" />,
  heart: <path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 4.5-7 9-7 9z" />,
  shield: <path d="M12 3l8 4v5c0 4.4-3.1 7.9-8 9-4.9-1.1-8-4.6-8-9V7z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></>,
}

export default function CarteEntite({ params = {}, data = {} }) {
  void params
  const e = data && data.id ? data : null
  if (!e) {
    return (
      <section className="card carte-entite">
        <p className="bloc-vide">Cet objectif n’est plus disponible.</p>
      </section>
    )
  }

  const accent = accentValide(e.couleurAccent) // hex, repli sûr si hors palette
  const cible = Number(e.cible) || 0
  const deja = Number(e.dejaEpargne) || 0
  const pct = cible > 0 ? Math.min(100, Math.max(0, Math.round((deja / cible) * 100))) : 0
  const h = e.horizonMois
  const horizonTxt = h === 0 ? 'Atteint' : h == null ? 'Au rythme actuel, pas encore en route' : `${h} mois à ton rythme`
  const fScen = filtrerFait(String(e.scenarioLabel || '')) // re-filtre défensif (jamais de texte brut)
  const scenario = fScen.ok && fScen.texte ? fScen.texte : ''
  const ic = ICONES[e.icon] || ICONES.target

  return (
    <section className="card carte-entite" style={{ '--ce-accent': accent }}>
      <div className={`ce-photo${e.photo ? '' : ' ce-photo-vide'}`} style={e.photo ? { backgroundImage: `url(${e.photo})` } : undefined} aria-hidden="true">
        {!e.photo && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ic}</svg>
        )}
      </div>

      <div className="ce-corps">
        <div className="ce-tete">
          <span className="ce-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ic}</svg>
          </span>
          <h3 className="ce-nom">{e.nom}</h3>
        </div>

        <div className="ce-piste"><span className="ce-rempli" style={{ width: `${pct}%` }} /></div>
        <div className="ce-rang">
          <span>Déjà <b>{formatCAD(deja)}</b></span>
          <span className="ce-pct">{pct} %</span>
          <span>Cible <b>{formatCAD(cible)}</b></span>
        </div>

        <div className="ce-horizon">{horizonTxt}</div>
        {scenario && <p className="ce-scenario">{scenario}</p>}
      </div>
    </section>
  )
}
