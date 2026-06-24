/* ============================================================================
   parity-twin.mjs — prouve que src/lib/twin.js (port ESM) donne EXACTEMENT les
   mêmes résultats fiscaux que l'original Site-Web-Groupe-Financier/js/twin-engine.js.

   Lance : node scripts/parity-twin.mjs
   Sortie : PASS/FAIL par fonction + le 1er écart s'il y en a un.
   ========================================================================== */
import { readFileSync } from 'node:fs'

const ORIG_PATH =
  'C:/Users/Utilisateur/OneDrive - IA Private Wealth/IA PublicQuébec/NICOLAS PERRON/Site-Web-Groupe-Financier/js/twin-engine.js'
const PORT_PATH = new URL('../src/lib/twin.js', import.meta.url)

// ---- 1) Charger l'ORIGINAL (IIFE qui pose window.TwinEngine) -----------------
const origSrc = readFileSync(ORIG_PATH, 'utf8')
const fakeWindow = {}
// L'IIFE référence `window` comme variable libre : on l'injecte en paramètre.
// eslint-disable-next-line no-new-func
new Function('window', origSrc)(fakeWindow)
const Orig = fakeWindow.TwinEngine
if (!Orig) throw new Error('Échec du chargement de twin-engine.js original')

// ---- 2) Charger le PORT ESM --------------------------------------------------
const Port = await import(PORT_PATH.href)

// ---- utilitaires -------------------------------------------------------------
let pass = 0
let fail = 0
function check(label, a, b) {
  const sa = JSON.stringify(a)
  const sb = JSON.stringify(b)
  if (sa === sb) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}`)
    console.log(`      original : ${sa.slice(0, 220)}`)
    console.log(`      port     : ${sb.slice(0, 220)}`)
  }
}

console.log('— calcTax (impôt combiné fed+QC + retenues) —')
const incomes = [0, 25000, 51780, 55867, 60000, 90000, 111733, 150000, 220000, 250000]
const deductions = [0, 5000, 31560]
for (const g of incomes) {
  for (const d of deductions) {
    check(`calcTax(${g}, ${d})`, Orig.calcTax(g, d), Port.calcTax(g, d))
  }
}

console.log('— projectLife (projection patrimoniale complète) —')
const profils = [
  {
    label: 'jeune épargnant',
    data: { name: 'A', age: 28, retirementAge: 65, lifeExpectancy: 90, situation: 'celibataire',
      revenus: [{ source: 'Salaire', montant: 62000, croissance: 0.025 }],
      depensesMensuelles: 2600, reer: 12000, celi: 8000, nonEnregistre: 3000,
      epargneMensuelle: 600, repartitionEpargne: { reer: 40, celi: 40, nonEnr: 20 } },
  },
  {
    label: 'propriétaire mi-carrière',
    data: { name: 'B', age: 42, retirementAge: 62, lifeExpectancy: 92, situation: 'famille',
      revenus: [{ source: 'Salaire', montant: 110000, croissance: 0.02 }],
      depensesMensuelles: 4800, reer: 95000, celi: 45000, nonEnregistre: 20000,
      maisonValeur: 480000, hypotheque: 280000, hypothequeTaux: 0.052, hypothequeAmort: 25,
      autresDettes: 12000, autresDettesTaux: 0.07,
      epargneMensuelle: 1200, repartitionEpargne: { reer: 50, celi: 30, nonEnr: 20 },
      objectifs: [{ ageVise: 50, cout: 25000 }] },
  },
  {
    label: 'proche retraite',
    data: { name: 'C', age: 60, retirementAge: 65, lifeExpectancy: 95, situation: 'couple',
      revenus: [{ source: 'Salaire', montant: 85000, croissance: 0.015 }],
      depensesMensuelles: 5200, reer: 420000, celi: 110000, nonEnregistre: 60000,
      maisonValeur: 550000, hypotheque: 40000,
      epargneMensuelle: 1500, repartitionEpargne: { reer: 20, celi: 60, nonEnr: 20 } },
  },
]
for (const p of profils) {
  // Twin créé UNE fois avec l'original, partagé aux deux projectLife (évite les
  // écarts de createdAt/updatedAt qui n'entrent pas dans le calcul).
  const twin = Orig.createTwin(p.data)
  check(`projectLife — ${p.label}`, Orig.projectLife(twin), Port.projectLife(twin))
}

console.log('— droits de cotisation + bilans —')
for (const age of [19, 25, 40, 65]) {
  check(`calcCeliRoom(${age}, 1000)`, Orig.calcCeliRoom(age, 1000), Port.calcCeliRoom(age, 1000))
  check(`calcCeliappInfo(${age}, 2000, true)`, Orig.calcCeliappInfo(age, 2000, true), Port.calcCeliappInfo(age, 2000, true))
}
for (const g of [40000, 90000, 200000]) {
  check(`calcReerRoom(${g}, 3000)`, Orig.calcReerRoom(g, 3000), Port.calcReerRoom(g, 3000))
  check(`calcDollarBreakdown(${g})`, Orig.calcDollarBreakdown(g, 3000, 2500, 500), Port.calcDollarBreakdown(g, 3000, 2500, 500))
}
check('compoundGrowth(10000, 300, 0.06, 25)', Orig.compoundGrowth(10000, 300, 0.06, 25), Port.compoundGrowth(10000, 300, 0.06, 25))

console.log('— calcHealthGauges —')
for (const p of profils) {
  const twin = Orig.createTwin(p.data)
  const projO = Orig.projectLife(twin)
  check(`calcHealthGauges — ${p.label}`, Orig.calcHealthGauges(twin, projO), Port.calcHealthGauges(twin, projO))
}

console.log('\n' + (fail === 0 ? `✅ PARITÉ TOTALE — ${pass} vérifications, 0 écart` : `❌ ${fail} écart(s) sur ${pass + fail} vérifications`))
process.exit(fail === 0 ? 0 : 1)
