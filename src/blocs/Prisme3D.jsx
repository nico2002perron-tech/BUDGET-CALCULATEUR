/* ============================================================================
   Prisme3D.jsx — LA SCÈNE 3D du carré de sable (bloc `prisme3d`).

   Une série (12 mois du snapshot, OU la série de la famille du KPI : postes du
   budget, projection par âge, segments du brut — via serieDuKPI) en PRISMES
   rectangulaires extrudés : CSS 3D pur (preserve-3d, 5 faces par barre),
   plancher quadrillé incliné pour la profondeur, rotation lente qui oscille
   (~±16°, 12 s) et croissance des barres décalée à l'apparition. Zéro
   dépendance — three.js reste une piste future : l'architecture (données
   résolues ici, géométrie 100 % CSS) permettrait de remplacer la scène sans
   toucher au contrat recette→registre→snapshot.

   props :
     params : { comparaisons?: [{contexte, label?}] } — de la STRUCTURE (schema.js
              résout chaque contexte en série ; jamais un chiffre dans la recette)
     data   : contrat normaliserSerie — { serie:[12] } historique, ou
              { labels, valeurs, titreBase, legende, seuil, seuilTexte, sousTexte }
     kpi    : la résolution du KPI héros (texteFactuel en sous-titre)

   COMPARAISON : pour chaque mois, les prismes s'accolent — « cette année » dans
   l'accent vif, les séries comparées en gris (#5A6480, puis gris dégradés).
   La légende suit. L'ambre du seuil ne marque QUE ta série (l'exception, §12).

   Canvas SOMBRE autoportant (near-black, coins très arrondis) : le bloc emporte
   sa surface, dans le sable comme sur la tour. Étiquettes/valeurs en mono.
   Data-aware : série vide → état honnête. prefers-reduced-motion : aucune
   rotation ni croissance, tout s'affiche d'un coup.
   ========================================================================== */
import { useRef, useState } from 'react'
import { formatCAD } from '../lib/format.js'
import { normaliserSerie, majuscule, etiquetteCourte } from '../lib/serie.js'
import { useSelection, InfoBulle, lignesComparees } from './_interaction.jsx'
import { sons } from '../lib/sons.js'

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
function Prisme({ hauteur, delai, sous, couleur, fort }) {
  return (
    <div
      className={`p3d-prisme${sous ? ' est-sous' : ''}${fort ? ' est-fort' : ''}`}
      style={{ height: hauteur, '--delai': delai, ...(couleur && !sous ? { '--pc': couleur } : {}) }}
    >
      <span className="p3d-face p3d-avant" />
      <span className="p3d-face p3d-arriere" />
      <span className="p3d-face p3d-gauche" />
      <span className="p3d-face p3d-droite" />
      <span className="p3d-face p3d-dessus" />
      {/* le reflet dans le plancher (salle d'exposition) — suit --pc, donc
          l'ambre d'une exception et le gris d'un repère se reflètent juste */}
      <span className="p3d-reflet" aria-hidden="true" />
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
    // ⚠️ pas de capture ICI : capturer au pointerdown détournerait le CLICK des
    // colonnes (le survol vivant) vers la scène — elle se pose au 1er VRAI
    // mouvement de rotation seulement.
    tourneRef.current = { pointerId: e.pointerId, x: e.clientX, angle: angleRef.current }
  }
  const surTournePointer = (e) => {
    const t = tourneRef.current
    if (!t || e.pointerId !== t.pointerId) return
    const delta = e.clientX - t.x
    if (Math.abs(delta) > 5 && !aTourneRef.current) {
      aTourneRef.current = true
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* décoratif */ }
    }
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

  // LE SURVOL VIVANT : la colonne regardée s'allume, la fiche suit ; un tap la
  // FIGE (mode projecteur). La position vient du rect PROJETÉ de la colonne
  // (la scène tourne) relatif à la scène — jamais pendant un glisser-rotation.
  const sel = useSelection()
  const [vise, setVise] = useState(null) // { i, x, y } fractions de la scène
  const viser = (i, el) => {
    const sc = sceneRef.current
    if (!sc || tourneRef.current) return false
    const r = el.getBoundingClientRect()
    const s = sc.getBoundingClientRect()
    if (!s.width || !s.height) return false
    setVise({ i, x: (r.left + r.width / 2 - s.left) / s.width, y: Math.max(0.26, (r.top - s.top) / s.height) })
    return true
  }
  const surEntreCol = (i) => (e) => {
    if (e.pointerType !== 'mouse' || sel.fige) return
    if (viser(i, e.currentTarget)) sel.survole(i)
  }
  const surQuitteCol = () => { sel.quitte() }
  const surTapCol = (i) => (e) => {
    if (aTourneRef.current) return // un vrai glisser n'est pas un tap
    if (sel.bascule(i)) { viser(i, e.currentTarget); sons.tap() }
  }

  const S = normaliserSerie(data)
  const serie = S.valeurs
  const labels = S.labels
  const titre = S.titreBase ? `${S.titreBase}, en relief` : 'Ton année, en relief'
  const reduce = reduceMotion()

  if (!serie.some((v) => v > 0)) {
    return (
      <section className="card p3d">
        <div className="card-title">{I_CUBE}{titre}</div>
        <p className="bloc-vide p3d-vide">{S.titreBase ? 'La scène s’allume avec tes vraies données — chaque valeur devient un prisme.' : 'La scène s’allume avec tes revenus de saison — 12 mois, en prismes.'}</p>
      </section>
    )
  }

  // Les séries comparées (déjà résolues par schema.js — ici on ne fait qu'afficher).
  const comparaisons = (Array.isArray(data.comparaisons) ? data.comparaisons : [])
    .filter((c) => c && Array.isArray(c.valeurs))
    .map((c, k) => ({ label: c.label || 'repère', couleur: GRIS_SERIES[k % GRIS_SERIES.length], valeurs: c.valeurs.slice(0, serie.length).map((v) => Math.max(0, Number(v) || 0)) }))
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
      <div className="card-title">{I_CUBE}{titre}</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub p3d-sub">{kpi.texteFactuel}</p> : null}

      <div
        className={`p3d-scene${reduce ? ' est-fixe' : ''}${sel.actif != null ? ' a-vise' : ''}`}
        ref={sceneRef}
        role="img"
        aria-label={`${S.titreBase ? `${S.titreBase} — ${serie.length} valeurs` : 'Tes 12 mois'} en prismes 3D${enComparaison ? `, comparés à ${comparaisons.map((c) => c.label).join(' et ')}` : ''}.${kpi && kpi.texteFactuel ? ' ' + kpi.texteFactuel : ''}`}
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
            className={`p3d-rangee${enComparaison ? ' p3d-rangee--multi' : ''}${sel.actif != null ? ' a-vise' : ''}`}
            style={{ '--cols': serie.length, ...(enComparaison ? { '--n': 1 + comparaisons.length, '--nc': comparaisons.length } : {}) }}
          >
            {serie.map((v, i) => {
              const sous = plancher > 0 && v < plancher
              return (
                <div
                  className={`p3d-col${sel.actif === i ? ' est-vise' : ''}`}
                  key={i}
                  onPointerEnter={surEntreCol(i)}
                  onPointerLeave={surQuitteCol}
                  onClick={surTapCol(i)}
                >
                  {i === iMax && <span className="p3d-val">{formatCAD(v)}</span>}
                  <div className="p3d-duo">
                    <Prisme hauteur={hauteurDe(v)} delai={`${i * 70}ms`} sous={sous} fort={i === iMax} />
                    {comparaisons.map((c, k) => (
                      <Prisme key={k} hauteur={hauteurDe(c.valeurs[i] || 0)} delai={`${i * 70 + 35}ms`} couleur={c.couleur} />
                    ))}
                  </div>
                  <span className="p3d-etiq" aria-hidden="true">{etiquetteCourte(labels[i], 6)}</span>
                </div>
              )
            })}
          </div>
        </div>
        {sel.actif != null && vise && vise.i === sel.actif && (
          <InfoBulle
            x={vise.x}
            y={vise.y}
            titre={labels[sel.actif]}
            valeur={serie[sel.actif]}
            lignes={lignesComparees(serie[sel.actif], comparaisons, sel.actif)}
            sous={plancher > 0 && serie[sel.actif] < plancher ? (cible > 0 ? 'sous ton objectif' : S.sousTexte) : ''}
          />
        )}
      </div>

      <div className="legend p3d-legende">
        <span className="it"><span className="sw p3d-sw-a" />{enComparaison ? 'cette année' : aAtteint ? 'Objectif atteint' : S.legende}</span>
        {comparaisons.map((c, k) => (
          <span className="it" key={k}><span className="sw" style={{ background: c.couleur }} />{c.label}</span>
        ))}
        {aDesSous && <span className="it"><span className="sw p3d-sw-sous" />{cible > 0 ? 'Sous ton objectif' : majuscule(S.sousTexte)}</span>}
      </div>
    </section>
  )
}
