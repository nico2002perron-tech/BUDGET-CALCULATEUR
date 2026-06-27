/* ============================================================================
   routeur.js — Tranche studio, ÉTAGE A : LE ROUTEUR (le SEUL appel IA en amont).

   Modèle Otto/ServiceNow : on classe le 1er message libre en UN canal, puis la
   conversation est SCRIPTÉE et DÉTERMINISTE (zéro appel IA ensuite). Ce module est
   PUR : il fournit (1) le mapping archétype (build-tool) → canal, et (2) un repli
   DÉTERMINISTE par mots-clés quand aucune clé IA n'est dispo (comme le chat le fait
   déjà). L'UI : avec clé → /api/build-tool classe (kind) → archetypeVersCanal ;
   sans clé → routerMessage (mots-clés). Aucun appel IA ailleurs.

   Pour cette tranche : un seul canal implémenté, `projet_abordable` (« puis-je me
   le permettre ? »). Les autres archétypes pointeront vers leurs canaux plus tard.
   ========================================================================== */

// Archétype renvoyé par build-tool (goal/cap/debt/budget/networth/unknown) → canal.
const ARCHETYPE_CANAL = {
  goal: 'projet_abordable', // un projet nommé vers un montant cible = « puis-je me le permettre »
  // à venir : cap / debt / budget / networth → leurs propres canaux
}

/** Mapping PUR archétype → canal. Archétype non outillé → 'inconnu' (jamais d'erreur). */
export function archetypeVersCanal(kind) {
  return ARCHETYPE_CANAL[kind] || 'inconnu'
}

function normalise(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Repli déterministe : un projet d'épargne / « puis-je me le permettre » → projet_abordable.
const MOTS_PROJET = [
  'permettre', 'payer', 'me payer', 'abord', 'voyage', 'projet', 'objectif',
  'epargn', 'economis', 'mettre de cote', 'acheter', 'maison', 'auto', 'voiture',
  'mariage', 'renovation', 'mise de fonds',
]

/** Classe un message libre en { canal, params } SANS IA (repli par mots-clés). PUR. */
export function routerMessage(texte) {
  const t = normalise(texte)
  if (!t.trim()) return { canal: 'inconnu', params: {} }
  if (MOTS_PROJET.some((m) => t.includes(m))) return { canal: 'projet_abordable', params: {} }
  return { canal: 'inconnu', params: {} }
}
