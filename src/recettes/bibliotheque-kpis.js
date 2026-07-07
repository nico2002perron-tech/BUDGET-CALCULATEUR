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
import { filtrerFait, estConnu } from './schema.js'
import { formatCAD, formatPct } from '../lib/format.js'
import { genererScenarios } from '../lib/scenarios.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}
const mois1 = (m) => (m == null ? '—' : Number(m).toFixed(1).replace('.', ','))

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
    resolve: (s, ctx) => {
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible); const deja = num(s.coussin && s.coussin.montant)
      const pct = cible > 0 ? Math.min(100, Math.round((deja / cible) * 100)) : null
      return { valeur: pct, unite: '%', texteFactuel: pct == null ? '' : `Tu es à ${pct} % de ta cible.` }
    },
  },
  {
    id: 'restant_a_combler', domaine: 'objectif', question: 'Combien il me manque ?',
    requiert: ['coussin'], blocsCompatibles: ['stat', 'barre_progression'],
    resolve: (s, ctx) => {
      const cible = num(ctx && ctx.objectif && ctx.objectif.cible); const deja = num(s.coussin && s.coussin.montant)
      const restant = cible > 0 ? Math.max(0, cible - deja) : null
      return { valeur: restant, unite: '$', texteFactuel: restant == null ? '' : `Il te reste ${formatCAD(restant)} à réunir.` }
    },
  },
  {
    id: 'contribution_requise', domaine: 'objectif', question: 'Combien par mois pour ma date ?',
    requiert: ['coussin'], blocsCompatibles: ['stat', 'fait'],
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
    resolve: (s, ctx) => {
      const g = objG(s, ctx); const h = g.objectif ? g.objectif.horizonMois : null
      return { valeur: h, unite: 'mois', texteFactuel: h === 0 ? 'Ta cible est déjà atteinte.' : h == null ? 'À ton rythme actuel, ta cible n’avance pas.' : `À ton rythme, tu y serais dans ${h} mois.` }
    },
  },

  // ── 2. Budget / flux mensuel ──────────────────────────────────────────────
  {
    id: 'solde_mois', domaine: 'budget', question: 'Il me reste quoi ?',
    requiert: ['depenses'], blocsCompatibles: ['solde', 'stat'],
    resolve: (s) => { const v = num(s.depenses.reste); return { valeur: v, unite: '$', texteFactuel: v >= 0 ? `Il te reste ${formatCAD(v)} après tes dépenses.` : `Tes dépenses dépassent ton revenu de ${formatCAD(Math.abs(v))}.` } },
  },
  {
    id: 'taux_epargne', domaine: 'budget', question: 'Quelle part je mets de côté ?',
    requiert: ['depenses'], blocsCompatibles: ['jauge', 'stat', 'repartition'],
    // réglable : TA cible d'épargne (ctx.cible, en %) — choisie par l'usager, jamais imposée
    reglage: { label: 'Ta cible', unite: '%', defaut: 10, min: 1, max: 50, pas: 1 },
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
    requiert: ['depenses'], blocsCompatibles: ['repartition', 'beignet'],
    resolve: (s) => { const p = s.depenses.pct; if (!p) return { valeur: null, unite: '%', texteFactuel: '' }; return { valeur: p, unite: '%', texteFactuel: `Tes parts : ${p.besoin} % besoins, ${p.envie} % désirs, ${p.epargne} % épargne.` } },
  },
  {
    id: 'engage_vs_libre', domaine: 'budget', question: 'Combien part tout seul chaque mois ?',
    requiert: ['depenses'], blocsCompatibles: ['barre_empilee', 'jauge'],
    resolve: (s) => { const el = s.depenses.engageLibre || {}; const fixe = num(el.fixe); const variable = num(el.variable); const tot = fixe + variable; const pct = tot > 0 ? Math.round((fixe / tot) * 100) : null; return { valeur: pct, unite: '%', texteFactuel: pct == null ? '' : `${pct} % de tes dépenses sont fixes (déjà engagées).` } },
  },
  {
    id: 'cout_vie_mensuel', domaine: 'budget', question: 'Ça me coûte combien de vivre ?',
    requiert: ['depenses'], blocsCompatibles: ['stat', 'anatomie_dollar'],
    resolve: (s) => { const v = num(s.depenses.coutVie); return { valeur: v, unite: '$', texteFactuel: `Vivre te coûte ${formatCAD(v)} par mois.` } },
  },
  {
    id: 'top_categorie', domaine: 'budget', question: 'Qu’est-ce qui pèse le plus ?',
    requiert: ['categories'], blocsCompatibles: ['beignet', 'liste', 'fait'],
    resolve: (s) => { const cats = [...s.depenses.parCategorie].sort((a, b) => num(b.montant) - num(a.montant)); const top = cats[0]; return { valeur: num(top.montant), unite: '$', texteFactuel: `Ta plus grosse catégorie : ${top.label || 'Dépense'}, à ${formatCAD(top.montant)}.` } },
  },
  {
    id: 'jours_de_repit', domaine: 'budget', question: 'Mon surplus couvre combien de jours ?',
    requiert: ['depenses'], blocsCompatibles: ['stat', 'fait'],
    resolve: (s) => { const reste = num(s.depenses.reste); const cv = num(s.depenses.coutVie); if (reste <= 0) return { valeur: 0, unite: 'jours', texteFactuel: 'Pas de surplus à reporter ce mois-ci.' }; const j = cv > 0 ? Math.round(reste / (cv / 30)) : null; return { valeur: j, unite: 'jours', texteFactuel: j == null ? '' : `Ton surplus couvre ${j} jours de dépenses.` } },
  },

  // ── 3. Coussin / sécurité ─────────────────────────────────────────────────
  {
    id: 'mois_couverts', domaine: 'coussin', question: 'Mon coussin tient combien de mois ?',
    requiert: ['coussin'], blocsCompatibles: ['jauge', 'coussin_urgence'],
    reglage: { label: 'Ta cible', unite: 'mois', defaut: 3, min: 1, max: 12, pas: 1 },
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
    resolve: (s) => { const v = num(s.coussin.montant); return { valeur: v, unite: '$', texteFactuel: `Tu as ${formatCAD(v)} de côté.` } },
  },
  {
    id: 'ecart_3_6_mois', domaine: 'coussin', question: 'Combien pour atteindre ma cible ?',
    requiert: ['coussin'], blocsCompatibles: ['barre_progression', 'fait'],
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
    resolve: (s) => { const ep = num(s.depenses.parClasse && s.depenses.parClasse.epargne); return { valeur: ep, unite: '$/mois', texteFactuel: ep > 0 ? `Tu ajoutes ${formatCAD(ep)} par mois à ton épargne.` : 'Aucune épargne mensuelle saisie pour l’instant.' } },
  },

  // ── 4. Revenus variables (saisonnier) ─────────────────────────────────────
  {
    id: 'amplitude_revenus', domaine: 'saisonnier', question: 'Mes revenus varient de combien ?',
    requiert: ['saison'], blocsCompatibles: ['flux_annuel', 'prisme3d', 'bandes', 'courbe', 'nuage', 'stat'],
    resolve: (s) => { const r = s.saison.revenusMensuels; const mn = Math.min(...r); const mx = Math.max(...r); return { valeur: mx - mn, unite: '$', texteFactuel: `Tes revenus varient de ${formatCAD(mn)} à ${formatCAD(mx)} selon les mois.` } },
  },
  {
    id: 'mois_sous_seuil', domaine: 'saisonnier', question: 'Combien de mois dans le rouge ?',
    requiert: ['saison'], blocsCompatibles: ['flux_annuel', 'prisme3d', 'bandes', 'courbe', 'nuage', 'fait'],
    resolve: (s) => { const dep = num(s.saison.depensesMensuelles); const n = s.saison.revenusMensuels.filter((x) => num(x) < dep).length; return { valeur: n, unite: 'mois', texteFactuel: `${n} mois passent sous ton coût de vie.` } },
  },
  {
    id: 'manque_saison_creuse', domaine: 'saisonnier', question: 'Combien mettre de côté pour l’hiver ?',
    requiert: ['saison'], blocsCompatibles: ['stat', 'jauge', 'fait'],
    resolve: (s) => { const dep = num(s.saison.depensesMensuelles); const somme = s.saison.revenusMensuels.reduce((a, x) => a + Math.max(0, dep - num(x)), 0); return { valeur: somme, unite: '$', texteFactuel: `Tes mois creux puisent ≈ ${formatCAD(somme)} sur l’année.` } },
  },
  {
    id: 'mois_le_plus_serre', domaine: 'saisonnier', question: 'Mon pire mois ?',
    requiert: ['saison'], blocsCompatibles: ['fait', 'stat'],
    resolve: (s) => { const dep = num(s.saison.depensesMensuelles); const nets = s.saison.revenusMensuels.map((x) => num(x) - dep); const minNet = Math.min(...nets); return { valeur: minNet, unite: '$', texteFactuel: `Ton mois le plus serré finit à ${formatCAD(minNet)} après tes dépenses.` } },
  },
  {
    id: 'revenu_lisse', domaine: 'saisonnier', question: 'Étalé sur l’année, ça fait combien par mois ?',
    requiert: ['saison'], blocsCompatibles: ['stat', 'flux_annuel', 'prisme3d', 'bandes', 'courbe', 'nuage'],
    resolve: (s) => { const r = s.saison.revenusMensuels; const moy = Math.round(r.reduce((a, x) => a + num(x), 0) / 12); return { valeur: moy, unite: '$/mois', texteFactuel: `Lissé sur l’année, ça ferait ${formatCAD(moy)} par mois.` } },
  },

  // ── 7. Impôt / revenu brut ────────────────────────────────────────────────
  {
    id: 'taux_effectif', domaine: 'impot', question: 'Quel % d’impôt je paie vraiment ?',
    requiert: ['fiscalite'], blocsCompatibles: ['impot_palier', 'stat'],
    resolve: (s) => { const v = num(s.fiscalite.tauxEffectif); return { valeur: v, unite: '%', texteFactuel: `Ton taux d’imposition effectif est de ${formatPct(v)}.` } },
  },
  {
    id: 'jour_liberation_fiscale', domaine: 'impot', question: 'À partir de quand je travaille pour moi ?',
    requiert: ['fiscalite'], blocsCompatibles: ['impot_palier', 'fait'],
    resolve: (s) => { const j = num(s.fiscalite.jourLiberation); return { valeur: j, unite: 'jour', texteFactuel: `Tu cesses de payer l’impôt au jour ${j} de l’année.` } },
  },
  {
    id: 'revenu_net_mensuel', domaine: 'impot', question: 'Il me reste quoi net ?',
    requiert: ['fiscalite'], blocsCompatibles: ['stat', 'anatomie_dollar'],
    resolve: (s) => { const v = Math.round(num(s.fiscalite.net) / 12); return { valeur: v, unite: '$/mois', texteFactuel: `Net, il te reste ${formatCAD(v)} par mois.` } },
  },
  {
    id: 'anatomie_brut', domaine: 'impot', question: 'Où va chaque dollar gagné ?',
    requiert: ['fiscalite'], blocsCompatibles: ['anatomie_dollar', 'beignet'],
    resolve: (s) => { const b = num(s.fiscalite.brut); return { valeur: b, unite: '$', texteFactuel: `Sur ${formatCAD(b)} brut, voici où va chaque dollar.` } },
  },
  {
    id: 'poids_cotisations', domaine: 'impot', question: 'RRQ/AE/RQAP me prennent combien ?',
    requiert: ['fiscalite'], blocsCompatibles: ['stat', 'fait'],
    resolve: (s) => { const v = num(s.fiscalite.cotisations); return { valeur: v, unite: '$', texteFactuel: `Tes cotisations (RRQ, AE, RQAP) totalisent ${formatCAD(v)} sur l’année.` } },
  },

  // ── 8. Patrimoine & retraite ──────────────────────────────────────────────
  {
    id: 'valeur_nette', domaine: 'patrimoine', question: 'Je vaux combien, net ?',
    requiert: ['patrimoine'], blocsCompatibles: ['composition', 'stat'],
    resolve: (s) => { const v = num(s.patrimoine.net); return { valeur: v, unite: '$', texteFactuel: `Ta valeur nette est de ${formatCAD(v)}.` } },
  },
  {
    id: 'ratio_actifs_passifs', domaine: 'patrimoine', question: 'Mes dettes pèsent combien face à mes avoirs ?',
    requiert: ['patrimoine'], blocsCompatibles: ['composition', 'jauge'],
    resolve: (s) => { const a = num(s.patrimoine.actifs); const p = num(s.patrimoine.passifs); const ratio = p > 0 ? a / p : null; return { valeur: ratio, unite: 'x', texteFactuel: p > 0 ? `Tu as ${ratio.toFixed(1).replace('.', ',')} $ d’actif pour 1 $ de dette.` : 'Tu n’as aucune dette enregistrée.' } },
  },
  {
    id: 'trajectoire_patrimoine', domaine: 'patrimoine', question: 'Ça évolue comment ?',
    requiert: ['projection'], blocsCompatibles: ['patrimoine_vie', 'stat'],
    resolve: (s) => { const a = s.projection.annees; const fin = a[a.length - 1]; return { valeur: num(fin.patrimoineNet), unite: '$', texteFactuel: `Projeté, ton patrimoine atteint ${formatCAD(fin.patrimoineNet)} à ${fin.age} ans.` } },
  },
  {
    id: 'patrimoine_retraite', domaine: 'patrimoine', question: 'J’aurai combien à la retraite ?',
    requiert: ['projection'], blocsCompatibles: ['patrimoine_vie', 'stat'],
    resolve: (s) => { const age = num(s.projection.retraiteAge); const at = s.projection.annees.find((y) => y.age >= age) || s.projection.annees[s.projection.annees.length - 1]; return { valeur: num(at.patrimoineNet), unite: '$', texteFactuel: `À ${age} ans, ton patrimoine projeté est de ${formatCAD(at.patrimoineNet)}.` } },
  },

  // ── 5. Dette (🟡 — domaine de saisie à brancher) : déclarés mais JAMAIS proposés
  //    tant que `s.dettes` n'existe pas → démontre la rétraction data-aware.
  {
    id: 'mois_jusqu_liberation', domaine: 'dette', question: 'Dans combien de temps c’est payé ?',
    requiert: ['dettesDetaillees'], blocsCompatibles: ['chronologie', 'chaine'],
    resolve: () => ({ valeur: null, unite: 'mois', texteFactuel: '' }),
  },
  {
    id: 'pct_rembourse', domaine: 'dette', question: 'J’ai remboursé combien ?',
    requiert: ['dettesDetaillees'], blocsCompatibles: ['barre_progression', 'jauge'],
    resolve: () => ({ valeur: null, unite: '%', texteFactuel: '' }),
  },
]

/** Le KPI d'un id, ou null. Sert au moteur à valider une recette {KPI, forme}. PUR. */
export function kpiPourId(id) {
  return REGISTRE_KPIS.find((k) => k.id === id) || null
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
  prisme3d: '3D prisme', bandes: 'Bandes', courbe: 'Courbe', nuage: 'Nuage',
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

/** Les formes OFFERTES pour un KPI : ses blocsCompatibles existants, filtrés par les
 *  données. KPI non résoluble → aucune. `comparaison` n'est offert que si le tuyau
 *  scénarios rend ≥2 chemins distincts (data-aware — note #1 résolue par la DONNÉE, pas
 *  à la main : il s'allume parce qu'il a deux vraies valeurs). PUR. */
export function formesPourKPI(kpiId, snapshot, ctx) {
  const def = kpiPourId(kpiId)
  if (!def || !Array.isArray(def.blocsCompatibles)) return []
  if (snapshot !== undefined && snapshot !== null && !resolveKPI(kpiId, snapshot, ctx || {}).disponible) return []
  const comparaisonOk = !!(snapshot && comparaisonScenarios(snapshot, ctx || {}))
  return def.blocsCompatibles.filter((t) => estConnu(t) && (t !== 'comparaison' || comparaisonOk))
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
