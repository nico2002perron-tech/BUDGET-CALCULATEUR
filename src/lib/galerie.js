/* ============================================================================
   galerie.js — LE CERVEAU de la Galerie (« créer ses outils comme dans Canva »).
   Dérive, depuis le snapshot, les CARTES de création :
     - TABLEAUX : les vues complètes (situations du composer) ;
     - INDICATEURS : chaque KPI du registre, en carte VIVANTE (sa question + ta
       vraie valeur, résolue par resolveKPI) ou GIVRÉE (sa condition d'allumage
       + où aller saisir la donnée).

   DISCIPLINE :
   - PUR : zéro React/DOM, testable headless (scripts/check-galerie.mjs).
   - UNE SEULE SOURCE DE VÉRITÉ : REGISTRE_KPIS + resolveKPI + DONNEE_DISPO —
     jamais de valeur recalculée à la main, jamais de faux chiffre (§10).
   - CONFORMITÉ (§11) : questions/faits du registre (déjà filtrés) ; les
     conditions d'allumage passent filtrerFait.
   ========================================================================== */
import { REGISTRE_KPIS, DONNEE_DISPO, resolveKPI } from '../recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../recettes/schema.js'

// La couleur VIVE de chaque catégorie (issue de la palette des entités — pas
// d'ambre : il reste réservé à l'exception, VISION §12).
export const DOMAINES = [
  { id: 'budget', label: 'Budget', accent: '#00b4d8' },
  { id: 'coussin', label: 'Coussin', accent: '#0f8a5f' },
  { id: 'saisonnier', label: 'Saison', accent: '#7a6fe6' },
  { id: 'impot', label: 'Impôts', accent: '#b5179e' },
  { id: 'patrimoine', label: 'Patrimoine', accent: '#3d3a8c' },
]
const ACCENT = Object.fromEntries(DOMAINES.map((d) => [d.id, d.accent]))

// Chaque donnée requise → comment on en parle + où elle se saisit.
const REQUIERT_INFO = {
  capacite: { label: 'tes revenus', sousSection: 'revenus' },
  depenses: { label: 'tes dépenses', sousSection: 'depenses' },
  categories: { label: 'tes dépenses', sousSection: 'depenses' },
  coussin: { label: 'ton coussin', sousSection: 'revenus' },
  saison: { label: 'tes revenus de saison', sousSection: 'revenus' },
  fiscalite: { label: 'ta paie (le brut)', sousSection: 'revenus' },
  patrimoine: { label: 'tes avoirs et tes dettes', sousSection: 'placements' },
  projection: { label: 'ton âge et tes avoirs', sousSection: 'placements' },
}

function fait(texte) {
  const f = filtrerFait(texte)
  return f.ok && f.texte ? f.texte : ''
}

// La condition d'allumage d'un KPI givré : sa PREMIÈRE donnée manquante.
function conditionGivre(def, snapshot) {
  const s = snapshot || {}
  const manquant = (def.requiert || []).find((r) => !(DONNEE_DISPO[r] && DONNEE_DISPO[r](s)))
  const info = REQUIERT_INFO[manquant] || { label: 'tes données', sousSection: 'revenus' }
  return { condition: fait(`S’allume avec ${info.label}.`), sousSection: info.sousSection, manque: info.label }
}

// Les TABLEAUX : les vues complètes que le composer sait bâtir sans entretien.
const TABLEAUX = [
  {
    situation: 'mon_budget', titre: 'Où va mon argent ce mois-ci', accent: '#00b4d8',
    sous: 'Le portrait complet de ton mois : catégories, engagé vs libre, solde.',
    dispo: (s) => !!(s && s.depenses), requiert: 'depenses',
  },
  {
    situation: 'mon_portrait', titre: 'Mon revenu décortiqué', accent: '#b5179e',
    sous: 'Du brut au net : impôts, cotisations, et ce qui tombe dans ton compte.',
    dispo: (s) => !!(s && s.fiscalite && s.fiscalite.brut > 0), requiert: 'fiscalite',
  },
  {
    situation: 'ma_vie', titre: 'Ma vie financière', accent: '#3d3a8c',
    sous: 'Ta valeur nette, sa trajectoire, et le « et si » qui la fait bouger.',
    dispo: (s) => !!(s && s.patrimoine), requiert: 'patrimoine',
  },
  {
    situation: 'revenu_saisonnier', titre: 'Ma saison à revenus variables', accent: '#7a6fe6',
    sous: 'Ton année mois par mois, et ton coussin qui porte les mois creux.',
    dispo: (s) => DONNEE_DISPO.saison(s || {}), requiert: 'saison',
  },
]

/**
 * Les cartes de la Galerie, dérivées du snapshot. PUR.
 * @returns {{
 *   tableaux: Array<{situation,titre,sous,accent,pret:boolean,condition?,sousSection?}>,
 *   indicateurs: Array<{id,domaine,accent,question,pret:boolean,
 *                       valeur?,unite?,texteFactuel?,condition?,sousSection?}>,
 *   totaux: {prets:number, aAllumer:number}
 * }}
 */
export function construireGalerie(snapshot) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {}

  const tableaux = TABLEAUX.map((t) => {
    if (t.dispo(s)) return { situation: t.situation, titre: t.titre, sous: t.sous, accent: t.accent, pret: true }
    const info = REQUIERT_INFO[t.requiert]
    return {
      situation: t.situation, titre: t.titre, sous: t.sous, accent: t.accent, pret: false,
      condition: fait(`S’allume avec ${info.label}.`), sousSection: info.sousSection, manque: info.label,
    }
  })

  const indicateurs = []
  for (const d of DOMAINES) {
    for (const def of REGISTRE_KPIS.filter((k) => k.domaine === d.id)) {
      const r = resolveKPI(def.id, s)
      if (r && r.disponible) {
        indicateurs.push({
          id: def.id, domaine: d.id, accent: ACCENT[d.id], question: def.question,
          pret: true, valeur: r.valeur, unite: r.unite, texteFactuel: r.texteFactuel,
          reglage: def.reglage || null, // la cible personnelle (si le KPI en supporte une)
        })
      } else {
        indicateurs.push({
          id: def.id, domaine: d.id, accent: ACCENT[d.id], question: def.question,
          pret: false, ...conditionGivre(def, s),
        })
      }
    }
  }

  const prets = tableaux.filter((t) => t.pret).length + indicateurs.filter((i) => i.pret).length
  return {
    tableaux,
    indicateurs,
    totaux: { prets, aAllumer: tableaux.length + indicateurs.length - prets },
  }
}

// L'accent des situations du composer (Pour toi + tableaux — même palette vive).
export const ACCENT_SITUATION = {
  mon_budget: '#00b4d8',
  mon_portrait: '#b5179e',
  ma_vie: '#3d3a8c',
  revenu_saisonnier: '#7a6fe6',
}

/** Le tiroir « À allumer » : les cartes givrées REGROUPÉES par donnée manquante —
 *  « 7 outils s'allument avec tes revenus » : UNE action débloque un paquet. PUR. */
export function groupesAAllumer(galerie) {
  if (!galerie) return []
  const givrees = [
    ...(galerie.tableaux || []).filter((t) => !t.pret),
    ...(galerie.indicateurs || []).filter((k) => !k.pret),
  ]
  const map = new Map()
  for (const c of givrees) {
    const cle = `${c.manque}|${c.sousSection}`
    const g = map.get(cle) || { manque: c.manque || 'tes données', sousSection: c.sousSection || 'revenus', n: 0 }
    g.n++
    map.set(cle, g)
  }
  return [...map.values()].sort((a, b) => b.n - a.n)
}
