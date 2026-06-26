/* ============================================================================
   diff.js — Pas 2 du Financial OS : LA DÉTECTION DE CHANGEMENT (pure).

   diffGraphe(avant, apres) compare DEUX états déjà produits par evaluerGraphe
   (lib/graphe.js). Il ne sait PAS d'où ils viennent : il ne touche jamais à
   localStorage, ne lit jamais le snapshot. Cette pureté sert les deux usages
   futurs avec le MÊME code :
     (a) « depuis ta dernière visite » → avant = dernier état sauvé, apres = maintenant ;
     (b) le curseur « et si »          → avant = maintenant, apres = evaluerGraphe(snap, {override}).
   La persistance de l'état précédent est une préoccupation SÉPARÉE (pas ici).

   Il émet UN SEUL événement d'attention — le plus saillant — ou null si rien de
   significatif n'a changé (philosophie de la tour, VISION §7a : montrer ce qui
   demande l'attention, pas tout).

   CONFORMITÉ (VISION §11) : le texte de `consequence` passe par filtrerFait —
   des faits, jamais de jugement/conseil/impératif.
   COULEUR = SENS (VISION §12) : `severite:'ambre'` UNIQUEMENT pour le déficit
   (flux disponible négatif — la seule vraie exception). Jamais d'ambre pour une
   bonne nouvelle.

   PUR : zéro React, zéro DOM, testable headless (scripts/check-diff.mjs).
   ========================================================================== */
import { filtrerFait } from '../recettes/schema.js'
import { formatCAD } from './format.js'

// Sous ce seuil (en $), une variation de flux est du BRUIT : on ne la signale pas.
const SEUIL_FLUX = 5

// Valeur numérique d'un nœud, ou null si absente/non finie (jamais de NaN propagé).
function vNoeud(etat, id) {
  const n = etat && etat.noeuds && etat.noeuds[id]
  const v = n ? Number(n.valeur) : NaN
  return isFinite(v) ? v : null
}

// Classe d'un horizon : 'mois' (un nombre de mois ≥ 1), 'comble' (0 → cible
// atteinte), 'hors' (null → hors d'atteinte au rythme actuel).
function classeHorizon(h) {
  if (h == null) return 'hors'
  if (h === 0) return 'comble'
  return 'mois'
}

// Décrit la transition d'horizon en une clause FACTUELLE, sans jamais imprimer
// « null » ni produire de NaN (on n'utilise hA/hP dans le texte que s'ils sont
// des nombres). { change:boolean, phrase:string }.
function decritHorizon(hA, hP) {
  const cA = classeHorizon(hA)
  const cP = classeHorizon(hP)

  if (cA === cP) {
    if (cP === 'mois' && hA !== hP) {
      const d = hP - hA
      return { change: true, phrase: `${d < 0 ? 'raccourcit' : 'allonge'} l’horizon de ton objectif de ${Math.abs(d)} mois` }
    }
    return { change: false, phrase: '' } // hors↔hors, comble↔comble, ou mois identiques
  }
  // Transitions de classe.
  if (cP === 'comble') return { change: true, phrase: 'amène ton objectif à sa cible' }
  if (cA === 'comble') {
    return cP === 'hors'
      ? { change: true, phrase: 'place ton objectif hors d’atteinte au rythme actuel' }
      : { change: true, phrase: `ramène un horizon estimé à ${hP} mois pour ton objectif` }
  }
  if (cP === 'hors') return { change: true, phrase: 'place ton objectif hors d’atteinte au rythme actuel' }
  // cA === 'hors', cP === 'mois'
  return { change: true, phrase: `rend ton objectif de nouveau atteignable, avec un horizon estimé à ${hP} mois` }
}

// Identifie l'ENTRÉE qui a le plus bougé → le « pourquoi » de l'événement.
function causePrincipale(avant, apres) {
  const a = avant.entrees || {}
  const b = apres.entrees || {}
  const cands = [
    { v: (b.revenuNetMensuel || 0) - (a.revenuNetMensuel || 0), nom: 'variation de revenu net' },
    { v: (b.depensesMensuelles || 0) - (a.depensesMensuelles || 0), nom: 'variation de ton coût de vie' },
    { v: (b.dejaEpargne || 0) - (a.dejaEpargne || 0), nom: 'variation de ton épargne accumulée' },
  ]
  return cands.reduce((meilleur, c) => (Math.abs(c.v) > Math.abs(meilleur.v) ? c : meilleur)).nom
}

/**
 * Compare deux états de graphe (sorties de evaluerGraphe).
 * @returns {{type:string, cause:string, consequence:string, severite:('info'|'ambre')}|null}
 *   null si l'un des états est inactif, si l'objectif est comblé des deux côtés,
 *   ou si rien de significatif n'a changé.
 */
export function diffGraphe(avant, apres) {
  // Un côté muet (pas de revenu net) → rien à comparer, jamais de plantage.
  if (!avant || !apres || !avant.actif || !apres.actif) return null
  if (!avant.objectif || !apres.objectif) return null

  const fluxA = vNoeud(avant, 'fluxDisponible')
  const fluxP = vNoeud(apres, 'fluxDisponible')
  if (fluxA == null || fluxP == null) return null

  const hA = avant.objectif.horizonMois
  const hP = apres.objectif.horizonMois

  // Objectif déjà comblé des deux côtés → rien à signaler.
  if (classeHorizon(hA) === 'comble' && classeHorizon(hP) === 'comble') return null

  const dFlux = fluxP - fluxA
  const signChange = (fluxA < 0) !== (fluxP < 0) // surplus ↔ déficit : toujours saillant
  const fluxBouge = Math.abs(dFlux) >= SEUIL_FLUX || signChange
  const horizon = decritHorizon(hA, hP)

  // Seuil de signifiance : si ni le flux ni l'horizon ne bougent notablement → null.
  if (!fluxBouge && !horizon.change) return null

  const cause = causePrincipale(avant, apres)

  // ── Conséquence FACTUELLE (flux + horizon), assemblée des seules clauses qui bougent.
  const parts = []
  if (fluxBouge) {
    const signe = dFlux >= 0 ? '+' : '−'
    parts.push(`modifie ton flux disponible mensuel estimé de ${signe}${formatCAD(Math.abs(dFlux))}`)
  }
  if (horizon.change && horizon.phrase) parts.push(horizon.phrase)
  const texte = `Cette ${cause} ${parts.join(' et ')}.`

  // Garde-fou de conformité OBLIGATOIRE (VISION §11). Nos gabarits sont factuels ;
  // si jamais un mot interdit s'y glissait, on retombe sur un fait minimal.
  const f = filtrerFait(texte)
  const consequence = f.ok ? f.texte : filtrerFait(`Cette ${cause} fait varier tes chiffres estimés.`).texte

  // Sévérité : ambre UNIQUEMENT quand le flux disponible DEVIENT négatif — la
  // TRANSITION vers le déficit (VISION §12), pas l'état. Un déficit qui s'améliore
  // mais reste négatif (ex. −1000 → −200) est une bonne nouvelle → jamais d'ambre.
  const devientDeficit = signChange && fluxP < 0
  const severite = devientDeficit ? 'ambre' : 'info'
  const type = devientDeficit ? 'deficit' : horizon.change ? 'horizon' : 'flux'

  return { type, cause, consequence, severite }
}
