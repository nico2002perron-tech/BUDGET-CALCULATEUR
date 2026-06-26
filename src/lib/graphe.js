/* ============================================================================
   graphe.js — LA COUCHE DE COMPRÉHENSION (Financial OS, Pas 1 du MVP).

   Transforme le snapshot APLATI en une CHAÎNE D'ENTITÉS RELIÉES. Ce n'est PAS
   un nouveau moteur de calcul : il lit les données via le snapshot canonique.
   Il ne remplace ni `canonical.js` ni `twin.js`.

   DÉCISION DE PORTÉE : l'impôt est HORS du chemin critique. L'usager fournit son
   revenu NET (le chiffre qu'il connaît — ce qui tombe dans son compte), donc la
   chaîne n'a aucun calcul fiscal à faire et AUCUN entretien fiscal annuel. Le
   moteur fiscal `twin.js` reste disponible pour une vue-vitrine dédiée (anatomie
   du dollar brut), mais la tour et le graphe n'en dépendent pas.

   La chaîne prouvée par ce MVP (4 nœuds reliés) :

     revenuNet → fluxDisponible → capaciteEpargne → objectif{horizonMois}

   PROPAGATION SANS MOTEUR RÉACTIF. Chaque nœud est une FONCTION PURE de ses
   entrées : changer `revenuNetMensuel` et ré-évaluer suffit à recalculer tout
   l'aval (le flux, donc la capacité, donc l'horizon de l'objectif). C'est ce que
   `evaluerGraphe(snap, { revenuNetMensuel })` permet : passer une valeur en
   `overrides` rejoue la chaîne complète — la base du « et si » et de la détection
   de changement (diff.js, Pas 2).

   PUR : zéro React, zéro DOM, testable headless (scripts/check-graphe.mjs).
   ========================================================================== */

/** Objectif par DÉFAUT (générique) — un simple REPLI quand la recette n'en fournit
 *  pas. La cible n'est plus codée en dur dans la chaîne : l'objectif RÉEL arrive par
 *  `overrides.objectif = { nom, cible, dejaEpargne? }` (posé par l'entonnoir → composer). */
export const OBJECTIF_DEFAUT = Object.freeze({
  id: 'epargne',
  nom: 'Objectif d’épargne',
  cible: 10000, // $ — repli neutre, jamais « la » cible du produit
})

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

/**
 * Évalue la chaîne du graphe depuis un snapshot canonique.
 *
 * @param {object} snapshot  sortie de snapshotFromStore() / getSnapshot()
 * @param {object} [overrides]  remplace une entrée pour rejouer la chaîne
 *                              (ex. { revenuNetMensuel: 3800 } = un « et si »).
 * @returns {{
 *   actif: boolean,                    // false si pas de revenu net → chaîne muette
 *   noeuds: object,                    // les 4 nœuds reliés (valeur + dépendances)
 *   objectif: object|null,             // l'objectif dérivé (cible, restant, horizonMois)
 *   entrees: { revenuNetMensuel, depensesMensuelles, dejaEpargne }
 * }}
 *
 * Règle d'or : aucune valeur inventée. Sans revenu net saisi, la chaîne est
 * INACTIVE (actif:false) plutôt que de produire des zéros trompeurs.
 */
export function evaluerGraphe(snapshot, overrides = {}) {
  const snap = snapshot || {}

  // ── ENTRÉE 1 — revenu NET mensuel (ce que l'usager voit sur sa paie). Base =
  //    le revenu saisi (surfacé par le snapshot) ; un override le remplace.
  const baseNet =
    snap.depenses && snap.depenses.revenu > 0
      ? snap.depenses.revenu
      : snap.budget && snap.budget.revenuMensuel > 0
        ? snap.budget.revenuMensuel
        : null
  const revenuNetMensuel =
    overrides.revenuNetMensuel != null ? num(overrides.revenuNetMensuel) : baseNet

  if (!(revenuNetMensuel > 0)) {
    // Pas de revenu net → la chaîne ne raconte rien. On le dit honnêtement.
    return {
      actif: false,
      noeuds: {},
      objectif: null,
      entrees: { revenuNetMensuel: null, depensesMensuelles: null, dejaEpargne: null },
    }
  }

  // ── ENTRÉE 2 — coût de vie mensuel (besoins + envies, hors épargne).
  const depensesMensuelles =
    overrides.depensesMensuelles != null
      ? num(overrides.depensesMensuelles)
      : num(snap.depenses && snap.depenses.coutVie)

  // ── L'OBJECTIF — CHOISI par l'usager (overrides.objectif = { nom, cible, dejaEpargne? }),
  //    sinon un repli neutre. Plus AUCUNE cible codée en dur dans la chaîne.
  const obj = overrides.objectif && num(overrides.objectif.cible) > 0 ? overrides.objectif : OBJECTIF_DEFAUT
  const cible = num(obj.cible)

  // ── ENTRÉE 3 — déjà épargné vers l'objectif. Priorité : « et si » (override direct)
  //    > montant de départ de l'objectif > coussin du snapshot.
  const dejaEpargne =
    overrides.dejaEpargne != null
      ? num(overrides.dejaEpargne)
      : obj.dejaEpargne != null
        ? num(obj.dejaEpargne)
        : num(snap.coussin && snap.coussin.montant)

  // ── NŒUD : flux disponible mensuel = net mensuel − coût de vie.
  const fluxDisponible = Math.round(revenuNetMensuel - depensesMensuelles)

  // ── NŒUD : capacité d'épargne mensuelle (le flux que l'objectif peut absorber).
  const capaciteEpargne = Math.max(0, fluxDisponible)

  // ── NŒUD : objectif — horizon = combien de mois pour combler le restant.
  const restant = Math.max(0, cible - dejaEpargne)
  const horizonMois =
    restant === 0 ? 0 : capaciteEpargne > 0 ? Math.ceil(restant / capaciteEpargne) : null

  const objectif = {
    id: obj.id || 'objectif',
    nom: obj.nom || 'Objectif',
    cible,
    dejaEpargne,
    restant,
    horizonMois, // null = capacité nulle → objectif hors d'atteinte au rythme actuel
  }

  // Les 4 nœuds reliés : chacun porte sa valeur, son unité et ce dont il dépend.
  const noeuds = {
    revenuNet: {
      id: 'revenuNet', label: 'Revenu net', valeur: Math.round(revenuNetMensuel),
      unite: '$/mois', depend: [],
    },
    fluxDisponible: {
      id: 'fluxDisponible', label: 'Flux disponible', valeur: fluxDisponible,
      unite: '$/mois', depend: ['revenuNet', 'depensesMensuelles'],
    },
    capaciteEpargne: {
      id: 'capaciteEpargne', label: "Capacité d'épargne", valeur: capaciteEpargne,
      unite: '$/mois', depend: ['fluxDisponible'],
    },
    objectif: {
      id: 'objectif', label: objectif.nom, valeur: objectif.horizonMois,
      unite: 'mois', depend: ['capaciteEpargne'],
    },
  }

  return {
    actif: true,
    noeuds,
    objectif,
    entrees: { revenuNetMensuel: Math.round(revenuNetMensuel), depensesMensuelles, dejaEpargne },
  }
}
