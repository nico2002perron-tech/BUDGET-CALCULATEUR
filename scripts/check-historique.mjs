/* ============================================================================
   check-historique.mjs — LE FIL DU TEMPS (K7), sans navigateur. Prouve :
     - une photo par mois (idempotent), FIFO plafonné, seulement des valeurs finies ;
     - deltaLong depuis la plus vieille photo, en mois, ou null (< 1 photo / même mois) ;
     - jamais un silo vide photographié ; migration douce (historique absent).
   Lance : node scripts/check-historique.mjs
   ========================================================================== */
import { ajouterPhoto, deltaLong, moisDe, capturerPhoto, MAX_PHOTOS } from '../src/lib/historique.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { exempleStore } from '../src/lib/storage.js'

let fail = 0
const ok = (c, l) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) fail++ }
const snapAt = (iso) => ({ ...snapshotFromStore(exempleStore()), meta: { ...snapshotFromStore(exempleStore()).meta, generatedAt: iso } })

console.log('— La photo mensuelle —')
const snapJuil = snapAt('2026-07-14T12:00:00Z')
const h1 = ajouterPhoto([], snapJuil)
ok(Array.isArray(h1) && h1.length === 1 && h1[0].mois === '2026-07', 'photo du mois créée (2026-07)')
ok(h1 && Object.keys(h1[0].valeurs).length > 0 && Object.values(h1[0].valeurs).every((v) => Number.isFinite(v)), 'que des valeurs numériques finies')
ok(ajouterPhoto(h1, snapJuil) === null, 'même mois → null (idempotent, pas de reboucle)')
const hVide = ajouterPhoto([], { meta: { generatedAt: '2026-07-14T12:00:00Z' } })
ok(hVide === null, 'snapshot sans donnée → null (aucun silo vide photographié)')
ok(moisDe(snapAt('2026-03-02T00:00:00Z')) === '2026-03', 'moisDe pur (via meta.generatedAt)')

console.log('\n— Le FIFO plafonné —')
let big = []
for (let i = 0; i < MAX_PHOTOS + 6; i++) { const mm = String((i % 12) + 1).padStart(2, '0'); big = ajouterPhoto(big, snapAt(`20${20 + Math.floor(i / 12)}-${mm}-05T00:00:00Z`)) || big }
ok(big.length <= MAX_PHOTOS, `plafonné à ${MAX_PHOTOS} (${big.length})`)

console.log('\n— Le delta LONG —')
// 3 photos anti-datées où mois_couverts monte, puis le snapshot courant
const kpi = 'mois_couverts'
const vieux = [
  { mois: '2026-04', valeurs: { [kpi]: 2.0 } },
  { mois: '2026-05', valeurs: { [kpi]: 2.5 } },
]
const dl = deltaLong(kpi, vieux, snapJuil) // courant ≈ 3,8 mois (exempleStore)
ok(dl && dl.mois === 3 && dl.delta > 0, `delta long : +${dl && dl.delta} sur ${dl && dl.mois} mois (avr→juil)`)
ok(deltaLong(kpi, [], snapJuil) === null, 'aucune photo → null')
ok(deltaLong(kpi, [{ mois: '2026-07', valeurs: { [kpi]: 3 } }], snapJuil) === null, 'photo du MÊME mois → null (pas de recul)')
ok(deltaLong('kpi_inexistant', vieux, snapJuil) === null, 'KPI absent des photos → null')

console.log('\n' + (fail === 0 ? '✅ Le fil du temps tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
