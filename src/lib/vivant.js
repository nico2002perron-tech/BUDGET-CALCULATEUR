/* ============================================================================
   vivant.js — LES TROIS HOOKS DU MOUVEMENT.

   Le principe, en une phrase : le mouvement ne tourne pas sur une minuterie,
   il se déclenche quand LA DONNÉE change. L'ancien index.css avait sept
   boucles décoratives (brumeA, brumeB, haloPulse, bandSheen, vrScan,
   voyantTour, p3dOscille) et zéro mouvement d'état — c'est pour ça qu'il
   paraissait chargé sans jamais paraître vivant.

   Tout respecte prefers-reduced-motion : le hook rend la valeur finale, sans
   transition. Rien à câbler en plus dans les composants.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'

const REDUIT = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ══════════════════════════════════════════════════════════════════════════
   1 — useValeurAnimee(valeur)

   Le chiffre ne SAUTE pas : il GLISSE vers sa nouvelle valeur (easeOutCubic,
   ~850 ms). Et il retourne `change` : un drapeau vrai pendant 900 ms après un
   vrai changement — à brancher sur la classe .a-change de theme.css, pour que
   la TUILE batte quand sa donnée bouge.

     const { affichee, change } = useValeurAnimee(kpi.valeur)
     <div className={`verre${change ? ' a-change' : ''}`}>
       <span className="chiffre">{formatCAD(affichee)}</span>

   Une valeur null (donnée manquante — resolveKPI le fait exprès) reste null :
   on n'anime jamais vers un chiffre inventé.
   ══════════════════════════════════════════════════════════════════════════ */
export function useValeurAnimee(valeur, ms = 850) {
  const [affichee, setAffichee] = useState(valeur)
  const [change, setChange] = useState(false)
  const depuis = useRef(valeur)
  const raf = useRef(null)
  const minuterie = useRef(null)

  useEffect(() => {
    if (valeur == null || depuis.current == null || valeur === depuis.current) {
      depuis.current = valeur
      setAffichee(valeur)
      return
    }
    if (REDUIT()) {
      depuis.current = valeur
      setAffichee(valeur)
      return
    }

    const de = depuis.current
    const vers = valeur
    const t0 = performance.now()

    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setAffichee(de + (vers - de) * e)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else depuis.current = vers
    }
    raf.current = requestAnimationFrame(tick)

    setChange(true)
    clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => setChange(false), 900)

    return () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(minuterie.current)
    }
  }, [valeur, ms])

  return { affichee, change }
}

/* ══════════════════════════════════════════════════════════════════════════
   2 — useVerre3D(max)

   La plaque s'INCLINE sous le curseur (rotateX/rotateY) et le spéculaire
   glisse en sens inverse. C'est l'inclinaison qui rend le verre physique — un
   backdrop-filter tout seul, ça reste une IMAGE de verre.

     const verre = useVerre3D(6)
     <div className="verre" {...verre}>

   Retourne les props à étaler : ref + les deux gestionnaires de pointeur.
   ══════════════════════════════════════════════════════════════════════════ */
export function useVerre3D(max = 6) {
  const ref = useRef(null)

  const onPointerMove = (e) => {
    const el = ref.current
    if (!el || REDUIT()) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
    el.style.transition = 'transform .12s linear'
    el.style.transform =
      `perspective(1200px) rotateY(${(px - 0.5) * max * 2}deg) ` +
      `rotateX(${-(py - 0.5) * max * 2}deg) translateY(-4px)`
  }
  const onPointerLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'transform .7s cubic-bezier(.22,.61,.36,1)'
    el.style.transform = ''
  }

  return { ref, onPointerMove, onPointerLeave }
}

/* ══════════════════════════════════════════════════════════════════════════
   3 — usePassage(refAtelier)

   Le passage tour → atelier n'est PAS un déclencheur (un seuil, ça s'allume
   d'un coup). C'est une VARIABLE continue : --p va de 0 à 1 selon la position
   de l'atelier dans la fenêtre, et tout le CSS s'y branche en calc(). Ton
   doigt fait le fondu. Tu remontes, ça se défait.

   L'inertie (lisse += (brut - lisse) * .14) est ce qui sépare « lié au
   scroll » de « soyeux » : sans elle, ça colle au pixel de défilement.

   Pose --p et --pic sur <html>. Retourne rien : le CSS lit les variables.
   ══════════════════════════════════════════════════════════════════════════ */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const doux = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function usePassage(refAtelier) {
  useEffect(() => {
    const el = refAtelier.current
    if (!el) return
    const root = document.documentElement

    if (REDUIT()) {
      root.style.setProperty('--p', '0')
      root.style.setProperty('--pic', '0')
      return
    }

    let brut = 0
    let lisse = 0
    let tick = null

    const boucle = () => {
      lisse += (brut - lisse) * 0.14
      root.style.setProperty('--p', doux(clamp(lisse)).toFixed(4))
      // la couture lumineuse : elle naît à 0, explose PILE à mi-passage, meurt à 0
      const pic = Math.sin(clamp(lisse) * Math.PI)
      root.style.setProperty('--pic', (pic * pic).toFixed(3))
      tick = Math.abs(brut - lisse) > 0.0005 ? requestAnimationFrame(boucle) : null
    }
    const mesurer = () => {
      const r = el.getBoundingClientRect()
      brut = clamp((innerHeight - r.top) / (innerHeight * 0.85))
      if (!tick) tick = requestAnimationFrame(boucle)
    }

    addEventListener('scroll', mesurer, { passive: true })
    addEventListener('resize', mesurer)
    mesurer()
    return () => {
      removeEventListener('scroll', mesurer)
      removeEventListener('resize', mesurer)
      cancelAnimationFrame(tick)
      root.style.removeProperty('--p')
      root.style.removeProperty('--pic')
    }
  }, [refAtelier])
}

/* ══════════════════════════════════════════════════════════════════════════
   4 — useTheme()

   La peau vit dans un attribut sur <html>, persisté. Le sombre est le défaut
   (VISION §12 réécrit) ; le clair reste servi pour la présentation client.
   ══════════════════════════════════════════════════════════════════════════ */
const CLE = 'gfsf.theme'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(CLE) || 'sombre'
    } catch {
      return 'sombre'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(CLE, theme)
    } catch {
      /* quota plein — la peau tient pour la session, c'est assez */
    }
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'sombre' ? 'clair' : 'sombre'))]
}
