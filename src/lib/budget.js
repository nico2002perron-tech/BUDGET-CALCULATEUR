/* ============================================================================
   budget.js — formules de budget PURES (zéro DOM, zéro React).

   Réécrites proprement (l'original Site-Web-Groupe-Financier/js/budget.js est à
   ~458 références DOM). On conserve la SÉMANTIQUE du contrat canonique :
     - depenseTotal = besoins + envies (l'épargne est À PART) ;
     - repartition = % du revenu pour besoins / envies / épargne (repère 50/30/20) ;
     - engageLibre = { engage: Σ fixe, libre: Σ variable, total } sur les dépenses
       (hors épargne), comme getFixedVariableTotals() de l'original.

   Modèle d'entrée (silo budgetcalc_v1) :
     revenus  : [ { montant } ]
     depenses : [ { montant, classe: 'besoin'|'envie'|'epargne', type: 'fixe'|'variable' } ]
   ========================================================================== */

function somme(liste, predicat) {
  if (!Array.isArray(liste)) return 0
  let total = 0
  for (const x of liste) {
    if (!x) continue
    if (predicat && !predicat(x)) continue
    const m = Number(x.montant)
    if (isFinite(m)) total += m
  }
  return total
}

/** Totaux du mois : revenu, besoins, envies, épargne, dépenses (hors épargne), solde. */
export function totaux(data) {
  const d = data || {}
  const revenu = somme(d.revenus)
  const besoins = somme(d.depenses, (x) => x.classe === 'besoin')
  const envies = somme(d.depenses, (x) => x.classe === 'envie')
  const epargne = somme(d.depenses, (x) => x.classe === 'epargne')
  const depenseTotal = besoins + envies // l'épargne est comptée à part (contrat canonique)
  return {
    revenu: Math.round(revenu),
    besoins: Math.round(besoins),
    envies: Math.round(envies),
    epargne: Math.round(epargne),
    depenseTotal: Math.round(depenseTotal),
    // solde = ce qu'il reste une fois dépenses ET épargne assignées
    solde: Math.round(revenu - depenseTotal - epargne),
    // reste avant épargne (revenus − dépenses), pour le bloc « solde »
    reste: Math.round(revenu - depenseTotal),
  }
}

/** Répartition réelle en % du revenu (repère 50/30/20 « à titre de repère »). */
export function repartition(data) {
  const t = totaux(data)
  const pct = (part) => (t.revenu > 0 ? Math.round((part / t.revenu) * 100) : null)
  return {
    besoins: pct(t.besoins),
    envies: pct(t.envies),
    epargne: pct(t.epargne),
  }
}

/** Engagé (fixe) vs libre (variable) sur les dépenses (hors épargne). */
export function engageLibre(data) {
  const d = data || {}
  const horsEpargne = (x) => x.classe !== 'epargne'
  const engage = somme(d.depenses, (x) => horsEpargne(x) && x.type === 'fixe')
  const libre = somme(d.depenses, (x) => horsEpargne(x) && x.type === 'variable')
  return {
    engage: Math.round(engage),
    libre: Math.round(libre),
    total: Math.round(engage + libre),
  }
}

/** Agrégat par catégorie (pour le bloc beignet), avec couleur si fournie. */
export function parCategorie(data) {
  const d = data || {}
  if (!Array.isArray(d.depenses)) return []
  const map = new Map()
  for (const x of d.depenses) {
    if (!x) continue
    const cle = x.categorie || x.label || x.classe || 'Autres'
    const m = Number(x.montant)
    if (!isFinite(m)) continue
    const prev = map.get(cle) || { label: cle, color: x.color || '', depense: 0 }
    prev.depense += m
    if (!prev.color && x.color) prev.color = x.color
    map.set(cle, prev)
  }
  return Array.from(map.values()).map((c) => ({ ...c, depense: Math.round(c.depense) }))
}
