/* ============================================================================
   check-bibliotheque-kpis.mjs — LE REGISTRE DE KPIs, sans navigateur. Prouve :
     - chaque KPI proposable résout vers une valeur cohérente (snapshot riche) ;
     - candidatsKPI se RÉTRACTE quand la donnée manque (riche > pauvre > vide=∅) ;
     - un KPI dont `requiert` manque n'est jamais proposé NI résolu en chiffre inventé ;
     - chaque texteFactuel passe filtrerFait (un jugement serait rejeté) ;
     - chaque blocsCompatibles ne nomme que des blocs EXISTANTS ;
     - resolveKPI sur un id inconnu → null.
   Lance : node scripts/check-bibliotheque-kpis.mjs
   ========================================================================== */
import { REGISTRE_KPIS, candidatsKPI, resolveKPI } from '../src/recettes/bibliotheque-kpis.js'
import { estConnu, filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

const ctx = { objectif: { nom: 'Maison', cible: 20000 }, moisCible: 24 }
const richSnap = {
  depenses: { revenu: 4000, coutVie: 2755, total: 2955, reste: 1045, parClasse: { besoin: 2190, envie: 565, epargne: 200 }, engageLibre: { fixe: 1000, variable: 1755 }, parCategorie: [{ id: 'a', label: 'Logement', classe: 'besoin', montant: 1100 }, { id: 'b', label: 'Épicerie', classe: 'besoin', montant: 600 }], pct: { besoin: 55, envie: 14, epargne: 5 } },
  coussin: { montant: 5000, essentielles: 2000, moisCouverts: 2.5, zone: 'orange', cible3: 6000, cible6: 12000 },
  saison: { revenusMensuels: [1000, 1000, 1000, 8000, 8000, 8000, 8000, 8000, 1000, 1000, 1000, 1000], depensesMensuelles: 3000, coussin: 5000 },
  fiscalite: { brut: 65000, federal: 8000, quebec: 9000, cotisations: 4000, net: 44000, tauxEffectif: 32, jourLiberation: 117, segments: [] },
  patrimoine: { net: 50000, actifs: 100000, passifs: 50000, composition: { reer: 40000, celi: 20000, nonEnregistre: 0, maison: 0, hypotheque: 0, autresDettes: 0 } },
  projection: { annees: [{ age: 34, patrimoineNet: 50000 }, { age: 65, patrimoineNet: 300000 }], retraiteAge: 65, ageRupture: null },
}

const DOMAINES = ['objectif', 'budget', 'coussin', 'saisonnier', 'impot', 'patrimoine', 'dette']

console.log('— Chaque KPI PROPOSABLE résout vers une valeur cohérente (snapshot riche) —')
let toutesOk = true
for (const k of REGISTRE_KPIS) {
  const proposable = candidatsKPI(k.domaine, richSnap).some((x) => x.id === k.id)
  const r = resolveKPI(k.id, richSnap, ctx)
  if (proposable) {
    const coherent = r && r.disponible === true && r.valeur !== null && r.valeur !== undefined && filtrerFait(r.texteFactuel).ok
    if (!coherent) { toutesOk = false; console.log(`      ✗ ${k.id} (proposable mais valeur/texte incohérent)`) }
  } else {
    // Donnée manquante → jamais un chiffre inventé.
    if (r && r.valeur !== null) { toutesOk = false; console.log(`      ✗ ${k.id} (non proposable mais valeur inventée: ${r.valeur})`) }
  }
}
const nbProposables = REGISTRE_KPIS.filter((k) => candidatsKPI(k.domaine, richSnap).some((x) => x.id === k.id)).length
ok(toutesOk, `les ${nbProposables} KPIs proposables résolvent (valeur + texte factuel), 0 chiffre inventé pour les autres`)

console.log('\n— candidatsKPI se RÉTRACTE quand la donnée manque —')
for (const d of DOMAINES) {
  const riche = candidatsKPI(d, richSnap).length
  const vide = candidatsKPI(d, {}).length
  console.log(`      ${d.padEnd(11)} riche: ${riche}   vide: ${vide}`)
  ok(vide === 0, `${d} : snapshot vide → aucun KPI proposé (jamais d’erreur)`)
}
ok(candidatsKPI('budget', { coussin: { montant: 1 } }).length === 0, 'budget sans depenses → 0 (la donnée d’un autre domaine ne compte pas)')
ok(candidatsKPI('coussin', richSnap).length > candidatsKPI('coussin', { depenses: richSnap.depenses }).length, 'coussin : riche > (depenses seules) → rétraction graduée')

console.log('\n— Domaines 🟡 : jamais proposés tant que la saisie n’existe pas —')
ok(candidatsKPI('dette', richSnap).length === 0, 'dette → 0 même sur snapshot riche (pas de saisie par-dette)')
const rDette = resolveKPI('mois_jusqu_liberation', richSnap, ctx)
ok(rDette && rDette.disponible === false && rDette.valeur === null, 'resolveKPI(dette) → honnête (valeur null), pas de chiffre inventé')

console.log('\n— Conformité + intégrité —')
ok(REGISTRE_KPIS.every((k) => k.blocsCompatibles.every((t) => estConnu(t))), 'chaque blocsCompatibles ne nomme que des blocs EXISTANTS')
ok(REGISTRE_KPIS.every((k) => { const r = resolveKPI(k.id, richSnap, ctx); return !r || filtrerFait(r.texteFactuel).ok }), 'chaque texteFactuel passe filtrerFait (faits seulement)')
ok(filtrerFait('Tu devrais réduire tes dépenses.').ok === false, 'preuve : un texte jugeant SERAIT rejeté')
ok(resolveKPI('kpi_inexistant', richSnap, ctx) === null, 'resolveKPI(id inconnu) → null propre')

console.log('\n— Échantillon de KPIs résolus (riche) —')
for (const id of ['horizon_objectif', 'solde_mois', 'mois_couverts', 'amplitude_revenus', 'taux_effectif', 'valeur_nette']) {
  const r = resolveKPI(id, richSnap, ctx)
  console.log(`      ${id.padEnd(20)} → ${r.valeur} ${r.unite || ''}  · "${r.texteFactuel}"`)
}

console.log('\n' + (fail === 0 ? '✅ Le registre de KPIs tient — 0 échec (la marchandise est prouvée)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
