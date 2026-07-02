/* ============================================================================
   check-verdict.mjs — LE VERDICT DU JOUR (lib/verdict.js), prouvé headless.
   Prouve, sans navigateur :
     - plan mensuel → phrase factuelle (sorties prévues / revenus / reste) ;
     - déficit prévu → segment 'neg' (la seule vraie exception) ;
     - dépenses sans revenus → on dit ce qu'on SAIT, rien de plus ;
     - saisonnier → le verdict du MOIS COURANT (jamais la moyenne) ;
     - 12 mois identiques ≠ saisonnier → le plan mensuel garde la parole ;
     - rythme : prorata + passées/à venir + clamp du jour aux bornes du mois ;
     - conformité : chaque phrase + note passe filtrerFait ;
     - data-aware : rien à raconter → null, jamais d'exception.
   Lance : node scripts/check-verdict.mjs
   ========================================================================== */
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
const ok = (cond, label) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++ }
// formatCAD sépare les milliers d'une espace insécable (fine) → on normalise pour comparer.
const joint = (v) => (v && Array.isArray(v.phrase) ? v.phrase.map((s) => s.texte).join('') : '').replace(/[   ]/g, ' ')

try {
  const { construireVerdict } = await vite.ssrLoadModule('/src/lib/verdict.js')
  const { filtrerFait } = await vite.ssrLoadModule('/src/recettes/schema.js')

  const CAL = {
    revenus: { mode: 'regulier', freq: 'biweekly' },
    depenses: [
      { id: 'log', jour: 1, label: 'Logement', montant: 1100, classe: 'besoin', type: 'fixe' },
      { id: 'abo', jour: 15, label: 'Abonnements', montant: 55, classe: 'envie', type: 'fixe' },
      { id: 'ass', jour: 21, label: 'Assurances', montant: 140, classe: 'besoin', type: 'fixe' },
    ],
  }
  const PLAN = { depenses: { revenu: 4000, coutVie: 2755, epargne: 200, total: 2955, reste: 1045 }, calendrier: CAL }
  const MI_MOIS = { maintenant: '2026-07-16T12:00:00' }

  console.log('— Plan mensuel : la phrase factuelle du jour —')
  const v = construireVerdict(PLAN, MI_MOIS)
  ok(!!v && v.source === 'plan', 'source = plan')
  ok(joint(v).includes('juillet'), `la phrase nomme le mois — « ${joint(v)} »`)
  ok(joint(v).includes('2 955 $') && joint(v).includes('4 000 $') && joint(v).includes('1 045 $'), 'sorties prévues + revenus + reste chiffrés')
  ok(v.phrase.filter((s) => s.fort).length === 3, 'les 3 montants sont des segments forts')
  ok(v.phrase.every((s) => s.sens !== 'neg'), 'reste positif → aucun segment ambre')
  ok(typeof v.dateLabel === 'string' && v.dateLabel.includes('juillet'), `dateLabel du jour — « ${v.dateLabel} »`)

  console.log('\n— Déficit prévu : la seule vraie exception (ambre) —')
  const vd = construireVerdict({ depenses: { revenu: 2500, coutVie: 2755, epargne: 200, total: 2955, reste: -455 } }, MI_MOIS)
  ok(joint(vd).includes('dépassent') && joint(vd).includes('455 $'), `le déficit est dit en fait — « ${joint(vd)} »`)
  ok(vd.phrase.some((s) => s.sens === 'neg'), 'le montant du déficit porte sens=neg')

  console.log('\n— Dépenses sans revenus : on dit ce qu\'on sait, rien de plus —')
  const vs = construireVerdict({ depenses: { revenu: 0, coutVie: 500, epargne: 0, total: 500, reste: -500 } }, MI_MOIS)
  ok(!!vs && !joint(vs).includes('revenus'), `aucune mention de revenus inventés — « ${joint(vs)} »`)
  ok(vs.phrase.every((s) => s.sens !== 'neg'), 'pas de faux déficit quand les revenus sont juste absents')

  console.log('\n— Saisonnier : le verdict du MOIS COURANT, jamais la moyenne —')
  const SAISON = { saison: { revenusMensuels: [0, 0, 800, 3200, 5600, 6800, 7200, 7000, 6200, 4200, 1200, 200], depensesMensuelles: 3400 } }
  const vj = construireVerdict(SAISON, { maintenant: '2026-07-16T12:00:00' })
  ok(!!vj && vj.source === 'saison', 'source = saison')
  ok(joint(vj).includes('7 200 $') && joint(vj).includes('+3 800 $'), `juillet → revenus du mois + flux positif — « ${joint(vj)} »`)
  const vjan = construireVerdict(SAISON, { maintenant: '2026-01-16T12:00:00' })
  ok(joint(vjan).includes('sont de 0 $') && joint(vjan).includes('−3 400 $'), 'janvier → 0 $ de revenus, flux négatif (le fait, sans drame)')
  ok(!vjan.phrase.some((s) => s.sens === 'neg'), 'année du plan POSITIVE → hiver structurel SANS ambre (l\'ambre reste un signal, §12)')
  const ANNEE_NEG = { saison: { revenusMensuels: [0, 0, 800, 3200, 5600, 6800, 7200, 7000, 6200, 4200, 1200, 200], depensesMensuelles: 4000 } }
  const vneg = construireVerdict(ANNEE_NEG, { maintenant: '2026-01-16T12:00:00' })
  ok(vneg.phrase.some((s) => s.sens === 'neg'), 'année du plan NÉGATIVE (42 400 < 48 000) → là, l\'ambre (la vraie exception)')
  const vsansCV = construireVerdict(
    { saison: { revenusMensuels: SAISON.saison.revenusMensuels, depensesMensuelles: 0 } },
    { maintenant: '2026-07-16T12:00:00' },
  )
  ok(!!vsansCV && !joint(vsansCV).includes('sorties') && !joint(vsansCV).includes('flux'), `sorties non saisies (0) → revenus seulement, jamais un flux bâti sur un 0 inventé — « ${joint(vsansCV)} »`)

  console.log('\n— Saisonnier ÉTANCHE : jamais la moyenne annuelle en mois mort —')
  const EPARGNE_SEULE = {
    saison: { revenusMensuels: SAISON.saison.revenusMensuels, depensesMensuelles: 0 },
    depenses: { revenu: 3533, coutVie: 0, epargne: 200, total: 200, reste: 3333 }, // revenu = moyenne annuelle (le piège)
    calendrier: { revenus: { mode: 'saisonnier' }, depenses: [{ id: 'celi', jour: 1, label: 'Virement CELI', montant: 200, classe: 'epargne', type: 'fixe' }] },
  }
  const vmort = construireVerdict(EPARGNE_SEULE, { maintenant: '2026-01-16T12:00:00' })
  ok(vmort.source === 'saison', 'mois mort + épargne datée → la branche saison GARDE la parole (pas de fuite vers le plan)')
  ok(joint(vmort).includes('sont de 0 $') && !joint(vmort).includes('3 533'), `janvier dit 0 $ (l'estimation de l'usager), jamais la moyenne 3 533 $ — « ${joint(vmort)} »`)
  ok(joint(vmort).includes('200 $'), 'l\'épargne prévue compte dans les sorties (une seule vérité phrase/barre)')

  console.log('\n— Élision française : « d\'avril », pas « de avril » —')
  const vavr = construireVerdict(PLAN, { maintenant: '2026-04-16T12:00:00' })
  ok(joint(vavr).includes("d'avril") && !joint(vavr).includes('de avril'), `« Selon ton plan d'avril » — « ${joint(vavr).slice(0, 40)}… »`)

  console.log('\n— 12 mois identiques ≠ saisonnier : le plan garde la parole —')
  const UNIFORME = {
    saison: { revenusMensuels: Array.from({ length: 12 }, () => 4000), depensesMensuelles: 2755 },
    depenses: PLAN.depenses,
  }
  const vu = construireVerdict(UNIFORME, MI_MOIS)
  ok(vu && vu.source === 'plan', 'revenus réguliers dérivés en 12 mois égaux → verdict du plan, pas « saisonnier »')

  console.log('\n— Le rythme du mois : prorata + passées / à venir + clamp —')
  const r = v.rythme
  ok(!!r && r.jour === 16 && r.nDays === 31, 'juillet, le 16 → jour 16 / 31')
  ok(r.prorataPct === Math.round((16 / 31) * 100), `prorata = ${r.prorataPct} %`)
  ok(r.fixesPassees === 1155 && r.fixesAVenir === 140, 'passées = Logement+Abonnements (1 155 $), à venir = Assurances (140 $)')
  ok(r.marqueurs.length === 3 && r.marqueurs.every((m, i, a) => i === 0 || a[i - 1].jour <= m.jour), '3 marqueurs triés par jour')
  const rf = construireVerdict(
    { depenses: PLAN.depenses, calendrier: { revenus: CAL.revenus, depenses: [{ id: 'x', jour: 31, label: 'Fin de mois', montant: 100, classe: 'besoin', type: 'fixe' }] } },
    { maintenant: '2026-02-10T12:00:00' },
  ).rythme
  ok(rf.nDays === 28 && rf.marqueurs[0].jour === 28, 'le « 31 » d\'un février tombe le 28 (clamp aux bornes du mois)')
  ok(construireVerdict({ depenses: PLAN.depenses }, MI_MOIS).rythme === null, 'aucune sortie datée → rythme null (pas de barre vide)')
  ok(r.sortiPct === Math.round((1155 / 1295) * 100), `2e axe : sortiPct = part de l'argent daté déjà sorti (${r.sortiPct} %)`)
  const rg = construireVerdict(
    { depenses: PLAN.depenses, calendrier: { revenus: CAL.revenus, depenses: [
      { id: 'log', jour: 1, label: 'Logement', montant: 1100, classe: 'besoin', type: 'fixe' },
      { id: 'ep', jour: 1, label: 'Épargne', montant: 200, classe: 'epargne', type: 'fixe' },
    ] } },
    MI_MOIS,
  ).rythme
  ok(rg.marqueurs.length === 1 && rg.marqueurs[0].montant === 1300 && rg.marqueurs[0].label === 'Logement + Épargne', 'deux sorties le MÊME jour → UN marqueur honnête (somme + labels joints)')
  const vinv = construireVerdict(PLAN, { maintenant: 'pas une date' })
  ok(!!vinv && !joint(vinv).includes('Invalid') && isFinite(vinv.rythme.prorataPct), 'date invalide → repli sur maintenant, jamais de NaN propagé')

  console.log('\n— Conformité : chaque texte passe filtrerFait (VISION §11) —')
  for (const [nom, vv] of [['plan', v], ['déficit', vd], ['sans revenus', vs], ['saison+', vj], ['saison−', vjan], ['année négative', vneg], ['mois mort', vmort], ['avril', vavr]]) {
    ok(filtrerFait(joint(vv)).ok && filtrerFait(vv.note).ok, `phrase + note « ${nom} » factuelles`)
  }

  console.log('\n— Data-aware : rien à raconter → null, jamais d\'exception —')
  ok(construireVerdict({}, MI_MOIS) === null, 'snapshot vide → null')
  ok(construireVerdict(null) === null, 'snapshot null → null')
  ok(construireVerdict({ saison: { revenusMensuels: Array.from({ length: 12 }, () => 0), depensesMensuelles: 0 } }, MI_MOIS) === null, 'saison à zéro sans plan → null')
} catch (e) {
  fail++
  console.log('  ✗ exception :', e && e.message)
} finally {
  await vite.close()
}

console.log('\n' + (fail === 0 ? '✅ Le verdict du jour tient — 0 échec (le héros dit des faits, au bon moment du mois)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
