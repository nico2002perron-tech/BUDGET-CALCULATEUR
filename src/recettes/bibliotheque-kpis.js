/* ============================================================================
   bibliotheque-kpis.js — LE REGISTRE DE KPIs : le « quoi mesurer » formalisé.

   Chaque KPI est une MÉTRIQUE NOMMÉE — fonction PURE du snapshot, data-aware — que
   l'IA/la recette SÉLECTIONNE (modèle Otto : piger dans un répertoire vérifié, jamais
   générer). Aujourd'hui les métriques sont enterrées dans les blocs/situations ; ici
   on les remonte d'un cran → un même KPI peut s'afficher en plusieurs blocs (le bloc
   = la FORME ; le KPI = le FOND).

   RÈGLES (réf. project_kpi_library.md, VISION §8/§11) :
   - PUR : zéro React/DOM. Aucune nouvelle source de chiffres — on réutilise le snapshot
     canonique + evaluerGraphe ; aucune duplication de calcul fiscal/budgétaire.
   - DATA-AWARE : `requiert` liste les données nécessaires ; un KPI dont la donnée manque
     n'est JAMAIS proposé (candidatsKPI) ni résolu en chiffre inventé (resolveKPI → null).
   - CONFORMITÉ : tout `texteFactuel` passe par filtrerFait (faits, jamais jugement/conseil).
   - `blocsCompatibles` ne nomme que des blocs qui EXISTENT (les formes neuves —
     comparaison, ligne_evolution… — s'ajouteront quand elles seront bâties).
   ========================================================================== */
import { evaluerGraphe } from '../lib/graphe.js'
import { filtrerFait, estConnu, BLOCS } from './schema.js'
import { formatCAD, formatPct, MOIS_COURTS } from '../lib/format.js'
import { genererScenarios } from '../lib/scenarios.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}
const mois1 = (m) => (m == null ? '—' : Number(m).toFixed(1).replace('.', ','))

/* ── LE TEMPS (K1) — un KPI peut PROJETER des dates. On garde ça PUR : le
   « maintenant » vient de snapshot.meta.generatedAt (l'instant où le snapshot a été
   bâti — les dates de aVenir y sont déjà relatives), avec repli sur l'heure réelle.
   Ainsi datesKPI est déterministe pour un snapshot donné (donc testable). ────────── */
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
function maintenantDe(s) {
  const iso = s && s.meta && s.meta.generatedAt
  const d = iso ? new Date(iso) : new Date()
  return isNaN(d.getTime()) ? new Date() : d
}
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Une date PROJETÉE = maintenant + h mois (posée au 1er du mois cible). null si h
 *  invalide (aucune projection sur une donnée absente / un horizon non fini). */
function dansMois(s, h, faireLabel) {
  if (typeof h !== 'number' || !isFinite(h) || h <= 0 || h > 720) return null
  const now = maintenantDe(s)
  const d = new Date(now.getFullYear(), now.getMonth() + Math.round(h), 1)
  return { date: isoLocal(d), type: 'projetee', label: faireLabel(MOIS_LONGS[d.getMonth()], d.getFullYear()) }
}
/** La prochaine PAIE réelle (1re entrée de aVenir) → { date, type:'reelle', label } ou null. */
function prochainePaie(s) {
  const av = s && Array.isArray(s.aVenir) ? s.aVenir : []
  const p = av.find((e) => e && e.type === 'entree' && e.date)
  return p ? { date: p.date, type: 'reelle', label: 'Ta prochaine paie' } : null
}
/** Le dernier jour du mois courant (fin de cycle du solde) → { date, type:'reelle', label }. */
function finDuMois(s) {
  const now = maintenantDe(s)
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { date: isoLocal(d), type: 'reelle', label: 'Fin du mois' }
}

// Disponibilité d'une donnée dans le snapshot (le « requiert » des KPIs). PUR.
// Exporté : progression.js (la carte de la tour) dérive les étages allumés/éteints
// de CES prédicats — une seule source de vérité, jamais de copie.
export const DONNEE_DISPO = {
  capacite: (s) => !!((s.depenses && s.depenses.revenu > 0) || (s.budget && s.budget.revenuMensuel > 0)),
  coussin: (s) => !!s.coussin,
  depenses: (s) => !!s.depenses,
  categories: (s) => !!(s.depenses && Array.isArray(s.depenses.parCategorie) && s.depenses.parCategorie.length > 0),
  saison: (s) => !!(s.saison && Array.isArray(s.saison.revenusMensuels) && s.saison.revenusMensuels.some((x) => x > 0)),
  fiscalite: (s) => !!(s.fiscalite && s.fiscalite.brut > 0),
  patrimoine: (s) => !!s.patrimoine,
  projection: (s) => !!(s.projection && Array.isArray(s.projection.annees) && s.projection.annees.length > 1),
  // 🟡 domaines à brancher : tant que la saisie n'existe pas, ces données restent absentes
  // → les KPIs qui en dépendent ne sont JAMAIS proposés (rétraction propre).
  dettesDetaillees: (s) => Array.isArray(s.dettes) && s.dettes.length > 0,
  comptesEnregistres: (s) => Array.isArray(s.comptes) && s.comptes.length > 0,
}

// L'objectif (cible/nom) vient du CONTEXTE (recette/entité), pas du snapshot.
const objG = (s, ctx) => evaluerGraphe(s, { objectif: ctx && ctx.objectif ? ctx.objectif : undefined })

export const REGISTRE_KPIS = [
  // ── 1. Objectif / projet ──────────────────────────────────────────────────
  {
    id: 'horizon_objectif', domaine: 'objectif', question: 'Dans combien de temps ?',
    requiert: ['capacite'], blocsCompatibles: ['chaine', 'chronologie', 'stat', 'comparaison'],
    explique: 'Le nombre de mois avant d’atteindre ta cible, à ton rythme d’épargne actuel.',
    depend: 'Ce qu’il te reste à réunir ÷ ce que tu mets de côté chaque mois.',
    dates: (s, ctx) => { const g = objG(s, ctx); const o = g.objectif; if (!o) return []; const contrib = num(ctx && ctx.contributionMensuelle); const h = contrib > 0 ? (o.restant <= 0 ? 0 : Math.ceil(o.restant / contrib)) : o.horizonMois; const dd = dansMois(s, h, (mo, an) => `À ton rythme, ta cible en ${mo} ${an}`); return dd ? [dd] : [] },
    resolve: (s, ctx) => {
      const g = objG(s, ctx)
      const o = g.objectif
      if (!o) return { valeur: null, unite: 'mois', texteFactuel: '' }
      // ctx.contributionMensuelle (un SCÉNARIO) → horizon à CE rythme = restant / contribution.
      // Sans contribution → la pleine capacité (comportement d'origine, inchangé).
      const contrib = num(ctx && ctx.contributionMensuelle)
      const h = contrib > 0 ? (o.restant <= 0 ? 0 : Math.ceil(o.restant / contrib)) : o.horizonMois
      const intro = contrib > 0 ? 'À ce rythme' : 'À ton rythme'
      return { valeur: h, unite: 'mois', texteFactuel: h === 0 ? 'Ta cible est déjà atteinte.' : h == null ? 'À ton rythme actuel, ta cible n’avance pas.' : `${intro}, ta cible est à ${h} mois.` }
    },
  },
  {
    id: 'pct_atteint', domaine: 'objectif', question: 'Je suis rendu où ?',
    requiert: ['coussin'], blocsCompatibles: ['barre_progression', 'jauge', 'stat'],
    explique: 'La part de ta cible déjà atteinte.',
    depend: 'Ce que tu as de côté ÷ ta cible.',
    resolve: (s, ctx) => {
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible); const deja = num(s.coussin && s.coussin.montant)
      const pct = cible > 0 ? Math.min(100, Math.round((deja / cible) * 100)) : null
      return { valeur: pct, unite: '%', texteFactuel: pct == null ? '' : `Tu es à ${pct} % de ta cible.` }
    },
  },
  {
    id: 'restant_a_combler', domaine: 'objectif', question: 'Combien il me manque ?',
    requiert: ['coussin'], blocsCompatibles: ['stat', 'barre_progression'],
    explique: 'Le montant qu’il te reste à réunir pour toucher ta cible.',
    depend: 'Ta cible − ce que tu as déjà de côté.',
    resolve: (s, ctx) => {
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible); const deja = num(s.coussin && s.coussin.montant)
      const restant = cible > 0 ? Math.max(0, cible - deja) : null
      return { valeur: restant, unite: '$', texteFactuel: restant == null ? '' : `Il te reste ${formatCAD(restant)} à réunir.` }
    },
  },
  {
    id: 'contribution_requise', domaine: 'objectif', question: 'Combien par mois pour ma date ?',
    requiert: ['coussin'], blocsCompatibles: ['stat', 'fait'],
    explique: 'Le montant à mettre de côté chaque mois pour atteindre ta cible à ta date.',
    depend: 'Ce qu’il te reste à réunir ÷ le nombre de mois jusqu’à ta date.',
    resolve: (s, ctx) => {
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible); const deja = num(s.coussin && s.coussin.montant)
      const moisCible = num(ctx && ctx.moisCible)
      if (!(cible > 0) || !(moisCible > 0)) return { valeur: null, unite: '$/mois', texteFactuel: '' }
      const req = Math.ceil(Math.max(0, cible - deja) / moisCible)
      return { valeur: req, unite: '$/mois', texteFactuel: `Pour viser ~${moisCible} mois, ${formatCAD(req)}/mois.` }
    },
  },
  {
    id: 'ecart_capacite', domaine: 'objectif', question: 'Est-ce réaliste à mon rythme ?',
    requiert: ['capacite', 'coussin'], blocsCompatibles: ['fait', 'stat'],
    explique: 'L’écart entre ce que ta date demande par mois et ce que ta capacité permet.',
    depend: 'Le montant requis par mois − ta capacité d’épargne.',
    resolve: (s, ctx) => {
      const g = objG(s, ctx); const cap = num(g.noeuds && g.noeuds.capaciteEpargne && g.noeuds.capaciteEpargne.valeur)
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible); const deja = num(s.coussin && s.coussin.montant)
      const moisCible = num(ctx && ctx.moisCible)
      if (!(cible > 0) || !(moisCible > 0)) return { valeur: null, unite: '$/mois', texteFactuel: '' }
      const req = Math.ceil(Math.max(0, cible - deja) / moisCible); const ecart = req - cap
      return { valeur: ecart, unite: '$/mois', texteFactuel: ecart <= 0 ? `Ta capacité (${formatCAD(cap)}/mois) couvre ce rythme.` : `Ta date demande ${formatCAD(ecart)}/mois de plus que ta capacité actuelle.` }
    },
  },
  {
    id: 'date_atteinte_projetee', domaine: 'objectif', question: 'À mon rythme, j’y serais quand ?',
    requiert: ['capacite', 'coussin'], blocsCompatibles: ['chronologie', 'fait', 'comparaison'],
    explique: 'Le moment où tu toucherais ta cible en gardant ton rythme d’épargne actuel.',
    depend: 'Ce qu’il te reste à réunir ÷ ta capacité d’épargne mensuelle.',
    dates: (s, ctx) => { const g = objG(s, ctx); const h = g.objectif ? g.objectif.horizonMois : null; const dd = dansMois(s, h, (mo, an) => `À ton rythme, tu y serais en ${mo} ${an}`); return dd ? [dd] : [] },
    resolve: (s, ctx) => {
      const g = objG(s, ctx); const h = g.objectif ? g.objectif.horizonMois : null
      return { valeur: h, unite: 'mois', texteFactuel: h === 0 ? 'Ta cible est déjà atteinte.' : h == null ? 'À ton rythme actuel, ta cible n’avance pas.' : `À ton rythme, tu y serais dans ${h} mois.` }
    },
  },

  // ── 2. Budget / flux mensuel ──────────────────────────────────────────────
  {
    id: 'solde_mois', domaine: 'budget', question: 'Il me reste quoi ?',
    requiert: ['depenses'], blocsCompatibles: ['solde', 'stat'],
    explique: 'Ce qui te reste chaque mois une fois toutes tes dépenses payées.',
    depend: 'Ton revenu − tes dépenses.',
    dates: (s) => { const out = []; const p = prochainePaie(s); if (p) out.push(p); out.push(finDuMois(s)); return out },
    resolve: (s) => { const v = num(s.depenses.reste); return { valeur: v, unite: '$', texteFactuel: v >= 0 ? `Il te reste ${formatCAD(v)} après tes dépenses.` : `Tes dépenses dépassent ton revenu de ${formatCAD(Math.abs(v))}.` } },
  },
  {
    id: 'taux_epargne', domaine: 'budget', question: 'Quelle part je mets de côté ?',
    requiert: ['depenses'], blocsCompatibles: ['jauge', 'stat', 'repartition'],
    explique: 'La part de ton revenu que tu mets de côté chaque mois.',
    depend: 'Ton épargne mensuelle ÷ ton revenu.',
    repere: { texte: 'Repère souvent cité : autour de 10 %.', min: null, max: null },
    // réglable : TA cible d'épargne (ctx.cible, en %) — choisie par l'usager, jamais imposée.
    // sens 'haut' : la valeur et la cible partagent l'unité (%) et « plus haut = atteint »
    // → seule condition sûre pour une pastille de statut (jamais un jugement inventé).
    reglage: { label: 'Ta cible', unite: '%', defaut: 10, min: 1, max: 50, pas: 1, sens: 'haut' },
    resolve: (s, ctx) => {
      const rev = num(s.depenses.revenu); const ep = num(s.depenses.parClasse && s.depenses.parClasse.epargne)
      const pct = rev > 0 ? Math.round((ep / rev) * 100) : null
      const cible = num(ctx && ctx.cible)
      const suite = pct != null && cible > 0 ? ` Ta cible : ${Math.round(cible)} %.` : ''
      return { valeur: pct, unite: '%', texteFactuel: pct == null ? '' : `Tu mets ${pct} % de ton revenu de côté.${suite}` }
    },
  },
  {
    id: 'equilibre_503020', domaine: 'budget', question: 'Mon budget est-il balancé ?',
    requiert: ['depenses'], blocsCompatibles: ['repartition', 'beignet', 'anneau3d'],
    explique: 'Comment tes dépenses se répartissent entre besoins, désirs et épargne.',
    depend: 'Tes dépenses classées en trois familles ÷ ton revenu.',
    repere: { texte: 'Repère usuel : 50 % besoins, 30 % désirs, 20 % épargne.', min: null, max: null },
    resolve: (s) => { const p = s.depenses.pct; if (!p) return { valeur: null, unite: '%', texteFactuel: '' }; return { valeur: p, unite: '%', texteFactuel: `Tes parts : ${p.besoin} % besoins, ${p.envie} % désirs, ${p.epargne} % épargne.` } },
  },
  {
    id: 'engage_vs_libre', domaine: 'budget', question: 'Combien part tout seul chaque mois ?',
    requiert: ['depenses'], blocsCompatibles: ['barre_empilee', 'jauge'],
    explique: 'La part de tes dépenses qui est fixe (déjà engagée) plutôt que variable.',
    depend: 'Tes dépenses fixes ÷ le total de tes dépenses.',
    resolve: (s) => { const el = s.depenses.engageLibre || {}; const fixe = num(el.fixe); const variable = num(el.variable); const tot = fixe + variable; const pct = tot > 0 ? Math.round((fixe / tot) * 100) : null; return { valeur: pct, unite: '%', texteFactuel: pct == null ? '' : `${pct} % de tes dépenses sont fixes (déjà engagées).` } },
  },
  {
    id: 'cout_vie_mensuel', domaine: 'budget', question: 'Ça me coûte combien de vivre ?',
    requiert: ['depenses'], blocsCompatibles: ['stat', 'anatomie_dollar'],
    explique: 'Ce que ça te coûte de vivre chaque mois, tout compris.',
    depend: 'La somme de toutes tes dépenses mensuelles.',
    resolve: (s) => { const v = num(s.depenses.coutVie); return { valeur: v, unite: '$', texteFactuel: `Vivre te coûte ${formatCAD(v)} par mois.` } },
  },
  {
    id: 'top_categorie', domaine: 'budget', question: 'Qu’est-ce qui pèse le plus ?',
    requiert: ['categories'], blocsCompatibles: ['beignet', 'anneau3d', 'liste', 'fait'],
    explique: 'La catégorie de dépense qui pèse le plus lourd dans ton budget.',
    depend: 'Le plus gros poste parmi tes catégories de dépenses.',
    resolve: (s) => { const cats = [...s.depenses.parCategorie].sort((a, b) => num(b.montant) - num(a.montant)); const top = cats[0]; return { valeur: num(top.montant), unite: '$', texteFactuel: `Ta plus grosse catégorie : ${top.label || 'Dépense'}, à ${formatCAD(top.montant)}.` } },
  },
  {
    id: 'jours_de_repit', domaine: 'budget', question: 'Mon surplus couvre combien de jours ?',
    requiert: ['depenses'], blocsCompatibles: ['stat', 'fait'],
    explique: 'Combien de jours de dépenses ton surplus du mois pourrait couvrir.',
    depend: 'Ton surplus ÷ ton coût de vie par jour.',
    resolve: (s) => { const reste = num(s.depenses.reste); const cv = num(s.depenses.coutVie); if (reste <= 0) return { valeur: 0, unite: 'jours', texteFactuel: 'Pas de surplus à reporter ce mois-ci.' }; const j = cv > 0 ? Math.round(reste / (cv / 30)) : null; return { valeur: j, unite: 'jours', texteFactuel: j == null ? '' : `Ton surplus couvre ${j} jours de dépenses.` } },
  },

  // ── 3. Coussin / sécurité ─────────────────────────────────────────────────
  {
    id: 'mois_couverts', domaine: 'coussin', question: 'Mon coussin tient combien de mois ?',
    requiert: ['coussin'], blocsCompatibles: ['jauge', 'coussin_urgence'],
    explique: 'Le nombre de mois que ton coussin couvrirait si tes revenus s’arrêtaient.',
    depend: 'Ton coussin ÷ tes dépenses essentielles par mois.',
    repere: { texte: 'Repère usuel : 3 à 6 mois.', min: 3, max: 6 },
    // valeur et cible en 'mois', « plus haut = atteint » → pastille de statut sûre.
    reglage: { label: 'Ta cible', unite: 'mois', defaut: 3, min: 1, max: 12, pas: 1, sens: 'haut' },
    resolve: (s, ctx) => {
      const m = s.coussin.moisCouverts
      const cible = num(ctx && ctx.cible)
      const suite = m != null && cible > 0 ? ` Ta cible : ${Math.round(cible)} mois.` : ''
      return { valeur: m == null ? null : m, unite: 'mois', texteFactuel: m == null ? 'Entre tes besoins essentiels pour situer ton coussin.' : `Ton coussin couvre ${mois1(m)} mois de dépenses.${suite}` }
    },
  },
  {
    id: 'montant_coussin', domaine: 'coussin', question: 'J’ai combien de côté ?',
    requiert: ['coussin'], blocsCompatibles: ['stat'],
    explique: 'Le montant total que tu as mis de côté pour les imprévus.',
    depend: 'La somme de ton fonds d’urgence.',
    resolve: (s) => { const v = num(s.coussin.montant); return { valeur: v, unite: '$', texteFactuel: `Tu as ${formatCAD(v)} de côté.` } },
  },
  {
    id: 'ecart_3_6_mois', domaine: 'coussin', question: 'Combien pour atteindre ma cible ?',
    requiert: ['coussin'], blocsCompatibles: ['barre_progression', 'fait'],
    explique: 'Le montant qu’il te manque pour atteindre ta cible de coussin.',
    depend: 'Ta cible en mois × tes essentielles − ce que tu as déjà.',
    repere: { texte: 'Repère usuel : 3 à 6 mois.', min: null, max: null },
    reglage: { label: 'Ta cible', unite: 'mois', defaut: 3, min: 1, max: 12, pas: 1 },
    resolve: (s, ctx) => {
      // TA cible en mois (défaut 3) → convertie en dollars via tes essentielles.
      const ess = num(s.coussin.essentielles)
      const nb = Math.max(1, Math.round(num(ctx && ctx.cible)) || 3)
      const cibleM = ess > 0 ? ess * nb : num(s.coussin.cible3)
      const m = num(s.coussin.montant)
      const manque = Math.max(0, cibleM - m)
      return { valeur: manque, unite: '$', texteFactuel: cibleM <= 0 ? '' : manque === 0 ? `Tu as dépassé ta cible de ${nb} mois.` : `Il te manque ${formatCAD(manque)} pour atteindre ${nb} mois.` }
    },
  },
  {
    id: 'temps_vers_coussin_cible', domaine: 'coussin', question: 'Ma cible de coussin, dans combien de temps ?',
    requiert: ['coussin', 'capacite'], blocsCompatibles: ['chronologie', 'chaine'],
    explique: 'Le moment où ton coussin toucherait ta cible, à ton rythme d’épargne actuel.',
    depend: 'Ce qu’il te manque ÷ ton épargne mensuelle.',
    dates: (s, ctx) => { const ess = num(s.coussin && s.coussin.essentielles); const nb = Math.max(1, Math.round(num(ctx && ctx.cible)) || 3); const cibleM = ess > 0 ? ess * nb : num(s.coussin && s.coussin.cible3); const m = num(s.coussin && s.coussin.montant); const cap = num(s.depenses && s.depenses.reste); const manque = Math.max(0, cibleM - m); const h = cibleM <= 0 ? null : (manque === 0 ? 0 : (cap > 0 ? Math.ceil(manque / cap) : null)); const dd = dansMois(s, h, (mo, an) => `À ton rythme, ta cible de coussin en ${mo} ${an}`); return dd ? [dd] : [] },
    reglage: { label: 'Ta cible', unite: 'mois', defaut: 3, min: 1, max: 12, pas: 1 },
    resolve: (s, ctx) => {
      const ess = num(s.coussin.essentielles)
      const nb = Math.max(1, Math.round(num(ctx && ctx.cible)) || 3)
      const cibleM = ess > 0 ? ess * nb : num(s.coussin.cible3)
      const m = num(s.coussin.montant)
      const cap = num(s.depenses && s.depenses.reste)
      const manque = Math.max(0, cibleM - m)
      if (cibleM <= 0) return { valeur: null, unite: 'mois', texteFactuel: '' }
      const h = manque === 0 ? 0 : cap > 0 ? Math.ceil(manque / cap) : null
      return { valeur: h, unite: 'mois', texteFactuel: h === 0 ? `Tu as déjà ${nb} mois de coussin.` : h == null ? 'À ton rythme actuel, ton coussin n’avance pas.' : `À ton rythme, ${nb} mois de coussin sont à ${h} mois.` }
    },
  },
  {
    id: 'taux_constitution', domaine: 'coussin', question: 'Mon coussin grossit à quelle vitesse ?',
    requiert: ['coussin', 'depenses'], blocsCompatibles: ['stat', 'fait'],
    explique: 'Ce que tu ajoutes à ton épargne chaque mois.',
    depend: 'Le montant classé en épargne dans tes dépenses.',
    resolve: (s) => { const ep = num(s.depenses.parClasse && s.depenses.parClasse.epargne); return { valeur: ep, unite: '$/mois', texteFactuel: ep > 0 ? `Tu ajoutes ${formatCAD(ep)} par mois à ton épargne.` : 'Aucune épargne mensuelle saisie pour l’instant.' } },
  },

  // ── 4. Revenus variables (saisonnier) ─────────────────────────────────────
  {
    id: 'amplitude_revenus', domaine: 'saisonnier', question: 'Mes revenus varient de combien ?',
    requiert: ['saison'], blocsCompatibles: ['flux_annuel', 'prisme3d', 'bandes', 'courbe', 'nuage', 'stat'],
    explique: 'L’écart entre ton mois de revenu le plus élevé et le plus faible.',
    depend: 'Ton revenu du mois le plus fort − celui du plus faible.',
    resolve: (s) => { const r = s.saison.revenusMensuels; const mn = Math.min(...r); const mx = Math.max(...r); return { valeur: mx - mn, unite: '$', texteFactuel: `Tes revenus varient de ${formatCAD(mn)} à ${formatCAD(mx)} selon les mois.` } },
  },
  {
    id: 'mois_sous_seuil', domaine: 'saisonnier', question: 'Combien de mois dans le rouge ?',
    requiert: ['saison'], blocsCompatibles: ['flux_annuel', 'prisme3d', 'bandes', 'courbe', 'nuage', 'fait'],
    explique: 'Le nombre de mois où ton revenu passe sous ton plancher.',
    depend: 'Les mois dont le revenu est inférieur à ton coût de vie (ou à ton plancher visé).',
    // ctx.cible (TON plancher, posé dans le sable) → le compte ET le texte suivent
    // la même lecture que le visuel (jamais deux chiffres contradictoires côte à côte).
    resolve: (s, ctx) => {
      const cible = num(ctx && ctx.cible)
      const seuil = cible > 0 ? cible : num(s.saison.depensesMensuelles)
      const n = s.saison.revenusMensuels.filter((x) => num(x) < seuil).length
      return { valeur: n, unite: 'mois', texteFactuel: cible > 0 ? `${n} mois passent sous ton plancher visé (${formatCAD(cible)}/mois).` : `${n} mois passent sous ton coût de vie.` }
    },
  },
  {
    id: 'manque_saison_creuse', domaine: 'saisonnier', question: 'Combien mettre de côté pour l’hiver ?',
    requiert: ['saison'], blocsCompatibles: ['stat', 'jauge', 'fait'],
    explique: 'Ce que tes mois creux te coûtent en tout sur l’année.',
    depend: 'La somme des manques, mois par mois, sous ton coût de vie.',
    resolve: (s) => { const dep = num(s.saison.depensesMensuelles); const somme = s.saison.revenusMensuels.reduce((a, x) => a + Math.max(0, dep - num(x)), 0); return { valeur: somme, unite: '$', texteFactuel: `Tes mois creux puisent ≈ ${formatCAD(somme)} sur l’année.` } },
  },
  {
    id: 'mois_le_plus_serre', domaine: 'saisonnier', question: 'Mon pire mois ?',
    requiert: ['saison'], blocsCompatibles: ['fait', 'stat'],
    explique: 'Ce qu’il te reste dans ton mois de revenu le plus faible, après tes dépenses.',
    depend: 'Ton plus petit revenu mensuel − tes dépenses.',
    resolve: (s) => { const dep = num(s.saison.depensesMensuelles); const nets = s.saison.revenusMensuels.map((x) => num(x) - dep); const minNet = Math.min(...nets); return { valeur: minNet, unite: '$', texteFactuel: `Ton mois le plus serré finit à ${formatCAD(minNet)} après tes dépenses.` } },
  },
  {
    id: 'revenu_lisse', domaine: 'saisonnier', question: 'Étalé sur l’année, ça fait combien par mois ?',
    requiert: ['saison'], blocsCompatibles: ['stat', 'flux_annuel', 'prisme3d', 'bandes', 'courbe', 'nuage'],
    explique: 'Ton revenu annuel réparti également sur les 12 mois.',
    depend: 'La somme de tes revenus ÷ 12.',
    resolve: (s) => { const r = s.saison.revenusMensuels; const moy = Math.round(r.reduce((a, x) => a + num(x), 0) / 12); return { valeur: moy, unite: '$/mois', texteFactuel: `Lissé sur l’année, ça ferait ${formatCAD(moy)} par mois.` } },
  },

  // ── 7. Impôt / revenu brut ────────────────────────────────────────────────
  {
    id: 'taux_effectif', domaine: 'impot', question: 'Quel % d’impôt je paie vraiment ?',
    requiert: ['fiscalite'], blocsCompatibles: ['impot_palier', 'stat'],
    explique: 'La part réelle de ton revenu brut qui part en impôts et cotisations.',
    depend: 'Tes impôts et cotisations ÷ ton revenu brut.',
    resolve: (s) => { const v = num(s.fiscalite.tauxEffectif); return { valeur: v, unite: '%', texteFactuel: `Ton taux d’imposition effectif est de ${formatPct(v)}.` } },
  },
  {
    id: 'jour_liberation_fiscale', domaine: 'impot', question: 'À partir de quand je travaille pour moi ?',
    requiert: ['fiscalite'], blocsCompatibles: ['impot_palier', 'fait'],
    explique: 'Le jour de l’année où tu finis de payer l’État et gardes le reste.',
    depend: 'La part de ton revenu qui part en impôts, ramenée en jours d’année.',
    dates: (s) => { const j = Math.round(num(s.fiscalite && s.fiscalite.jourLiberation)); if (!(j >= 1 && j <= 365)) return []; const now = maintenantDe(s); const d = new Date(now.getFullYear(), 0, j); return [{ date: isoLocal(d), type: 'projetee', label: 'Ton jour de libération fiscale' }] },
    resolve: (s) => { const j = num(s.fiscalite.jourLiberation); return { valeur: j, unite: 'jour', texteFactuel: `Tu cesses de payer l’impôt au jour ${j} de l’année.` } },
  },
  {
    id: 'revenu_net_mensuel', domaine: 'impot', question: 'Il me reste quoi net ?',
    requiert: ['fiscalite'], blocsCompatibles: ['stat', 'anatomie_dollar'],
    explique: 'Ce qu’il te reste chaque mois après impôts et cotisations.',
    depend: 'Ton revenu net annuel ÷ 12.',
    resolve: (s) => { const v = Math.round(num(s.fiscalite.net) / 12); return { valeur: v, unite: '$/mois', texteFactuel: `Net, il te reste ${formatCAD(v)} par mois.` } },
  },
  {
    id: 'anatomie_brut', domaine: 'impot', question: 'Où va chaque dollar gagné ?',
    requiert: ['fiscalite'], blocsCompatibles: ['anatomie_dollar', 'beignet'],
    explique: 'Comment ton revenu brut se partage entre impôts, cotisations et net.',
    depend: 'Ton brut décomposé en fédéral, Québec, cotisations et net.',
    resolve: (s) => { const b = num(s.fiscalite.brut); return { valeur: b, unite: '$', texteFactuel: `Sur ${formatCAD(b)} brut, voici où va chaque dollar.` } },
  },
  {
    id: 'poids_cotisations', domaine: 'impot', question: 'RRQ/AE/RQAP me prennent combien ?',
    requiert: ['fiscalite'], blocsCompatibles: ['stat', 'fait'],
    explique: 'Le total de tes cotisations sociales sur l’année.',
    depend: 'La somme de RRQ, AE et RQAP retenue sur ta paie.',
    resolve: (s) => { const v = num(s.fiscalite.cotisations); return { valeur: v, unite: '$', texteFactuel: `Tes cotisations (RRQ, AE, RQAP) totalisent ${formatCAD(v)} sur l’année.` } },
  },

  // ── 8. Patrimoine & retraite ──────────────────────────────────────────────
  {
    id: 'valeur_nette', domaine: 'patrimoine', question: 'Je vaux combien, net ?',
    requiert: ['patrimoine'], blocsCompatibles: ['composition', 'stat'],
    explique: 'La valeur de tes avoirs, une fois tes dettes soustraites.',
    depend: 'Tes actifs − tes passifs.',
    resolve: (s) => { const v = num(s.patrimoine.net); return { valeur: v, unite: '$', texteFactuel: `Ta valeur nette est de ${formatCAD(v)}.` } },
  },
  {
    id: 'ratio_actifs_passifs', domaine: 'patrimoine', question: 'Mes dettes pèsent combien face à mes avoirs ?',
    requiert: ['patrimoine'], blocsCompatibles: ['composition', 'jauge'],
    explique: 'Combien tu as d’actif pour chaque dollar de dette.',
    depend: 'Tes actifs ÷ tes passifs.',
    resolve: (s) => { const a = num(s.patrimoine.actifs); const p = num(s.patrimoine.passifs); const ratio = p > 0 ? a / p : null; return { valeur: ratio, unite: 'x', texteFactuel: p > 0 ? `Tu as ${ratio.toFixed(1).replace('.', ',')} $ d’actif pour 1 $ de dette.` : 'Tu n’as aucune dette enregistrée.' } },
  },
  {
    id: 'trajectoire_patrimoine', domaine: 'patrimoine', question: 'Ça évolue comment ?',
    requiert: ['projection'], blocsCompatibles: ['patrimoine_vie', 'stat'],
    explique: 'Où ton patrimoine se rend, année après année, selon tes hypothèses.',
    depend: 'Ta valeur nette projetée avec ton taux de rendement.',
    resolve: (s) => { const a = s.projection.annees; const fin = a[a.length - 1]; return { valeur: num(fin.patrimoineNet), unite: '$', texteFactuel: `Projeté, ton patrimoine atteint ${formatCAD(fin.patrimoineNet)} à ${fin.age} ans.` } },
  },
  {
    id: 'patrimoine_retraite', domaine: 'patrimoine', question: 'J’aurai combien à la retraite ?',
    requiert: ['projection'], blocsCompatibles: ['patrimoine_vie', 'stat'],
    explique: 'Ton patrimoine projeté à l’âge où tu comptes prendre ta retraite.',
    depend: 'Ta trajectoire de patrimoine à ton âge de retraite visé.',
    resolve: (s) => { const age = num(s.projection.retraiteAge); const at = s.projection.annees.find((y) => y.age >= age) || s.projection.annees[s.projection.annees.length - 1]; return { valeur: num(at.patrimoineNet), unite: '$', texteFactuel: `À ${age} ans, ton patrimoine projeté est de ${formatCAD(at.patrimoineNet)}.` } },
  },

  // ── 5. Dette (🟡 — domaine de saisie à brancher) : déclarés mais JAMAIS proposés
  //    tant que `s.dettes` n'existe pas → démontre la rétraction data-aware.
  {
    id: 'mois_jusqu_liberation', domaine: 'dette', question: 'Dans combien de temps c’est payé ?',
    requiert: ['dettesDetaillees'], blocsCompatibles: ['chronologie', 'chaine'],
    explique: 'Le nombre de mois avant que tes dettes soient à zéro, à ton rythme.',
    depend: 'Le solde de tes dettes ÷ ce que tu verses dessus chaque mois.',
    resolve: () => ({ valeur: null, unite: 'mois', texteFactuel: '' }),
  },
  {
    id: 'pct_rembourse', domaine: 'dette', question: 'J’ai remboursé combien ?',
    requiert: ['dettesDetaillees'], blocsCompatibles: ['barre_progression', 'jauge'],
    explique: 'La part de tes dettes déjà réglée.',
    depend: 'Ce que tu as déjà réglé ÷ le total emprunté.',
    resolve: () => ({ valeur: null, unite: '%', texteFactuel: '' }),
  },
]

/** Le KPI d'un id, ou null. Sert au moteur à valider une recette {KPI, forme}. PUR. */
export function kpiPourId(id) {
  return REGISTRE_KPIS.find((k) => k.id === id) || null
}

/* ════════════════════════════════════════════════════════════════════════════
   K1 — LE KPI QUI SE COMPREND. Deux lectures déclaratives par-dessus le registre :
   son TRIPTYQUE pédagogique (c'est quoi · d'où ça vient · le repère) et les DATES
   qu'il projette. Tout passe par filtrerFait (des FAITS, jamais un conseil).
   ════════════════════════════════════════════════════════════════════════════ */

/** Le triptyque d'un KPI : { explique, depend, repere } — textes filtrés (AMF), ou
 *  null si l'id est inconnu. `repere` = { texte, min, max } (bornes pour poser la zone
 *  sur une jauge) ou null. C'est la matière que la tuile/le sable serviront (K4). PUR. */
export function expliqueKPI(kpiId) {
  const def = kpiPourId(kpiId)
  if (!def) return null
  const net = (t) => { const f = filtrerFait(String(t || '')); return f.ok && f.texte ? f.texte : '' }
  let repere = null
  if (def.repere && def.repere.texte) {
    const t = net(def.repere.texte)
    if (t) repere = { texte: t, min: def.repere.min == null ? null : def.repere.min, max: def.repere.max == null ? null : def.repere.max }
  }
  return { explique: net(def.explique), depend: net(def.depend), repere }
}

/** Les dates que ce KPI projette (réelles : paie/fin de mois · projetées : « à ton
 *  rythme »). Chaque entrée : { date:'AAAA-MM-JJ', type:'reelle'|'projetee', label,
 *  kpiId }. Triées, validées (date réelle), plafonnées, labels filtrés (AMF). PUR : le
 *  « maintenant » vient de snapshot.meta.generatedAt → déterministe pour un snapshot.
 *  [] si le KPI ne projette rien ou si sa donnée manque (même rétraction que resolveKPI). */
export function datesKPI(kpiId, snapshot, ctx = {}) {
  const def = kpiPourId(kpiId)
  if (!def || typeof def.dates !== 'function') return []
  const s = snapshot || {}
  if (!def.requiert.every((r) => DONNEE_DISPO[r] && DONNEE_DISPO[r](s))) return []
  let liste
  try { liste = def.dates(s, ctx) || [] } catch { liste = [] }
  if (!Array.isArray(liste)) return []
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  const net = (t) => { const f = filtrerFait(String(t || '')); return f.ok && f.texte ? f.texte : '' }
  const vus = new Set()
  return liste
    .filter((e) => e && typeof e.date === 'string' && ISO.test(e.date) && !isNaN(new Date(e.date + 'T00:00:00').getTime()))
    .map((e) => ({ date: e.date, type: e.type === 'reelle' ? 'reelle' : 'projetee', label: net(e.label), kpiId }))
    .filter((e) => e.label && !vus.has(e.date + e.label) && vus.add(e.date + e.label))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 8)
}

/* ── ChoixAngle : la colonne « comment voir ». Les ANGLES d'un KPI = ses blocsCompatibles
   (formes EXISTANTES), filtrés par les données (si le KPI lui-même n'est pas résoluble,
   aucun angle n'est offert). Même esprit que candidatsValides/resoudreSlot, côté KPI. */

/** Le « pourquoi » FACTUEL d'une forme (ce qu'elle met en avant). Posé déterministe,
 *  jamais un jugement ; passe filtrerFait. Affiché pour le recommandé seulement. */
const POURQUOI_FORME = {
  stat: 'Le gros chiffre va droit au but.',
  jauge: 'La jauge situe ta valeur par rapport à une cible.',
  chronologie: 'Le compte à rebours met le temps en avant.',
  chaine: 'La chaîne montre d’où vient le chiffre.',
  comparaison: 'La comparaison met deux scénarios côte à côte.',
  barre_progression: 'La barre montre le chemin parcouru.',
  fait: 'Une phrase qui dit le constat en clair.',
  beignet: 'Le circulaire montre la part de chaque poste.',
  prisme3d: 'La scène 3D met tes 12 mois en relief.',
  anneau3d: 'L’anneau 3D fait tourner la part de chaque poste.',
  bandes: 'Des barres nettes, mois par mois.',
  courbe: 'La courbe montre le mouvement de l’année.',
  nuage: 'Chaque mois devient une bulle — son poids saute aux yeux.',
}
export function pourquoiForme(forme) {
  const f = filtrerFait(POURQUOI_FORME[forme] || '')
  return f.ok ? f.texte : ''
}

/** Nom court et lisible d'une forme (pour les cartes du sélecteur). */
const NOM_FORME = {
  stat: 'Chiffre', jauge: 'Jauge', chronologie: 'Compte à rebours', chaine: 'Chaîne',
  comparaison: 'Comparaison', barre_progression: 'Barre', fait: 'Constat', beignet: 'Circulaire',
  prisme3d: '3D prisme', anneau3d: 'Anneau 3D', bandes: 'Bandes', courbe: 'Courbe', nuage: 'Nuage',
  // les formes-blocs restantes (l'essayage de la Galerie les nomme en clair)
  coussin_urgence: 'Cadran à zones', barre_empilee: 'Barres empilées', repartition: 'Répartition',
  solde: 'Solde', liste: 'Liste', flux_annuel: 'Année en barres', anatomie_dollar: 'Anatomie du dollar',
  impot_palier: 'Paliers d’impôt', patrimoine_vie: 'Trajectoire', composition: 'Composition',
}
export function nomForme(forme) {
  return NOM_FORME[forme] || forme
}

/** LE TUYAU scenarios.js → comparaison : deux scénarios d'un objectif deviennent les
 *  deux côtés d'un bloc comparaison. Chaque côté = un CTX (contribution différente) que
 *  resolveKPI résoudra — la valeur ne sort JAMAIS d'un calcul du bloc. Il faut ≥2
 *  scénarios RÉELS et distincts (sinon null → comparaison n'a rien à comparer). PUR.
 *  @returns {null | { ctxA, etiquetteA, ctxB, etiquetteB, ecart }} */
export function comparaisonScenarios(snapshot, ctx) {
  const objectif = ctx && ctx.objectif
  const cible = objectif ? num(objectif.cible) : 0
  if (!(cible > 0)) return null
  const scs = genererScenarios(snapshot, { cout: cible, echeance: ctx && ctx.echeance })
  // Seuls les scénarios à horizon réel + contribution > 0 (les cas-limites « déjà atteint »
  // / « capacité nulle » rendent 1 carte sans contribution → écartés ici).
  const reels = scs.filter((x) => typeof x.horizonMois === 'number' && isFinite(x.horizonMois) && num(x.contributionMensuelle) > 0)
  if (reels.length < 2) return null
  const bas = reels[0] // plus faible contribution → horizon le plus long
  const haut = reels[reels.length - 1] // pleine capacité → horizon le plus court
  if (bas.horizonMois === haut.horizonMois) return null // pas d'écart → rien à comparer
  const fA = filtrerFait(`En orientant ${formatCAD(bas.contributionMensuelle)}/mois`)
  const fB = filtrerFait(`Toute ta capacité (${formatCAD(haut.contributionMensuelle)}/mois)`)
  return {
    ctxA: { objectif, contributionMensuelle: bas.contributionMensuelle },
    etiquetteA: fA.ok && fA.texte ? fA.texte : `${formatCAD(bas.contributionMensuelle)}/mois`,
    ctxB: { objectif, contributionMensuelle: haut.contributionMensuelle },
    etiquetteB: fB.ok && fB.texte ? fB.texte : `${formatCAD(haut.contributionMensuelle)}/mois`,
    ecart: Math.abs(bas.horizonMois - haut.horizonMois),
  }
}

/* ── LA SÉRIE et LES PARTS d'un KPI : la vraie donnée de sa FAMILLE — jamais
   inventée. C'est ce qui débloque les formes du sable (prisme/bandes/courbe/
   nuage et beignet/anneau) pour TOUS les KPIs dont la donnée existe. PUR. */

export const FORMES_SERIE = ['prisme3d', 'bandes', 'courbe', 'nuage']
export const FORMES_PARTS = ['beignet', 'anneau3d']

/* ── LA CIBLE d'un KPI (le stepper « objectif » du sable) — SOURCE UNIQUE.
   Un KPI porte sa cible sur def.reglage (mois/%…) ; à défaut, un KPI saisonnier
   dont une forme-série est offerte reçoit le réglage LOCAL au sable (un plancher
   de revenu, $/mois). Centralisé ici pour que la barre-copilote pose EXACTEMENT
   la même cible que la rangée « objectif » — jamais deux règles divergentes. PUR. */
export const FORMES_COMPARABLES = ['prisme3d', 'bandes', 'courbe']
export const REGLAGE_SERIE = { label: 'Ton plancher de revenu', unite: '$/mois', defaut: 3000, min: 500, max: 15000, pas: 250 }
export function reglageCible(kpiId, snapshot, ctx) {
  const def = kpiPourId(kpiId)
  if (!def) return null
  if (def.reglage) return def.reglage
  if (def.domaine === 'saisonnier') {
    const formes = formesPourKPI(kpiId, snapshot, ctx || {})
    if (formes.some((f) => FORMES_COMPARABLES.includes(f) || f === 'nuage')) return REGLAGE_SERIE
  }
  return null
}

/* ── LE STATUT D'UNE CIBLE : la pastille factuelle sur la tuile (« Cible atteinte »
   ou « Cible 3 mois »). VOLONTAIREMENT prudent — on ne la calcule QUE quand
   c'est indiscutable : le KPI porte un réglage avec un `sens` (donc valeur et
   cible partagent l'unité et une direction connue), une cible > 0 est posée, la
   donnée est disponible. Sinon → null (jamais un « atteint/sous » inventé sur un
   KPI dont la cible est une entrée de calcul et non une comparaison). Le texte
   ne juge pas (pas de « en retard / bien géré ») : il énonce un fait. PUR. */
export function statutCible(kpiId, snapshot, cible) {
  const def = kpiPourId(kpiId)
  if (!def || !def.reglage || !def.reglage.sens) return null
  const c = Number(cible)
  if (!Number.isFinite(c) || c <= 0) return null // NaN/Infinity/≤0 (silo corrompu) → rien
  const r = resolveKPI(kpiId, snapshot, { cible: c })
  if (!r || !r.disponible || typeof r.valeur !== 'number' || !Number.isFinite(r.valeur)) return null
  if (r.unite !== def.reglage.unite) return null // valeur et cible DOIVENT partager l'unité
  const atteint = def.reglage.sens === 'haut' ? r.valeur >= c : r.valeur <= c
  const uniteTxt = def.reglage.unite === '%' ? ' %' : ` ${def.reglage.unite}`
  return { atteint, cible: c, unite: def.reglage.unite, texte: atteint ? 'Cible atteinte' : `Cible ${c}${uniteTxt}` }
}

/* ── LE VIVANT : est-ce que ce KPI a BOUGÉ entre deux snapshots (ex. depuis ta
   dernière visite) ? On compare sa VALEUR résolue — jamais un chiffre inventé.
   false si un côté manque (1re visite → aucun repère → rien ne pulse). PUR. */
export function kpiABouge(kpiId, snapAvant, snapApres, ctx = {}) {
  if (!snapAvant || !snapApres || !kpiPourId(kpiId)) return false
  // ctx (les params de la tuile : cible/objectif) est passé aux DEUX résolutions —
  // sans lui, la famille « objectif » (cible dans le ctx) rendrait null des deux
  // côtés et ne pulserait JAMAIS. Même ctx des deux côtés : seul le snapshot change.
  const a = resolveKPI(kpiId, snapAvant, ctx)
  const b = resolveKPI(kpiId, snapApres, ctx)
  if (!a || !b) return false
  if (!!a.disponible !== !!b.disponible) return true // la donnée est apparue / a disparu
  if (!a.disponible) return false
  const estNul = (v) => v == null
  // On ne PULSE que sur une valeur PRIMITIVE finie (nombre/chaîne). Une valeur OBJET
  // (ex. equilibre 50/30/20 = {besoin,envie,epargne}) comparée par référence serait
  // TOUJOURS « différente » (deux instances) = faux positif permanent → on s'abstient.
  const prim = (v) => (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string'
  // Une valeur qui apparaît/disparaît (null ↔ primitive) reste un vrai mouvement.
  if (estNul(a.valeur) !== estNul(b.valeur)) return prim(a.valeur) || prim(b.valeur)
  // Deux valeurs non nulles : on ne compare QUE des primitives (jamais un objet par réf).
  if (!prim(a.valeur) || !prim(b.valeur)) return false
  return a.valeur !== b.valeur
}

/** L'ÉCART FACTUEL d'un KPI entre deux snapshots (la baseline = dernière visite → l'état
 *  actuel). Retourne { delta, unite, sens } ou null. PUR, mêmes gardes que kpiABouge :
 *  seulement des valeurs NUMÉRIQUES finies des DEUX côtés (jamais un objet, jamais une
 *  chaîne, jamais une donnée absente). Un delta est un FAIT, jamais un jugement — le
 *  signe ne dit rien de « bien/mal » (à charge de la vue de ne PAS colorer en ambre). */
export function deltaKPI(kpiId, snapAvant, snapApres, ctx = {}) {
  if (!snapAvant || !snapApres || !kpiPourId(kpiId)) return null
  const a = resolveKPI(kpiId, snapAvant, ctx)
  const b = resolveKPI(kpiId, snapApres, ctx)
  if (!a || !b || !a.disponible || !b.disponible) return null
  const na = a.valeur
  const nb = b.valeur
  if (typeof na !== 'number' || !Number.isFinite(na) || typeof nb !== 'number' || !Number.isFinite(nb)) return null
  const delta = nb - na
  if (delta === 0) return null
  return { delta, unite: b.unite || null, sens: delta > 0 ? 'hausse' : 'baisse' }
}

// ≤ max points, premiers/derniers inclus (les projections longues restent
// lisibles). `ancres` = indices à inclure COÛTE QUE COÛTE (l'année de retraite,
// l'année de rupture) : le fait daté du héros a toujours son point sur la courbe.
function echantillonner(liste, max, ancres = []) {
  if (liste.length <= max) return liste
  const pas = (liste.length - 1) / (max - 1)
  const idx = Array.from({ length: max }, (_, i) => Math.round(i * pas))
  for (const a of ancres) {
    if (!(a > 0 && a < liste.length - 1) || idx.includes(a)) continue
    let meilleur = 1
    let dist = Infinity
    for (let j = 1; j < idx.length - 1; j++) {
      const d = Math.abs(idx[j] - a)
      if (d < dist) { dist = d; meilleur = j }
    }
    idx[meilleur] = a
  }
  return [...new Set(idx)].sort((x, y) => x - y).map((i) => liste[i])
}

/** La série d'un KPI : { titreBase, labels, valeurs, legende, seuil, seuilTexte,
 *  sousTexte } ou null (donnée absente → la forme reste grisée). PUR. */
export function serieDuKPI(kpiId, snapshot, ctx) {
  const def = kpiPourId(kpiId)
  const s = snapshot
  if (!def || !s) return null
  switch (def.domaine) {
    case 'saisonnier': {
      if (!DONNEE_DISPO.saison(s)) return null
      // Pas de titreBase : les blocs gardent leurs titres historiques (« Tes mois
      // en bandes »…) — le rendu saisonnier d'aujourd'hui ne bouge pas d'un pixel.
      return {
        serie: s.saison.revenusMensuels.slice(0, 12).map(num),
        seuil: num(s.saison.depensesMensuelles),
      }
    }
    case 'budget': {
      if (!DONNEE_DISPO.categories(s)) return null
      const cats = s.depenses.parCategorie.filter((c) => num(c.montant) > 0).slice(0, 10)
      if (!cats.length) return null
      return {
        titreBase: 'Tes postes', labels: cats.map((c) => String(c.label || 'Dépense')),
        valeurs: cats.map((c) => num(c.montant)),
        legende: 'Dépenses par catégorie (par mois)', seuil: 0, seuilTexte: '', sousTexte: '',
      }
    }
    case 'coussin': {
      if (!DONNEE_DISPO.coussin(s)) return null
      const depart = num(s.coussin.montant)
      const ajout = num(s.depenses && s.depenses.parClasse && s.depenses.parClasse.epargne)
      if (depart <= 0 && ajout <= 0) return null
      const cible = num(s.coussin.cible3)
      return {
        titreBase: 'Ton coussin',
        labels: Array.from({ length: 12 }, (_, i) => `+${i + 1}`),
        valeurs: Array.from({ length: 12 }, (_, i) => depart + ajout * (i + 1)),
        // l'AFFECTATION de l'épargne au coussin n'est pas une saisie : l'hypothèse
        // est divulguée, jamais attribuée à un « plan » qui n'existe pas.
        legende: ajout > 0 ? `Coussin projeté (si ton épargne de ${formatCAD(ajout)}/mois y allait)` : 'Coussin (aucun ajout mensuel saisi)',
        seuil: cible,
        seuilTexte: cible > 0 ? `cible 3 mois ${formatCAD(cible)}` : '',
        sousTexte: 'sous la cible 3 mois',
      }
    }
    case 'impot': {
      if (!DONNEE_DISPO.fiscalite(s)) return null
      const segs = (s.fiscalite.segments || []).filter((x) => num(x.montant) > 0)
      if (!segs.length) return null
      return {
        titreBase: 'Ton brut', labels: segs.map((x) => String(x.label)),
        valeurs: segs.map((x) => num(x.montant)),
        legende: 'Où va ton brut (par an)', seuil: 0, seuilTexte: '', sousTexte: '',
      }
    }
    case 'patrimoine': {
      if (!DONNEE_DISPO.projection(s)) return null
      const annees = s.projection.annees
      // l'année de retraite (le fait daté du KPI héros) et l'année de rupture
      // sont TOUJOURS dans l'échantillon — la courbe contient ce que la carte dit.
      const ancres = []
      const iRetraite = annees.findIndex((y) => y.age >= num(s.projection.retraiteAge))
      if (iRetraite > 0) ancres.push(iRetraite)
      if (s.projection.ageRupture != null) {
        const iRupture = annees.findIndex((y) => y.age === s.projection.ageRupture)
        if (iRupture > 0) ancres.push(iRupture)
      }
      const pts = echantillonner(annees, 12, ancres)
      const valeurs = pts.map((y) => num(y.patrimoineNet))
      // une hauteur/aire ne sait pas dire un net NÉGATIF (borné à 0 = chiffre
      // inventé) → rétraction propre : formes jamais offertes pour ce profil.
      if (valeurs.some((v) => v < 0)) return null
      return {
        titreBase: 'Ta trajectoire', labels: pts.map((y) => `${y.age} ans`),
        valeurs,
        legende: 'Patrimoine projeté (selon tes hypothèses)', seuil: 0, seuilTexte: '', sousTexte: '',
      }
    }
    case 'objectif': {
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible)
      if (!(cible > 0)) return null
      const g = objG(s, ctx)
      if (!g.actif || !g.objectif) return null
      const deja = num(g.objectif.dejaEpargne)
      // la convention du registre : contribution POSÉE par l'usager → « selon ton
      // plan » ; sinon capacité CALCULÉE → « à ton rythme » (jamais un plan inventé).
      const contrib = num(ctx && ctx.contributionMensuelle)
      const cap = contrib > 0 ? contrib : num(g.noeuds.capaciteEpargne && g.noeuds.capaciteEpargne.valeur)
      if (cap <= 0 && deja <= 0) return null
      return {
        titreBase: 'Ton projet',
        labels: Array.from({ length: 12 }, (_, i) => `+${i + 1}`),
        valeurs: Array.from({ length: 12 }, (_, i) => Math.min(cible, deja + cap * (i + 1))),
        legende: cap > 0 ? `Vers ta cible (${formatCAD(cap)}/mois, ${contrib > 0 ? 'selon ton plan' : 'à ton rythme'})` : 'Vers ta cible',
        seuil: 0, seuilTexte: '', sousTexte: '',
      }
    }
    default:
      return null
  }
}

/** Les parts d'un KPI (beignet / anneau 3D) : un TOUT réel qui se découpe —
 *  même contrat que le beignet ({ parCategorie, total } + titres). PUR. */
export function partsDuKPI(kpiId, snapshot) {
  const def = kpiPourId(kpiId)
  const s = snapshot
  if (!def || !s) return null
  const classes = ['besoin', 'envie', 'epargne'] // le cycle de couleurs existant
  // Cycle de 3 sur n parts : quand n ≡ 1 (mod 3), la DERNIÈRE part hériterait de
  // la couleur de la PREMIÈRE — adjacentes sur l'anneau (il boucle). On remplace
  // alors la dernière par la classe qui ne touche ni la première ni l'avant-dernière.
  const classePour = (i, n) => {
    const c = classes[i % 3]
    if (n > 3 && i === n - 1 && c === classes[0]) {
      return classes.find((x) => x !== classes[0] && x !== classes[(n - 2) % 3]) || c
    }
    return c
  }
  if (def.domaine === 'budget') {
    if (!DONNEE_DISPO.categories(s)) return null
    return { parCategorie: s.depenses.parCategorie, total: num(s.depenses.total) }
  }
  if (def.domaine === 'impot') {
    if (!DONNEE_DISPO.fiscalite(s)) return null
    const bruts = (s.fiscalite.segments || []).filter((x) => num(x.montant) > 0)
    const parts = bruts.map((x, i) => ({ id: `seg_${i}`, label: String(x.label), classe: classePour(i, bruts.length), montant: num(x.montant) }))
    if (!parts.length) return null
    return { parCategorie: parts, total: parts.reduce((a, x) => a + x.montant, 0), titre: 'Où va ton dollar brut', sous: 'La part de chaque poste dans ton brut annuel.', centre: 'par an' }
  }
  if (def.domaine === 'patrimoine') {
    const c = s.patrimoine && s.patrimoine.composition
    if (!c) return null
    const actifs = [
      { id: 'reer', label: 'REER', montant: num(c.reer) },
      { id: 'celi', label: 'CELI', montant: num(c.celi) },
      { id: 'nonenr', label: 'Non enregistré', montant: num(c.nonEnregistre) },
      { id: 'maison', label: 'Maison', montant: num(c.maison) },
    ].filter((x) => x.montant > 0)
    const parts = actifs.map((x, i) => ({ ...x, classe: classePour(i, actifs.length) }))
    if (!parts.length) return null
    return { parCategorie: parts, total: parts.reduce((a, x) => a + x.montant, 0), titre: 'Tes actifs', sous: 'La part de chaque actif dans ton patrimoine.', centre: 'd’actifs' }
  }
  if (def.domaine === 'saisonnier') {
    if (!DONNEE_DISPO.saison(s)) return null
    const mois = s.saison.revenusMensuels
      .map((v, i) => ({ id: `m${i}`, label: MOIS_COURTS[i], montant: num(v) }))
      .filter((x) => x.montant > 0)
    const parts = mois.map((x, i) => ({ ...x, classe: classePour(i, mois.length) }))
    if (!parts.length) return null
    return { parCategorie: parts, total: parts.reduce((a, x) => a + x.montant, 0), titre: 'Ton année, mois par mois', sous: 'La part de chaque mois dans ton revenu annuel.', centre: 'par an' }
  }
  return null
}

/** Les formes OFFERTES pour un KPI : ses blocsCompatibles existants, filtrés par les
 *  données, PLUS les formes du sable que sa famille débloque (série réelle →
 *  prisme/bandes/courbe/nuage ; tout découpable → beignet/anneau). KPI non
 *  résoluble → aucune. `comparaison` : seulement si ≥2 vrais chemins. PUR. */
export function formesPourKPI(kpiId, snapshot, ctx) {
  const def = kpiPourId(kpiId)
  if (!def || !Array.isArray(def.blocsCompatibles)) return []
  if (snapshot !== undefined && snapshot !== null && !resolveKPI(kpiId, snapshot, ctx || {}).disponible) return []
  const comparaisonOk = !!(snapshot && comparaisonScenarios(snapshot, ctx || {}))
  const formes = def.blocsCompatibles.filter((t) => estConnu(t) && (t !== 'comparaison' || comparaisonOk))
  if (snapshot) {
    if (serieDuKPI(kpiId, snapshot, ctx || {})) for (const f of FORMES_SERIE) { if (estConnu(f) && !formes.includes(f)) formes.push(f) }
    if (partsDuKPI(kpiId, snapshot)) for (const f of FORMES_PARTS) { if (estConnu(f) && !formes.includes(f)) formes.push(f) }
  }
  return formes
}

/** La forme ADAPTÉE à la TAILLE de tuile (présentation pure — resolveKPI reste la
 *  seule source de chiffres) : une tuile S rend une forme compacte, une tuile
 *  L/XL une forme large — parmi les formes OFFERTES du KPI. La forme stockée
 *  n'est jamais mutée ; M garde la forme telle quelle. PUR. */
export function formeAdaptee(kpiId, forme, taille, snapshot, ctx) {
  const formes = formesPourKPI(kpiId, snapshot, ctx)
  if (!formes.length) return forme
  const actuelle = formes.includes(forme) ? forme : formes[0]
  const estLarge = (f) => { const c = BLOCS[f]; return !!(c && c.taille === 'large') }
  if (taille === 's' && estLarge(actuelle)) {
    return formes.find((f) => f === 'stat') || formes.find((f) => !estLarge(f)) || actuelle
  }
  if ((taille === 'l' || taille === 'xl') && !estLarge(actuelle)) {
    return formes.find(estLarge) || actuelle
  }
  return actuelle
}

/** La forme à RENDRE pour un KPI : la choisie si offerte, sinon la 1re offerte, sinon
 *  null. Coercition sûre — une forme invalide ne peut jamais atteindre le rendu (miroir
 *  de resoudreSlot, côté KPI). PUR. */
export function resoudreForme(kpiId, formeChoisie, snapshot, ctx) {
  const formes = formesPourKPI(kpiId, snapshot, ctx)
  if (!formes.length) return null
  return formes.includes(formeChoisie) ? formeChoisie : formes[0]
}

/** KPIs d'un domaine dont TOUTES les données requises existent (data-aware). PUR. */
export function candidatsKPI(domaine, snapshot) {
  const s = snapshot || {}
  return REGISTRE_KPIS.filter((k) => k.domaine === domaine && k.requiert.every((r) => DONNEE_DISPO[r] && DONNEE_DISPO[r](s)))
}

/** Résout un KPI. Donnée manquante → état HONNÊTE (valeur null), jamais un chiffre inventé.
 *  id inconnu → null. `texteFactuel` filtré par filtrerFait. PUR. */
export function resolveKPI(id, snapshot, ctx = {}) {
  const kpi = REGISTRE_KPIS.find((k) => k.id === id)
  if (!kpi) return null
  const s = snapshot || {}
  const dispo = kpi.requiert.every((r) => DONNEE_DISPO[r] && DONNEE_DISPO[r](s))
  if (!dispo) return { id, domaine: kpi.domaine, valeur: null, unite: null, texteFactuel: '', disponible: false }
  let out
  try { out = kpi.resolve(s, ctx) || {} } catch { out = {} }
  const f = filtrerFait(String(out.texteFactuel || ''))
  return {
    id, domaine: kpi.domaine,
    valeur: out.valeur === undefined ? null : out.valeur,
    unite: out.unite || null,
    texteFactuel: f.ok && f.texte ? f.texte : '',
    disponible: true,
  }
}
