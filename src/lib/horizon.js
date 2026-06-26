/* ============================================================================
   horizon.js — le « télescope du et si ». Logique pure reprise de l'ancien tour.js
   (wireProjection). On NE re-roule PAS toute la projection : on ajoute au socle
   final (dernière année de la courbe) la valeur future d'une épargne mensuelle
   supplémentaire à intérêts composés. À étiqueter « selon tes hypothèses ».
   ========================================================================== */

/** Taux annualisé implicite d'une courbe (borné -50 %..+50 %, défaut 5 %). */
export function tauxImplicite(startV, endV, years) {
  const s = Number(startV) || 0
  const e = Number(endV) || 0
  const y = Number(years) || 0
  if (s <= 0 || e <= 0 || y <= 0) return 0.05
  const r = Math.pow(e / s, 1 / y) - 1
  if (!isFinite(r)) return 0.05
  return Math.min(0.5, Math.max(-0.5, r))
}

/** Valeur finale « et si » : socle + FV d'une annuité mensuelle (extra $/mois). */
export function etSi(baseEnd, extraMensuel, rate, years) {
  const base = Number(baseEnd) || 0
  const extra = Math.max(0, Number(extraMensuel) || 0)
  const y = Math.max(0, Number(years) || 0)
  const monthlyR = (Number(rate) || 0) / 12
  const n = Math.round(y * 12)
  if (extra <= 0 || n <= 0) return base
  const fv = monthlyR === 0 ? extra * n : extra * ((Math.pow(1 + monthlyR, n) - 1) / monthlyR)
  return base + fv
}

/** Année finale et socle d'une courbe d'années [{age, patrimoineNet}]. */
export function socleCourbe(annees) {
  const a = Array.isArray(annees) ? annees.filter((x) => x && isFinite(x.patrimoineNet)) : []
  if (a.length < 2) return null
  const first = a[0]
  const last = a[a.length - 1]
  const years = Math.max(1, last.age - first.age)
  return {
    startV: first.patrimoineNet,
    baseEnd: last.patrimoineNet,
    ageDebut: first.age,
    ageFin: last.age,
    annee: new Date().getFullYear() + years,
    years,
    rate: tauxImplicite(first.patrimoineNet, last.patrimoineNet, years),
  }
}
