/* ============================================================================
   check-statut.mjs — LA PASTILLE DE STATUT (statutCible), pure et PRUDENTE.
   Headless (node) : on ne calcule un statut QUE pour un KPI dont le réglage a un
   `sens` (valeur et cible de même unité, direction connue) ET une cible posée >0
   ET la donnée dispo. Tous les autres cas → null (jamais un « atteint/sous »
   inventé sur une cible qui est une entrée de calcul). Textes filtrés (conformité).
   ========================================================================== */
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore, DEMO_SAISONNIER } from '../src/lib/storage.js'
import { statutCible, resolveKPI } from '../src/recettes/bibliotheque-kpis.js'
import { filtrerFait } from '../src/recettes/schema.js'

let echecs = 0
function ok(cond, label, detail) {
  if (cond) console.log(`  ✓ ${label}`)
  else { echecs++; console.log(`  ✗ ${label}${detail ? `\n      → ${detail}` : ''}`) }
}

const snap = snapshotFromStore(exempleStore())
const snapSaison = snapshotFromStore(DEMO_SAISONNIER)

console.log('— STATUT : seulement les KPI à cible SÛRE (réglage.sens), sinon null —')
{
  // mois_couverts : valeur et cible en 'mois', plus haut = atteint
  const vM = resolveKPI('mois_couverts', snap).valeur
  ok(typeof vM === 'number', `mois_couverts a une valeur numérique (${vM})`, String(vM))
  const bas = statutCible('mois_couverts', snap, 1) // cible faible → atteinte (valeur ≥ 1)
  ok(bas && bas.atteint === (vM >= 1), 'mois_couverts, cible 1 : atteint ssi valeur ≥ 1', JSON.stringify(bas))
  ok(bas && bas.texte === 'Cible atteinte', 'atteint → texte « Cible atteinte »', bas && bas.texte)
  const haut = statutCible('mois_couverts', snap, 12) // cible haute → pas atteinte (valeur < 12)
  ok(haut && haut.atteint === (vM >= 12), 'mois_couverts, cible 12 : atteint ssi valeur ≥ 12', JSON.stringify(haut))
  if (haut && !haut.atteint) ok(/^Cible 12 mois$/.test(haut.texte), 'pas atteint → texte « Cible 12 mois » (fait, pas jugement)', haut.texte)

  // taux_epargne : % vs %, plus haut = atteint
  const vE = resolveKPI('taux_epargne', snap, { cible: 10 }).valeur
  ok(typeof vE === 'number', `taux_epargne a une valeur numérique (${vE})`, String(vE))
  const eBas = statutCible('taux_epargne', snap, 1)
  ok(eBas && eBas.atteint === (vE >= 1), 'taux_epargne, cible 1 % : atteint ssi valeur ≥ 1', JSON.stringify(eBas))
  const eHaut = statutCible('taux_epargne', snap, 50)
  if (eHaut && !eHaut.atteint) ok(/^Cible 50 %$/.test(eHaut.texte), 'pas atteint → « Cible 50 % »', eHaut.texte)
}

console.log('\n— PRUDENCE : aucun statut là où la cible n’est PAS une comparaison —')
{
  // ecart_3_6_mois / temps_vers_coussin_cible : cible = entrée de calcul → PAS de sens → null
  ok(statutCible('ecart_3_6_mois', snap, 3) === null, 'ecart_3_6_mois (cible = entrée) → null')
  ok(statutCible('temps_vers_coussin_cible', snap, 3) === null, 'temps_vers_coussin_cible → null')
  // saisonnier : réglage LOCAL au sable (pas def.reglage) → null (jamais atteint/sous sur un plancher)
  ok(statutCible('amplitude_revenus', snapSaison, 3000) === null, 'amplitude_revenus (plancher local) → null')
  // KPI sans réglage du tout
  ok(statutCible('valeur_nette', snap, 100000) === null, 'valeur_nette (aucun réglage) → null')
  // cible absente / nulle / négative → null (rien à comparer)
  ok(statutCible('mois_couverts', snap, 0) === null, 'cible 0 → null')
  ok(statutCible('mois_couverts', snap, null) === null, 'cible null → null')
  ok(statutCible('mois_couverts', snap, -3) === null, 'cible négative → null')
  ok(statutCible('kpi_inexistant', snap, 3) === null, 'KPI inconnu → null')
  // donnée manquante (saison seule : pas de coussin) → null
  ok(statutCible('mois_couverts', snapSaison, 3) === null, 'sans donnée coussin → null (data-aware)')
}

console.log('\n— CONFORMITÉ : les textes passent filtrerFait (faits, jamais de jugement) —')
{
  const textes = [
    statutCible('mois_couverts', snap, 1),
    statutCible('mois_couverts', snap, 12),
    statutCible('taux_epargne', snap, 50),
  ].filter(Boolean).map((s) => s.texte)
  ok(textes.length >= 2, `textes produits : ${textes.length}`, textes.join(' | '))
  ok(textes.every((t) => filtrerFait(t).ok), 'tous les textes de statut passent filtrerFait', textes.join(' | '))
}

console.log('')
if (echecs > 0) { console.log(`❌ ${echecs} échec(s)`); process.exit(1) }
console.log('✅ La pastille de statut tient — 0 échec (prudente, factuelle, filtrée)')
