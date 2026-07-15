/* ============================================================================
   evenements.js — LE PRIMITIF ÉVÉNEMENT (Financial OS). La brique de base de la
   future Chronologie : le moteur émet des FAITS financiers, chacun avec sa
   CONSÉQUENCE sur la trajectoire — jamais une interface.

   Un événement = un fait DATÉ (échéance future) ou DÉTECTÉ (changement vs un état
   précédent) qui a une conséquence. On UNIFIE trois pièces déjà bâties :
     - evaluerGraphe (graphe.js)  → propage la conséquence (flux → capacité → horizon) ;
     - diffGraphe (diff.js)       → le changement-avec-conséquence vs un état précédent ;
     - resolveKPI (bibliotheque)  → un KPI qui franchit un seuil EST un événement.

   PORTÉE STRICTE : UNIQUEMENT le producteur. Aucune vue, aucune mémoire persistante,
   aucune navigation, aucun scénario branché. Juste : snapshot (+ état précédent) →
   liste d'événements, prouvée headless (scripts/check-evenements.mjs).

   DISCIPLINE :
   - PUR : zéro React/DOM. On ne recalcule rien à la main — on propage via evaluerGraphe.
   - DATA-AWARE : une famille sans sa donnée n'émet RIEN (jamais d'événement inventé).
   - LA CONSÉQUENCE, PAS LE MOUVEMENT : chaque événement explique son impact.
   - CONFORMITÉ (VISION §11) : tout titre / texte passe par filtrerFait.
   - COULEUR = SENS (VISION §12) : `exception` (ambre) RÉSERVÉ à la vraie exception
     (flux disponible devenu négatif). Jamais d'ambre pour une bonne nouvelle.
   ========================================================================== */
import { filtrerFait } from '../recettes/schema.js'
import { formatCAD } from './format.js'
import { evaluerGraphe } from './graphe.js'
import { diffGraphe } from './diff.js'
import { resolveKPI } from '../recettes/bibliotheque-kpis.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

// Tout texte d'événement passe par filtrerFait ; repli factuel si un mot interdit s'y glisse.
function fait(texte, repli) {
  const f = filtrerFait(texte)
  return f.ok && f.texte ? f.texte : filtrerFait(repli).texte || repli
}

const SEVERITE_RANG = { exception: 2, attention: 1, info: 0 }
const SEUIL_IMMINENT_JOURS = 14 // une échéance proche attire l'attention (cyan), sans être une exception

function joursAvant(maintenant, dateISO) {
  const t = Date.parse(dateISO)
  if (!isFinite(t)) return null
  return Math.ceil((t - maintenant.getTime()) / 86400000)
}

/* ── FAMILLE 1 — Échéances (data-aware : s.dettes = [{ label, paiementMensuel, finLe }]).
   La fin d'un paiement LIBÈRE ce montant → on PROPAGE la conséquence via evaluerGraphe
   (dépenses − paiement → flux +X → horizon de l'objectif raccourci). Pas juste un montant.
   ⚠️ DORMANT en prod : canonical.js ne fabrique pas encore snapshot.dettes (seul
   patrimoine.autresDettes agrégé existe). Cette famille s'ALLUME au P6 (parcours) —
   le modèle « Sortir de mes dettes » introduit la saisie du détail des dettes, que
   canonical mappera vers snapshot.dettes. Ici : rien à changer, la garde ci-dessous
   (dettes = [] si absent) reste correcte. */
function evEcheances(snapshot, maintenant) {
  const dettes = Array.isArray(snapshot && snapshot.dettes) ? snapshot.dettes : []
  const out = []
  for (const d of dettes) {
    if (!d || !d.finLe) continue
    const jours = joursAvant(maintenant, d.finLe)
    if (jours == null || jours < 0) continue // échéance passée → pas un événement futur
    const P = num(d.paiementMensuel)
    if (!(P > 0)) continue // pas de paiement chiffrable → pas de conséquence (data-aware)

    // PROPAGATION : libérer P = réduire les dépenses de P, puis rejouer la chaîne.
    const avant = evaluerGraphe(snapshot, {})
    let deltaFlux = null
    let deltaHorizon = null
    if (avant.actif) {
      const base = Math.max(0, num(avant.entrees.depensesMensuelles) - P)
      const apres = evaluerGraphe(snapshot, { depensesMensuelles: base })
      deltaFlux = apres.noeuds.fluxDisponible.valeur - avant.noeuds.fluxDisponible.valeur
      const hA = avant.objectif && avant.objectif.horizonMois
      const hP = apres.objectif && apres.objectif.horizonMois
      if (typeof hA === 'number' && typeof hP === 'number') deltaHorizon = hP - hA
    }

    const label = d.label || 'ton prêt'
    const clauseH = deltaHorizon != null && deltaHorizon < 0
      ? ` et raccourcit l’horizon de ton objectif de ${Math.abs(deltaHorizon)} mois`
      : ''
    const texte = deltaFlux != null
      ? `Libère ${formatCAD(deltaFlux)} par mois${clauseH}.`
      : `Ce paiement de ${formatCAD(P)} par mois prend fin.`

    out.push({
      id: `echeance:dette:${d.id || label}`,
      type: 'echeance',
      quand: d.finLe,
      titre: fait(`Fin de ${label} dans ${jours} ${jours > 1 ? 'jours' : 'jour'}`, 'Une échéance approche.'),
      consequence: { texte: fait(texte, 'Un paiement mensuel prend fin.'), deltaFlux, deltaHorizon },
      severite: jours <= SEUIL_IMMINENT_JOURS ? 'attention' : 'info',
      source: 'echeance:dette',
    })
  }
  return out
}

/* ── FAMILLE 2 — Seuils KPI franchis vs état précédent. Un KPI qui change d'état EST un
   événement (le coussin atteint 3 / 6 mois). Pas de franchissement → rien. Bonne nouvelle
   → jamais d'ambre. */
function evSeuils(snapshot, etatPrecedent) {
  if (!etatPrecedent) return []
  const out = []
  const moisDe = (s) => { const r = resolveKPI('mois_couverts', s); return r && r.disponible && typeof r.valeur === 'number' ? r.valeur : null }
  const avant = moisDe(etatPrecedent)
  const apres = moisDe(snapshot)
  if (avant != null && apres != null) {
    for (const seuil of [3, 6]) {
      if (avant < seuil && apres >= seuil) {
        out.push({
          id: `seuil:coussin:${seuil}`,
          type: 'seuil_franchi',
          quand: 'detecte',
          titre: fait(`Ton coussin a atteint ${seuil} mois`, 'Ton coussin a franchi un palier.'),
          consequence: { texte: fait(`Tu couvres maintenant ${seuil} mois de dépenses essentielles.`, 'Ton coussin couvre plus de mois.') },
          severite: 'info', // bonne nouvelle → jamais d'ambre
          source: 'kpi:mois_couverts',
        })
      }
    }
  }
  return out
}

/* ── FAMILLE 3 — Changement détecté (généralise diff.js) vs état précédent. Réutilise le
   seuil de signifiance de diff.js (rien sous quelques dollars → pas de bruit) et sa
   sévérité (déficit = ambre → 'exception'). La conséquence est propagée, pas le mouvement. */
function evChangement(snapshot, etatPrecedent) {
  if (!etatPrecedent) return []
  const avant = evaluerGraphe(etatPrecedent, {})
  const apres = evaluerGraphe(snapshot, {})
  const d = diffGraphe(avant, apres)
  if (!d) return []
  let deltaFlux = null
  if (avant.actif && apres.actif) deltaFlux = apres.noeuds.fluxDisponible.valeur - avant.noeuds.fluxDisponible.valeur
  let deltaHorizon = null
  const hA = avant.objectif && avant.objectif.horizonMois
  const hP = apres.objectif && apres.objectif.horizonMois
  if (typeof hA === 'number' && typeof hP === 'number') deltaHorizon = hP - hA
  return [{
    id: `changement:${d.type}`,
    type: 'changement',
    quand: 'detecte',
    titre: fait(d.type === 'deficit' ? 'Ton flux disponible est devenu négatif' : 'Un changement modifie ta trajectoire', 'Un changement détecté.'),
    consequence: { texte: fait(d.consequence, 'Tes chiffres estimés ont varié.'), deltaFlux, deltaHorizon },
    severite: d.severite === 'ambre' ? 'exception' : 'info',
    source: 'diff',
  }]
}

// Clé de tri saillance : exception d'abord, puis l'échéance la plus proche, puis le reste.
function dateVal(e) {
  const t = Date.parse(e.quand)
  return isFinite(t) ? t : Infinity
}
function trier(events) {
  return events.slice().sort((a, b) => {
    const s = (SEVERITE_RANG[b.severite] || 0) - (SEVERITE_RANG[a.severite] || 0)
    if (s !== 0) return s
    return dateVal(a) - dateVal(b)
  })
}

/**
 * Produit la liste des événements financiers depuis le snapshot (+ optionnellement un
 * état précédent pour les changements/seuils). PUR. Triés par saillance.
 * @param {object} snapshot       snapshot canonique courant
 * @param {object} [etatPrecedent] snapshot canonique précédent (pour seuils/changements)
 * @param {object} [opts]         { maintenant?: Date|string } — référence temporelle (testable)
 * @returns {Array<{id,type,quand,titre,consequence,severite,source}>}
 */
export function genererEvenements(snapshot, etatPrecedent = null, opts = {}) {
  if (!snapshot || typeof snapshot !== 'object') return []
  const maintenant = opts.maintenant ? new Date(opts.maintenant) : new Date()
  const events = [
    ...evEcheances(snapshot, maintenant),
    ...evSeuils(snapshot, etatPrecedent),
    ...evChangement(snapshot, etatPrecedent),
  ]
  return trier(events)
}

/** Les n événements les plus saillants (la future Tour s'en servira — pas bâtie ici). PUR. */
export function evenementsSaillants(events, n = 3) {
  if (!Array.isArray(events)) return []
  return trier(events).slice(0, Math.max(0, num(n)))
}

/** La CIBLE de navigation d'un événement (P2 — « Explorer cet impact ») : où mène le tap.
 *  Déterministe, sur le seul source/quand de l'événement. null = pas de destination franche
 *  → l'événement reste informatif (non cliquable), jamais un lien mort. PUR.
 *   - échéance datée → le calendrier, sur son mois ;
 *   - seuil KPI franchi (source 'kpi:<id>') → le carré de sable, sur ce KPI ;
 *   - un changement 'diff' général n'a pas de vue dédiée → null. */
export function cibleEvenement(ev) {
  if (!ev || typeof ev !== 'object') return null
  const src = String(ev.source || '')
  if (src.startsWith('echeance') && typeof ev.quand === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ev.quand)) {
    return { type: 'calendrier', mois: ev.quand.slice(0, 7) }
  }
  if (src.startsWith('kpi:')) {
    const kpiId = src.slice(4)
    return kpiId ? { type: 'kpi', kpiId } : null
  }
  return null
}
