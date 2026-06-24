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

/** Dérive les 12 revenus mensuels du modèle (stable → ×12 ; saisonnier → répartition). */
export function revenusMensuels(revenus) {
  const r = revenus || {}
  if (r.mode === 'saisonnier') {
    const rep = Array.isArray(r.repartition) ? r.repartition : []
    return Array.from({ length: 12 }, (_, i) => Math.max(0, Number(rep[i]) || 0))
  }
  const m = Math.max(0, Number(r.mensuel) || 0)
  return Array.from({ length: 12 }, () => m)
}

/** Total annuel effectif (somme des 12 mois dérivés). */
export function totalAnnuel(revenus) {
  return revenusMensuels(revenus).reduce((a, b) => a + b, 0)
}
