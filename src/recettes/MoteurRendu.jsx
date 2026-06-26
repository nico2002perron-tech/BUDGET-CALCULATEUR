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

// Anti-redondance d'une vue : jamais DEUX blocs du même type, ni le même CHIFFRE deux
// fois (le coussin via jauge/stat/coussin_urgence → un seul). On garde le 1er rencontré.
const GROUPE_METRIQUE = { jauge: 'coussin', stat: 'coussin', coussin_urgence: 'coussin' }
function dedupeBlocs(blocs) {
  const types = new Set()
  const groupes = new Set()
  return blocs.filter((b) => {
    if (!b || types.has(b.type)) return false
    const g = GROUPE_METRIQUE[b.type]
    if (g && groupes.has(g)) return false
    types.add(b.type)
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
    const Composant = composantPour(bloc.type)
    const el = (
      <div className={sequence ? 'bloc-reveal' : undefined} key={i}>
        <Composant params={bloc.params} data={data} />
      </div>
    )
    if (cfg && cfg.taille === 'compacte') sides.push(el)
    else mains.push(el)
  })

  if (!aSide) return <div className="grid-main">{mains}</div>
  return (
    <div className="grid">
      <div className="grid-main">{mains}</div>
      <div className="grid-side">{sides}</div>
    </div>
  )
}
