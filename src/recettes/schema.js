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
import { evaluerGraphe } from '../lib/graphe.js'

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
    bornes: { ton: ['cyan', 'bleu', 'ambre', 'vert', 'cyan_clair'] },
    defauts: { ton: 'cyan' },
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

  patrimoine_vie: {
    taille: 'large',
    bornes: {},
    defauts: {},
    resolve: (snap) => {
      const p = snap && snap.projection
      return p ? { annees: p.annees, retraiteAge: p.retraiteAge, ageRupture: p.ageRupture } : { annees: [], retraiteAge: null }
    },
  },

  horizon: {
    taille: 'large',
    bornes: { ajoutMax: [500, 1000, 2000], pas: [50, 100] },
    defauts: { ajoutMax: 1000, pas: 50 },
    resolve: (snap) => {
      const p = snap && snap.projection
      return p ? { annees: p.annees } : { annees: [] }
    },
  },

  composition: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    resolve: (snap) => {
      const p = snap && snap.patrimoine
      return p ? { net: p.net, actifs: p.actifs, passifs: p.passifs, composition: p.composition } : { net: 0, actifs: 0, passifs: 0, composition: {} }
    },
  },

  chaine: {
    taille: 'large', // colonne principale (la chaîne reliée, horizontale)
    bornes: {},
    defauts: {},
    // La couche de compréhension. L'objectif (nom, cible) vient de la recette (params,
    // posé par l'entonnoir) ; les MONTANTS (revenu net, coût de vie, coussin) du snapshot.
    resolve: (snap, params) => evaluerGraphe(snap, params && params.objectif ? { objectif: params.objectif } : {}),
  },

  // Étage 1 — blocs manquants (REGISTRE-BLOCS.md familles 1 & 4 & 6).
  barre_progression: {
    taille: 'compacte',
    bornes: {},
    defauts: { etiquetteGauche: 'Déjà', etiquetteDroite: 'Cible' },
    // VALEUR (déjà épargné) du snapshot ; CIBLE = intention (params de la recette).
    resolve: (snap) => ({ valeur: snap && snap.coussin ? snap.coussin.montant || 0 : 0 }),
  },

  chronologie: {
    taille: 'compacte',
    bornes: {},
    defauts: { label: 'Échéance' },
    // La date cible vient de la recette (params.dateCible) ; jamais inventée. Rien du snapshot.
    resolve: () => ({}),
  },

  liste: {
    taille: 'compacte',
    bornes: {},
    defauts: { titre: 'Le détail' },
    // Angle alternatif de « où va l'argent » : les catégories de dépenses du snapshot.
    resolve: (snap) => {
      const d = snap && snap.depenses
      if (!d || !Array.isArray(d.parCategorie)) return { items: [] }
      return { items: d.parCategorie.map((c) => ({ libelle: c.label || 'Dépense', montant: Math.round(Number(c.montant) || 0), meta: c.classe || null })) }
    },
  },

  // Studio (#21) — la TUILE « fabriquée pour toi ». L'entité vit dans le silo et est
  // surfacée par snapshot.entites ; la recette ne porte que son `id`.
  carte_entite: {
    taille: 'large',
    bornes: {},
    defauts: {},
    resolve: (snap, params) => {
      const id = params && params.id
      const e = snap && Array.isArray(snap.entites) ? snap.entites.find((x) => x && x.id === id) : null
      return e || null
    },
  },

  fait: {
    taille: 'compacte',
    bornes: {},
    defauts: {},
    // Fait CALCULÉ depuis le snapshot (chiffres vrais, pas inventés). On choisit le
    // constat le plus PARLANT selon la situation — faits seulement, aucun jugement.
    // Le texte d'un fait fourni par la recette passe, lui, par filtrerFait().
    resolve: (snap) => {
      const s = snap && snap.saison
      const d = snap && snap.depenses
      // 1) Saisonnier : s'il y a des mois sous le seuil de dépenses, le fait le plus
      //    parlant est le coussin puisé sur l'année.
      if (s && Array.isArray(s.revenusMensuels)) {
        const dep = s.depensesMensuelles || 0
        const moisDef = s.revenusMensuels.filter((r) => r < dep).length
        if (moisDef > 0) {
          const puise = s.revenusMensuels.reduce((acc, r) => acc + Math.max(0, dep - r), 0)
          return { texte: `Tes ${moisDef} mois sous le seuil de dépenses puisent ≈ ${formatCAD(puise)} dans ton coussin sur l'année.` }
        }
      }
      // 2) Revenu stable : la part déjà ENGAGÉE (dépenses fixes) de ton revenu mensuel.
      if (d && d.revenu > 0 && d.engageLibre) {
        const fixe = Number(d.engageLibre.fixe) || 0
        if (fixe > 0) {
          const pct = Math.round((fixe / d.revenu) * 100)
          return { texte: `≈ ${pct} % de ton revenu mensuel est déjà engagé dans des dépenses fixes.` }
        }
      }
      return { texte: '' }
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

    // Emplacement à CANDIDATS : plusieurs graphiques pour la MÊME donnée. On garde le
    // slot (MoteurRendu rendra le `choisi`). Candidats = types connus seulement ; choisi
    // défaut = recommande ; `pourquoi` filtré (jamais de texte brut non conforme).
    if (bloc.slot === 'graphique') {
      const recommande = estConnu(bloc.recommande) ? bloc.recommande : null
      const alternatives = Array.isArray(bloc.alternatives) ? bloc.alternatives.filter((t) => estConnu(t) && t !== recommande) : []
      const candidats = [recommande, ...alternatives].filter(Boolean)
      const choisi = candidats.includes(bloc.choisi) ? bloc.choisi : recommande
      const f = filtrerFait(bloc.pourquoi)
      return { slot: 'graphique', recommande, alternatives, choisi, pourquoi: f.ok && f.texte ? f.texte : '', _ignore: candidats.length === 0 }
    }

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
      // On garde les params LIBRES de la recette (libellés, cible, dateCible, objectif…),
      // MAIS on RE-BORNE les params à valeurs contrôlées (hors borne → défaut sûr). Les
      // MONTANTS financiers viennent toujours du snapshot (resolve) ; `cible`/`objectif`
      // sont des INTENTIONS de l'usager (posées par l'entonnoir), pas des chiffres fabriqués.
      const clamped = { ...cfg.defauts, ...params }
      for (const k of Object.keys(cfg.bornes)) {
        if (!(params[k] != null && cfg.bornes[k].includes(params[k]))) clamped[k] = cfg.defauts[k]
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

/* ============================================================================
   SÉLECTEUR D'ANGLE — plusieurs graphiques pour la MÊME donnée, sous un autre angle
   (jamais une interprétation différente). PUR + data-aware. Recommandation et
   « pourquoi » sont posés par composer (déterministe, zéro IA).
   ========================================================================== */

// « Quel bloc montre quelle donnée » — la donnée est-elle SUFFISANTE pour cet angle ?
// (ex. pas de beignet sans catégories, pas de courbe 12 mois avec une seule donnée).
function donneeSuffisante(type, snapshot) {
  const s = snapshot || {}
  const d = s.depenses
  switch (type) {
    case 'beignet':
    case 'liste':
      return !!(d && Array.isArray(d.parCategorie) && d.parCategorie.length >= 1)
    case 'barre_empilee':
      return !!(d && d.engageLibre && ((Number(d.engageLibre.fixe) || 0) > 0 || (Number(d.engageLibre.variable) || 0) > 0))
    case 'repartition':
      return !!(d && d.parClasse && (Number(d.parClasse.besoin) || 0) + (Number(d.parClasse.envie) || 0) + (Number(d.parClasse.epargne) || 0) > 0)
    case 'flux_annuel': {
      const r = s.saison && s.saison.revenusMensuels
      return Array.isArray(r) && r.filter((x) => Number(x) > 0).length >= 2
    }
    default:
      return false // un candidat non déclaré n'est jamais offert
  }
}

/** Les candidats d'un slot dont la donnée existe RÉELLEMENT (recommande d'abord).
 *  Sans snapshot fourni (appels de structure) → on ne filtre pas. PUR, lecture seule. */
export function candidatsValides(slot, snapshot) {
  const liste = []
  const ajout = (t) => { if (t && estConnu(t) && !liste.includes(t)) liste.push(t) }
  ajout(slot && slot.recommande)
  if (slot && Array.isArray(slot.alternatives)) slot.alternatives.forEach(ajout)
  if (!snapshot) return liste
  return liste.filter((t) => donneeSuffisante(t, snapshot))
}

/** Le type de bloc à RENDRE pour un slot : `choisi` s'il est valide, sinon `recommande`,
 *  sinon le 1er candidat valide, sinon null (slot ignoré proprement). Coercition sûre :
 *  un `choisi` inconnu/invalide ne peut jamais atteindre le rendu. PUR. */
export function resoudreSlot(slot, snapshot) {
  const valides = candidatsValides(slot, snapshot)
  if (!valides.length) return null
  if (slot && valides.includes(slot.choisi)) return slot.choisi
  if (slot && valides.includes(slot.recommande)) return slot.recommande
  return valides[0]
}
