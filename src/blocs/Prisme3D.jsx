/* ============================================================================
   Prisme3D.jsx — LA SCÈNE 3D du carré de sable (bloc `prisme3d`).

   Une série temporelle (12 mois du snapshot) en PRISMES rectangulaires extrudés :
   CSS 3D pur (preserve-3d, 5 faces par barre), plancher quadrillé incliné pour la
   profondeur, rotation lente qui oscille (~±16°, 12 s) et croissance des barres
   décalée à l'apparition. Zéro dépendance — three.js reste une piste future :
   l'architecture (données résolues ici, géométrie 100 % CSS) permettrait de
   remplacer la scène sans toucher au contrat recette→registre→snapshot.

   props :
     params : { comparaisons?: [{contexte, label?}] } — de la STRUCTURE (schema.js
              résout chaque contexte en série ; jamais un chiffre dans la recette)
     data   : { serie:[12], seuil:number, comparaisons:[{label, valeurs:[12]}] }
     kpi    : la résolution du KPI héros (texteFactuel en sous-titre)

   COMPARAISON : pour chaque mois, les prismes s'accolent — « cette année » dans
   l'accent vif, les séries comparées en gris (#5A6480, puis gris dégradés).
   La légende suit. L'ambre du seuil ne marque QUE ta série (l'exception, §12).

   Canvas SOMBRE autoportant (near-black, coins très arrondis) : le bloc emporte
   sa surface, dans le sable comme sur la tour. Étiquettes/valeurs en mono.
   Data-aware : série vide → état honnête. prefers-reduced-motion : aucune
   rotation ni croissance, tout s'affiche d'un coup.
   ========================================================================== */
import { useRef } from 'react'
import { MOIS_COURTS, formatCAD } from '../lib/format.js'

const I_CUBE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
)

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/* Les gris des séries comparées (la 1re = le gris de la capture). */
const GRIS_SERIES = ['#5A6480', '#8a93a8', '#3e4658']

/* Un prisme à base rectangulaire : 5 faces dans un wrapper preserve-3d. Le
   dessus est plus clair, les côtés plus foncés, l'avant à mi-ton (ombrage par
   calques translucides sur la couleur d'accent — voir index.css). `sous` =
   mois sous le seuil → ambre (l'exception négative, jamais décoratif) ;
   `couleur` = série comparée (gris) — elle prime sur l'accent, jamais sur l'ambre. */
function Prisme({ hauteur, delai, sous, couleur }) {
  return (
    <div
      className={`p3d-prisme${sous ? ' est-sous' : ''}`}
      style={{ height: hauteur, '--delai': delai, ...(couleur && !sous ? { '--pc': couleur } : {}) }}
    >
      <span className="p3d-face p3d-avant" />
      <span className="p3d-face p3d-arriere" />
      <span className="p3d-face p3d-gauche" />
      <span className="p3d-face p3d-droite" />
      <span className="p3d-face p3d-dessus" />
    </div>
  )
}

export default function Prisme3D({ params = {}, data = {}, kpi = null }) {
  // ROTATION AU DOIGT : glisser horizontalement fait tourner la scène (CSS 3D
  // piloté au pointeur — zéro dépendance ; three.js reste une porte future).
  // Une fois touchée, la scène reste où TU la laisses (l'oscillation cesse).
  const stageRef = useRef(null)
  const sceneRef = useRef(null)
  const tourneRef = useRef(null) // { pointerId, x, angle } pendant le glisser
  const angleRef = useRef(-14) // l'angle « laissé là »
  const aTourneRef = useRef(false) // un vrai glisser → le clic qui suit est avalé
  const surPrisePointer = (e) => {
    if (e.button > 0 || e.target.closest('button, input, a, select, textarea')) return
    // un NOUVEAU geste repart propre : un swipe tactile ne laisse jamais un
    // drapeau levé qui avalerait le prochain tap (tuile qui n'ouvre plus).
    aTourneRef.current = false
    // reprendre l'angle COURANT de l'oscillation — jamais de décrochage au grab.
    if (stageRef.current && sceneRef.current && !sceneRef.current.classList.contains('est-manuel')) {
      try {
        const m = new DOMMatrixReadOnly(getComputedStyle(stageRef.current).transform)
        // transform = rotateX(10°)·rotateY(a) → m11 = cos a ; m13 = −cos(10°)·sin a
        const a = Math.atan2(-m.m13 / Math.cos((10 * Math.PI) / 180), m.m11) * (180 / Math.PI)
        if (isFinite(a)) angleRef.current = a
      } catch { /* on garde l'angle mémorisé */ }
    }
    tourneRef.current = { pointerId: e.pointerId, x: e.clientX, angle: angleRef.current }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* décoratif */ }
  }
  const surTournePointer = (e) => {
    const t = tourneRef.current
    if (!t || e.pointerId !== t.pointerId) return
    const delta = e.clientX - t.x
    if (Math.abs(delta) > 5) aTourneRef.current = true
    angleRef.current = t.angle + delta * 0.45
    if (sceneRef.current) sceneRef.current.classList.add('est-manuel')
    if (stageRef.current) stageRef.current.style.transform = `rotateX(10deg) rotateY(${angleRef.current}deg)`
  }
  const surLachePointer = (e) => {
    const t = tourneRef.current
    if (t && e.pointerId === t.pointerId) tourneRef.current = null
  }
  const avaleClicApresGlisser = (e) => {
    if (aTourneRef.current) { e.stopPropagation(); e.preventDefault(); aTourneRef.current = false }
  }

  const serie = (Array.isArray(data.serie) ? data.serie : [])
    .slice(0, 12)
    .map((v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0 })
  while (serie.length < 12) serie.push(0)
  const reduce = reduceMotion()

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card p3d">
        <div className="card-title">{I_CUBE}Ton année, en relief</div>
        <p className="bloc-vide p3d-vide">La scène s’allume avec tes revenus de saison — 12 mois, en prismes.</p>
      </section>
    )
  }

  // Les séries comparées (déjà résolues par schema.js — ici on ne fait qu'afficher).
  const comparaisons = (Array.isArray(data.comparaisons) ? data.comparaisons : [])
    .filter((c) => c && Array.isArray(c.valeurs))
    .map((c, k) => ({ label: c.label || 'repère', couleur: GRIS_SERIES[k % GRIS_SERIES.length], valeurs: c.valeurs.slice(0, 12).map((v) => Math.max(0, Number(v) || 0)) }))
  const enComparaison = comparaisons.length > 0

  // TON OBJECTIF (params.cible, intention posée par le stepper du sable) : le plan
  // ambre en travers de la scène. Posé → c'est LUI que l'ambre marque ; sinon
  // l'ambre garde sa lecture coût de vie (seuil du snapshot), comme flux_annuel.
  const cible = Math.max(0, Number(params.cible) || 0)
  const seuil = Number(data.seuil) || 0
  const plancher = cible > 0 ? cible : seuil
  // L'échelle englobe TOUTES les séries (et la cible) — tout se compare à l'œil.
  const max = Math.max(...serie, ...comparaisons.flatMap((c) => c.valeurs), cible, 1)
  const maxA = Math.max(...serie)
  const iMax = serie.indexOf(maxA)
  const H_MAX = 168 // hauteur (px) du plus haut prisme
  const hauteurDe = (v) => Math.max(2, Math.round((v / max) * H_MAX))
  const hCible = Math.round((cible / max) * H_MAX)
  const aDesSous = plancher > 0 && serie.some((v) => v < plancher)
  const aAtteint = cible > 0 && serie.some((v) => v >= cible) // la légende ne décrit jamais un état absent

  return (
    <section className="card p3d">
      <div className="card-title">{I_CUBE}Ton année, en relief</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub p3d-sub">{kpi.texteFactuel}</p> : null}

      <div
        className={`p3d-scene${reduce ? ' est-fixe' : ''}`}
        ref={sceneRef}
        role="img"
        aria-label={`Tes 12 mois en prismes 3D${enComparaison ? `, comparés à ${comparaisons.map((c) => c.label).join(' et ')}` : ''}.${kpi && kpi.texteFactuel ? ' ' + kpi.texteFactuel : ''}`}
        title="Glisse pour faire tourner la scène"
        onPointerDown={surPrisePointer}
        onPointerMove={surTournePointer}
        onPointerUp={surLachePointer}
        onPointerCancel={surLachePointer}
        onClickCapture={avaleClicApresGlisser}
      >
        <div className="p3d-stage" ref={stageRef}>
          <div className="p3d-sol" aria-hidden="true" />
          {/* LE PLAN CIBLE : une nappe ambre couchée à la hauteur de ton objectif. */}
          {cible > 0 && (
            <>
              <div className="p3d-cible" style={{ bottom: `${hCible}px` }} aria-hidden="true" />
              <span className="p3d-cible-etiq" style={{ bottom: `${hCible + 8}px` }} aria-hidden="true">
                objectif {formatCAD(cible)}/mois
              </span>
            </>
          )}
          <div
            className={`p3d-rangee${enComparaison ? ' p3d-rangee--multi' : ''}`}
            style={enComparaison ? { '--n': 1 + comparaisons.length, '--nc': comparaisons.length } : undefined}
          >
            {serie.map((v, i) => {
              const sous = plancher > 0 && v < plancher
              const infos = [`${MOIS_COURTS[i]} · ${enComparaison ? 'cette année ' : ''}${formatCAD(v)}${sous ? (cible > 0 ? ' (sous ton objectif)' : ' (sous ton coût de vie)') : ''}`]
              comparaisons.forEach((c) => infos.push(`${c.label} ${formatCAD(c.valeurs[i] || 0)}`))
              return (
                <div className="p3d-col" key={i} title={infos.join(' · ')}>
                  {i === iMax && <span className="p3d-val">{formatCAD(v)}</span>}
                  <div className="p3d-duo">
                    <Prisme hauteur={hauteurDe(v)} delai={`${i * 70}ms`} sous={sous} />
                    {comparaisons.map((c, k) => (
                      <Prisme key={k} hauteur={hauteurDe(c.valeurs[i] || 0)} delai={`${i * 70 + 35}ms`} couleur={c.couleur} />
                    ))}
                  </div>
                  <span className="p3d-etiq">{MOIS_COURTS[i]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="legend p3d-legende">
        <span className="it"><span className="sw p3d-sw-a" />{enComparaison ? 'cette année' : aAtteint ? 'Objectif atteint' : 'Revenus'}</span>
        {comparaisons.map((c, k) => (
          <span className="it" key={k}><span className="sw" style={{ background: c.couleur }} />{c.label}</span>
        ))}
        {aDesSous && <span className="it"><span className="sw p3d-sw-sous" />{cible > 0 ? 'Sous ton objectif' : 'Sous ton coût de vie'}</span>}
      </div>
    </section>
  )
}
