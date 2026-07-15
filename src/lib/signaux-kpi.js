/* ============================================================================
   signaux-kpi.js — LE MOTEUR DE SIGNAUX (P3). 100 % LOCAL, DÉTERMINISTE.

   La tour répond à « je ne sais pas quoi suivre » : elle lit le snapshot et
   détecte des SIGNAUX FACTUELS (des faits, jamais un jugement), puis les traduit
   en SUGGESTIONS de KPI — une à la fois, avec son POURQUOI. Aucun appel IA : le
   volet IA (reformulation, question libre) est le P6 ; ici tout est pur.

   DISCIPLINE (les pièges) :
   - Data-aware : un signal ne s'allume QUE si le snapshot porte la donnée
     (DONNEE_DISPO) ; une suggestion n'est émise que si son KPI RÉSOUT vraiment
     (resolveKPI.disponible) — jamais une tuile vide.
   - La `raison` est un FAIT (« ta plus grosse catégorie pèse 38 % »), filtrée par
     filtrerFait ; rejetée → suggestion omise, jamais affichée brute (§11).
   - Jamais de doublon avec les tuiles déjà épinglées (dejaEpingles).
   - Apprentissage local honnête : une suggestion « Pas maintenant » (écartée)
     disparaît 3 mois, et ne revient qu'après si le signal s'est RENFORCÉ ; un
     domaine déjà épinglé (gardé) remonte. Le « mois » vient du snapshot
     (meta.generatedAt), jamais Date.now() — le score reste stable/testable.

   PUR : zéro React/DOM, testable headless (scripts/check-signaux.mjs).
   ========================================================================== */
import { DONNEE_DISPO, resolveKPI, kpiPourId } from '../recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../recettes/schema.js'
import { formatCAD } from './format.js'

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0)
const moisIndex = (m) => { if (typeof m !== 'string') return null; const [y, mo] = m.split('-').map(Number); return (y && mo >= 1 && mo <= 12) ? y * 12 + (mo - 1) : null }
const ecartMois = (a, b) => { const ia = moisIndex(a), ib = moisIndex(b); return (ia != null && ib != null) ? ib - ia : 999 }
/** Le mois courant ('YYYY-MM') d'après le snapshot — jamais l'horloge réelle (pur). */
export function moisDeSnapshot(snapshot) {
  const iso = snapshot && snapshot.meta && snapshot.meta.generatedAt
  const d = iso ? new Date(iso) : null
  if (!d || isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* Chaque signal : `detecte(snapshot, {historique, baseline})` → { score, raison,
   faitsUtilises } ou null. Le score porte la MAGNITUDE du fait (il grandit avec lui)
   → « le signal se renforce » a un sens (réapparition d'une écartée). kpisPossibles =
   les KPI que ce signal éclaire, du plus pertinent au moins ; couches = ce qui les
   enrichit (recommandé au P4/P5). */
const SIGNAUX = [
  {
    id: 'changement', domaine: 'budget', kpisPossibles: ['solde_mois'], couches: [],
    detecte: (s, { baseline } = {}) => {
      const fini = (v) => (typeof v === 'number' && isFinite(v) ? v : null)
      const av = baseline && baseline.depenses ? fini(baseline.depenses.reste) : null
      const ap = s.depenses ? fini(s.depenses.reste) : null
      if (av == null || ap == null) return null
      const d = ap - av
      if (Math.abs(d) < 50) return null
      return { score: 120 + Math.min(60, Math.abs(d) / 20), raison: `Depuis ta dernière visite, ton solde du mois a varié de ${d > 0 ? '+' : '−'}${formatCAD(Math.abs(d))}.`, faitsUtilises: ['depenses.reste', 'baseline'] }
    },
  },
  {
    id: 'saison', domaine: 'saisonnier', kpisPossibles: ['amplitude_revenus', 'mois_sous_seuil', 'revenu_lisse', 'manque_saison_creuse'], couches: ['evolution'],
    detecte: (s) => {
      if (!DONNEE_DISPO.saison(s)) return null
      const r = s.saison.revenusMensuels.filter((x) => typeof x === 'number' && isFinite(x))
      if (r.length < 2) return null
      const mn = Math.min(...r), mx = Math.max(...r)
      if (mx - mn < 500) return null
      return { score: 100 + Math.min(50, (mx - mn) / 200), raison: `Tes revenus varient de ${formatCAD(mn)} à ${formatCAD(mx)} selon les mois.`, faitsUtilises: ['saison.revenusMensuels'] }
    },
  },
  {
    id: 'concentration', domaine: 'budget', kpisPossibles: ['top_categorie', 'equilibre_503020'], couches: ['decoupe'],
    detecte: (s) => {
      if (!DONNEE_DISPO.categories(s)) return null
      const cats = [...s.depenses.parCategorie].sort((a, b) => num(b.montant) - num(a.montant))
      const top = cats[0], cv = num(s.depenses.coutVie)
      if (!top || !(cv > 0)) return null
      const pct = Math.round((num(top.montant) / cv) * 100)
      if (pct < 30) return null
      return { score: 60 + pct, raison: `Ta plus grosse catégorie (${top.label || 'une dépense'}) pèse ${pct} % de ton coût de vie.`, faitsUtilises: ['depenses.parCategorie', 'depenses.coutVie'] }
    },
  },
  {
    id: 'marge', domaine: 'budget', kpisPossibles: ['solde_mois', 'jours_de_repit'], couches: [],
    detecte: (s) => {
      if (!(s.depenses && typeof s.depenses.reste === 'number')) return null
      const v = s.depenses.reste
      return { score: 70, raison: v >= 0 ? `Il te reste ${formatCAD(v)} après tes dépenses ce mois-ci.` : `Tes dépenses dépassent ton revenu de ${formatCAD(Math.abs(v))}.`, faitsUtilises: ['depenses.reste'] }
    },
  },
  {
    id: 'coussin', domaine: 'coussin', kpisPossibles: ['mois_couverts', 'montant_coussin'], couches: ['cible'],
    detecte: (s) => {
      if (!DONNEE_DISPO.coussin(s)) return null
      const m = num(s.coussin.montant)
      if (!(m > 0)) return null
      return { score: 65, raison: `Tu as ${formatCAD(m)} de côté.`, faitsUtilises: ['coussin.montant'] }
    },
  },
  {
    id: 'engage_libre', domaine: 'budget', kpisPossibles: ['engage_vs_libre'], couches: ['decoupe'],
    detecte: (s) => {
      const el = s.depenses && s.depenses.engageLibre
      if (!el) return null
      const fixe = num(el.fixe), variable = num(el.variable), tot = fixe + variable
      if (!(tot > 0)) return null
      return { score: 55, raison: `${Math.round((fixe / tot) * 100)} % de tes dépenses sont fixes (déjà engagées).`, faitsUtilises: ['depenses.engageLibre'] }
    },
  },
  {
    id: 'historique', domaine: null, kpisPossibles: ['mois_couverts', 'valeur_nette', 'taux_epargne'], couches: ['evolution'],
    detecte: (s, { historique } = {}) => {
      const n = Array.isArray(historique) ? historique.length : 0
      if (n < 3) return null
      return { score: 50 + Math.min(20, n), raison: `Tu as ${n} mois d’historique — de quoi voir ton évolution.`, faitsUtilises: ['historique'] }
    },
  },
]

/** Les signaux ACTIFS du snapshot (faits détectés), avec magnitude/raison. PUR.
 *  @returns {Array<{id, domaine, score, raison, faitsUtilises, kpisPossibles, couches}>} */
export function detecterSignaux(snapshot, opts = {}) {
  const s = snapshot || {}
  const out = []
  for (const sig of SIGNAUX) {
    let det = null
    try { det = sig.detecte(s, opts) } catch { det = null }
    if (!det) continue
    out.push({ id: sig.id, domaine: sig.domaine, score: det.score, raison: det.raison, faitsUtilises: det.faitsUtilises, kpisPossibles: sig.kpisPossibles, couches: sig.couches })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Les SUGGESTIONS de KPI (une par signal), scorées, data-aware, hors board et hors
 *  écartées-récentes. La 1re = la mieux placée ; « Une autre idée » prend la suivante.
 *  @param {object} opts { historique, baseline, dejaEpingles:[kpiId], ecartees:{[id]:{mois,score}},
 *                         gardees:{[domaine]:mois} }
 *  @returns {Array<{id, question, raison, kpiId, params, donneesRequises, couchesRecommandees, domaine, score}>} PUR. */
export function suggestionsKPI(snapshot, opts = {}) {
  const s = snapshot || {}
  const { historique, baseline, dejaEpingles = [], ecartees = {}, gardees = {} } = opts
  const mois = moisDeSnapshot(s)
  const dejaSet = new Set(Array.isArray(dejaEpingles) ? dejaEpingles : [])
  const vus = new Set()
  const out = []
  for (const sig of detecterSignaux(s, { historique, baseline })) {
    // La raison est PROPRE au signal (pas au KPI) → rejetée par filtrerFait = tout le signal tu.
    const raisonF = filtrerFait(sig.raison)
    if (!raisonF.ok || !raisonF.texte) continue
    for (const kpiId of sig.kpisPossibles) {
      if (dejaSet.has(kpiId) || vus.has(kpiId)) continue
      const def = kpiPourId(kpiId)
      if (!def) continue
      // Data-aware STRICT : « disponible » ne suffit pas (la CATÉGORIE existe) — il faut une
      // VRAIE valeur, sinon aperçu vide + tuile « — » épinglable (revue nuage). null → on
      // tente le KPI SUIVANT du signal (ex. mois_couverts null → montant_coussin chiffré).
      const r = resolveKPI(kpiId, s)
      if (!r || !r.disponible || r.valeur == null) continue
      const id = `${sig.id}:${kpiId}`
      // APPRENTISSAGE (par SUGGESTION) : une écartée reste tue 3 mois et ne revient qu'après si
      // le SIGNAL s'est renforcé. On compare des grandeurs HOMOGÈNES : le score BRUT du signal
      // (hors boost domaine) des deux côtés — App stocke sg.scoreSignal (brut) à l'écartement.
      // Écartée toujours valide → on tente le KPI suivant (per-id), on ne tue pas le signal.
      const ec = ecartees[id]
      if (ec && (ecartMois(ec.mois, mois) < 3 || !(sig.score > (num(ec.score) || 0)))) continue
      // Un domaine déjà épinglé (gardé) → on remonte les suggestions de la même famille.
      let score = sig.score
      if (def.domaine && gardees[def.domaine] != null) score += 15
      out.push({ id, question: def.question, raison: raisonF.texte, kpiId, params: {}, donneesRequises: def.requiert || [], couchesRecommandees: sig.couches || [], domaine: def.domaine, scoreSignal: sig.score, score })
      vus.add(kpiId)
      break // une suggestion par signal
    }
  }
  return out.sort((a, b) => b.score - a.score)
}
