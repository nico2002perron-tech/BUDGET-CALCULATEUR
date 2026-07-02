/* ============================================================================
   MoteurRendu.jsx — le moteur de rendu DATA-DRIVEN (REGISTRE-BLOCS.md §3).

   Reçoit une recette + le snapshot. Pour chaque bloc :
     1. (recette validée par schema.js : params bornés, faits filtrés)
     2. trouve le composant via le REGISTRE ; type inconnu = ignoré PROPREMENT.
     3. résout les DONNÉES depuis le SNAPSHOT (schema BLOCS[type].resolve),
        jamais depuis la recette.
     4. place le bloc selon sa `taille` : `large` → colonne principale,
        `compacte` → colonne de droite (agencement géré par la tour).

   Mise en scène (prop `anime`) : à la COMPOSITION (chat / entretien), la vue se
   CONSTRUIT pièce par pièce — les blocs sont MONTÉS un par un (stagger), donc leurs
   animations internes (compteur du stat, arc de la jauge, barres du flux) se
   déclenchent à LEUR apparition, pas avant. `anime` défaut false → tout d'un coup
   (reload, calendrier…). `prefers-reduced-motion` → aucun stagger, tout instantané.
   Le contrat recette→registre→snapshot est inchangé.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { validerRecette, BLOCS, resoudreSlot } from './schema.js'
import { composantPour } from './registre.js'
import { resolveKPI, kpiPourId, comparaisonScenarios } from './bibliotheque-kpis.js'

// Anti-redondance d'une vue : jamais DEUX fois la même métrique. On déduplique sur la
// CLÉ (l'id du KPI s'il y en a un, sinon le type) + le groupe métrique (le coussin via
// jauge/stat/coussin_urgence → un seul). On garde le 1er rencontré.
const GROUPE_METRIQUE = { jauge: 'coussin', stat: 'coussin', coussin_urgence: 'coussin' }
function dedupeBlocs(blocs) {
  const cles = new Set()
  const groupes = new Set()
  return blocs.filter((b) => {
    if (!b) return false
    const cle = b.kpi || b.type
    if (cles.has(cle)) return false
    // Un bloc KPI est une métrique NOMMÉE (déjà dédoublonnée par sa clé) → on ne le range
    // pas dans un groupe métrique générique (ex. coussin), sinon une forme stat d'un KPI
    // entrerait en collision avec coussin_urgence.
    const g = b.kpi ? null : GROUPE_METRIQUE[b.type]
    if (g && groupes.has(g)) return false
    cles.add(cle)
    if (g) groupes.add(g)
    return true
  })
}

function prefersReduce() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function MoteurRendu({ recette, snapshot, anime = false }) {
  const r = validerRecette(recette)
  // Un emplacement à CANDIDATS → on rend le bloc `choisi` (repli sûr si invalide ; un
  // `choisi` inconnu ne peut jamais atteindre le rendu). Puis : seuls les types CONNUS,
  // et on enlève les redondances → chaque bloc apporte une info DIFFÉRENTE.
  const effectifs = r.blocs
    .map((b) => {
      if (b && b.slot === 'graphique') {
        const type = resoudreSlot(b, snapshot)
        return type ? { type, params: {} } : null
      }
      // Emplacement KPI : la recette nomme {KPI, forme}. Le moteur résout la FORME
      // (∈ blocsCompatibles, repli sûr sur le 1er sinon) ; le KPI inconnu est ignoré.
      // Le bloc-forme reçoit la valeur résolue (kpi), il ne recalcule jamais la métrique.
      if (b && b.KPI) {
        const def = kpiPourId(b.KPI)
        if (!def || !Array.isArray(def.blocsCompatibles) || def.blocsCompatibles.length === 0) return null
        const forme = def.blocsCompatibles.includes(b.forme) ? b.forme : def.blocsCompatibles[0]
        return composantPour(forme) ? { type: forme, params: b.params || {}, kpi: b.KPI } : null
      }
      return composantPour(b.type) ? b : null
    })
    .filter(Boolean)
  const blocs = dedupeBlocs(effectifs)
  const total = blocs.length

  const sequence = anime && !prefersReduce()
  // Reveal : on MONTE les blocs un par un (≈170 ms d'écart, après un court délai pour
  // laisser le titre apparaître). Sans séquence → tous montés d'emblée.
  const [revele, setRevele] = useState(sequence ? 0 : total)
  useEffect(() => {
    if (!sequence) { setRevele(total); return }
    setRevele(0) // (re)part de zéro → les blocs se posent un par un
    let annule = false
    const timers = []
    for (let i = 0; i < total; i++) {
      timers.push(setTimeout(() => { if (!annule) setRevele((c) => Math.max(c, i + 1)) }, 220 + i * 170))
    }
    return () => { annule = true; timers.forEach(clearTimeout) }
  }, [sequence, total])

  // La grille (1 ou 2 colonnes) se décide sur la recette ENTIÈRE → pas de saut de mise
  // en page pendant que la colonne de droite se remplit.
  const aSide = blocs.some((b) => { const c = BLOCS[b.type]; return c && c.taille === 'compacte' })
  const mains = []
  const sides = []
  blocs.forEach((bloc, i) => {
    if (i >= revele) return // pas encore son tour → pas monté (ses anims internes attendent)
    const cfg = BLOCS[bloc.type]
    // resolve(snapshot, params) : les MONTANTS viennent du snapshot ; certains blocs
    // lisent aussi une INTENTION dans les params (ex. chaine → l'objectif choisi).
    const data = cfg && typeof cfg.resolve === 'function' ? cfg.resolve(snapshot, bloc.params) : {}
    // Emplacement KPI : la métrique est résolue par la bibliothèque (pas de double
    // source) ; le bloc-forme l'affiche via sa prop `kpi`. Donnée absente → resolveKPI
    // rend un état honnête (valeur null), jamais un chiffre inventé.
    //  • comparaison → DEUX résolutions du MÊME KPI (un ctx par côté : avant/après, A/B) ;
    //  • toute autre forme → UNE résolution.
    let kpi = null
    if (bloc.kpi) {
      if (bloc.type === 'comparaison') {
        const base = bloc.params || {}
        // ctxA/ctxB explicites (recette authored) sinon AUTO-DÉRIVÉS des scénarios de
        // l'objectif (le tuyau scenarios.js → comparaison). Chaque côté reste un resolveKPI.
        let ctxA = base.ctxA, ctxB = base.ctxB, etiquetteA = base.etiquetteA, etiquetteB = base.etiquetteB
        if (!ctxA || !ctxB) {
          const d = comparaisonScenarios(snapshot, base)
          if (d) { ctxA = d.ctxA; ctxB = d.ctxB; etiquetteA = etiquetteA || d.etiquetteA; etiquetteB = etiquetteB || d.etiquetteB }
        }
        const a = resolveKPI(bloc.kpi, snapshot, { ...base, ...(ctxA || {}) })
        const b = resolveKPI(bloc.kpi, snapshot, { ...base, ...(ctxB || {}) })
        kpi = { a, b, etiquetteA, etiquetteB }
      } else {
        kpi = resolveKPI(bloc.kpi, snapshot, bloc.params)
      }
    }
    const Composant = composantPour(bloc.type)
    const el = (
      <div className={sequence ? 'bloc-reveal' : undefined} key={i}>
        <Composant params={bloc.params} data={data} kpi={kpi} />
      </div>
    )
    if (cfg && cfg.taille === 'compacte') sides.push(el)
    else mains.push(el)
  })

  if (!aSide) return <div className="grid-main">{mains}</div>
  // Que des blocs compacts (ex. un seul KPI) → pas de grille à moitié vide :
  // une colonne bornée, le bloc respire au centre.
  if (mains.length === 0) return <div className="grid-solo">{sides}</div>
  return (
    <div className="grid">
      <div className="grid-main">{mains}</div>
      <div className="grid-side">{sides}</div>
    </div>
  )
}
