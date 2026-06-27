/* ============================================================================
   scenarios.js — Tranche studio, ÉTAGE C : LES SCÉNARIOS (cartes tappables, pures).

   Remplace l'ancien curseur « et si » par des CARTES de chemin tappables. Chaque
   scénario est un FAIT que l'usager explore (« en orientant X/mois → N mois »),
   JAMAIS un conseil. C'est la MATH de l'objectif (restant / contribution), avec la
   capacité réelle tirée de evaluerGraphe (lib/graphe.js).

   DISCIPLINE :
   - Aucun appel IA, aucun jugement/impératif. Tout label passe par filtrerFait.
   - Data-aware : la contribution mensuelle est BORNÉE par la capacité réelle — on
     n'offre jamais +500/mois si la capacité est de 200.
   - Cas-limites honnêtes : déjà atteignable → le dire ; hors d'atteinte (capacité
     nulle) → le dire factuellement, sans jugement.
   - Coercition : le coût est coercé en nombre avant tout calcul.
   PUR : zéro React/DOM, testable headless (scripts/check-scenarios.mjs).
   ========================================================================== */
import { evaluerGraphe } from './graphe.js'
import { filtrerFait } from '../recettes/schema.js'
import { formatCAD } from './format.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

// Échéance tappable → un horizon-cible (en mois), déterministe. Sert à proposer une
// contribution « pour viser ta date » SI elle reste dans la capacité (data-aware).
const MOIS_ECHEANCE = { cette_annee: 12, moyen: 30, long: 60 }

// Repli conforme — passé LUI AUSSI par filtrerFait (la règle « tout texte via filtrerFait »
// vaut aussi pour le repli, pas seulement pour les labels dynamiques).
const REPLI = (() => { const f = filtrerFait('Un chemin possible vers ton projet.'); return f.ok && f.texte ? f.texte : 'Un chemin possible.' })()
function carte(label, horizonMois, contributionMensuelle) {
  const f = filtrerFait(label) // garde-fou conformité : aucun mot interdit ne sort
  return { label: f.ok && f.texte ? f.texte : REPLI, horizonMois, contributionMensuelle }
}

/**
 * Génère 1-3 scénarios FACTUELS pour « puis-je me le permettre ». Voix CLAIRE-
 * CONVERSATIONNELLE : tutoiement, un verbe, court. Faits + chemins (l'usager en tape un),
 * JAMAIS de conseil/impératif. Quand la date visée dépasse la pleine capacité, on le dit
 * factuellement (pas de fausse promesse, pas de jugement).
 * @returns {Array<{label, horizonMois, contributionMensuelle}>}
 */
export function genererScenarios(snapshot, { cout, echeance } = {}) {
  const coutN = num(cout)
  if (!(coutN > 0)) return [] // coût invalide/absent → aucun scénario (jamais d'erreur)

  const g = evaluerGraphe(snapshot, { objectif: { nom: 'Projet', cible: coutN } })
  if (!g.actif) return [carte('Ajoute ton revenu net pour estimer le temps vers ce projet.', null, 0)]

  const cap = num(g.noeuds.capaciteEpargne.valeur)
  const restant = num(g.objectif.restant)

  // Déjà atteignable : ce que tu as de côté couvre le coût (ton qui célèbre un peu, sans verdict oui/non).
  if (restant === 0) return [carte(`Tu y es déjà : ${formatCAD(g.objectif.dejaEpargne)} de côté pour ${formatCAD(coutN)}.`, 0, 0)]
  // Capacité nulle → hors d'atteinte au rythme actuel (fait, pas jugement ; « pour l'instant » ouvre l'avenir).
  if (cap <= 0) return [carte('Pour l’instant, rien ne va encore vers ce projet : ta capacité d’épargne est à zéro ce mois-ci.', null, 0)]

  const capArrondi = Math.round(cap)
  const fastest = Math.ceil(restant / capArrondi) // le plus rapide POSSIBLE (pleine capacité)
  const H = MOIS_ECHEANCE[echeance]
  const dateTient = H ? fastest <= H : false // la date demandée est-elle atteignable ?

  // Contributions croissantes, toutes ≤ capacité réelle : un rythme souple, (si la date
  // tient) le rythme « pour viser ta date », et la pleine capacité.
  const contribs = new Set()
  const moitie = Math.round(cap / 2)
  if (moitie > 0) contribs.add(moitie)
  if (dateTient) { const cd = Math.ceil(restant / H); if (cd > 0 && cd <= capArrondi) contribs.add(cd) }
  contribs.add(capArrondi)

  return [...contribs].sort((a, b) => a - b).map((c) => {
    const h = Math.ceil(restant / c)
    const estCap = c === capArrondi
    const estDate = dateTient && c === Math.ceil(restant / H)
    let label
    if (estCap && H && !dateTient) {
      // Date demandée HORS d'atteinte même à plein régime → on dit où tu en SERAIS (chemin
      // qui aboutit, juste plus tard), jamais « tu n'y arriveras pas ».
      label = `En y mettant toute ta capacité (${formatCAD(capArrondi)}/mois), tu y arrives en ${h} mois — plus tard que les ~${H} mois visés.`
    } else if (estDate) {
      label = `En orientant ${formatCAD(c)}/mois, tu tiens ta date (~${H} mois).`
    } else if (estCap) {
      label = `En y mettant toute ta capacité (${formatCAD(capArrondi)}/mois), tu y arrives en ${h} mois.`
    } else {
      label = `En orientant ${formatCAD(c)}/mois, tu y arrives en ${h} mois.`
    }
    return carte(label, h, c)
  })
}
