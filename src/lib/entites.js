/* ============================================================================
   entites.js — Tranche studio, ÉTAGE D1 : L'ENTITÉ-OBJECTIF (données pures).

   Une entité goal est l'outil « fabriqué pour toi » : nom, photo, accent de couleur,
   cible, contribution, horizon. Elle vit dans le silo (budgetcalc_v1) → surveillable
   ensuite par la tour, et elle SURVIT à export/import (privacy-first, VISION §4/§10).

   DISCIPLINE :
   - Les chiffres (dejaEpargne, horizonMois) viennent du MOTEUR (evaluerGraphe / le
     scénario choisi), jamais codés en dur.
   - Photo LOCALE en base64, BORNÉE (~200 Ko) ; au-delà → refusée (jamais un blob qui
     gonfle le silo). Jamais envoyée.
   - couleurAccent ∈ palette curée ; hors palette → repli sûr. L'accent colore la TUILE,
     jamais le chrome (VISION §12) — donc PAS d'ambre/corail (réservés à l'exception).
   - Tout texte (scenarioLabel) passe par filtrerFait.
   PUR : zéro React/DOM, testable headless (scripts/check-entite.mjs).
   ========================================================================== */
import { evaluerGraphe } from './graphe.js'
import { filtrerFait } from '../recettes/schema.js'

// Palette curée d'accents — dérivés du système, lisibles sur les cartes claires. AUCUN
// ambre/corail (couleur réservée à l'exception, §12). L'usager colore SA tuile avec ça.
export const PALETTE_ACCENTS = [
  { id: 'cyan', hex: '#00b4d8' },
  { id: 'ocean', hex: '#0077b6' },
  { id: 'indigo', hex: '#3d3a8c' },
  { id: 'vert', hex: '#0f8a5f' },
  { id: 'lavande', hex: '#7a6fe6' },
  { id: 'magenta', hex: '#b5179e' },
]
const ACCENT_REPLI = 'cyan'
const PALETTE_IDS = new Set(PALETTE_ACCENTS.map((a) => a.id))

// Photo : base64 borné (~200 Ko). 1 octet ≈ 1,34 car. base64 → seuil en caractères.
export const MAX_PHOTO_CARS = 280000

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

/** Hex d'un accent (par id) ; id hors palette → repli sûr (jamais une couleur invalide). */
export function accentValide(id) {
  const a = PALETTE_ACCENTS.find((x) => x.id === id) || PALETTE_ACCENTS.find((x) => x.id === ACCENT_REPLI)
  return a.hex
}

/** Photo bornée ET sûre : data:image/… seulement (une URL http déclencherait une
 *  REQUÊTE RÉSEAU au rendu — rien ne quitte l'appareil, même via un silo importé
 *  trafiqué), ≤ seuil, sinon null. À appliquer aussi AU RENDU. */
export function photoBornee(photo) {
  return typeof photo === 'string' && photo.startsWith('data:image/') && photo.length <= MAX_PHOTO_CARS ? photo : null
}

/**
 * Construit une entité goal depuis la config de conversation (resoudreCanal) + le snapshot.
 * `id` est fourni par l'appelant (l'écran génère un id ; les tests en passent un fixe) →
 * fonction PURE et déterministe.
 */
export function construireEntite(config = {}, snapshot = null, id = null) {
  const r = config.reponses || {}
  const sc = config.scenarioChoisi || {}
  const cible = num(r.cout)

  // dejaEpargne + horizon : DÉRIVÉS du moteur (jamais inventés).
  const g = evaluerGraphe(snapshot, { objectif: { nom: r.nom || 'Projet', cible } })
  const dejaEpargne = g.actif ? num(g.objectif.dejaEpargne) : num(snapshot && snapshot.coussin && snapshot.coussin.montant)
  const horizonMois = sc.horizonMois !== undefined ? sc.horizonMois : g.actif ? g.objectif.horizonMois : null

  const labelF = filtrerFait(String(sc.label || ''))

  return {
    id: id || 'e_sans_id',
    kind: 'goal',
    nom: String(r.nom || 'Mon projet'),
    icon: r.icon || 'target',
    photo: photoBornee(r.photo), // locale, bornée
    couleurAccent: PALETTE_IDS.has(r.couleur) ? r.couleur : ACCENT_REPLI, // ∈ palette, sinon repli
    cible,
    contributionMensuelle: num(sc.contributionMensuelle),
    dejaEpargne,
    horizonMois,
    echeanceVisee: r.echeance || null,
    scenarioLabel: labelF.ok && labelF.texte ? labelF.texte : '', // voix verrouillée, filtrée
  }
}

/** Ajoute une entité au silo (pur) — elle sera persistée par saveStore (survit à export/import). */
export function ajouterEntiteAuStore(store, entite) {
  const s = store || {}
  const entites = Array.isArray(s.entites) ? s.entites : []
  return { ...s, entites: [...entites, entite] }
}
