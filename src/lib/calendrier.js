/* ============================================================================
   calendrier.js — ÉVÉNEMENTS d'un mois (logique pure, zéro DOM).
   Reprend recurringFor / incomePayDaysForMonth de l'ancien budget.js, réécrit :
     · ENTRÉES = paies (régulier → montant par paie sur chaque jour de paie ;
       saisonnier → revenu du mois posé le 1er) ;
     · SORTIES = dépenses récurrentes (fixes + épargne) sur leur jour du mois.
   Les MONTANTS viennent toujours du silo, jamais inventés.
   ========================================================================== */
import { payDaysForMonth, payParYear } from './revenus.js'

function clampJour(d, nDays) {
  return Math.min(nDays, Math.max(1, (Number(d) || 1) | 0))
}

/** Montant par paie placé sur le calendrier (mode régulier). */
export function revenuParPaie(revenus) {
  const r = revenus || {}
  if (r.mode === 'saisonnier') return 0
  if (r.montantParPaie != null && r.montantParPaie !== '') return Math.round(Number(r.montantParPaie) || 0)
  if (r.mensuel != null) return Math.round(((Number(r.mensuel) || 0) * 12) / payParYear(r.freq)) // compat
  return 0
}

/** Dépenses récurrentes datées : fixes (ou épargne) avec un jour et un montant > 0. */
export function depensesRecurrentes(depenses) {
  return (Array.isArray(depenses) ? depenses : [])
    .filter((d) => d && d.jour != null && (Number(d.montant) || 0) > 0 && (d.type === 'fixe' || d.classe === 'epargne'))
    .map((d) => ({
      id: d.id,
      jour: Number(d.jour) | 0,
      label: d.label || 'Dépense',
      montant: Math.round(Number(d.montant) || 0),
      classe: d.classe || 'besoin',
      type: d.type || 'fixe',
    }))
}

/** Événements d'un mois (y, m 0-11). { nDays, entrees[], sorties[] } (jour, montant, label…). */
export function evenementsDuMois(revenus, depensesRec, y, m) {
  const nDays = new Date(y, m + 1, 0).getDate()
  const r = revenus || {}
  const entrees = []
  if (r.mode === 'saisonnier') {
    const rep = Array.isArray(r.repartition) ? r.repartition : []
    const montant = Math.round(Number(rep[m]) || 0)
    if (montant > 0) entrees.push({ jour: 1, montant, label: 'Revenu du mois' })
  } else {
    const parPaie = revenuParPaie(r)
    if (parPaie > 0) for (const j of payDaysForMonth(r, y, m)) entrees.push({ jour: j, montant: parPaie, label: 'Paie' })
  }
  const sorties = (Array.isArray(depensesRec) ? depensesRec : []).map((d) => ({
    jour: clampJour(d.jour, nDays),
    montant: d.montant,
    label: d.label,
    classe: d.classe,
    type: d.type,
  }))
  return { nDays, entrees, sorties }
}

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Échéances datées des `horizon` prochains jours (forme aVenir : {date,type,label,montant}). */
export function prochainesEcheances(revenus, depensesRec, aujourdhui, horizon = 45) {
  const base = aujourdhui instanceof Date && !isNaN(aujourdhui.getTime()) ? aujourdhui : new Date()
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const out = []
  // Couvre assez de mois pour atteindre vraiment l'horizon (≈28 j/mois + marge).
  const nbMois = Math.ceil(horizon / 28) + 1
  for (let k = 0; k <= nbMois; k++) {
    const total = start.getMonth() + k
    const yy = start.getFullYear() + Math.floor(total / 12)
    const mm = ((total % 12) + 12) % 12
    const ev = evenementsDuMois(revenus, depensesRec, yy, mm)
    ev.entrees.forEach((e) => out.push({ d: new Date(yy, mm, e.jour), iso: isoDate(yy, mm, e.jour), type: 'entree', label: e.label, montant: e.montant, classe: null }))
    ev.sorties.forEach((s) => out.push({ d: new Date(yy, mm, s.jour), iso: isoDate(yy, mm, s.jour), type: 'sortie', label: s.label, montant: s.montant, classe: s.classe }))
  }
  return out
    .filter((e) => {
      const diff = Math.round((e.d - start) / 86400000)
      return diff >= 0 && diff <= horizon
    })
    .sort((a, b) => a.d - b.d)
    .map((e) => ({ date: e.iso, jour: e.d.getDate(), type: e.type, label: e.label, montant: e.montant, classe: e.classe }))
}
