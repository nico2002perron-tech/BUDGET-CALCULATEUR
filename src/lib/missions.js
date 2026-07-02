/* ============================================================================
   missions.js — LES MISSIONS D'ALLUMAGE (le « 2 min » tenu). Le cerveau PUR des
   mini-saisies style Duolingo : une question à la fois, chips et montants, et à
   la fin la famille S'ALLUME dans le studio.

   Une mission = une liste d'ÉTAPES data-driven { id, question, type, … } ; les
   réponses s'appliquent au silo par appliquerMission (PURE : store → store).
   On RÉUTILISE le modèle existant (revenus.js, depenses.js, storage) — les
   saisies détaillées de « Mes données » restent la référence pour fignoler.

   DISCIPLINE : zéro React/DOM ; testable headless (scripts/check-missions.mjs) ;
   questions en mots de tous les jours, factuelles (jamais de conseil) ; une
   étape optionnelle sautée n'écrit RIEN (jamais de zéro inventé).
   ========================================================================== */
import { moisActifsDefaut, repartirSaisonnier } from './revenus.js'
import { depensesParDefaut } from './depenses.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) && n > 0 ? n : null
}

/* Les étapes de chaque mission. type: 'chips' (choix tappables) | 'montant'
   (gros nombre + pas ±). `si(reponses)` masque une étape ; `optionnel` = bouton
   « Passer ». `pas` = l'incrément des steppers. */
export const MISSIONS = {
  revenus: {
    titre: 'Allumer tes revenus',
    sousTitre: 'Environ 2 minutes — tu pourras fignoler plus tard.',
    etapes: [
      {
        id: 'mode', question: 'Comment tu es payé ?', type: 'chips',
        options: [
          { id: 'biweekly', label: 'Aux 2 semaines' },
          { id: 'weekly', label: 'Chaque semaine' },
          { id: 'semimonthly', label: 'Deux fois par mois' },
          { id: 'monthly', label: 'Une fois par mois' },
          { id: 'saisonnier', label: 'Ça varie selon la saison' },
        ],
      },
      {
        id: 'montantParPaie', question: 'Combien tombe dans ton compte, par paie ?',
        sous: 'Le net — ce que tu vois sur ton relevé.', type: 'montant', pas: 50,
        si: (r) => r.mode && r.mode !== 'saisonnier',
      },
      {
        id: 'annuel', question: 'Tes revenus nets sur l’année, à peu près ?',
        sous: 'Une estimation suffit — la tour répartit sur tes mois actifs.', type: 'montant', pas: 1000,
        si: (r) => r.mode === 'saisonnier',
      },
      {
        id: 'coussin', question: 'T’as combien de côté, en ce moment ?',
        sous: 'Ton coussin — ça allume aussi la famille Coussin.', type: 'montant', pas: 500, optionnel: true,
      },
      {
        id: 'brutAnnuel', question: 'Et ton salaire brut à l’année ?',
        sous: 'Avant impôts — ça allume la famille Impôts.', type: 'montant', pas: 1000, optionnel: true,
      },
    ],
  },

  depenses: {
    titre: 'Allumer tes dépenses',
    sousTitre: 'Cinq questions, des à-peu-près — tu pourras fignoler plus tard.',
    etapes: [
      { id: 'cat_logement', question: 'Ton logement par mois ?', sous: 'Loyer ou hypothèque, à peu près.', type: 'montant', pas: 50 },
      { id: 'cat_alimentation', question: 'L’épicerie et la bouffe ?', type: 'montant', pas: 25 },
      { id: 'cat_transport', question: 'Le transport ?', sous: 'Auto, essence, bus — tout ensemble.', type: 'montant', pas: 25, optionnel: true },
      { id: 'cat_protection', question: 'Tes assurances ?', type: 'montant', pas: 10, optionnel: true },
      { id: 'wcat_autres', question: 'Le reste de ton mois, en gros ?', sous: 'Sorties, abonnements, l’imprévu — un seul chiffre.', type: 'montant', pas: 25, optionnel: true },
    ],
  },

  placements: {
    titre: 'Allumer ton patrimoine',
    sousTitre: 'Des à-peu-près suffisent — tu pourras fignoler plus tard.',
    etapes: [
      { id: 'age', question: 'Ton âge ?', type: 'montant', pas: 1 },
      { id: 'reer', question: 'Dans ton REER ?', type: 'montant', pas: 500, optionnel: true },
      { id: 'celi', question: 'Dans ton CELI ?', type: 'montant', pas: 500, optionnel: true },
      { id: 'maisonValeur', question: 'Ta maison vaut environ ?', sous: 'Pas de maison ? Passe.', type: 'montant', pas: 5000, optionnel: true },
      { id: 'hypotheque', question: 'Il reste combien sur l’hypothèque ?', type: 'montant', pas: 5000, optionnel: true, si: (r) => num(r.maisonValeur) != null },
      { id: 'autresDettes', question: 'D’autres dettes ?', sous: 'Carte, marge, prêt auto…', type: 'montant', pas: 500, optionnel: true },
    ],
  },
}

/** Les étapes réellement visibles pour des réponses données (les `si` filtrent). */
export function etapesVisibles(famille, reponses = {}) {
  const m = MISSIONS[famille]
  if (!m) return []
  return m.etapes.filter((e) => !e.si || e.si(reponses))
}

/**
 * Applique les réponses d'une mission au silo. PURE : retourne un NOUVEAU store.
 * Une réponse absente/sautée n'écrit rien (jamais de zéro inventé).
 */
export function appliquerMission(famille, reponses = {}, store = {}) {
  const s = store && typeof store === 'object' ? store : {}

  if (famille === 'revenus') {
    const r = { ...(s.revenus || {}) }
    if (reponses.mode === 'saisonnier') {
      const annuel = num(reponses.annuel)
      if (annuel != null) {
        r.mode = 'saisonnier'
        r.annuel = annuel
        r.moisActifs = Array.isArray(r.moisActifs) && r.moisActifs.length === 12 ? r.moisActifs : moisActifsDefaut()
        r.repartition = repartirSaisonnier(annuel, r.moisActifs)
      }
    } else if (reponses.mode) {
      const paie = num(reponses.montantParPaie)
      if (paie != null) {
        r.mode = 'regulier'
        r.freq = reponses.mode
        r.montantParPaie = paie
        if (!Array.isArray(r.jours)) r.jours = [1, 15]
        if (r.weekday == null) r.weekday = 4
      }
    }
    if (num(reponses.coussin) != null) r.coussin = num(reponses.coussin)
    if (num(reponses.brutAnnuel) != null) r.brutAnnuel = num(reponses.brutAnnuel)
    return { ...s, revenus: r }
  }

  if (famille === 'depenses') {
    const base = Array.isArray(s.depenses) && s.depenses.length > 0 ? s.depenses : depensesParDefaut()
    const depenses = base.map((d) => {
      const v = num(reponses[d.id])
      return v != null ? { ...d, montant: v } : d
    })
    return { ...s, depenses }
  }

  if (famille === 'placements') {
    const p = { ...(s.patrimoine || {}) }
    for (const cle of ['age', 'reer', 'celi', 'maisonValeur', 'hypotheque', 'autresDettes']) {
      if (num(reponses[cle]) != null) p[cle] = num(reponses[cle])
    }
    if (p.retraite == null) p.retraite = 65
    if (p.rendement == null) p.rendement = 5
    return { ...s, patrimoine: p }
  }

  return s
}
