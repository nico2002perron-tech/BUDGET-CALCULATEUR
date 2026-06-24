/* ============================================================================
   twin.js — JUMEAU FINANCIER : projection patrimoniale + fiscalité QC.

   PORTÉ QUASI TEL QUEL depuis Site-Web-Groupe-Financier/js/twin-engine.js.
   C'est le fossé technique — on ne le réécrit JAMAIS de mémoire. Seul changement
   vs l'original : l'enveloppe IIFE `window.TwinEngine = {…}` est remplacée par des
   exports ESM, et les helpers de stockage (save/load/clearTwin, localStorage) sont
   sortis du module pur (ils vivent dans storage.js). Les maths sont identiques —
   la parité fiscale est vérifiée par scripts/parity-twin.mjs.
   ========================================================================== */

// ══════════════════════════════════════
//  CONSTANTES FISCALES QUEBEC 2024-2025
// ══════════════════════════════════════
export const TAX = {
  // Federal brackets
  fedBrackets: [
    { limit: 55867, rate: 0.15 },
    { limit: 111733, rate: 0.205 },
    { limit: 154906, rate: 0.26 },
    { limit: 220000, rate: 0.29 },
    { limit: Infinity, rate: 0.33 },
  ],
  fedBasic: 15705,
  // Quebec brackets
  qcBrackets: [
    { limit: 51780, rate: 0.14 },
    { limit: 103545, rate: 0.19 },
    { limit: 126000, rate: 0.24 },
    { limit: Infinity, rate: 0.2575 },
  ],
  qcBasic: 17183,
  qcAbatement: 0.165, // Federal abatement for QC
  // CPP/RRQ
  rrqRate: 0.064,
  rrqMax: 68500,
  rrqExempt: 3500,
  rrq2Rate: 0.01,
  rrq2Max: 73200,
  // EI
  eiRate: 0.0166,
  eiMax: 63200,
  // RQAP
  rqapRate: 0.00494,
  rqapMax: 94000,
  // Pension publique
  rrqMaxBenefit: 16375, // RRQ max annuel a 65 ans
  psvMax: 8560, // PSV max annuel
  psvClawbackStart: 90997,
  psvClawbackEnd: 148065,
  // CELI/REER
  celiAnnual: 7000,
  reerPctMax: 0.18,
  reerDollarMax: 31560,
  // Inflation
  defaultInflation: 0.022,
}

// ══════════════════════════════════════
//  MODELE CLIENT TWIN
// ══════════════════════════════════════
export function createTwin(data) {
  return {
    // Identite
    name: data.name || '',
    age: data.age || 30,
    retirementAge: data.retirementAge || 65,
    lifeExpectancy: data.lifeExpectancy || 90,
    province: 'QC',
    situation: data.situation || 'celibataire', // celibataire, couple, famille

    // Revenus
    revenus: data.revenus || [
      { source: 'Salaire principal', montant: 0, croissance: 0.025 },
    ],

    // Depenses mensuelles
    depensesMensuelles: data.depensesMensuelles || 0,
    depensesCroissance: data.depensesCroissance || 0.022,

    // Actifs
    reer: data.reer || 0,
    celi: data.celi || 0,
    nonEnregistre: data.nonEnregistre || 0,
    maisonValeur: data.maisonValeur || 0,
    autresActifs: data.autresActifs || 0,

    // Passifs
    hypotheque: data.hypotheque || 0,
    hypothequeTaux: data.hypothequeTaux || 0.05,
    hypothequeAmort: data.hypothequeAmort || 25,
    autresDettes: data.autresDettes || 0,
    autresDettesTaux: data.autresDettesTaux || 0.06,

    // Epargne mensuelle
    epargneMensuelle: data.epargneMensuelle || 0,
    repartitionEpargne: data.repartitionEpargne || { reer: 40, celi: 40, nonEnr: 20 },

    // Detail depenses par categorie
    depensesDetail: data.depensesDetail || {},

    // Objectifs de vie
    objectifs: data.objectifs || [],

    // Express mode flag
    expressMode: data.expressMode || false,

    // Rendements attendus
    rendementActions: data.rendementActions || 0.07,
    rendementOblig: data.rendementOblig || 0.04,
    allocActions: data.allocActions || 0.7,

    // Inflation
    inflation: data.inflation || TAX.defaultInflation,

    // Metadata
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ══════════════════════════════════════
//  CALCUL IMPOT COMBINE FED+QC
// ══════════════════════════════════════
export function calcTax(grossIncome, reerDeduction) {
  var taxable = Math.max(0, grossIncome - reerDeduction)

  // Federal tax
  var fedTax = 0
  var prev = 0
  for (var i = 0; i < TAX.fedBrackets.length; i++) {
    var b = TAX.fedBrackets[i]
    var slice = Math.min(taxable, b.limit) - prev
    if (slice > 0) fedTax += slice * b.rate
    prev = b.limit
    if (taxable <= b.limit) break
  }
  fedTax = Math.max(0, fedTax - TAX.fedBasic * 0.15)
  fedTax *= 1 - TAX.qcAbatement // QC abatement

  // Quebec tax
  var qcTax = 0
  prev = 0
  for (var j = 0; j < TAX.qcBrackets.length; j++) {
    var bq = TAX.qcBrackets[j]
    var sliceq = Math.min(taxable, bq.limit) - prev
    if (sliceq > 0) qcTax += sliceq * bq.rate
    prev = bq.limit
    if (taxable <= bq.limit) break
  }
  qcTax = Math.max(0, qcTax - TAX.qcBasic * 0.14)

  // Payroll deductions
  var rrqEarnings = Math.min(grossIncome, TAX.rrqMax) - TAX.rrqExempt
  var rrq = Math.max(0, rrqEarnings) * TAX.rrqRate
  var rrq2Earnings = Math.min(grossIncome, TAX.rrq2Max) - TAX.rrqMax
  var rrq2 = Math.max(0, rrq2Earnings) * TAX.rrq2Rate
  var ei = Math.min(grossIncome, TAX.eiMax) * TAX.eiRate
  var rqap = Math.min(grossIncome, TAX.rqapMax) * TAX.rqapRate

  return {
    federal: fedTax,
    quebec: qcTax,
    rrq: rrq + rrq2,
    ei: ei,
    rqap: rqap,
    total: fedTax + qcTax + rrq + rrq2 + ei + rqap,
    netIncome: grossIncome - (fedTax + qcTax + rrq + rrq2 + ei + rqap),
    effectiveRate: grossIncome > 0 ? (fedTax + qcTax + rrq + rrq2 + ei + rqap) / grossIncome : 0,
  }
}

// ══════════════════════════════════════
//  PENSION PUBLIQUE (helper interne, comme l'original)
// ══════════════════════════════════════
function calcPensionPublique(twin, yearAge) {
  var result = { rrq: 0, psv: 0 }
  if (yearAge < 60) return result

  // RRQ (simplified: pro-rated by years contributed vs 40)
  var yearsWorked = Math.min(40, twin.retirementAge - 18)
  var rrqBase = TAX.rrqMaxBenefit * (yearsWorked / 40) * 0.7 // 70% du max pour simplifier
  if (yearAge < 65) {
    rrqBase *= 1 - (65 - yearAge) * 0.06 // 6% reduction per year before 65
  } else if (yearAge > 65) {
    rrqBase *= 1 + Math.min(yearAge - 65, 5) * 0.084 // 8.4% bonus per year after 65
  }
  result.rrq = Math.max(0, rrqBase)

  // PSV (from age 65)
  if (yearAge >= 65) {
    result.psv = TAX.psvMax
    // Clawback for high income — simplified
  }

  return result
}

// ══════════════════════════════════════
//  MOTEUR DE PROJECTION
// ══════════════════════════════════════
export function projectLife(twin, overrides) {
  var t = Object.assign({}, twin, overrides || {})
  var years = []
  var reer = t.reer
  var celi = t.celi
  var nonEnr = t.nonEnregistre
  var hypo = t.hypotheque
  var dettes = t.autresDettes
  var maisonVal = t.maisonValeur

  var rendementPortf = t.allocActions * t.rendementActions + (1 - t.allocActions) * t.rendementOblig
  var epargneAnnuelle = t.epargneMensuelle * 12

  for (var age = t.age; age <= t.lifeExpectancy; age++) {
    var yearIdx = age - t.age
    var isRetired = age >= t.retirementAge

    // Revenus
    var revenuBrut = 0
    if (!isRetired) {
      for (var r = 0; r < t.revenus.length; r++) {
        var rev = t.revenus[r]
        revenuBrut += rev.montant * Math.pow(1 + rev.croissance, yearIdx)
      }
    }

    // Pensions publiques
    var pensions = calcPensionPublique(t, age)
    if (isRetired) revenuBrut += pensions.rrq + pensions.psv

    // Depenses (croissent avec inflation)
    var depenses = t.depensesMensuelles * 12 * Math.pow(1 + t.inflation, yearIdx)
    if (isRetired) depenses *= 0.75 // 75% des depenses en retraite

    // Epargne REER (deductible)
    var reerContrib = 0
    var celiContrib = 0
    var nonEnrContrib = 0
    if (!isRetired && epargneAnnuelle > 0) {
      var ep = epargneAnnuelle * Math.pow(1 + t.depensesCroissance, yearIdx)
      reerContrib = ep * (t.repartitionEpargne.reer / 100)
      celiContrib = ep * (t.repartitionEpargne.celi / 100)
      nonEnrContrib = ep * (t.repartitionEpargne.nonEnr / 100)
    }

    // Impots
    var taxes = isRetired ? calcTax(revenuBrut, 0) : calcTax(revenuBrut, reerContrib)
    var revenuNet = taxes.netIncome

    // Cashflow
    var cashflow = revenuNet - depenses
    if (!isRetired) cashflow -= (reerContrib + celiContrib + nonEnrContrib) * (1 - taxes.effectiveRate)

    // Retraits si cashflow negatif en retraite
    var retraits = 0
    if (isRetired && cashflow < 0) {
      retraits = Math.abs(cashflow)
      // Retirer du CELI d'abord, puis REER, puis non-enregistre
      var fromCeli = Math.min(celi, retraits)
      celi -= fromCeli
      retraits -= fromCeli
      var fromNonEnr = Math.min(nonEnr, retraits)
      nonEnr -= fromNonEnr
      retraits -= fromNonEnr
      var fromReer = Math.min(reer, retraits)
      reer -= fromReer
      retraits -= fromReer
      cashflow = -retraits // deficit restant si tout epuise
    }

    // Croissance des actifs
    reer = (reer + reerContrib) * (1 + rendementPortf)
    celi = (celi + celiContrib) * (1 + rendementPortf)
    nonEnr = (nonEnr + nonEnrContrib) * (1 + rendementPortf * 0.75) // apres impot gains

    // Hypotheque
    if (hypo > 0) {
      var paiementHypo =
        (hypo * (t.hypothequeTaux / 12)) /
        (1 - Math.pow(1 + t.hypothequeTaux / 12, -t.hypothequeAmort * 12 + yearIdx * 12))
      if (isNaN(paiementHypo) || !isFinite(paiementHypo)) paiementHypo = 0
      var interetHypo = hypo * t.hypothequeTaux
      var capitalHypo = Math.min(hypo, paiementHypo * 12 - interetHypo)
      hypo = Math.max(0, hypo - capitalHypo)
    }

    // Maison appreciation
    maisonVal *= 1 + 0.03 // 3% appreciation immobiliere

    // Dettes
    if (dettes > 0) {
      var paiementDettes = Math.min(dettes * 1.2, dettes + dettes * t.autresDettesTaux)
      dettes = Math.max(0, dettes + dettes * t.autresDettesTaux - paiementDettes)
    }

    // Patrimoine
    var actifsTotaux = reer + celi + nonEnr + maisonVal + t.autresActifs
    var passifsTotaux = hypo + dettes
    var patrimoineNet = actifsTotaux - passifsTotaux

    // Apply life events / objectifs
    for (var o = 0; o < t.objectifs.length; o++) {
      var obj = t.objectifs[o]
      if (obj.ageVise === age && obj.cout) {
        // Deduct from non-enregistre, then CELI, then REER
        var cout = obj.cout
        var fromN = Math.min(nonEnr, cout)
        nonEnr -= fromN
        cout -= fromN
        var fromC = Math.min(celi, cout)
        celi -= fromC
        cout -= fromC
        var fromR = Math.min(reer, cout)
        reer -= fromR
        patrimoineNet -= obj.cout
      }
    }

    years.push({
      age: age,
      year: new Date().getFullYear() + yearIdx,
      isRetired: isRetired,
      revenuBrut: revenuBrut,
      revenuNet: revenuNet,
      depenses: depenses,
      cashflow: cashflow,
      impots: taxes.total,
      tauxEffectif: taxes.effectiveRate,
      reer: reer,
      celi: celi,
      nonEnregistre: nonEnr,
      hypotheque: hypo,
      dettes: dettes,
      maisonValeur: maisonVal,
      patrimoineNet: patrimoineNet,
      actifsTotaux: actifsTotaux,
      passifsTotaux: passifsTotaux,
      pensionRRQ: pensions.rrq,
      pensionPSV: pensions.psv,
      epargneReer: reerContrib,
      epargneCeli: celiContrib,
      epargneNonEnr: nonEnrContrib,
    })
  }

  return years
}

// ══════════════════════════════════════
//  HEALTH GAUGES
// ══════════════════════════════════════
export function calcHealthGauges(twin, projection) {
  var current = projection[0] || {}
  var atRetirement = projection.find(function (y) { return y.age === twin.retirementAge }) || {}
  var revenuAnnuel = 0
  for (var i = 0; i < twin.revenus.length; i++) revenuAnnuel += twin.revenus[i].montant

  // 1. Coussin urgence (mois de depenses couvertes)
  var liquidites = twin.celi + twin.nonEnregistre
  var depMensuel = twin.depensesMensuelles || 1
  var coussinMois = liquidites / depMensuel
  var coussinScore = Math.min(100, (coussinMois / 6) * 100)

  // 2. Ratio dette/revenu
  var detteTotal = twin.hypotheque + twin.autresDettes
  var ratioDetteRevenu = revenuAnnuel > 0 ? detteTotal / revenuAnnuel : 0
  var detteScore = ratioDetteRevenu <= 0 ? 100 : Math.max(0, 100 - (ratioDetteRevenu - 0.3) * 200)

  // 3. Taux epargne
  var tauxEpargne = revenuAnnuel > 0 ? ((twin.epargneMensuelle * 12) / revenuAnnuel) * 100 : 0
  var epargneScore = Math.min(100, (tauxEpargne / 20) * 100)

  // 4. Progression retraite
  var ageYearsLeft = Math.max(1, twin.retirementAge - twin.age)
  var depRetraite = twin.depensesMensuelles * 12 * 0.75
  var capitalNeeded = depRetraite * (twin.lifeExpectancy - twin.retirementAge)
  var capitalCurrent = twin.reer + twin.celi + twin.nonEnregistre
  var retraiteScore = Math.min(100, (capitalCurrent / (capitalNeeded * 0.3)) * 100)

  // 5. Protection
  var protectionScore = 50 // Par defaut moyen — pourra etre enrichi

  // Score global
  var global = Math.round((coussinScore + detteScore + epargneScore + retraiteScore + protectionScore) / 5)

  return {
    global: global,
    coussin: { score: Math.round(coussinScore), mois: Math.round(coussinMois * 10) / 10, label: 'Coussin urgence' },
    dette: { score: Math.round(detteScore), ratio: Math.round(ratioDetteRevenu * 100) / 100, label: 'Ratio dette/revenu' },
    epargne: { score: Math.round(epargneScore), taux: Math.round(tauxEpargne * 10) / 10, label: 'Taux épargne' },
    retraite: { score: Math.round(retraiteScore), ageVise: twin.retirementAge, label: 'Progression retraite' },
    protection: { score: Math.round(protectionScore), label: 'Protection' },
  }
}

// ══════════════════════════════════════
//  MONTE CARLO SIMPLIFIE
// ══════════════════════════════════════
export function monteCarlo(twin, simulations) {
  var n = simulations || 500
  var results = []

  for (var s = 0; s < n; s++) {
    // Randomize returns, inflation, longevity
    var override = {
      rendementActions: twin.rendementActions + (Math.random() - 0.5) * 0.08,
      rendementOblig: twin.rendementOblig + (Math.random() - 0.5) * 0.03,
      inflation: twin.inflation + (Math.random() - 0.5) * 0.015,
      lifeExpectancy: twin.lifeExpectancy + Math.round((Math.random() - 0.5) * 10),
    }

    var proj = projectLife(twin, override)
    var atRetirement = proj.find(function (y) { return y.age === twin.retirementAge })
    var lastPositive = proj.filter(function (y) { return y.patrimoineNet > 0 })
    var ruinAge = lastPositive.length > 0 ? lastPositive[lastPositive.length - 1].age : twin.retirementAge

    results.push({
      patrimoineRetraite: atRetirement ? atRetirement.patrimoineNet : 0,
      ruinAge: ruinAge,
      finalPatrimoine: proj[proj.length - 1].patrimoineNet,
    })
  }

  results.sort(function (a, b) { return a.patrimoineRetraite - b.patrimoineRetraite })

  var p10 = results[Math.floor(n * 0.1)]
  var p50 = results[Math.floor(n * 0.5)]
  var p90 = results[Math.floor(n * 0.9)]
  var successCount = results.filter(function (r) { return r.ruinAge >= twin.lifeExpectancy }).length

  return {
    p10: p10,
    p50: p50,
    p90: p90,
    successRate: Math.round((successCount / n) * 100),
    results: results,
  }
}

// ══════════════════════════════════════
//  DROITS DE COTISATION (INFO PUBLIQUE)
// ══════════════════════════════════════
const CELI_LIMITS = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500, 2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000,
}

export function calcCeliRoom(age, dejaCotise) {
  var currentYear = new Date().getFullYear()
  var birthYear = currentYear - age
  var turned18 = birthYear + 18
  var startYear = Math.max(2009, turned18)
  var totalRoom = 0
  for (var y = startYear; y <= currentYear; y++) {
    totalRoom += CELI_LIMITS[y] || 7000
  }
  return {
    totalRoom: totalRoom,
    used: dejaCotise || 0,
    available: Math.max(0, totalRoom - (dejaCotise || 0)),
    annualLimit: CELI_LIMITS[currentYear] || 7000,
    startYear: startYear,
  }
}

export function calcReerRoom(grossIncome, dejaCotise) {
  var room = Math.min(grossIncome * 0.18, TAX.reerDollarMax)
  return {
    annualRoom: Math.round(room),
    maxAnnual: TAX.reerDollarMax,
    used: dejaCotise || 0,
    available: Math.max(0, Math.round(room) - (dejaCotise || 0)),
    taxRefund: Math.round((dejaCotise || 0) * 0.4), // approx combined marginal
  }
}

const CELIAPP_ANNUAL = 8000
const CELIAPP_LIFETIME = 40000
const CELIAPP_START_YEAR = 2023

export function calcCeliappInfo(age, dejaCotise, isFirstTimeBuyer) {
  var currentYear = new Date().getFullYear()
  var eligible = age >= 18 && age <= 71 && isFirstTimeBuyer !== false
  var yearsSinceStart = Math.max(0, currentYear - CELIAPP_START_YEAR + 1)
  var maxRoom = Math.min(yearsSinceStart * CELIAPP_ANNUAL, CELIAPP_LIFETIME)
  return {
    eligible: eligible,
    annualLimit: CELIAPP_ANNUAL,
    lifetimeLimit: CELIAPP_LIFETIME,
    totalRoom: eligible ? maxRoom : 0,
    used: dejaCotise || 0,
    available: eligible ? Math.max(0, maxRoom - (dejaCotise || 0)) : 0,
  }
}

// Bilan du dollar — ou va chaque 1$ gagne
export function calcDollarBreakdown(grossIncome, reerContrib, depensesMensuelles, epargneMensuelle) {
  var taxes = calcTax(grossIncome, reerContrib)
  var depAnnuel = depensesMensuelles * 12
  var epAnnuel = epargneMensuelle * 12

  if (grossIncome <= 0) return { segments: [], total: 0 }

  var segments = [
    { label: 'Impôt fédéral', amount: taxes.federal, color: '#dc2626' },
    { label: 'Impôt Québec', amount: taxes.quebec, color: '#ef4444' },
    { label: 'RRQ', amount: taxes.rrq, color: '#f97316' },
    { label: 'AE + RQAP', amount: taxes.ei + taxes.rqap, color: '#f59e0b' },
    { label: 'Dépenses', amount: Math.min(depAnnuel, taxes.netIncome), color: '#8b5cf6' },
    { label: 'Épargne', amount: Math.min(epAnnuel, Math.max(0, taxes.netIncome - depAnnuel)), color: '#10b981' },
  ]

  var accounted = segments.reduce(function (s, seg) { return s + seg.amount }, 0)
  var reste = Math.max(0, grossIncome - accounted)
  if (reste > 50) {
    segments.push({ label: 'Solde libre', amount: reste, color: '#00b4d8' })
  }

  return { segments: segments, total: grossIncome, netIncome: taxes.netIncome, taxes: taxes }
}

// Effet du temps — interets composes educatif
export function compoundGrowth(principal, monthlyContrib, annualRate, years) {
  var balance = principal
  var totalContrib = principal
  var monthlyRate = annualRate / 12
  for (var m = 0; m < years * 12; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContrib
    totalContrib += monthlyContrib
  }
  return {
    finalBalance: Math.round(balance),
    totalContributed: Math.round(totalContrib),
    totalGrowth: Math.round(balance - totalContrib),
    growthPct: totalContrib > 0 ? Math.round(((balance - totalContrib) / totalContrib) * 100) : 0,
  }
}
