/* ============================================================================
   perches.js — LES PERCHES du copilote : des suggestions TAPPABLES qui règlent
   le « syndrome de la page blanche ». Au lieu d'une barre vide, la tour tend
   2-3 perches DATA-AWARE (« Compare à ta moyenne », « Ajoute ton coussin »,
   « C'est quoi ton plus gros poste ? ») — on tape, ça s'exécute, on a COMPRIS
   par l'exemple qu'on pouvait le demander. Chaque perche = un label + des
   ACTIONS (le vocabulaire fermé de actions.js) : zéro IA, instantané, hors ligne.

   HONNÊTE par construction : on ne garde une perche que si ses actions
   PRODUISENT vraiment un changement (dry-run executerActions → faites) — jamais
   une perche qui ne ferait rien ou serait refusée. Labels filtrés (conformité).
   PUR : zéro React/DOM, testable headless (scripts/check-perches.mjs).
   ========================================================================== */
import { executerActions } from './actions.js'
import { kpiPourId, formesPourKPI, reglageCible, FORMES_COMPARABLES } from './bibliotheque-kpis.js'
import { filtrerFait } from './schema.js'
import { PALETTE_ACCENTS } from '../lib/entites.js'

const MAX_PERCHES = 3
const NOM_COULEUR = { cyan: 'cyan', ocean: 'océan', indigo: 'indigo', vert: 'vert', lavande: 'lavande', magenta: 'magenta' }

/* ── L'ENSEIGNEMENT PROGRESSIF : chaque action appartient à un GESTE (une
   capacité). La tour souffle le prochain geste que tu n'as pas encore utilisé
   (Duolingo : on ne réenseigne pas ce qu'on sait). PUR. */
const GESTE = {
  ajouter_comparateur: 'comparer', retirer_comparateur: 'comparer',
  changer_forme: 'forme', poser_cible: 'cible', retirer_cible: 'cible',
  changer_couleur: 'couleur', renommer: 'nom', changer_icone: 'icone',
  creer_widget: 'creer', repondre_kpi: 'repondre', retirer_widget: 'retirer',
  redimensionner: 'taille', ouvrir_sable: 'ouvrir',
}
/** Les gestes (capacités) DISTINCTS d'une salve d'actions — pour marquer l'appris. PUR. */
export function gestesDe(actions) {
  const out = []
  for (const a of Array.isArray(actions) ? actions : []) {
    const g = a && GESTE[a.verbe]
    if (g && !out.includes(g)) out.push(g)
  }
  return out
}
/** La PROCHAINE perche à enseigner : la 1re dont le geste n'est pas encore
 *  appris. `appris` = liste/Set des gestes déjà utilisés. null si tout est su. PUR. */
export function prochainePerche(perches, appris) {
  const su = appris instanceof Set ? appris : new Set(Array.isArray(appris) ? appris : [])
  return (Array.isArray(perches) ? perches : []).find((p) => { const g = GESTE[p.actions[0] && p.actions[0].verbe]; return g && !su.has(g) }) || null
}

// Ne garde que les perches dont TOUTES les actions aboutissent (dry-run) ET dont
// le label passe filtrerFait. L'ordre des candidats = la priorité. PUR.
function valider(candidats, ctx, etat) {
  const out = []
  for (const c of candidats) {
    if (out.length >= MAX_PERCHES) break
    if (!c || !Array.isArray(c.actions) || !c.actions.length) continue
    let ok = false
    try { ok = executerActions(c.actions, ctx, etat).faites.length === c.actions.length } catch { ok = false }
    if (!ok) continue
    const f = filtrerFait(c.label)
    if (!f.ok || !f.texte) continue
    out.push({ label: f.texte, actions: c.actions })
  }
  return out
}

/* ── LES PERCHES DU SABLE : sur la scène d'un KPI. « comparer / voir autrement /
   poser une cible / colorer » — priorité au geste le plus parlant. ── */
export function perchesSable(etatScene, widget, snapshot) {
  const s = etatScene || {}
  const def = kpiPourId(s.kpiId)
  if (!def) return []
  const ctx = { snapshot }
  const etat = { widgets: widget ? [widget] : [], sable: s } // sable + tuile (pour couleur)
  const ctxFormes = { objectif: s.objectif, comparaisons: s.comparaisons }
  const formes = formesPourKPI(s.kpiId, snapshot, ctxFormes)
  const cands = []
  const reglage = reglageCible(s.kpiId, snapshot, ctxFormes)
  const accent = widget && widget.accent
  const coul = PALETTE_ACCENTS.find((c) => c.hex !== accent) || PALETTE_ACCENTS[0]

  // La comparaison ne s'AFFICHE que sur une forme-série comparable (miroir du
  // gate de CarreDeSable) : sur un nuage/beignet, ajouter un repère serait un
  // « Fait » sans effet visible. On ne l'offre donc que si la forme le porte.
  const comparable = def.domaine === 'saisonnier' && FORMES_COMPARABLES.includes(s.forme)
  // Priorité à la VARIÉTÉ des gestes (comparer · voir autrement · cible · colorer) :
  // 3 perches diverses enseignent plus que 3 variantes du même geste.
  // 1) Comparer (le geste « Athena », saison + forme comparable).
  if (comparable) cands.push({ label: 'Compare à ta moyenne', actions: [{ verbe: 'ajouter_comparateur', contexte: 'moyenne' }] })
  // 2) Voir autrement — la forme spectaculaire pas encore à l'écran.
  if (s.forme !== 'prisme3d' && formes.includes('prisme3d')) cands.push({ label: 'Vois-le en relief', actions: [{ verbe: 'changer_forme', forme: 'prisme3d' }] })
  else if (s.forme !== 'courbe' && formes.includes('courbe')) cands.push({ label: 'En courbe', actions: [{ verbe: 'changer_forme', forme: 'courbe' }] })
  // 3) Poser une cible (si le KPI en supporte une et qu'aucune n'est posée).
  if (reglage && !(s.cible > 0)) cands.push({ label: 'Pose une cible', actions: [{ verbe: 'poser_cible', valeur: reglage.defaut }] })
  // 4) Colorer (une couleur DIFFÉRENTE de l'accent courant — enseigne « en vert »).
  cands.push({ label: `Mets-le en ${NOM_COULEUR[coul.id] || coul.id}`, actions: [{ verbe: 'changer_couleur', couleur: coul.id }] })
  // 5) Un 2e comparateur en dernier recours (si de la place reste, forme comparable).
  if (comparable) cands.push({ label: 'Ajoute ton coût de vie', actions: [{ verbe: 'ajouter_comparateur', contexte: 'cout_vie' }] })

  return valider(cands, ctx, etat)
}

/* ── LES PERCHES DU BOARD : des DÉPARTS chaleureux (créer / répondre) parmi un
   choix curé, seulement ceux que les données allument ET pas déjà dans la tour.
   « répondre = construire » : une question pose la tuile qui répond. ── */
const DEPART_BOARD = [
  { kpi: 'mois_couverts', label: 'Ajoute ton coussin', mode: 'creer' },
  { kpi: 'top_categorie', label: 'C’est quoi ton plus gros poste ?', mode: 'repondre' },
  { kpi: 'solde_mois', label: 'Il me reste quoi ce mois-ci ?', mode: 'repondre' },
  { kpi: 'taux_effectif', label: 'Suis tes impôts', mode: 'creer' },
  { kpi: 'amplitude_revenus', label: 'Mes revenus varient de combien ?', mode: 'creer' },
  { kpi: 'valeur_nette', label: 'Je vaux combien, net ?', mode: 'repondre' },
]
export function perchesBoard(widgets, snapshot) {
  const ctx = { snapshot }
  const etat = { widgets: Array.isArray(widgets) ? widgets : [], sable: null }
  const cands = DEPART_BOARD.map((d) => ({
    label: d.label,
    actions: [{ verbe: d.mode === 'repondre' ? 'repondre_kpi' : 'creer_widget', kpi: d.kpi }],
  }))
  return valider(cands, ctx, etat)
}

/* Les exemples qui TOURNENT dans le placeholder (neutres, filtrés). */
export const PLACEHOLDERS_SABLE = [
  'ex. « en courbe »',
  'ex. « compare à ma moyenne »',
  'ex. « mets une cible de 4 000 »',
  'ex. « en vert »',
]
export const PLACEHOLDERS_BOARD = [
  'ex. « ajoute mon coussin »',
  'ex. « c’est quoi mon plus gros poste ? »',
  'ex. « suis mes impôts »',
  'ex. « il me reste quoi ce mois-ci ? »',
]
