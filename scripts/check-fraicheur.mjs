/* ============================================================================
   check-fraicheur.mjs — L'ÂGE DES DONNÉES (K2), sans navigateur. Prouve :
     - sous le seuil → null (le calme d'abord) ; au-delà → la ligne ;
     - le silo le PLUS VIEUX d'un requiert composite l'emporte ;
     - est-datee bascule à 2× le seuil ;
     - migration douce (freshness absente → null, jamais d'erreur) ;
     - texte compact + jamais d'ambre (juste un fait).
   Lance : node scripts/check-fraicheur.mjs
   ========================================================================== */
import { etatFraicheur, ageEnMots, silosDe, SILOS } from '../src/lib/fraicheur.js'
import { touchSilo } from '../src/lib/storage.js'

let fail = 0
const ok = (c, l) => { console.log(`  ${c ? '✓' : '✗'} ${l}`); if (!c) fail++ }
const NOW = new Date('2026-07-14T12:00:00Z')
const jadis = (n) => new Date(NOW.getTime() - n * 86400000).toISOString()
const snap = (maj) => ({ meta: { freshness: maj } })

console.log('— Le calme d’abord : sous le seuil → null —')
ok(etatFraicheur(snap({ depenses: jadis(10) }), ['depenses'], NOW) === null, 'dépenses il y a 10 j (< 30) → aucune ligne')
ok(etatFraicheur(snap({ patrimoine: jadis(80) }), ['patrimoine'], NOW) === null, 'patrimoine il y a 80 j (< 90) → aucune ligne')

console.log('\n— Au-delà du seuil : la ligne (par silo) —')
const e1 = etatFraicheur(snap({ depenses: jadis(45) }), ['depenses'], NOW)
ok(e1 && e1.silo === 'depenses' && e1.datee === false, 'dépenses 45 j → ligne, pas encore datee (< 60)')
ok(e1 && e1.section === 'depenses' && /sem\.|mois/.test(e1.texte), `texte compact : "${e1 && e1.texte}"`)
const e2 = etatFraicheur(snap({ patrimoine: jadis(200) }), ['patrimoine'], NOW)
ok(e2 && e2.datee === true, 'patrimoine 200 j (≥ 2×90) → est-datee')

console.log('\n— Le PLUS VIEUX silo d’un requiert composite l’emporte —')
const eC = etatFraicheur(snap({ revenus: jadis(2), depenses: jadis(45) }), ['coussin'], NOW)
ok(eC && eC.silo === 'depenses' && eC.jours === 45, 'coussin ← {revenus 2 j, depenses 45 j} → prend dépenses (45 j)')
ok(JSON.stringify(silosDe(['coussin'])) === JSON.stringify(['revenus', 'depenses']), 'silosDe(coussin) = [revenus, depenses]')
ok(JSON.stringify(silosDe(['capacite', 'depenses'])) === JSON.stringify(['revenus', 'depenses']), 'silosDe dédupliqué')

console.log('\n— Migration douce + robustesse —')
ok(etatFraicheur(snap({}), ['depenses'], NOW) === null, 'freshness sans le silo → null (jamais d’âge fabriqué)')
ok(etatFraicheur({ meta: {} }, ['depenses'], NOW) === null, 'meta sans freshness → null')
ok(etatFraicheur(null, ['depenses'], NOW) === null, 'snapshot null → null')
ok(etatFraicheur(snap({ depenses: 'pas-une-date' }), ['depenses'], NOW) === null, 'iso invalide → null (pas de NaN)')
ok(etatFraicheur(snap({ depenses: jadis(45) }), [], NOW) === null, 'requiert vide → null')
ok(etatFraicheur(snap({ depenses: jadis(45) }), ['dettesDetaillees'], NOW) === null, 'requiert hors carte silo → null')

console.log('\n— touchSilo : une mise à jour rafraîchit AUSSITÔT (la boucle K2) —')
const stale = { revenus: { a: 1 }, meta: { majSilos: { depenses: jadis(45) } } }
ok(etatFraicheur(snap(stale.meta.majSilos), ['depenses']) !== null, 'avant : dépenses 45 j → ligne d’âge présente')
const frais = touchSilo({ ...stale, depenses: [{ montant: 2 }] }, 'depenses')
ok(etatFraicheur({ meta: { freshness: frais.meta.majSilos } }, ['depenses']) === null, 'après touchSilo(depenses) → ligne effacée (silo frais dans l’ÉTAT)')
ok(frais.meta.majSilos.depenses !== stale.meta.majSilos.depenses, 'touchSilo pose une nouvelle estampille')
ok(touchSilo({ revenus: 1 }, 'revenus').meta.majSilos.revenus, 'touchSilo crée meta.majSilos si absent (jamais d’erreur)')

console.log('\n— Le mot d’âge est compact et calme —')
for (const j of [3, 12, 45, 200, 400]) console.log(`      ${String(j).padStart(3)} j → "${ageEnMots(j)}"`)
ok(!/tu devrais|il faut|urgent|attention|alerte/i.test(Object.values(SILOS).map((x) => x.nom).join(' ') + ' ' + ageEnMots(200)), 'aucun mot d’alarme/conseil (juste un fait)')

console.log('\n' + (fail === 0 ? '✅ La fraîcheur tient — 0 échec' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
