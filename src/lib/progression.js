/* ============================================================================
   progression.js — LE CERVEAU d'« Allume ta tour » (Vague 1 de la fusion).

   La carte de LA TOUR : chaque ÉTAGE = une famille de données ; il est ALLUMÉ
   quand la donnée existe dans le snapshot ; chaque FENÊTRE = un indicateur créé
   qui se branche sur cet étage. Les PIÈCES (KPIs) prêtes / à venir par étage se
   dérivent du registre — c'est le data-aware existant qui DEVIENT le jeu.

   DISCIPLINE :
   - PUR : zéro React/DOM, testable headless (scripts/check-progression.mjs).
   - UNE SEULE SOURCE DE VÉRITÉ : les états d'étage viennent de DONNEE_DISPO,
     les pièces de candidatsKPI/REGISTRE_KPIS — jamais de prédicat copié.
   - CONFORMITÉ (VISION §11) : la progression est un fait sur L'OUTIL (« ta tour
     voit N pièces »), JAMAIS un score de santé financière. Textes via filtrerFait.
   - Data-aware honnête : un étage éteint dit ce qui l'allume, rien d'inventé.
   ========================================================================== */
import { REGISTRE_KPIS, DONNEE_DISPO, candidatsKPI, kpiPourId } from '../recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../recettes/schema.js'

// Domaine du registre KPI → étage de la tour.
const DOMAINE_VERS_ETAGE = {
  saisonnier: 'revenus',
  impot: 'revenus',
  budget: 'depenses',
  dette: 'depenses',
  coussin: 'coussin',
  patrimoine: 'patrimoine',
  objectif: 'projets',
}

// Situation d'une recette → étage (les fenêtres se branchent au bon niveau).
const SITUATION_VERS_ETAGE = {
  revenu_saisonnier: 'revenus',
  mon_portrait: 'revenus',
  mon_budget: 'depenses',
  ma_vie: 'patrimoine',
  objectif_epargne: 'projets',
}

// Texte factuel ; repli si un mot interdit s'y glissait (jamais de texte jugeant).
function fait(texte) {
  const f = filtrerFait(texte)
  return f.ok && f.texte ? f.texte : ''
}

/** L'étage d'un widget (recette) : situation connue, sinon domaine de son KPI héros,
 *  sinon bloc carte_entite → projets. Un indicateur inconnu reste TON projet. */
export function etageDuWidget(widget) {
  const r = widget && widget.recette
  if (!r) return 'projets'
  if (SITUATION_VERS_ETAGE[r.situation]) return SITUATION_VERS_ETAGE[r.situation]
  const blocs = Array.isArray(r.blocs) ? r.blocs : []
  const kpiBloc = blocs.find((b) => b && b.KPI)
  if (kpiBloc) {
    const def = kpiPourId(kpiBloc.KPI)
    if (def && DOMAINE_VERS_ETAGE[def.domaine]) return DOMAINE_VERS_ETAGE[def.domaine]
  }
  if (blocs.some((b) => b && b.type === 'carte_entite')) return 'projets'
  return 'projets'
}

/**
 * La carte de la tour, dérivée du snapshot + des indicateurs créés. PUR.
 * @param {object} snapshot  snapshot canonique (snapshotFromStore/getSnapshot)
 * @param {Array}  widgets   store.tourWidgets (indicateurs créés)
 * @param {Array}  entites   store.entites (projets fabriqués au studio)
 * @returns {{
 *   etages: Array<{id,label,etat:'allume'|'eteint',fenetres:number,condition:string|null,
 *                  piecesPretes:number,piecesAVenir:number,sousSection:string|null}>,
 *   antenne: {active:boolean},
 *   totaux: {allumes:number,etages:number,fenetres:number,piecesPretes:number,piecesAVenir:number}
 * }}
 */
export function construireProgression(snapshot, widgets = [], entites = []) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {}
  const liste = Array.isArray(widgets) ? widgets : []
  const projets = Array.isArray(entites) ? entites : []

  // Fenêtres : les indicateurs créés, branchés à leur étage.
  const fenetres = { revenus: 0, depenses: 0, coussin: 0, patrimoine: 0, projets: 0 }
  for (const w of liste) fenetres[etageDuWidget(w)]++

  // Pièces prêtes / à venir par étage — dérivées du registre, jamais recomptées à la main.
  const pieces = { revenus: { p: 0, a: 0 }, depenses: { p: 0, a: 0 }, coussin: { p: 0, a: 0 }, patrimoine: { p: 0, a: 0 }, projets: { p: 0, a: 0 } }
  const domaines = [...new Set(REGISTRE_KPIS.map((k) => k.domaine))]
  for (const d of domaines) {
    const etage = DOMAINE_VERS_ETAGE[d]
    if (!etage) continue
    const total = REGISTRE_KPIS.filter((k) => k.domaine === d).length
    const pretes = candidatsKPI(d, s).length
    pieces[etage].p += pretes
    pieces[etage].a += total - pretes
  }

  // Les étages, de la FONDATION au SOMMET. État = DONNEE_DISPO (source unique).
  // sousSection = où cette donnée se saisit (navigation « rallumer »/« allumer »).
  const DEF = [
    {
      id: 'revenus', label: 'Revenus', sousSection: 'revenus',
      allume: DONNEE_DISPO.capacite(s) || DONNEE_DISPO.saison(s),
      condition: 'S’allume avec tes revenus.',
    },
    {
      id: 'depenses', label: 'Dépenses', sousSection: 'depenses',
      allume: DONNEE_DISPO.depenses(s),
      condition: 'S’allume avec tes dépenses.',
    },
    {
      id: 'coussin', label: 'Coussin', sousSection: 'revenus', // le coussin se saisit avec les revenus
      allume: DONNEE_DISPO.coussin(s),
      condition: 'S’allume avec ton coussin.',
    },
    {
      id: 'patrimoine', label: 'Patrimoine', sousSection: 'placements',
      allume: DONNEE_DISPO.patrimoine(s),
      condition: 'S’allume avec tes avoirs et tes dettes.',
    },
    {
      id: 'projets', label: 'Projets', sousSection: null, // → la surface « créer »
      allume: projets.length > 0 || fenetres.projets > 0,
      condition: 'S’allume avec ton premier projet.',
    },
  ]

  const etages = DEF.map((e) => ({
    id: e.id,
    label: e.label,
    etat: e.allume ? 'allume' : 'eteint',
    fenetres: fenetres[e.id],
    condition: e.allume ? null : fait(e.condition) || null,
    piecesPretes: pieces[e.id].p,
    piecesAVenir: pieces[e.id].a,
    sousSection: e.sousSection,
  }))

  const allumes = etages.filter((e) => e.etat === 'allume').length
  return {
    etages,
    antenne: { active: DONNEE_DISPO.projection(s) }, // l’antenne balaie quand la projection existe
    totaux: {
      allumes,
      etages: etages.length,
      fenetres: liste.length,
      piecesPretes: etages.reduce((n, e) => n + e.piecesPretes, 0),
      piecesAVenir: etages.reduce((n, e) => n + e.piecesAVenir, 0),
    },
  }
}
