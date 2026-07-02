/* ============================================================================
   check-galerie.mjs — LE CERVEAU de la Galerie (lib/galerie.js), prouvé headless.
   Prouve :
     - chaque KPI du registre (5 domaines) devient une carte : VIVANTE (vraie
       valeur via resolveKPI) ou GIVRÉE (condition + où saisir) — jamais un faux
       chiffre ;
     - les tableaux complets suivent leurs données ;
     - la cohérence avec candidatsKPI (source unique, rien recompté à la main) ;
     - conformité : conditions factuelles (filtrerFait) ;
     - robustesse : snapshot vide/null → tout givré, jamais d'exception.
   Lance : node scripts/check-galerie.mjs
   ========================================================================== */
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }

try {
  const { construireGalerie, groupesAAllumer, DOMAINES } = await vite.ssrLoadModule('/src/lib/galerie.js')
  const { REGISTRE_KPIS, candidatsKPI } = await vite.ssrLoadModule('/src/recettes/bibliotheque-kpis.js')
  const { filtrerFait } = await vite.ssrLoadModule('/src/recettes/schema.js')
  const { snapshotFromStore } = await vite.ssrLoadModule('/src/lib/canonical.js')
  const { exempleStore } = await vite.ssrLoadModule('/src/lib/storage.js')

  const snap = snapshotFromStore(exempleStore())
  const g = construireGalerie(snap)
  const ids = new Set(DOMAINES.map((d) => d.id))
  const attendu = REGISTRE_KPIS.filter((k) => ids.has(k.domaine)).length

  console.log('— Chaque KPI du registre devient une carte —')
  ok(g.indicateurs.length === attendu, `${attendu} cartes-indicateurs (tout le registre des 5 domaines)`)
  ok(g.tableaux.length === 4, '4 tableaux complets')
  ok(g.indicateurs.every((k) => k.question && k.accent && k.domaine), 'chaque carte a sa question, sa couleur, sa catégorie')

  console.log('\n— Cartes VIVANTES : la vraie valeur, jamais une maquette —')
  const pretes = g.indicateurs.filter((k) => k.pret)
  const attenduPrets = DOMAINES.reduce((n, d) => n + candidatsKPI(d.id, snap).length, 0)
  ok(pretes.length === attenduPrets, `prêtes = Σ candidatsKPI (${attenduPrets}) — source unique`)
  const solde = g.indicateurs.find((k) => k.id === 'solde_mois')
  ok(solde && solde.pret && typeof solde.valeur === 'number' && solde.unite === '$', `« ${solde.question} » porte sa vraie valeur (${solde.valeur} $)`)
  ok(pretes.every((k) => k.texteFactuel !== undefined), 'chaque carte vivante a son fait')

  console.log('\n— Cartes GIVRÉES : la condition + où aller saisir —')
  const vide = construireGalerie({})
  ok(vide.indicateurs.every((k) => !k.pret), 'snapshot vide → tout givré (rien d\'inventé)')
  ok(vide.indicateurs.every((k) => k.condition && k.condition.startsWith('S’allume avec')), 'chaque givrée dit ce qui l\'allume')
  ok(vide.indicateurs.every((k) => ['revenus', 'depenses', 'placements'].includes(k.sousSection)), 'chaque givrée sait où sa donnée se saisit')
  ok(vide.tableaux.every((t) => !t.pret && t.condition && t.sousSection), 'tableaux givrés pareil')
  ok(vide.totaux.prets === 0 && vide.totaux.aAllumer === attendu + 4, 'les totaux disent l\'état honnêtement')

  console.log('\n— Conformité (VISION §11) —')
  ok(vide.indicateurs.every((k) => filtrerFait(k.condition).ok), 'chaque condition passe filtrerFait')
  ok(g.tableaux.every((t) => filtrerFait(t.sous).ok), 'chaque sous-titre de tableau passe filtrerFait')

  console.log('\n— Le tiroir « À allumer » : regroupé par info manquante —')
  const groupes = groupesAAllumer(vide)
  ok(groupes.reduce((n, g) => n + g.n, 0) === attendu + 4, 'les groupes couvrent TOUTES les givrées (indicateurs + tableaux)')
  ok(groupes.every((g) => g.manque && g.sousSection), 'chaque groupe dit ce qui manque et où le saisir')
  ok(groupes.every((g, i, a) => i === 0 || a[i - 1].n >= g.n), 'les plus gros paquets d\'abord (une action = plusieurs outils)')
  ok(groupesAAllumer(construireGalerie(snap)).reduce((n, g) => n + g.n, 0) === construireGalerie(snap).totaux.aAllumer, 'profil exemple : groupes = exactement les cartes à allumer')
  ok(groupesAAllumer(null).length === 0, 'galerie null → [] propre')

  console.log('\n— Robustesse —')
  ok(construireGalerie(null).indicateurs.length === attendu, 'snapshot null → galerie complète givrée, jamais d\'exception')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ La galerie tient — 0 échec (chaque carte dit vrai : ta valeur ou sa condition)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
