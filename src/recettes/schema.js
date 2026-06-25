/* ============================================================================
   schema.js — LE CONTRAT IA → moteur (REGISTRE-BLOCS.md §« schéma de recette »).

   Une recette = { situation, titre, blocs:[ {type, params} ] }. Ce module est
   PUR (zéro React, zéro DOM) : il valide une recette et applique les garde-fous.

   Règles du contrat :
   1. `type` connu (présent dans BLOCS) → params validés contre ses bornes
      (valeur hors borne → défaut sûr). Type inconnu → conservé mais marqué
      `_ignore` (MoteurRendu l'ignore ; jamais d'erreur).
   2. Les MONTANTS viennent du snapshot via `resolve(snapshot)`, JAMAIS de la
      recette. La recette dit QUOI montrer, pas les chiffres.
   3. Le `texte` d'un `fait` passe par le FILTRE DE CONFORMITÉ (mots interdits →
      rejeté). On décrit des faits, jamais de jugement/conseil (VISION §11).
   ========================================================================== */
import { formatCAD } from '../lib/format.js'

// ── Filtre de conformité (VISION §11 : faits, jamais jugement/conseil/impératif)
// Liste normalisée (minuscule, sans accents). Heuristique volontairement stricte.
export const MOTS_INTERDITS = [
  // conseils / impératifs de jugement
  'tu devrais', 'vous devriez', 'tu dois', 'vous devez', 'il faut', 'faudrait',
  'tu ferais mieux', 'je te conseille', 'je vous conseille', 'mon conseil',
  // jugements de trajectoire
  'sur la bonne voie', 'bonne voie', 'en avance', 'en retard',
  'bien gere', 'mal gere', 'bien gerer', 'mal gerer',
  // impératifs d'action
  'coupe ', 'coupez', 'reduis', 'reduisez', 'rembourse', 'remboursez',
  'epargne plus', 'depense moins', 'arrete', 'arretez',
]

function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Filtre de conformité d'un texte de `fait`.
 * @returns {{ok:boolean, texte:(string|null), motif:string[]}}
 *   ok=false ET texte=null si un mot interdit est détecté (fait rejeté).
 */
export function filtrerFait(texte) {
  const norm = normaliser(texte)
  if (!norm) return { ok: true, texte: '', motif: [] }
  const motif = MOTS_INTERDITS.filter((m) => norm.includes(m))
  if (motif.length) return { ok: false, texte: null, motif }
  return { ok: true, texte: String(texte), motif: [] }
}

// ── Config par bloc : bornes des params + résolveur de données (depuis le snapshot)
// Pour cette fondation, seul `flux_annuel` est implémenté (l'étalon).
export const BLOCS = {
  flux_annuel: {
    taille: 'large', // colonne principale
    bornes: {
      souligner: ['mois_deficitaires', 'aucun'],
      vue: ['annuel', 'mensuel'], // `mensuel` = le même bloc réduit (preuve : nouveau cas = un param)
      anime: [true, false], // false → aperçu live (barres au repos, suivent la saisie)
    },
    defauts: { souligner: 'mois_deficitaires', vue: 'annuel', anime: true },
    // Les CHIFFRES viennent du snapshot, jamais de la recette.
    resolve: (snap) => ({
      revenus: (snap && snap.saison && snap.saison.revenusMensuels) || [],
      depenses: (snap && snap.saison && snap.saison.depensesMensuelles) || 0,
      coussin: snap && snap.saison ? snap.saison.coussin : null,
    }),
  },

  jauge: {
    taille: 'compacte', // colonne de droite
    bornes: { mesure: ['mois', 'montant'] },
    defauts: { mesure: 'mois', cible: 5 },
    resolve: (snap) => ({
      coussin: snap && snap.saison ? snap.saison.coussin || 0 : 0,
      depensesMensuelles: snap && snap.saison ? snap.saison.depensesMensuelles || 0 : 0,
    }),
  },

  stat: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    resolve: (snap) => ({
      valeur: snap && snap.saison ? snap.saison.coussin || 0 : 0,
      label: 'dans ton coussin cette saison',
    }),
  },

  calendrier: {
    taille: 'large', // colonne principale (grille du mois)
    bornes: {
      vue: ['mois'],
      souligner: ['echeances_proches', 'aucun'],
    },
    defauts: { vue: 'mois', souligner: 'echeances_proches' },
    // Modèle récurrent (paies + dépenses datées) tiré du snapshot, jamais de la recette.
    resolve: (snap) => (snap && snap.calendrier ? snap.calendrier : { revenus: {}, depenses: [] }),
  },

  echeancier: {
    taille: 'compacte', // colonne de droite (liste des imminentes)
    bornes: { horizon: [7, 14, 30, 60, 90] },
    defauts: { horizon: 30 },
    resolve: (snap) => ({ echeances: snap && Array.isArray(snap.aVenir) ? snap.aVenir : [] }),
  },

  solde: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    resolve: (snap) => {
      const d = snap && snap.depenses
      return d ? { revenu: d.revenu, total: d.total, reste: d.reste } : { revenu: 0, total: 0, reste: 0 }
    },
  },

  repartition: {
    taille: 'large',
    bornes: { repere: ['50/30/20', 'aucun'] },
    defauts: { repere: '50/30/20' },
    resolve: (snap) => {
      const d = snap && snap.depenses
      return d ? { parClasse: d.parClasse, pct: d.pct, revenu: d.revenu } : { parClasse: { besoin: 0, envie: 0, epargne: 0 }, pct: null, revenu: 0 }
    },
  },

  beignet: {
    taille: 'large',
    bornes: {},
    defauts: { centre: 'par mois' },
    resolve: (snap) => {
      const d = snap && snap.depenses
      return d ? { parCategorie: d.parCategorie, total: d.total } : { parCategorie: [], total: 0 }
    },
  },

  barre_empilee: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    resolve: (snap) => {
      const d = snap && snap.depenses
      return d ? { engageLibre: d.engageLibre } : { engageLibre: { fixe: 0, variable: 0 } }
    },
  },

  coussin_urgence: {
    taille: 'large',
    bornes: {},
    defauts: {},
    resolve: (snap) => (snap && snap.coussin ? snap.coussin : { montant: 0, essentielles: 0, moisCouverts: null, zone: 'vide', cible3: 0, cible6: 0 }),
  },

  anatomie_dollar: {
    taille: 'large',
    bornes: {},
    defauts: { centre: 'brut / an' },
    resolve: (snap) => {
      const f = snap && snap.fiscalite
      return f ? { brut: f.brut, net: f.net, segments: f.segments } : { brut: 0, net: 0, segments: [] }
    },
  },

  impot_palier: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    resolve: (snap) => {
      const f = snap && snap.fiscalite
      return f
        ? { brut: f.brut, federal: f.federal, quebec: f.quebec, cotisations: f.cotisations, net: f.net, tauxEffectif: f.tauxEffectif, jourLiberation: f.jourLiberation }
        : { brut: 0, federal: 0, quebec: 0, cotisations: 0, net: 0, tauxEffectif: 0, jourLiberation: 0 }
    },
  },

  fait: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    // Fait CALCULÉ depuis le snapshot (chiffres vrais, pas inventés). Le texte
    // d'un fait fourni par la recette passe, lui, par filtrerFait() (validerRecette).
    resolve: (snap) => {
      const s = snap && snap.saison
      if (!s || !Array.isArray(s.revenusMensuels)) return { texte: '' }
      const dep = s.depensesMensuelles || 0
      const moisDef = s.revenusMensuels.filter((r) => r < dep).length
      const puise = s.revenusMensuels.reduce((acc, r) => acc + Math.max(0, dep - r), 0)
      return {
        texte: `Tes ${moisDef} mois sous le seuil de dépenses puisent ≈ ${formatCAD(puise)} dans ton coussin sur l'année.`,
      }
    },
  },
}

/** Un type est « connu » s'il a une config de bloc (donc un composant attendu). */
export function estConnu(type) {
  return Object.prototype.hasOwnProperty.call(BLOCS, type)
}

/**
 * Valide + assainit une recette. Ne LÈVE JAMAIS d'erreur.
 *  - type connu  → params bornés (hors borne → défaut sûr).
 *  - type `fait` → texte filtré (interdit → rejeté, `_faitRejete` = motifs).
 *  - type inconnu→ conservé, marqué `_ignore` (MoteurRendu saute).
 */
export function validerRecette(recette) {
  const r = recette || {}
  const blocsIn = Array.isArray(r.blocs) ? r.blocs : []

  const blocs = blocsIn.map((b) => {
    const bloc = b || {}
    const type = bloc.type
    const params = bloc.params || {}

    if (type === 'fait') {
      const f = filtrerFait(params.texte)
      return {
        type,
        params: { ...params, texte: f.ok ? params.texte : null },
        _faitRejete: f.ok ? null : f.motif,
      }
    }

    if (estConnu(type)) {
      const cfg = BLOCS[type]
      const clamped = { ...cfg.defauts }
      for (const k of Object.keys(cfg.bornes)) {
        if (params[k] != null && cfg.bornes[k].includes(params[k])) clamped[k] = params[k]
        // sinon : on garde le défaut sûr
      }
      return { type, params: clamped }
    }

    // Type inconnu → conservé mais marqué pour être ignoré proprement.
    return { type, params, _ignore: true }
  })

  return {
    situation: r.situation || null,
    titre: typeof r.titre === 'string' ? r.titre : '',
    blocs,
  }
}
