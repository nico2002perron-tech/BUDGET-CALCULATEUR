/* ============================================================================
   check-promesse.mjs — LA TUILE-PROMESSE (P4), sans navigateur. Prouve :
     - un KPI dont la donnée MANQUE → une promesse (silo à remplir + phrase factuelle) ;
     - un KPI dont la donnée EST là → null (pas de promesse) ;
     - le bon silo par famille ; phrase sans reproche ; KPI inconnu → null.
   Lance : node scripts/check-promesse.mjs
   ========================================================================== */
import { promesseKPI } from '../src/lib/promesse.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'

let fail = 0
const ok = (c, l) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) fail++ }

console.log('— Donnée MANQUANTE → une promesse (silo + phrase) —')
const vide = {}
const pPat = promesseKPI('valeur_nette', vide)
ok(pPat && pPat.silo === 'placements', 'valeur_nette sans patrimoine → silo « placements »')
const pDep = promesseKPI('top_categorie', vide)
ok(pDep && pDep.silo === 'depenses', 'top_categorie sans dépenses → silo « depenses »')
const pRev = promesseKPI('amplitude_revenus', vide)
ok(pRev && pRev.silo === 'revenus', 'amplitude_revenus sans saison → silo « revenus »')
ok(pPat && /s’allume avec/.test(pPat.phrase) && !/(devrais|n’as pas|manque|oublié)/i.test(pPat.phrase), 'phrase = futur factuel, jamais un reproche')

console.log('\n— Donnée PRÉSENTE → pas de promesse —')
const snap = snapshotFromStore(exempleStore())
ok(promesseKPI('valeur_nette', snap) === null, 'valeur_nette avec patrimoine → null')
ok(promesseKPI('amplitude_revenus', snap) === null, 'amplitude_revenus avec saison → null')

console.log('\n— Robustesse —')
ok(promesseKPI('kpi_inexistant', vide) === null, 'KPI inconnu → null')
ok(promesseKPI('valeur_nette', null) && promesseKPI('valeur_nette', null).silo === 'placements', 'snapshot null → promesse quand même (tout manque)')

console.log('\n' + (fail === 0 ? '✅ La tuile-promesse tient — 0 échec (une donnée absente est une invitation, pas un « — »)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
