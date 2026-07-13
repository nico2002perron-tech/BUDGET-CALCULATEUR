/* ============================================================================
   AnneauModeles.jsx — L'ANNEAU DE L'ATELIER.

   Ce n'est PAS un dashboard-builder (VISION §8 : réarranger des tuiles vides est
   un piège). L'anneau SÉLECTIONNE un KPI de REGISTRE_KPIS — chaque KPI PENSE (il
   a son `requiert`, son `resolve`, ses formes). C'est le modèle Otto : piger dans
   un répertoire vérifié, jamais générer.

   ZÉRO DONNÉE NOUVELLE. Un KPI dont la donnée manque n'est jamais caché en
   silence — il est là, ÉTEINT, avec la donnée qui lui manque écrite dessus, et il
   devient une porte vers « Mes données ». resolveKPI refuse déjà d'inventer un
   chiffre ; l'interface est aussi honnête que lui.

   Physique en SECONDES (deg/s), pas en frames : même vitesse à 60 Hz ou 120 Hz.
   Trois régimes qui se relaient : DÉRIVE · LANCÉ · VISÉ.
   ========================================================================== */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { REGISTRE_KPIS, DONNEE_DISPO, resolveKPI, resoudreForme } from '../recettes/bibliotheque-kpis.js'
import { formatKPI } from '../lib/format.js'
import MoteurRendu from '../recettes/MoteurRendu.jsx'

const DOMAINES = ['budget', 'coussin', 'patrimoine', 'impot']

/* La donnée manquante, dite en français — jamais en nom de variable. `section` DOIT
   être une mission réelle (missions.js n'a que revenus/depenses/placements) : router
   vers une clé inexistante blanchit l'atelier. coussin se remplit dans la mission
   revenus ; patrimoine/projection dans placements. */
const OU_LA_PRENDRE = {
  capacite: { texte: 'tes revenus', section: 'revenus' },
  depenses: { texte: 'tes dépenses', section: 'depenses' },
  categories: { texte: 'tes catégories de dépenses', section: 'depenses' },
  coussin: { texte: 'ton coussin', section: 'revenus' },
  patrimoine: { texte: 'ton patrimoine', section: 'placements' },
  projection: { texte: 'ton âge et ton horizon', section: 'placements' },
  fiscalite: { texte: 'ton revenu brut', section: 'revenus' },
}
const sectionPour = (r) => (OU_LA_PRENDRE[r] && OU_LA_PRENDRE[r].section) || 'revenus'
const textePour = (r) => (OU_LA_PRENDRE[r] && OU_LA_PRENDRE[r].texte) || r

const REDUIT = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* Dégraissage de la phrase : si elle COMMENCE par le nombre déjà affiché en gros,
   on retire le nombre en tête (« 47 % de tes dépenses… » → « de tes dépenses… ») ;
   sinon on la montre TELLE QUELLE — jamais mutilée (les texteFactuel de
   bibliotheque-kpis.js sont conformes/filtrés et servent ailleurs : on n'y touche
   pas ; une redondance vaut mieux qu'une phrase cassée). */
function phrasePlaque(texte, montre) {
  const t = String(texte || '').trim()
  if (montre && montre !== '—' && t.startsWith(montre)) {
    const reste = t.slice(montre.length).replace(/^[\s,.;:–—-]+/, '').trim()
    if (reste.length >= 4) return reste.charAt(0).toLowerCase() + reste.slice(1)
  }
  return t
}

/* LE CONTENU d'une plaque — mémoïsé. Il ne dépend QUE de {p, snapshot} (stables
   pendant une rotation) : ainsi la pagination (setDevant à chaque cran pendant un
   lancé) ne ré-exécute JAMAIS les <MoteurRendu apercu> de chaque plaque. La rotation
   visible reste pilotée impérativement (pl.style dans la boucle physique). */
const PlaqueContenu = memo(function PlaqueContenu({ p, snapshot }) {
  const montre = !p.creer && p.dispo ? formatKPI(p.resolu?.valeur, p.resolu?.unite) : null
  const aChiffre = montre != null && montre !== '—' // faux pour une valeur OBJET (ex. l'équilibre en parts)
  const phrase = !p.creer && p.dispo ? phrasePlaque(p.resolu?.texteFactuel, montre) : ''
  return (
    <>
      <span className="pl-lustre" />
      <span className="pl-arete" />
      {p.creer ? (
        <span className="pl-vide">
          <span className="pl-vide-plus">+</span>
          <b>Crée le tien</b>
          <span>Dis-le dans tes mots</span>
        </span>
      ) : !p.dispo ? (
        /* ÉTEINTE — INCHANGÉE : c'est ICI que vit l'honnêteté sur la donnée. La
           donnée manquante est écrite ; la plaque est la porte vers « Mes données ». */
        <>
          <div className="pl-tete"><span className="pl-n">{p.kpi.question}</span></div>
          <span className="pl-src">{p.kpi.requiert.map((r) => textePour(r)).join(' + ')}</span>
          <p className="pl-manque">Il me manque {p.manque.map((r) => textePour(r)).join(' et ')}.</p>
          <span className="pl-ajout pl-aller">Aller la remplir →</span>
        </>
      ) : (
        /* ALLUMÉE — elle PRÉSENTE : le CHIFFRE est la réponse. La question chuchote
           au-dessus ; l'aperçu (le vrai bloc) passe DERRIÈRE, discret. */
        <div className={`pl-corps${aChiffre ? '' : ' pl-corps-obj'}`}>
          <span className="pl-label">{p.kpi.question}</span>
          {aChiffre && <span className="pl-chiffre">{montre}</span>}
          <div className="pl-apercu">
            <MoteurRendu recette={p.recette} snapshot={snapshot} apercu />
          </div>
          {phrase && <p className="pl-phrase">{phrase}</p>}
          <span className="pl-ajout">+ Ajouter à ma tour</span>
        </div>
      )}
    </>
  )
})

export default function AnneauModeles({ snapshot, widgets = [], onAjouter, onAllerSaisie, onCreer }) {
  /* Les KPIs déjà posés sur la tour (par l'emplacement KPI de leur recette) : on
     ne les repropose pas dans l'anneau. */
  const dejaPosees = useMemo(() => {
    const s = new Set()
    for (const w of Array.isArray(widgets) ? widgets : []) {
      const kb = w && w.recette && Array.isArray(w.recette.blocs) ? w.recette.blocs[0] : null
      if (kb && kb.KPI) s.add(kb.KPI)
    }
    return s
  }, [widgets])

  /* ── LES PLAQUES : les KPIs des domaines, allumés OU éteints. Un KPI éteint reste
        visible — c'est une invitation à remplir la donnée qui manque. ─── */
  const plaquesData = useMemo(() => {
    const liste = REGISTRE_KPIS
      .filter((k) => DOMAINES.includes(k.domaine) && !dejaPosees.has(k.id))
      .map((k) => {
        const manque = k.requiert.filter((r) => !(DONNEE_DISPO[r] && DONNEE_DISPO[r](snapshot)))
        const dispo = manque.length === 0
        const forme = dispo ? resoudreForme(k.id, k.blocsCompatibles[0], snapshot, {}) : null
        return {
          kpi: k, dispo, manque, forme,
          resolu: dispo ? resolveKPI(k.id, snapshot) : null,
          // L'aperçu est le VRAI bloc : une recette d'emplacement KPI (le format que
          // MoteurRendu connaît), rendue en réduction via la prop `apercu`.
          recette: dispo && forme ? { situation: `kpi_${k.id}`, titre: k.question, blocs: [{ KPI: k.id, forme, params: {} }] } : null,
        }
      })
    liste.sort((a, b) => Number(b.dispo) - Number(a.dispo)) // les allumés d'abord
    return [...liste, { creer: true }]
  }, [snapshot, dejaPosees])

  const N = plaquesData.length
  const PAS = 360 / N
  const RAYON = useMemo(() => Math.round(132 / Math.tan(Math.PI / Math.max(3, N))) + 74, [N])

  const vueRef = useRef(null)
  const refs = useRef([])
  const [devant, setDevant] = useState(0)

  /* Mouvement réduit : l'anneau ne tourne pas, il se met à PLAT (grille), et reste
     entièrement lisible ET cliquable. Réactif (l'usager peut changer le réglage). */
  const [reduit, setReduit] = useState(REDUIT)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduit(mq.matches)
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on)
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on) }
  }, [])

  /* ── L'ÉTAT PHYSIQUE — dans des refs : il tourne à 60 fps, il ne doit JAMAIS
        déclencher un re-rendu React. Seul `devant` (le cran atteint) remonte. ── */
  const S = useRef({
    angle: 0, vel: 0, tire: false, survol: false,
    cible: null, action: 0,
    ax: 0, aa: 0, xPrec: 0, tPrec: 0, devant: -1,
    pending: false, pid: null, // tap-vs-drag : on ne CAPTURE le pointeur qu'après un vrai mouvement
  })

  const viser = useCallback((i) => {
    const s = S.current
    let c = -i * PAS
    c += Math.round((s.angle - c) / 360) * 360 // le chemin le plus COURT
    s.cible = c
    s.action = performance.now()
  }, [PAS])

  const craner = useCallback((n) => {
    const s = S.current
    s.cible = Math.round(s.angle / PAS) * PAS + n * PAS
    s.action = performance.now()
  }, [PAS])

  useEffect(() => {
    if (reduit) return // mouvement réduit : l'anneau se fige à plat (CSS .anneau.plat), pas de boucle
    let brut = performance.now()
    let raf

    const DERIVE = 7, FRICTION = 1.9, K = 52, AMORTI = 8, SEUIL = 95

    const physique = (dt) => {
      const s = S.current
      if (s.tire) return

      if (s.cible !== null) { // VISÉ — un ressort ferme amène la plaque devant
        s.vel += (s.cible - s.angle) * 70 * dt
        s.vel *= Math.exp(-9.5 * dt)
        s.angle += s.vel * dt
        if (Math.abs(s.cible - s.angle) < 0.12 && Math.abs(s.vel) < 2.5) {
          s.angle = s.cible; s.vel = 0; s.cible = null
        }
        return
      }
      if (s.survol || Math.abs(s.vel) <= SEUIL) { // AIMANTÉ — vers le cran le plus proche
        const cran = Math.round(s.angle / PAS) * PAS
        s.vel += (cran - s.angle) * K * dt
        s.vel *= Math.exp(-AMORTI * dt)
      } else { // LANCÉ — il coule
        s.vel *= Math.exp(-FRICTION * dt)
      }
      // DÉRIVE — seulement si personne n'est là ET rien de touché depuis 4 s
      const oisif = !s.survol && performance.now() - s.action > 4000
      if (oisif && Math.abs(s.vel) < 1.2 && Math.abs(s.angle - Math.round(s.angle / PAS) * PAS) < 0.4) {
        s.vel += (DERIVE - s.vel) * Math.min(1, dt * 1.1)
      }
      s.angle += s.vel * dt
    }

    const poser = () => {
      const s = S.current
      const flou = Math.min(4.2, Math.abs(s.vel) / 58) // FLOU DE VITESSE
      refs.current.forEach((pl, i) => {
        if (!pl) return
        const a = i * PAS + s.angle
        const rad = (a * Math.PI) / 180
        const face = Math.cos(rad) // 1 devant · −1 derrière
        const prof = (face + 1) / 2
        const lift = Math.max(0, face) ** 7 // seule la plaque de FRONT se soulève
        pl.style.transform =
          `rotateY(${a}deg) translateZ(${RAYON}px) ` +
          `translateY(${(-lift * 13).toFixed(1)}px) ` +
          `scale(${(0.86 + prof * 0.14 + lift * 0.05).toFixed(3)})`
        pl.style.opacity = (0.1 + prof * 0.9).toFixed(3)
        pl.style.filter = `blur(${((1 - prof) * 4.6 + flou).toFixed(2)}px)`
        pl.style.zIndex = String(Math.round(face * 100) + 120)
        pl.style.pointerEvents = prof > 0.3 ? 'auto' : 'none' // TOUTE plaque qu'on voit est cliquable
        // Une SEULE plaque de front (le seuil doit exclure les voisins : avec N plaques,
        // le pas est 360/N ; à 21 plaques ≈ 17°, cos(17°)=0.956 → seuil > 0.956).
        pl.classList.toggle('avant', face > 0.97)
        /* LE LUSTRE : la lumière est fixe DANS LA PIÈCE, la plaque la traverse. */
        const t = Math.max(-1, Math.min(1, Math.sin(rad)))
        pl.style.setProperty('--gx', `${(t * 110 + 30).toFixed(1)}%`)
        pl.style.setProperty('--gi', (Math.max(0, face) ** 1.4 * 0.9).toFixed(3))
      })
      const idx = ((Math.round(-s.angle / PAS) % N) + N) % N
      if (idx !== s.devant) { s.devant = idx; setDevant(idx) }
    }

    let visible = true
    const boucle = (t) => {
      const dt = Math.min(0.05, (t - brut) / 1000)
      brut = t
      physique(dt)
      poser()
      raf = visible ? requestAnimationFrame(boucle) : null
    }
    const demarrer = () => { if (raf == null) { brut = performance.now(); raf = requestAnimationFrame(boucle) } }
    // Hors écran (l'usager lit la tour plus haut) → on SUSPEND la boucle : pas de
    // CPU/batterie pour une animation invisible. On reprend quand elle réapparaît.
    let io = null
    if (typeof IntersectionObserver === 'function' && vueRef.current) {
      io = new IntersectionObserver((entrees) => {
        visible = entrees[0].isIntersecting
        if (visible) demarrer()
      })
      io.observe(vueRef.current)
    }
    raf = requestAnimationFrame(boucle)
    return () => { if (raf != null) cancelAnimationFrame(raf); if (io) io.disconnect() }
  }, [N, PAS, RAYON, reduit])

  // La molette HORIZONTALE (ou shift+molette) fait tourner l'anneau. Écouteur NATIF
  // non-passif : un onWheel React est toujours passif (preventDefault ignoré → un
  // swipe horizontal du trackpad déclencherait la navigation « retour »).
  useEffect(() => {
    const el = vueRef.current
    if (!el || reduit) return
    const h = (e) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0)
      if (!d) return
      e.preventDefault()
      const s = S.current
      s.cible = null; s.action = performance.now(); s.vel += d * 1.6
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [reduit])

  /* ── LA PRISE : 1:1 avec le doigt, vitesse en deg/SECONDE. On distingue le TAP
        du DRAG : on ne CAPTURE le pointeur (ce qui vole le `click` au bouton de la
        plaque) qu'une fois un vrai mouvement engagé. Un tap laisse filer le clic. ── */
  // En mouvement réduit (grille à plat), aucune prise : le clic d'une plaque ne
  // doit jamais être volé par un micro-drag (il n'y a rien à faire tourner).
  const onPointerDown = (e) => {
    if (reduit) return
    const s = S.current
    s.pending = true; s.tire = false; s.vel = 0; s.cible = null; s.action = performance.now()
    s.ax = e.clientX; s.aa = s.angle; s.xPrec = e.clientX; s.tPrec = performance.now(); s.pid = e.pointerId
  }
  const onPointerMove = (e) => {
    if (reduit) return
    const s = S.current
    if (s.pending && Math.abs(e.clientX - s.ax) > 4) {
      // c'est un DRAG : on démarre à tirer et on capture (le clic est annulé)
      s.pending = false; s.tire = true
      vueRef.current?.setPointerCapture(s.pid)
    }
    if (!s.tire) return
    s.angle = s.aa + (e.clientX - s.ax) * 0.34
    const t = performance.now(), dt = (t - s.tPrec) / 1000
    if (dt > 0.004) { s.vel = ((e.clientX - s.xPrec) * 0.34) / dt; s.xPrec = e.clientX; s.tPrec = t }
  }
  // pointerup ET pointercancel : une interruption système émet pointercancel (pas
  // pointerup) ; sans ce relâchement, s.tire resterait vrai et figerait l'anneau.
  const onPointerUp = () => {
    const s = S.current
    s.pending = false
    if (s.tire) { s.tire = false; s.action = performance.now() }
  }

  const cliquer = (i, p) => {
    // En 3D : une plaque pas de front → on l'AMÈNE devant (elle n'est pas encore le
    // choix). À plat (mouvement réduit) : chaque plaque est directement activable.
    if (!reduit && !refs.current[i]?.classList.contains('avant')) { viser(i); return }
    if (p.creer) { onCreer?.(); return }
    if (!p.dispo) { onAllerSaisie?.(sectionPour(p.manque[0])); return }
    if (p.recette) onAjouter?.(p.recette)
  }

  return (
    <div className="carrousel">
      <div
        className="anneau-vue"
        ref={vueRef}
        onPointerEnter={() => { S.current.survol = true }}
        onPointerLeave={() => { S.current.survol = false }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Le parent NE TOURNE PAS — chaque plaque porte SON angle (deux rotations
            qui s'annulent = un anneau figé). Il ne fait que reculer + s'incliner.
            En mouvement réduit : `plat` → une grille lisible, aucune 3D. */}
        <div className={reduit ? 'anneau plat' : 'anneau'} style={reduit ? undefined : { transform: `translateZ(-${RAYON}px) rotateX(4deg)` }}>
          {plaquesData.map((p, i) => (
            <button
              key={p.creer ? 'creer' : p.kpi.id}
              type="button"
              ref={(el) => { refs.current[i] = el }}
              className={`plaque${p.creer ? ' creer' : ''}${!p.creer && !p.dispo ? ' eteinte' : ''}`}
              onClick={() => cliquer(i, p)}
            >
              <PlaqueContenu p={p} snapshot={snapshot} />
            </button>
          ))}
        </div>
        <div className="sol" />
      </div>

      {/* Le pied (flèches + points) pilote la ROTATION : sans intérêt à plat (chaque
          plaque est déjà directement activable), et craner/viser n'ont pas d'effet
          sans la boucle. On ne le rend donc pas en mouvement réduit. */}
      {!reduit && (
        <>
          <div className="car-pied">
            <button type="button" className="car-fl" onClick={() => craner(-1)} aria-label="Plaque précédente">‹</button>
            <div className="car-pts">
              {plaquesData.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className={`car-pt${i === devant ? ' on' : ''}`}
                  onClick={() => viser(i)}
                  aria-label={`Aller à la plaque ${i + 1}`}
                />
              ))}
            </div>
            <button type="button" className="car-fl" onClick={() => craner(1)} aria-label="Plaque suivante">›</button>
          </div>
          <div className="car-aide">Attrape · lance · ou molette</div>
        </>
      )}
    </div>
  )
}
