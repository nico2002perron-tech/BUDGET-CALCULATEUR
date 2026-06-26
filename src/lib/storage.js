/* ============================================================================
   storage.js — le SEUL endroit qui touche localStorage (VISION §4, §10).

   Les montants vivent ici, sur l'appareil, jamais envoyés. Clé : budgetcalc_v1.
   Filet de sécurité obligatoire : export / import JSON.
   Toute lecture localStorage n'arrive QUE dans une fonction (jamais au chargement
   du module) → import sûr côté Node pour les tests.
   ========================================================================== */

import { moisActifsDefaut, repartirSaisonnier } from './revenus.js'
import { depensesParDefaut } from './depenses.js'

export const STORAGE_KEY = 'budgetcalc_v1'

/** Silo VIDE — l'app démarre ici (état accueillant, rien d'inventé). */
export function emptyStore() {
  return {
    version: 1,
    updatedAt: null,
    identity: { prenom: null, metier: null, age: null, situation: null },
    revenus: {
      mode: 'regulier', // régulier (par fréquence de paie) | saisonnier
      freq: 'biweekly',
      montantParPaie: null,
      weekday: 4, // jeudi (getDay 0=dim … 4=jeu)
      anchor: null, // 'AAAA-MM-JJ' (aux 2 semaines)
      jours: [1, 15], // bimensuel/mensuel
      // saisonnier :
      annuel: null,
      moisActifs: moisActifsDefaut(),
      repartition: Array.from({ length: 12 }, () => 0),
    },
    depenses: depensesParDefaut(),
    patrimoine: {
      age: null,
      retraite: 65,
      rendement: 5, // %/an
      reer: null,
      celi: null,
      nonEnregistre: null,
      maisonValeur: null,
      hypotheque: null,
      autresDettes: null,
    },
  }
}

/** Exemple saisonnier (bouton « voir un exemple ») : 42 400 $ sur avr→oct + dépenses. */
export function exempleStore() {
  const moisActifs = [false, false, false, true, true, true, true, true, true, true, false, false]
  const annuel = 42400
  return {
    version: 1,
    updatedAt: null,
    identity: { prenom: 'Maxime', metier: 'paysagiste', age: null, situation: null },
    revenus: { mode: 'saisonnier', mensuel: null, annuel, moisActifs, coussin: 8400, repartition: repartirSaisonnier(annuel, moisActifs) },
    depenses: [
      { id: 'cat_logement', label: 'Logement', classe: 'besoin', type: 'fixe', montant: 1100, jour: 1 },
      { id: 'cat_transport', label: 'Transport', classe: 'besoin', type: 'variable', montant: 350, jour: null },
      { id: 'cat_alimentation', label: 'Alimentation', classe: 'besoin', type: 'variable', montant: 600, jour: null },
      { id: 'cat_protection', label: 'Assurances', classe: 'besoin', type: 'fixe', montant: 140, jour: 8 },
      { id: 'cat_dettes_impots', label: 'Dettes & impôts', classe: 'besoin', type: 'fixe', montant: 0, jour: 21 },
      { id: 'wcat_sorties', label: 'Sorties & restos', classe: 'envie', type: 'variable', montant: 220, jour: null },
      { id: 'wcat_abonnements', label: 'Abonnements', classe: 'envie', type: 'fixe', montant: 55, jour: 15 },
      { id: 'wcat_shopping', label: 'Shopping', classe: 'envie', type: 'variable', montant: 130, jour: null },
      { id: 'wcat_voyages', label: 'Voyages & loisirs', classe: 'envie', type: 'variable', montant: 90, jour: null },
      { id: 'wcat_autres', label: 'Autres', classe: 'envie', type: 'variable', montant: 70, jour: null },
      { id: 'fix_epargne', label: 'Épargne (REER, CELI, REEE)', classe: 'epargne', type: 'fixe', montant: 200, jour: 1 },
    ],
    patrimoine: {
      age: 34,
      retraite: 65,
      rendement: 5,
      reer: 22000,
      celi: 14000,
      nonEnregistre: 6000,
      maisonValeur: 320000,
      hypotheque: 240000,
      autresDettes: 8000,
    },
  }
}

// Profil de démonstration « travailleur saisonnier » — valeurs reprises EXACTEMENT
// de la maquette validée (tour-saisonnier-v2.html : rev[12], DEP, coussin).
export const DEMO_SAISONNIER = {
  version: 1,
  updatedAt: null,
  identity: { prenom: 'Maxime', metier: 'paysagiste', age: null, situation: null },
  saison: {
    revenusMensuels: [0, 0, 800, 3200, 5600, 6800, 7200, 7000, 6200, 4200, 1200, 200],
    depensesMensuelles: 3400,
    coussin: 8400,
  },
  // budget mensuel détaillé (besoins/envies/épargne) : non rempli pour ce profil
  budget: null,
}

function hasLocal() {
  return typeof localStorage !== 'undefined' && localStorage !== null
}

/** Lit le silo. Retourne null si absent/corrompu (jamais d'exception). */
export function loadStore() {
  if (!hasLocal()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Écrit le silo (estampille updatedAt). */
export function saveStore(store) {
  if (!hasLocal()) return false
  try {
    const blob = { ...store, updatedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
    return true
  } catch {
    return false
  }
}

/** Retourne le silo, en semant le profil démo au premier passage (persisté). */
export function loadStoreOrSeedDemo() {
  const existing = loadStore()
  if (existing) return existing
  saveStore(DEMO_SAISONNIER)
  return loadStore() || DEMO_SAISONNIER
}

/** Filet de sécurité — exporte tout le silo en JSON (string). */
export function exportJSON() {
  const store = loadStore() || {}
  return JSON.stringify(store, null, 2)
}

/** Filet de sécurité — importe un JSON, le sauvegarde, le retourne. */
export function importJSON(text) {
  const parsed = JSON.parse(text)
  saveStore(parsed)
  return loadStore()
}

/** Réinitialise le silo. */
export function clearStore() {
  if (!hasLocal()) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* no-op */
  }
}
