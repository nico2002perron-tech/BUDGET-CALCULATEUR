/* ============================================================================
   vue-objectif.js — L'ADVISOR, VERSION CONFORME. Zeta/Athena transforme un but en
   PLAN (du conseil). Ici, JAMAIS : un but → une VUE COMPOSÉE de FAITS. Une même
   cible (ex. « Maison, 20 000 $ ») déploie le tableau complet du projet — où tu en
   es, ce qu'il te manque, combien par mois, si c'est réaliste À TON RYTHME, quand.

   Ce sont les KPI de domaine 'objectif' (déjà conformes : filtrerFait, « à ton
   rythme » / « selon ton plan », jamais « tu devrais »). On ne compose que ceux
   qui RÉSOLVENT vraiment (data-aware) ; aucun fait inventé, aucun jugement. PUR.
   ========================================================================== */
import { resolveKPI, kpiPourId } from './bibliotheque-kpis.js'

// Les faits qui composent le tableau d'un projet. L'ordre = la lecture naturelle
// (où j'en suis → ce qu'il manque → l'effort → le réalisme → la date). Le HÉROS
// déjà posé (souvent horizon_objectif) est exclu par l'appelant.
const KPIS_VUE = ['pct_atteint', 'restant_a_combler', 'contribution_requise', 'ecart_capacite', 'date_atteinte_projetee']

/** Compose la VUE d'un objectif : la liste des recettes-faits résolubles pour cette
 *  cible. `exclureKpi` = le héros déjà sur la tour (pas de doublon). [] si la cible
 *  est absente/nulle ou si rien ne résout (honnête). PUR. */
export function composerVueObjectif(objectif, snapshot, exclureKpi) {
  const cible = objectif && Number(objectif.cible)
  if (!(cible > 0) || !snapshot) return []
  const out = []
  for (const id of KPIS_VUE) {
    if (id === exclureKpi) continue
    const def = kpiPourId(id)
    if (!def || !Array.isArray(def.blocsCompatibles) || !def.blocsCompatibles.length) continue
    const r = resolveKPI(id, snapshot, { objectif })
    // data-aware : on ne pose un fait que s'il EXISTE (valeur chiffrée ou constat texte).
    if (!r || !r.disponible || (typeof r.valeur !== 'number' && !(r.texteFactuel && r.texteFactuel.trim()))) continue
    out.push({
      situation: `vueobj_${id}_${objectif.id || 'projet'}`,
      titre: def.question,
      blocs: [{ KPI: id, forme: def.blocsCompatibles[0], params: { objectif } }],
    })
  }
  return out
}
