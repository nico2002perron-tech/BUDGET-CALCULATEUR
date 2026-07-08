/* ============================================================================
   Anneau3D.jsx — bloc `anneau3d` : le beigne des catégories en ANNEAU 3D.

   Le même contenu que le beignet (la part de chaque poste, couleur = rôle),
   couché en anneau qui tourne lentement : CSS 3D pur — l'épaisseur est un
   empilement de couches (translateZ), les couches basses assombries. Le total
   reste en HUD plat (lisible, jamais déformé). Canvas sombre AUTOPORTANT
   (même famille visuelle que le prisme). Zéro dépendance.

   props : params {} · data { parCategorie, total, titre?, centre? } (le resolve
           du beignet, OU les parts de la famille du KPI via partsDuKPI —
           segments du brut, actifs du patrimoine… avec leurs propres titres)
           kpi (texteFactuel en sous-titre)
   Data-aware : aucune catégorie → état honnête. prefers-reduced-motion :
   anneau immobile.
   ========================================================================== */
import { couleurClasse } from '../lib/depenses.js'
import { formatCAD } from '../lib/format.js'

const I_ANNEAU = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="9" ry="4.5" /><ellipse cx="12" cy="12" rx="4" ry="2" />
  </svg>
)

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Même géométrie d'arc que le beignet (large-arc sur l'angle RÉEL du segment).
function arcPath(cx, cy, r, a0, a1, large) {
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const COUCHES = 8 // l'épaisseur de l'anneau (translateZ par couche)

export default function Anneau3D({ params = {}, data = {}, kpi = null }) {
  void params
  const cats = (Array.isArray(data.parCategorie) ? data.parCategorie : []).filter((c) => Number(c.montant) > 0)
  const total = cats.reduce((s, c) => s + (Number(c.montant) || 0), 0)
  const titre = typeof data.titre === 'string' && data.titre ? `${data.titre}, en anneau` : 'Ton anneau des dépenses'
  const centre = typeof data.centre === 'string' && data.centre ? data.centre : 'par mois'
  const reduce = reduceMotion()

  if (cats.length === 0 || total <= 0) {
    return (
      <section className="card p3d a3d">
        <div className="card-title">{I_ANNEAU}{titre}</div>
        <p className="bloc-vide p3d-vide">L’anneau s’allume avec tes vraies données, part par part.</p>
      </section>
    )
  }

  const cx = 90, cy = 90, r = 64, sw = 26
  const seul = cats.length === 1
  let a = -Math.PI / 2
  const segs = cats.map((c) => {
    const frac = c.montant / total
    const a0 = a
    const a1 = a + frac * Math.PI * 2
    a = a1
    const large = a1 - a0 > Math.PI ? 1 : 0
    return { id: c.id, label: c.label || 'Dépense', montant: c.montant, couleur: couleurClasse(c.classe), full: seul, d: arcPath(cx, cy, r, a0, Math.max(a0 + 0.001, a1 - 0.02), large) }
  })
  const top = cats.slice(0, 5)

  // Une couche = le même anneau, plus bas et plus sombre → l'épaisseur.
  const couche = (i) => (
    <svg
      key={i}
      className="a3d-couche"
      viewBox="0 0 180 180"
      style={{ transform: `translateZ(${(-i * 1.8).toFixed(1)}px)`, filter: i > 0 ? `brightness(${(0.72 - i * 0.05).toFixed(2)})` : undefined }}
      aria-hidden={i > 0 ? 'true' : undefined}
    >
      {segs.map((s) =>
        s.full ? (
          <circle key={s.id} cx={cx} cy={cy} r={r} fill="none" stroke={s.couleur} strokeWidth={sw} />
        ) : (
          <path key={s.id} d={s.d} fill="none" stroke={s.couleur} strokeWidth={sw} strokeLinecap="butt">
            {i === 0 ? <title>{`${s.label} · ${formatCAD(s.montant)}`}</title> : null}
          </path>
        ),
      )}
    </svg>
  )

  return (
    <section className="card p3d a3d">
      <div className="card-title">{I_ANNEAU}{titre}</div>
      {kpi && kpi.texteFactuel ? <p className="card-sub p3d-sub">{kpi.texteFactuel}</p> : null}

      <div className={`a3d-scene${reduce ? ' est-fixe' : ''}`} role="img" aria-label={`La part de chaque poste (${formatCAD(total)} ${centre}), en anneau 3D.`}>
        <div className="a3d-stage">
          {Array.from({ length: COUCHES }, (_, i) => couche(COUCHES - 1 - i))}
        </div>
        {/* Le HUD reste PLAT : le total se lit toujours, jamais déformé. */}
        <div className="a3d-hud" aria-hidden="true">
          <span className="a3d-total">{formatCAD(total)}</span>
          <span className="a3d-sous">{centre}</span>
        </div>
      </div>

      <div className="legend p3d-legende">
        {top.map((c) => (
          <span className="it" key={c.id}><span className="sw" style={{ background: couleurClasse(c.classe) }} />{c.label} · {formatCAD(c.montant)}</span>
        ))}
      </div>
    </section>
  )
}
