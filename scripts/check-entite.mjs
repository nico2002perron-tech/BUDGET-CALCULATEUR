/* ============================================================================
   check-entite.mjs — Tranche studio, PORTE D : l'entité-objectif + carte_entite.
   Prouve, sans navigateur :
     - une config de conversation → une entité valide ;
     - horizon & dejaEpargne DÉRIVÉS du moteur (jamais codés en dur) ;
     - l'entité SURVIT à export→import, photo incluse (le « fabriqué pour moi » ne
       s'évapore pas si l'usager vide sa cache) ;
     - carte_entite résout depuis l'entité ; photo absente → propre ; id inconnu → null ;
     - accent hors palette → repli ; photo surdimensionnée → refusée ;
     - tout texte (scenarioLabel) passe filtrerFait ; palette curée sans ambre.
   Lance : node scripts/check-entite.mjs
   ========================================================================== */
// Mock localStorage en mémoire → les VRAIS exportJSON/importJSON (storage.js) s'exécutent.
const _mem = new Map()
globalThis.localStorage = { getItem: (k) => (_mem.has(k) ? _mem.get(k) : null), setItem: (k, v) => { _mem.set(k, String(v)) }, removeItem: (k) => { _mem.delete(k) } }

import { construireEntite, accentValide, photoBornee, ajouterEntiteAuStore, PALETTE_ACCENTS, MAX_PHOTO_CARS } from '../src/lib/entites.js'
import { exportJSON, importJSON, saveStore, emptyStore } from '../src/lib/storage.js'
import { snapshotFromStore } from '../src/lib/canonical.js'
import { BLOCS, filtrerFait } from '../src/recettes/schema.js'

let fail = 0
const ok = (cond, label) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) fail++
}

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const snap = { depenses: { revenu: 4000, coutVie: 2500 }, coussin: { montant: 2000 } } // snapshot synthétique (construireEntite lit un snapshot, pas un store)
const config = {
  canal: 'projet_abordable',
  reponses: { cout: 6000, echeance: 'moyen', nom: 'Voyage au Japon', couleur: 'lavande', photo: PHOTO },
  scenarioChoisi: { contributionMensuelle: 750, horizonMois: 6, label: 'En orientant 750 $/mois, tu y arrives en 6 mois.' },
}

console.log('— Une config de conversation → une entité valide —')
const e = construireEntite(config, snap, 'e_test1')
ok(e.kind === 'goal' && e.nom === 'Voyage au Japon' && e.cible === 6000, 'entité goal : nom + cible')
ok(e.contributionMensuelle === 750 && e.couleurAccent === 'lavande' && e.echeanceVisee === 'moyen', 'contribution + accent + échéance')
ok(typeof e.photo === 'string' && e.photo === PHOTO, 'photo conservée (locale)')

console.log('\n— horizon & dejaEpargne DÉRIVÉS du moteur (jamais en dur) —')
ok(e.dejaEpargne === 2000, 'dejaEpargne = coussin du snapshot (2 000)')
ok(e.horizonMois === 6, 'horizonMois = celui du scénario choisi (6)')
const e9 = construireEntite(config, { depenses: { revenu: 4000, coutVie: 2500 }, coussin: { montant: 9000 } }, 'e_test9')
ok(e9.dejaEpargne === 9000, 'snapshot différent → dejaEpargne change (donc dérivé, pas codé)')

console.log('\n— L’entité SURVIT à export → import, PHOTO incluse —')
saveStore(ajouterEntiteAuStore(emptyStore(), e))
const exp = exportJSON()
const reimporte = importJSON(exp)
const e2 = (reimporte.entites || []).find((x) => x.id === 'e_test1')
ok(!!e2, 'entité retrouvée après export→import')
ok(e2 && e2.photo === PHOTO, 'la PHOTO survit au round-trip (privacy-first : le filet tient)')
ok(e2 && e2.nom === e.nom && e2.cible === e.cible && e2.horizonMois === e.horizonMois && e2.couleurAccent === e.couleurAccent, 'tous les champs intacts')

console.log('\n— carte_entite résout depuis l’entité —')
const snap2 = snapshotFromStore(ajouterEntiteAuStore(emptyStore(), e))
const resolu = BLOCS.carte_entite.resolve(snap2, { id: 'e_test1' })
ok(resolu && resolu.id === 'e_test1' && resolu.nom === 'Voyage au Japon', 'resolve(snap, {id}) → l’entité')
ok(BLOCS.carte_entite.resolve(snap2, { id: 'inconnu' }) === null, 'id inconnu → null (carte montre un état propre)')

console.log('\n— Cas-limites : photo absente, accent hors palette, photo surdimensionnée —')
const eSansPhoto = construireEntite({ reponses: { cout: 6000, nom: 'Sans photo' }, scenarioChoisi: { contributionMensuelle: 500, horizonMois: 8 } }, snap, 'e_np')
ok(eSansPhoto.photo === null, 'photo absente → null (état propre, pas de trou)')
const eAccent = construireEntite({ reponses: { cout: 6000, couleur: 'turquoise_fluo' }, scenarioChoisi: {} }, snap, 'e_ac')
ok(eAccent.couleurAccent === 'cyan', 'accent hors palette → repli « cyan »')
ok(accentValide('turquoise_fluo') === accentValide('cyan'), 'accentValide : hex de repli pour un id inconnu')
ok(accentValide('lavande') === '#7a6fe6', 'accentValide : hex correct pour un id valide')
const eBig = construireEntite({ reponses: { cout: 6000, photo: 'x'.repeat(MAX_PHOTO_CARS + 1) }, scenarioChoisi: {} }, snap, 'e_big')
ok(eBig.photo === null, `photo > seuil (~200 Ko) → refusée (jamais un blob qui gonfle le silo)`)
ok(photoBornee('x'.repeat(MAX_PHOTO_CARS)) !== null && photoBornee('x'.repeat(MAX_PHOTO_CARS + 1)) === null, 'photoBornee : borne nette au seuil')

console.log('\n— Conformité : scenarioLabel via filtrerFait ; palette curée sans ambre —')
const eJuge = construireEntite({ reponses: { cout: 6000 }, scenarioChoisi: { contributionMensuelle: 750, horizonMois: 6, label: 'Tu devrais épargner plus.' } }, snap, 'e_j')
ok(eJuge.scenarioLabel === '', 'un scenarioLabel jugeant est rejeté (filtrerFait) → vidé')
ok(filtrerFait(e.scenarioLabel).ok && e.scenarioLabel, 'le scenarioLabel factuel passe filtrerFait')
ok(PALETTE_ACCENTS.length === 6, 'palette curée de 6 accents')
ok(PALETTE_ACCENTS.every((a) => a.id !== 'ambre' && a.id !== 'corail' && a.hex.toLowerCase() !== '#b8740a'), 'aucun ambre/corail (réservé à l’exception, §12)')

console.log('\n' + (fail === 0 ? '✅ L’entité + carte_entite tiennent — 0 échec (le « fabriqué pour moi » survit)' : `❌ ${fail} échec(s)`))
process.exit(fail === 0 ? 0 : 1)
