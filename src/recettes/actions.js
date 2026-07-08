/* ============================================================================
   actions.js — LE REGISTRE D'ACTIONS de la barre-copilote « Demande à ta tour ».

   Le pari « Athena » sans le risque : la barre agit — mais l'IA ne fait que
   CHOISIR des actions dans ce vocabulaire FERMÉ ; ici, tout est déterministe.
   Chaque verbe :
     • se VALIDE contre les registres RÉELS (formesPourKPI, resoudreComparaisons,
       reglageCible, DONNEE_DISPO…) → une action impossible est REFUSÉE avec sa
       raison honnête (un fait filtré), JAMAIS exécutée à moitié ;
     • s'APPLIQUE sur un état ABSTRAIT (immutable, sérialisable) ; l'exécuteur
       enchaîne une salve → { etat, faites, refusees }.
   Rien n'est irréversible : l'appelant garde l'état-AVANT sur une pile → Annuler.

   L'ÉTAT (etat) :
     {
       widgets: [ tuile… ],            // le board (store.tourWidgets)
       sable: null | {                 // un widget ouvert dans le carré de sable
         widgetId, kpiId, forme,
         comparaisons: [{contexte,label}],  cible: number|null,
       },
     }
   Les verbes forme/comparaisons/cible éditent la SCÈNE (etat.sable) — local
   jusqu'à `epingler`, comme le sable réel. couleur/titre/icône éditent la TUILE
   tout de suite (accent / recette.titre / icône). creer/retirer/redimensionner/
   ouvrir_sable pilotent le board.

   ctx : { snapshot, nouvelId? } — snapshot = source des chiffres (jamais inventés) ;
   nouvelId() = fabrique d'id (défaut = compteur déterministe → testable).
   TOUT est PUR (aucun React, aucun DOM, aucun réseau, aucune horloge implicite).
   ========================================================================== */
import {
  kpiPourId, resolveKPI, formesPourKPI, resoudreForme, reglageCible,
  nomForme, REGISTRE_KPIS,
} from './bibliotheque-kpis.js'
import { resoudreComparaisons, CONTEXTES_COMPARAISON, TAILLES_WIDGET, filtrerFait } from './schema.js'
import { formatCAD } from '../lib/format.js'
import { ICONES_IDS } from '../lib/icones-ids.js'
import { PALETTE_ACCENTS, accentValide } from '../lib/entites.js'
import { DOMAINES } from '../lib/galerie.js'

const ACCENT_DOMAINE = Object.fromEntries(DOMAINES.map((d) => [d.id, d.accent]))
const ACCENT_ID = new Set(PALETTE_ACCENTS.map((a) => a.id))
const HEX = /^#[0-9a-f]{6}$/i

function num(v) { const n = Number(v); return isFinite(n) ? n : NaN }

/** Tout texte rendu à l'usager (raison de refus, résumé du « Fait ») passe par
 *  le filtre de conformité — un fait, jamais un jugement. Rejeté → repli neutre. */
function fait(txt, repli = '') {
  const f = filtrerFait(String(txt || ''))
  return f.ok && f.texte ? f.texte : repli
}

// Un refus / un succès normalisés.
const refus = (raison) => ({ ok: false, raison: fait(raison, 'Action impossible.') })
const ok = () => ({ ok: true })

// ── Ciblage : la tuile visée par une édition (couleur/titre/icône/retirer…).
//    `action.cible` explicite (barre du board), sinon la tuile du sable ouvert.
function idCible(action, etat) {
  if (action && typeof action.cible === 'string') return action.cible
  if (etat.sable && etat.sable.widgetId) return etat.sable.widgetId
  return null
}
function widgetPar(etat, id) {
  return (etat.widgets || []).find((w) => w && w.id === id) || null
}
function heroKPI(widget) {
  const blocs = widget && widget.recette && Array.isArray(widget.recette.blocs) ? widget.recette.blocs : []
  return blocs.find((b) => b && b.KPI) || null
}

// Le ctx de résolution d'une scène = ses INTENTIONS (objectif + comparaisons) —
// pour que formesPourKPI/reglageCible offrent EXACTEMENT ce que le sable offre
// (un KPI de projet garde ses formes qui dépendent de l'objectif). Miroir du
// `kb.params` passé partout par CarreDeSable.
function ctxScene(sable) {
  return {
    objectif: sable && sable.objectif ? sable.objectif : undefined,
    comparaisons: sable ? sable.comparaisons : undefined,
  }
}

// ── Mises à jour IMMUTABLES (aucune mutation de `etat`).
function majTuile(etat, id, fn) {
  return { ...etat, widgets: (etat.widgets || []).map((w) => (w && w.id === id ? fn(w) : w)) }
}
function majSable(etat, patch) {
  return { ...etat, sable: { ...etat.sable, ...patch } }
}

/* ── LE REGISTRE : chaque verbe = { scope, valider, appliquer, resume }.
   scope 'sable' exige une scène ouverte ; 'board' agit sur les tuiles ;
   'tuile' édite une tuile (sable ou board selon la cible). */
export const ACTIONS = {
  // 1 — ajouter un repère de comparaison (scène saisonnière)
  ajouter_comparateur: {
    scope: 'sable',
    valider(a, etat, ctx) {
      if (!etat.sable) return refus('Ouvre d’abord une vue.')
      const def = kpiPourId(etat.sable.kpiId)
      if (!def || def.domaine !== 'saisonnier') return refus('Cette vue ne porte pas de comparaison.')
      if (!a || !CONTEXTES_COMPARAISON.includes(a.contexte)) return refus('Ce repère n’existe pas.')
      if ((etat.sable.comparaisons || []).some((c) => c.contexte === a.contexte)) return refus('C’est déjà comparé.')
      if ((etat.sable.comparaisons || []).length >= 3) return refus('Trois repères au maximum.')
      // DATA-AWARE : le repère doit VRAIMENT se résoudre (« l'an passé » attend l'historique).
      if (resoudreComparaisons(ctx.snapshot, [{ contexte: a.contexte }]).length === 0) {
        return refus(a.contexte === 'an_passe' ? 'L’an passé s’allume avec ton historique.' : 'Ce repère n’a pas de donnée à montrer.')
      }
      return ok()
    },
    appliquer(a, etat, ctx) {
      const [r] = resoudreComparaisons(ctx.snapshot, [{ contexte: a.contexte }])
      return majSable(etat, { comparaisons: [...(etat.sable.comparaisons || []), { contexte: a.contexte, label: r.label }] })
    },
    resume(a, etat, ctx) {
      const [r] = resoudreComparaisons(ctx.snapshot, [{ contexte: a.contexte }]) || []
      return `Repère « ${(r && r.label) || a.contexte} » ajouté`
    },
  },

  // 2 — retirer un repère
  retirer_comparateur: {
    scope: 'sable',
    valider(a, etat) {
      if (!etat.sable) return refus('Ouvre d’abord une vue.')
      if (!(etat.sable.comparaisons || []).some((c) => c.contexte === (a && a.contexte))) return refus('Ce repère n’est pas là.')
      return ok()
    },
    appliquer(a, etat) {
      return majSable(etat, { comparaisons: (etat.sable.comparaisons || []).filter((c) => c.contexte !== a.contexte) })
    },
    resume() { return 'Repère retiré' },
  },

  // 3 — poser une cible (le stepper « objectif »)
  poser_cible: {
    scope: 'sable',
    valider(a, etat, ctx) {
      if (!etat.sable) return refus('Ouvre d’abord une vue.')
      const reglage = reglageCible(etat.sable.kpiId, ctx.snapshot, ctxScene(etat.sable))
      if (!reglage) return refus('Cette vue n’a pas de cible à poser.')
      if (isNaN(num(a && a.valeur))) return refus('Donne un nombre pour la cible.')
      return ok()
    },
    appliquer(a, etat, ctx) {
      const reglage = reglageCible(etat.sable.kpiId, ctx.snapshot, ctxScene(etat.sable))
      const v = Math.min(reglage.max, Math.max(reglage.min, num(a.valeur)))
      return majSable(etat, { cible: v })
    },
    resume(a, etat, ctx) {
      const reglage = reglageCible(etat.sable.kpiId, ctx.snapshot, ctxScene(etat.sable))
      const v = Math.min(reglage.max, Math.max(reglage.min, num(a.valeur)))
      return `Cible posée à ${valeurCible(v, reglage.unite)}`
    },
  },

  // 4 — retirer la cible
  retirer_cible: {
    scope: 'sable',
    valider(a, etat) {
      if (!etat.sable) return refus('Ouvre d’abord une vue.')
      if (etat.sable.cible == null) return refus('Aucune cible à retirer.')
      return ok()
    },
    appliquer(a, etat) { return majSable(etat, { cible: null }) },
    resume() { return 'Cible retirée' },
  },

  // 5 — changer la forme (parmi celles OFFERTES pour ce KPI)
  changer_forme: {
    scope: 'sable',
    valider(a, etat, ctx) {
      if (!etat.sable) return refus('Ouvre d’abord une vue.')
      const formes = formesPourKPI(etat.sable.kpiId, ctx.snapshot, ctxScene(etat.sable))
      if (!a || !formes.includes(a.forme)) return refus('Cette forme n’est pas offerte ici.')
      return ok()
    },
    appliquer(a, etat) { return majSable(etat, { forme: a.forme }) },
    resume(a) { return `Forme : ${nomForme(a.forme)}` },
  },

  // 6 — changer la couleur d'une tuile (scène ou board)
  changer_couleur: {
    scope: 'tuile',
    valider(a, etat) {
      const id = idCible(a, etat)
      if (!id || !widgetPar(etat, id)) return refus('Je ne vois pas quelle tuile colorer.')
      const hex = couleurHex(a && a.couleur)
      if (!hex) return refus('Cette couleur n’est pas dans la palette.')
      return ok()
    },
    appliquer(a, etat) {
      return majTuile(etat, idCible(a, etat), (w) => ({ ...w, accent: couleurHex(a.couleur) }))
    },
    resume() { return 'Couleur mise à jour' },
  },

  // 7 — renommer une tuile
  renommer: {
    scope: 'tuile',
    valider(a, etat) {
      const id = idCible(a, etat)
      if (!id || !widgetPar(etat, id)) return refus('Je ne vois pas quelle tuile renommer.')
      if (!a || typeof a.titre !== 'string') return refus('Donne un nom en texte.')
      if (!fait(a.titre).trim()) return refus('Ce nom n’est pas accepté.')
      return ok()
    },
    appliquer(a, etat) {
      // espaces normalisés (l'IA peut renvoyer des sauts de ligne) + borné à 60.
      const titre = fait(a.titre).replace(/\s+/g, ' ').trim().slice(0, 60)
      return majTuile(etat, idCible(a, etat), (w) => (w.recette ? { ...w, recette: { ...w.recette, titre } } : w))
    },
    resume(a) { return `Renommé « ${fait(a.titre).replace(/\s+/g, ' ').trim().slice(0, 40)} »` },
  },

  // 8 — changer l'icône d'une tuile
  changer_icone: {
    scope: 'tuile',
    valider(a, etat) {
      const id = idCible(a, etat)
      if (!id || !widgetPar(etat, id)) return refus('Je ne vois pas quelle tuile changer.')
      if (!a || !ICONES_IDS.includes(a.icone)) return refus('Cette icône n’existe pas.')
      return ok()
    },
    appliquer(a, etat) { return majTuile(etat, idCible(a, etat), (w) => ({ ...w, icone: a.icone })) },
    resume() { return 'Icône changée' },
  },

  // 9 — créer une tuile pour un KPI (« ajoute mon coussin »)
  creer_widget: {
    scope: 'board',
    valider(a, etat, ctx) {
      const def = kpiPourId(a && a.kpi)
      if (!def) return refus('Cet indicateur n’existe pas.')
      const r = resolveKPI(a.kpi, ctx.snapshot)
      if (!r || !r.disponible) return refus(conditionKPI(def))
      if (!resoudreForme(a.kpi, null, ctx.snapshot)) return refus('Cet indicateur n’a rien à montrer encore.')
      if ((etat.widgets || []).some((w) => w.recette && w.recette.situation === `kpi_${a.kpi}`)) return refus('Tu as déjà cette vue dans ta tour.')
      return ok()
    },
    appliquer(a, etat, ctx) {
      const def = kpiPourId(a.kpi)
      const forme = resoudreForme(a.kpi, a.forme || null, ctx.snapshot)
      const recette = { situation: `kpi_${a.kpi}`, titre: def.question, blocs: [{ KPI: a.kpi, forme, params: {} }] }
      const w = { id: nouvelId(ctx, etat), recette, accent: ACCENT_DOMAINE[def.domaine] || null, icone: null, nouveau: true }
      return { ...etat, widgets: [...(etat.widgets || []), w] }
    },
    resume(a) { const def = kpiPourId(a.kpi); return `Vue ajoutée : ${def ? def.question : 'indicateur'}` },
  },

  // 10 — retirer une tuile
  retirer_widget: {
    scope: 'board',
    valider(a, etat) {
      if (!a || !widgetPar(etat, a.cible)) return refus('Cette tuile n’est pas dans ta tour.')
      return ok()
    },
    appliquer(a, etat) {
      const s = etat.sable && etat.sable.widgetId === a.cible ? null : etat.sable
      return { ...etat, sable: s, widgets: (etat.widgets || []).filter((w) => w.id !== a.cible) }
    },
    resume() { return 'Tuile retirée' },
  },

  // 11 — redimensionner une tuile
  redimensionner: {
    scope: 'board',
    valider(a, etat) {
      if (!a || !widgetPar(etat, a.cible)) return refus('Cette tuile n’est pas dans ta tour.')
      if (!TAILLES_WIDGET.includes(a.taille)) return refus('Cette taille n’existe pas.')
      return ok()
    },
    appliquer(a, etat) { return majTuile(etat, a.cible, (w) => ({ ...w, taille: a.taille })) },
    resume(a) { return `Taille : ${a.taille.toUpperCase()}` },
  },

  // 12 — épingler la scène du sable sur sa tuile (la boucle se referme)
  epingler: {
    scope: 'sable',
    valider(a, etat) {
      if (!etat.sable || !etat.sable.forme) return refus('Ouvre d’abord une vue.')
      if (!widgetPar(etat, etat.sable.widgetId)) return refus('Cette tuile n’existe plus.')
      return ok()
    },
    appliquer(a, etat) {
      const s = etat.sable
      return majTuile(etat, s.widgetId, (w) => {
        if (!w.recette || !Array.isArray(w.recette.blocs)) return w
        // params PAR bloc, SEMÉS depuis b.params (miroir de CarreDeSable) : on
        // PRÉSERVE tout param de base (ex. params.objectif d'un KPI de projet) et
        // on ne touche QUE comparaisons/cible (retirées dans le sable → delete).
        const blocs = w.recette.blocs.map((b) => {
          if (!(b && b.KPI)) return b
          const params = { ...(b.params || {}) }
          if ((s.comparaisons || []).length) params.comparaisons = s.comparaisons
          else delete params.comparaisons
          if (s.cible != null && s.cible > 0) params.cible = s.cible
          else delete params.cible
          return { ...b, forme: s.forme, params }
        })
        return { ...w, recette: { ...w.recette, blocs }, epingle: true }
      })
    },
    resume() { return 'Épinglée à ta tour' },
  },

  // 13 — ouvrir le carré de sable sur une tuile (navigation)
  ouvrir_sable: {
    scope: 'board',
    valider(a, etat) {
      const w = widgetPar(etat, a && a.cible)
      if (!w) return refus('Cette tuile n’est pas dans ta tour.')
      if (!heroKPI(w)) return refus('Cette tuile ne s’ouvre pas dans le sable.')
      return ok()
    },
    appliquer(a, etat, ctx) {
      const w = widgetPar(etat, a.cible)
      const kb = heroKPI(w)
      const params = kb.params || {}
      // On CAPTURE l'objectif de la tuile dans la scène : ses formes en dépendent
      // (un KPI de projet). resoudreForme reçoit ces intentions (parité sandbox).
      const objectif = params.objectif && Number(params.objectif.cible) > 0 ? params.objectif : null
      const comparaisons = Array.isArray(params.comparaisons) ? params.comparaisons : []
      return {
        ...etat,
        sable: {
          widgetId: w.id,
          kpiId: kb.KPI,
          forme: resoudreForme(kb.KPI, kb.forme || null, ctx.snapshot, { objectif: objectif || undefined, comparaisons }),
          comparaisons,
          cible: isFinite(Number(params.cible)) && Number(params.cible) > 0 ? Number(params.cible) : null,
          objectif,
        },
      }
    },
    resume() { return 'Vue ouverte' },
  },

  // 14 — répondre à une question par une tuile-réponse (répondre = construire)
  repondre_kpi: {
    scope: 'board',
    valider(a, etat, ctx) {
      const def = kpiPourId(a && a.kpi)
      if (!def) return refus('Je n’ai pas d’indicateur pour cette question.')
      const r = resolveKPI(a.kpi, ctx.snapshot)
      if (!r || !r.disponible || !r.texteFactuel) return refus(conditionKPI(def))
      if ((etat.widgets || []).some((w) => w.recette && w.recette.situation === `kpi_${a.kpi}`)) return refus('Cette réponse est déjà dans ta tour.')
      return ok()
    },
    appliquer(a, etat, ctx) {
      const def = kpiPourId(a.kpi)
      const forme = resoudreForme(a.kpi, a.forme || null, ctx.snapshot)
      const recette = { situation: `kpi_${a.kpi}`, titre: def.question, blocs: [{ KPI: a.kpi, forme, params: {} }] }
      const w = { id: nouvelId(ctx, etat), recette, accent: ACCENT_DOMAINE[def.domaine] || null, icone: null, nouveau: true }
      return { ...etat, widgets: [...(etat.widgets || []), w] }
    },
    resume(a, etat, ctx) {
      const r = resolveKPI(a.kpi, ctx.snapshot)
      return fait(r && r.texteFactuel, 'Voici ta réponse')
    },
  },
}

export const VERBES = Object.keys(ACTIONS)

/* ── L'EXÉCUTEUR : enchaîne une salve. Chaque action est validée contre l'état
   COURANT (donc « en courbe puis compare » voit déjà la nouvelle forme). Une
   action refusée n'altère RIEN. L'état d'entrée n'est jamais muté (→ Annuler =
   restaurer la référence d'avant). PUR. */
export function executerActions(actions, ctx = {}, etatInitial = {}) {
  const base = { widgets: Array.isArray(etatInitial.widgets) ? etatInitial.widgets : [], sable: etatInitial.sable || null }
  let cur = base
  const faites = []
  const refusees = []
  const liste = Array.isArray(actions) ? actions : []
  for (const a of liste) {
    // hasOwnProperty.call (comme estConnu/resoudreComparaisons) : un verbe nommé
    // comme une clé de la chaîne de prototype (constructor, toString, __proto__)
    // ne récupère JAMAIS une fonction d'Object → aucune exception sur du JSON hostile.
    const def = a && typeof a.verbe === 'string' && Object.prototype.hasOwnProperty.call(ACTIONS, a.verbe) ? ACTIONS[a.verbe] : null
    if (!def) { refusees.push({ action: a, raison: 'Commande inconnue.' }); continue }
    const v = def.valider(a, cur, ctx)
    if (!v.ok) { refusees.push({ action: a, raison: v.raison }); continue }
    const resume = fait(def.resume(a, cur, ctx), 'Fait')
    cur = def.appliquer(a, cur, ctx)
    faites.push({ verbe: a.verbe, resume })
  }
  return { etat: cur, faites, refusees }
}

/** Le texte de la chip « Fait · … » (un fait, filtré). PUR. */
export function resumeActions(faites) {
  const t = (faites || []).map((f) => f.resume).filter(Boolean).join(' · ')
  return fait(t)
}

// ── Fabrique d'id UNIQUE : ctx.nouvelId() si fourni (App : `w_` + horloge) ET
//    non déjà pris — sinon un compteur DÉTERMINISTE. Garantit l'unicité même si
//    deux creer_widget d'une même salve tombent sur la même horloge (Date.now).
function nouvelId(ctx, etat) {
  const pris = new Set((etat.widgets || []).map((w) => w && w.id))
  const propose = ctx && typeof ctx.nouvelId === 'function' ? ctx.nouvelId() : null
  if (propose && !pris.has(propose)) return propose
  let n = (etat.widgets || []).length + 1
  let id = `w_new_${n}`
  while (pris.has(id)) { n += 1; id = `w_new_${n}` }
  return id
}

// ── Une couleur = un id de palette OU un hex direct (#rrggbb). Sinon null.
function couleurHex(c) {
  if (typeof c !== 'string') return null
  if (ACCENT_ID.has(c)) return accentValide(c)
  return HEX.test(c) ? c : null
}

// ── Le montant d'une cible, dans son unité ($/mois, mois, %).
function valeurCible(v, unite) {
  if (typeof unite === 'string' && unite.startsWith('$')) return `${formatCAD(v)}${unite.slice(1)}`
  return `${v} ${unite || ''}`.trim()
}

// ── La condition honnête d'un KPI indisponible (« s'allume avec … »).
const NOM_DONNEE = {
  capacite: 'ton revenu et tes dépenses', coussin: 'ton coussin', depenses: 'tes dépenses',
  categories: 'tes catégories de dépenses', saison: 'tes revenus de saison', fiscalite: 'ta paie (le brut)',
  patrimoine: 'ton patrimoine', projection: 'tes hypothèses de patrimoine',
  dettesDetaillees: 'tes dettes', comptesEnregistres: 'tes comptes',
}
function conditionKPI(def) {
  const manque = (def.requiert || []).map((r) => NOM_DONNEE[r]).filter(Boolean)
  return manque.length ? `Cet indicateur s’allume avec ${manque[0]}.` : 'Cet indicateur n’a pas encore de donnée.'
}

// Réexport pratique pour A2/A3 (payload forme-seulement : verbes + KPIs offerts).
export { REGISTRE_KPIS }
