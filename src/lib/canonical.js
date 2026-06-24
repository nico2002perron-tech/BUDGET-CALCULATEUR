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

function buildSaison(store) {
  const s = store && store.saison
  if (!s || !Array.isArray(s.revenusMensuels)) return null
  // 12 mois garantis (complète/tronque à 12, valeurs numériques sûres).
  const revenus = []
  for (let i = 0; i < 12; i++) revenus.push(num(s.revenusMensuels[i]) || 0)
  return {
    revenusMensuels: revenus,
    depensesMensuelles: num(s.depensesMensuelles) || 0,
    coussin: num(s.coussin),
  }
}

/** Construit le snapshot canonique à partir d'un silo (fonction PURE, testable). */
export function snapshotFromStore(store) {
  let identity = { prenom: null, age: null, situation: null, metier: null }
  let budget = null
  let saison = null
  try { identity = buildIdentity(store) } catch { /* garde les null */ }
  try { budget = buildBudget(store) } catch { budget = null }
  try { saison = buildSaison(store) } catch { saison = null }

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
    aVenir: [], // hors prototype (pas d'échéancier)
    saison: saison, // additif : alimente les blocs temporels (flux_annuel)
  }
}

/** Snapshot live : lit le silo (sème la démo au 1er passage) puis normalise. */
export function getSnapshot() {
  const store = loadStoreOrSeedDemo()
  return snapshotFromStore(store)
}
