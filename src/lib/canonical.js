/* ============================================================================
   canonical.js — la COUCHE CANONIQUE : une seule source de vérité, read-only.

   On garde la FORME du snapshot de l'original (le contrat : meta / identity /
   budget / hypotheque / patrimoine / projection / entites / aVenir) et on la
   REBRANCHE au nouveau silo React (budgetcalc_v1) au lieu des anciens globals
   (GFSF_Budget, dossier.js, TwinEngine…).

   Règles d'or (VISION §10) : read-only ; donnée absente → null (jamais inventée) ;
   chaque section dans un try/catch (un silo corrompu ne plante pas getSnapshot()).

   Additif prototype : la section `saison` { revenusMensuels[12], depensesMensuelles,
   coussin } alimente les blocs temporels (flux_annuel). Documentée, pas dans le
   contrat d'origine, mais nécessaire au 1er bloc-signature.
   ========================================================================== */
import { loadStoreOrSeedDemo } from './storage.js'
import { totaux, repartition, engageLibre, parCategorie } from './budget.js'
import { revenusMensuels as deriveRevenus, revenuMensuel } from './revenus.js'
import { depensesRecurrentes, prochainesEcheances, revenuParPaie } from './calendrier.js'
import { moisCouverts, zoneDe, cibles } from './coussin.js'
import { calcTax } from './twin.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : null
}

function buildIdentity(store) {
  const id = (store && store.identity) || {}
  return {
    prenom: id.prenom || null,
    age: id.age == null || id.age === '' ? null : num(id.age),
    situation: id.situation || null,
    metier: id.metier || null, // additif (la maquette montre « Maxime · paysagiste »)
  }
}

function buildBudget(store) {
  const b = store && store.budget
  if (!b || !Array.isArray(b.revenus)) return null
  const t = totaux(b)
  if (!(t.revenu > 0)) return null // mois vide → null (zéros trompeurs évités)
  return {
    revenuMensuel: t.revenu,
    budgetTotal: t.revenu, // l'enveloppe à répartir = le revenu
    depenseTotal: t.depenseTotal, // besoins + envies (hors épargne)
    parCategorie: parCategorie(b),
    repartition: repartition(b),
    engageLibre: engageLibre(b),
  }
}

// Dépenses mensuelles = somme des dépenses (hors épargne). 0 tant que rien saisi.
function depensesMensuelles(store) {
  const d = store && store.depenses
  if (!Array.isArray(d)) return 0
  let t = 0
  for (const x of d) {
    if (!x || x.classe === 'epargne') continue
    const m = Number(x.montant)
    if (isFinite(m)) t += m
  }
  return Math.round(t)
}

function buildSaison(store) {
  // 1) La SAISIE de l'usager prime TOUJOURS (corrige le bug : un seed démo
  //    résiduel ne doit jamais masquer les vrais chiffres).
  const revenus = deriveRevenus(store && store.revenus)
  const dep = depensesMensuelles(store)
  if (revenus.some((v) => v > 0) || dep > 0) {
    return {
      revenusMensuels: revenus,
      depensesMensuelles: dep,
      coussin: num(store && store.revenus && store.revenus.coussin),
    }
  }
  // 2) Rien saisi → données EXPLICITES (seed démo / import) en repli.
  const s = store && store.saison
  if (s && Array.isArray(s.revenusMensuels)) {
    const r = []
    for (let i = 0; i < 12; i++) r.push(num(s.revenusMensuels[i]) || 0)
    return { revenusMensuels: r, depensesMensuelles: num(s.depensesMensuelles) || 0, coussin: num(s.coussin) }
  }
  return null
}

// Détail des DÉPENSES pour les blocs « où va l'argent » (réparti, beignet, solde,
// engagé/libre). Dérivé de store.depenses (la nouvelle saisie). Null si rien saisi.
function buildDepenses(store) {
  const liste = store && Array.isArray(store.depenses) ? store.depenses : []
  const avecMontant = liste.filter((d) => d && Number(d.montant) > 0)
  if (avecMontant.length === 0) return null
  const somme = (arr) => Math.round(arr.reduce((s, d) => s + (Number(d.montant) || 0), 0))
  const besoin = somme(avecMontant.filter((d) => d.classe === 'besoin'))
  const envie = somme(avecMontant.filter((d) => d.classe === 'envie'))
  const epargne = somme(avecMontant.filter((d) => d.classe === 'epargne'))
  const coutVie = besoin + envie
  const total = coutVie + epargne
  const fixe = somme(avecMontant.filter((d) => d.classe !== 'epargne' && d.type === 'fixe'))
  const variable = somme(avecMontant.filter((d) => d.classe !== 'epargne' && d.type === 'variable'))
  const revenu = Math.round(revenuMensuel(store && store.revenus))
  const parCategorie = avecMontant
    .map((d) => ({ id: d.id, label: d.label || 'Dépense', classe: d.classe || 'besoin', montant: Math.round(Number(d.montant) || 0) }))
    .sort((a, b) => b.montant - a.montant)
  const pct =
    revenu > 0
      ? {
          besoin: Math.round((besoin / revenu) * 100),
          envie: Math.round((envie / revenu) * 100),
          epargne: Math.round((epargne / revenu) * 100),
        }
      : null
  return {
    revenu,
    coutVie,
    epargne,
    total,
    reste: revenu - total, // surplus (>0) / déficit (<0) mensuel
    parClasse: { besoin, envie, epargne },
    engageLibre: { fixe, variable },
    parCategorie,
    pct,
  }
}

// Fonds d'urgence : le coussin (montant ponctuel) situé en mois de besoins
// essentiels couverts + repères 3/6 mois. Null si aucun coussin saisi.
function buildCoussin(store) {
  const montant = num(store && store.revenus && store.revenus.coussin)
  if (montant == null) return null
  const dep = store && Array.isArray(store.depenses) ? store.depenses : []
  const essentielles = Math.round(dep.filter((d) => d && d.classe === 'besoin').reduce((s, d) => s + (Number(d.montant) || 0), 0))
  const mois = moisCouverts(montant, essentielles)
  const { cible3, cible6 } = cibles(essentielles)
  return { montant: Math.round(montant), essentielles, moisCouverts: mois, zone: zoneDe(mois), cible3, cible6 }
}

// Anatomie du revenu BRUT : où va chaque dollar gagné (impôts + cotisations +
// dépenses + épargne + libre), via twin.calcTax. Null sans revenu brut saisi.
function buildFiscalite(store) {
  const brut = num(store && store.revenus && store.revenus.brutAnnuel)
  if (brut == null || brut <= 0) return null
  const t = calcTax(brut, 0)
  const cotisations = t.rrq + t.ei + t.rqap
  const dep = store && Array.isArray(store.depenses) ? store.depenses : []
  const coutVie = dep.filter((d) => d && d.classe !== 'epargne').reduce((s, d) => s + (Number(d.montant) || 0), 0) * 12
  const epargne = dep.filter((d) => d && d.classe === 'epargne').reduce((s, d) => s + (Number(d.montant) || 0), 0) * 12
  const depCouvert = Math.min(coutVie, Math.max(0, t.netIncome))
  const epCouvert = Math.min(epargne, Math.max(0, t.netIncome - depCouvert))
  const segments = [
    { label: 'Impôt fédéral', montant: Math.round(t.federal), couleur: '#b8740a' },
    { label: 'Impôt Québec', montant: Math.round(t.quebec), couleur: '#e0a23c' },
    { label: 'Cotisations (RRQ, AE, RQAP)', montant: Math.round(cotisations), couleur: '#caa15a' },
    { label: 'Dépenses', montant: Math.round(depCouvert), couleur: '#0077b6' },
    { label: 'Épargne', montant: Math.round(epCouvert), couleur: '#0f8a5f' },
  ]
  const accounted = segments.reduce((s, x) => s + x.montant, 0)
  const libre = Math.max(0, Math.round(brut) - accounted)
  if (libre > 50) segments.push({ label: 'Solde libre', montant: libre, couleur: '#00b4d8' })
  return {
    brut: Math.round(brut),
    federal: Math.round(t.federal),
    quebec: Math.round(t.quebec),
    cotisations: Math.round(cotisations),
    impotTotal: Math.round(t.federal + t.quebec + cotisations),
    net: Math.round(t.netIncome),
    tauxEffectif: Math.round(t.effectiveRate * 100),
    jourLiberation: Math.min(365, Math.max(1, Math.round((t.total / brut) * 365))),
    segments,
  }
}

// Données récurrentes pour le bloc calendrier : le modèle de paie + les dépenses
// datées. Null si rien à montrer (aucune entrée possible ET aucune sortie datée).
function buildCalendrier(store) {
  const r = (store && store.revenus) || {}
  const depRec = depensesRecurrentes(store && store.depenses)
  const aDesEntrees =
    r.mode === 'saisonnier'
      ? Array.isArray(r.repartition) && r.repartition.some((v) => Number(v) > 0)
      : revenuParPaie(r) > 0
  if (!aDesEntrees && depRec.length === 0) return null
  return {
    revenus: {
      mode: r.mode || 'regulier',
      freq: r.freq || 'biweekly',
      montantParPaie: r.montantParPaie != null ? r.montantParPaie : null,
      mensuel: r.mensuel != null ? r.mensuel : null,
      weekday: r.weekday,
      anchor: r.anchor || null,
      jours: Array.isArray(r.jours) ? r.jours : [1, 15],
      repartition: Array.isArray(r.repartition) ? r.repartition : [],
    },
    depenses: depRec,
  }
}

// aVenir[] : les échéances datées des ~45 prochains jours (paies + dépenses fixes).
function buildAVenir(store) {
  const r = (store && store.revenus) || {}
  const depRec = depensesRecurrentes(store && store.depenses)
  // 92 j : couvre le plus grand horizon offert par l'échéancier (90).
  return prochainesEcheances(r, depRec, new Date(), 92)
}

/** Construit le snapshot canonique à partir d'un silo (fonction PURE, testable). */
export function snapshotFromStore(store) {
  let identity = { prenom: null, age: null, situation: null, metier: null }
  let budget = null
  let saison = null
  let calendrier = null
  let aVenir = []
  let depenses = null
  let coussin = null
  let fiscalite = null
  try { identity = buildIdentity(store) } catch { /* garde les null */ }
  try { budget = buildBudget(store) } catch { budget = null }
  try { saison = buildSaison(store) } catch { saison = null }
  try { calendrier = buildCalendrier(store) } catch { calendrier = null }
  try { aVenir = buildAVenir(store) } catch { aVenir = [] }
  try { depenses = buildDepenses(store) } catch { depenses = null }
  try { coussin = buildCoussin(store) } catch { coussin = null }
  try { fiscalite = buildFiscalite(store) } catch { fiscalite = null }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      freshness: { budget: (store && store.updatedAt) || null },
      completeness: { budget: !!budget, saison: !!saison },
    },
    identity: identity,
    budget: budget, // null si pas rempli
    hypotheque: null, // hors prototype (pas de silo hypothèque ici)
    patrimoine: null, // hors prototype (pas de twin chargé)
    projection: null, // hors prototype
    entites: [], // hors prototype (pas de build-tool branché)
    aVenir: aVenir, // échéances datées des ~45 prochains jours (paies + dépenses fixes)
    saison: saison, // additif : alimente les blocs temporels (flux_annuel)
    calendrier: calendrier, // additif : modèle récurrent (paies + dépenses) pour le bloc calendrier
    depenses: depenses, // additif : détail des dépenses (réparti, beignet, solde, engagé/libre)
    coussin: coussin, // additif : fonds d'urgence (mois couverts + zones + repères)
    fiscalite: fiscalite, // additif : anatomie du revenu brut (impôts/cotisations/net)
  }
}

/** Snapshot live : lit le silo (sème la démo au 1er passage) puis normalise. */
export function getSnapshot() {
  const store = loadStoreOrSeedDemo()
  return snapshotFromStore(store)
}
