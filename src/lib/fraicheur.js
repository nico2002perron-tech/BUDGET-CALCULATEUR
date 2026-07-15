/* ============================================================================
   fraicheur.js — L'ÂGE DES DONNÉES par silo (K2). PUR, zéro DOM.

   Une tuile SAIT de quoi elle est faite : son `requiert` (KPI) → les silos-store
   qui la nourrissent → leur âge. Au-delà d'un seuil PAR SILO, la tuile le dit
   calmement (« Données de tes dépenses : il y a 6 sem. ») ; au-delà de 2× le
   seuil, elle vieillit visuellement (classe est-datee). JAMAIS d'ambre : l'âge
   d'une donnée est un FAIT, pas une alarme (AMF).

   L'horodatage vit sur store.meta.majSilos (posé par saveStore, K2) et remonte
   dans snapshot.meta.freshness. Migration douce : silo jamais estampillé →
   on retombe sur updatedAt global (jamais d'erreur, jamais de « très vieux »
   fabriqué). ========================================================================== */

// Les silos-store SUIVIS (les seules données saisies par l'usager). Seuil en JOURS :
// au-delà, la tuile affiche son âge ; à 2× le seuil, elle vieillit (est-datee).
export const SILOS = {
  revenus: { nom: 'tes revenus', section: 'revenus', seuil: 60 },
  depenses: { nom: 'tes dépenses', section: 'depenses', seuil: 30 },
  patrimoine: { nom: 'ton patrimoine', section: 'placements', seuil: 90 },
}
export const SILOS_SUIVIS = Object.keys(SILOS)

// requiert (clé de snapshot) → silos-store qui la produisent. Un KPI hérite de
// l'âge du PLUS VIEUX silo dont il dépend. (Voir canonical.js : coussin ← revenus
// + depenses ; fiscalite/saison ← revenus ; projection ← patrimoine.)
const REQUIERT_SILOS = {
  capacite: ['revenus', 'depenses'],
  depenses: ['depenses'],
  categories: ['depenses'],
  coussin: ['revenus', 'depenses'],
  saison: ['revenus'],
  fiscalite: ['revenus', 'depenses'], // buildFiscalite lit le brut ET les dépenses
  patrimoine: ['patrimoine'],
  projection: ['patrimoine', 'revenus', 'depenses'], // la trajectoire (twin) se nourrit des trois
}

function joursDepuis(iso, now) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const j = Math.floor((now.getTime() - d.getTime()) / 86400000)
  return j >= 0 ? j : 0
}

/** L'âge en mots — approximatif, calme, COMPACT (la pilule doit tenir dans la tuile). */
export function ageEnMots(jours) {
  if (jours == null) return ''
  if (jours < 10) return 'il y a quelques jours'
  if (jours < 13) return 'il y a 1 sem.'
  if (jours < 55) return `il y a ${Math.round(jours / 7)} sem.`
  if (jours < 350) { const m = Math.max(1, Math.round(jours / 30)); return `il y a ${m} mois` }
  return 'il y a plus d’un an'
}

/** Les silos-store dont dépend un `requiert` (dédupliqués). */
export function silosDe(requiert) {
  if (!Array.isArray(requiert)) return []
  return [...new Set(requiert.flatMap((r) => REQUIERT_SILOS[r] || []))]
}

/** L'ÉTAT DE FRAÎCHEUR d'une tuile (le silo le PLUS VIEUX de son requiert), ou null
 *  si tout est frais / inconnu (le calme d'abord : sous le seuil → RIEN).
 *  @returns {null | { silo, section, jours, nom, texte, datee }}  PUR. */
export function etatFraicheur(snapshot, requiert, now = new Date()) {
  const fr = snapshot && snapshot.meta && snapshot.meta.freshness
  if (!fr) return null
  const silos = silosDe(requiert)
  if (!silos.length) return null
  let pire = null
  for (const silo of silos) {
    if (!SILOS[silo]) continue
    const j = joursDepuis(fr[silo], now)
    if (j == null) continue
    if (!pire || j > pire.jours) pire = { silo, jours: j }
  }
  if (!pire) return null
  const def = SILOS[pire.silo]
  if (pire.jours < def.seuil) return null // frais → aucune ligne (le calme d'abord)
  const nomCap = def.nom.charAt(0).toUpperCase() + def.nom.slice(1) // « tes dépenses » → « Tes dépenses »
  return {
    silo: pire.silo, section: def.section, jours: pire.jours, nom: def.nom,
    texte: `${nomCap} · ${ageEnMots(pire.jours)}`,
    datee: pire.jours >= def.seuil * 2,
  }
}
