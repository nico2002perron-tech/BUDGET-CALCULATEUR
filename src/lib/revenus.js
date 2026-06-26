/* ============================================================================
   revenus.js — modèle de revenus + répartition saisonnière (PUR, testable).

   CONFORMITÉ ABSOLUE (VISION §11) : le TOTAL vient de l'usager. L'app ne fait
   que la MISE EN FORME — étaler ce total sur les mois actifs selon une courbe
   réaliste. AUCUN montant n'est inventé : la somme de la répartition est
   EXACTEMENT le total saisi, et chaque mois reste ajustable.

   Modèle (silo budgetcalc_v1 → store.revenus) :
     { mode: 'stable'|'saisonnier',
       mensuel,            // mode stable : net mensuel
       annuel,             // mode saisonnier : total annuel (de l'usager)
       moisActifs: [b×12], // mois où il y a du revenu
       repartition: [n×12] // la répartition (somme = annuel), éditable }
   ========================================================================== */

/** 12 booléens, tous actifs par défaut. */
export function moisActifsDefaut() {
  return Array.from({ length: 12 }, () => true)
}

/**
 * Répartit un TOTAL annuel sur les mois actifs selon une courbe en cloche
 * (montée/descente douce, pic au milieu de la saison). La somme rendue vaut
 * EXACTEMENT `annuel` (l'app ne crée pas de dollars).
 * @returns number[12]
 */
export function repartirSaisonnier(annuel, moisActifs) {
  const total = Math.max(0, Math.round(Number(annuel) || 0))
  const res = Array.from({ length: 12 }, () => 0)
  const actifs = []
  for (let i = 0; i < 12; i++) if (moisActifs && moisActifs[i]) actifs.push(i)
  if (!actifs.length || total <= 0) return res

  const n = actifs.length
  // Poids en cloche : sin(π·(k+0.5)/n) → ~0 aux bords, 1 au centre.
  const poids = actifs.map((_, k) => Math.sin((Math.PI * (k + 0.5)) / n))
  const sommePoids = poids.reduce((a, b) => a + b, 0) || 1

  // Parts arrondies, puis on recolle l'écart d'arrondi sur le mois-pic
  // → la somme est garantie EXACTEMENT égale au total.
  const parts = poids.map((p) => Math.round((total * p) / sommePoids))
  const ecart = total - parts.reduce((a, b) => a + b, 0)
  let pic = 0
  for (let k = 1; k < n; k++) if (poids[k] > poids[pic]) pic = k
  parts[pic] += ecart

  actifs.forEach((idx, k) => { res[idx] = parts[k] })
  return res
}

// ── Fréquence de paie (modèle repris de l'ancien budget.js, réécrit propre)
export const PAY_PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }
export const FREQS = [
  { id: 'weekly', label: 'Chaque semaine', sub: '52 paies / an' },
  { id: 'biweekly', label: 'Aux 2 semaines', sub: '26 paies / an' },
  { id: 'semimonthly', label: '2 fois par mois', sub: '24 paies / an' },
  { id: 'monthly', label: 'Mensuel', sub: '12 paies / an' },
]
export function payParYear(freq) {
  return PAY_PER_YEAR[freq] || 12
}

/** Revenu MENSUEL net dérivé (régulier : par paie × fréquence ÷ 12 ; saisonnier : annuel ÷ 12). */
export function revenuMensuel(revenus) {
  const r = revenus || {}
  if (r.mode === 'saisonnier') {
    const annuel = (Array.isArray(r.repartition) ? r.repartition : []).reduce((a, b) => a + (Number(b) || 0), 0)
    return Math.round(annuel / 12)
  }
  if (r.montantParPaie != null && r.montantParPaie !== '') {
    // freq absente (store partiel/ancien) → biweekly par défaut (= défaut de l'UI),
    // pour que le « net/mois » corresponde TOUJOURS à la fréquence affichée.
    return Math.round((Math.max(0, Number(r.montantParPaie) || 0) * payParYear(r.freq || 'biweekly')) / 12)
  }
  if (r.mensuel != null) return Math.max(0, Math.round(Number(r.mensuel) || 0)) // compat ancien modèle
  return 0
}

/** Dérive les 12 revenus mensuels (régulier → 12 mois égaux ; saisonnier → répartition). */
export function revenusMensuels(revenus) {
  const r = revenus || {}
  if (r.mode === 'saisonnier') {
    const rep = Array.isArray(r.repartition) ? r.repartition : []
    return Array.from({ length: 12 }, (_, i) => Math.max(0, Number(rep[i]) || 0))
  }
  const m = revenuMensuel(r)
  return Array.from({ length: 12 }, () => m)
}

/** Total annuel effectif (somme des 12 mois dérivés). */
export function totalAnnuel(revenus) {
  return revenusMensuels(revenus).reduce((a, b) => a + b, 0)
}

/** Jours du mois (1-31) où tombent les paies — pour le calendrier (mode régulier). */
export function payDaysForMonth(revenus, y, m) {
  const r = revenus || {}
  if (r.mode === 'saisonnier') return []
  const nDays = new Date(y, m + 1, 0).getDate()
  const clamp = (d) => Math.min(nDays, Math.max(1, d | 0))
  const out = []
  if (r.freq === 'monthly') {
    out.push(clamp((r.jours && r.jours[0]) || 1))
  } else if (r.freq === 'semimonthly') {
    ;(r.jours && r.jours.length ? r.jours : [1, 15]).forEach((x) => out.push(clamp(x)))
  } else if (r.freq === 'weekly') {
    const wd = r.weekday >= 0 && r.weekday <= 6 ? r.weekday : 4
    for (let d = 1; d <= nDays; d++) if (new Date(y, m, d).getDay() === wd) out.push(d)
  } else if (r.freq === 'biweekly') {
    const wd = r.weekday >= 0 && r.weekday <= 6 ? r.weekday : 4
    let anchor = r.anchor ? new Date(r.anchor + 'T00:00:00') : null
    if (!anchor || isNaN(anchor.getTime())) {
      for (let d = 1; d <= nDays; d++) if (new Date(y, m, d).getDay() === wd) { anchor = new Date(y, m, d); break }
    }
    if (anchor && !isNaN(anchor.getTime())) {
      const first = new Date(y, m, 1)
      const last = new Date(y, m, nDays)
      const cur = new Date(anchor)
      while (cur > first) cur.setDate(cur.getDate() - 14)
      while (cur <= last) {
        if (cur >= first && cur.getMonth() === m) out.push(cur.getDate())
        cur.setDate(cur.getDate() + 14)
      }
    }
  }
  // Semimensuel : on NE déduplique PAS — deux jours de paie distincts qui clampent
  // sur la même date (ex. [29,30] en février) doivent rester DEUX paies, sinon le
  // mois sous-compte d'un montant par paie. Les autres modes ne créent pas de doublon.
  const jours = r.freq === 'semimonthly' ? out : Array.from(new Set(out))
  return jours.sort((a, b) => a - b)
}
