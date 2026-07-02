/* ============================================================================
   verdict.js — LE VERDICT DU JOUR (VISION §7a·2). Le producteur PUR du héros
   cockpit : snapshot → { la phrase factuelle du jour, le rythme du mois }.

   Le verdict est UNE phrase FACTUELLE (jamais un jugement — VISION §11) qui
   répond à « est-ce que je finis mon mois dans le vert ? » avec les chiffres
   du PLAN de l'usager. Le rythme = où on est rendu dans le mois (prorata) et
   quelles sorties fixes datées sont passées vs à venir.

   DEUX SITUATIONS, choisies par les données (data-aware, §10) :
   - SAISONNIER (revenus qui varient d'un mois à l'autre) → le verdict parle du
     MOIS COURANT (revenus estimés du mois vs coût de vie), pas d'une moyenne
     qui mentirait en janvier comme en juillet.
   - PLAN MENSUEL (depenses rempli) → sorties prévues vs revenus, et le reste.
   Ni l'un ni l'autre → null : le héros ne se rend pas (jamais de zéro inventé).

   DISCIPLINE :
   - PUR : zéro React/DOM ; `opts.maintenant` rend le temps testable (headless).
   - CONFORMITÉ (§11) : la phrase assemblée passe par filtrerFait ; rejetée →
     repli factuel minimal. Jamais « en avance / en retard / bonne voie ».
   - La phrase sort en SEGMENTS ({ texte, fort?, sens? }) pour que la vue mette
     les montants en évidence sans jamais re-manipuler le texte.
   ========================================================================== */
import { filtrerFait } from '../recettes/schema.js'
import { formatCAD } from './format.js'

function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

// Segments : t = texte courant, f = montant mis en évidence (sens 'pos'|'neg').
const t = (texte) => ({ texte })
const f = (texte, sens) => ({ texte, fort: true, sens: sens || 'pos' })

// La phrase jointe passe le garde-fou de conformité ; rejetée → repli factuel.
function phraseSure(segments, repli) {
  const joint = segments.map((s) => s.texte).join('')
  if (filtrerFait(joint).ok) return segments
  const r = filtrerFait(repli)
  return [t(r.ok && r.texte ? r.texte : 'Ton plan du mois est en place.')]
}

/* ── Le rythme du mois : prorata + sorties DATÉES (calendrier.depenses : fixes et
   épargne datée), partagées passées / à venir selon le jour courant. Les sorties
   d'un MÊME jour sont regroupées en un marqueur (somme + labels joints) — deux
   points superposés se liraient comme un seul et son infobulle mentirait. Aucune
   sortie datée → null (une barre vide ne raconte rien). Jour clampé aux bornes du
   mois (le « 31 » d'un février tombe le 28, comme dans calendrier.js). */
function construireRythme(snapshot, maintenant) {
  const cal = snapshot && snapshot.calendrier
  const sorties = cal && Array.isArray(cal.depenses) ? cal.depenses : []
  if (sorties.length === 0) return null

  const nDays = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0).getDate()
  const jour = maintenant.getDate()
  const parJour = new Map()
  for (const d of sorties) {
    const j = Math.min(Math.max(1, Math.round(num(d.jour) || 1)), nDays)
    const acc = parJour.get(j) || { jour: j, labels: [], montant: 0, passe: j <= jour }
    acc.labels.push(d.label || 'Dépense')
    acc.montant += Math.round(num(d.montant))
    parJour.set(j, acc)
  }
  const marqueurs = [...parJour.values()]
    .map((m) => ({ jour: m.jour, label: m.labels.join(' + '), montant: m.montant, passe: m.passe }))
    .sort((a, b) => a.jour - b.jour)

  const fixesPassees = marqueurs.filter((m) => m.passe).reduce((s, m) => s + m.montant, 0)
  const fixesTotal = marqueurs.reduce((s, m) => s + m.montant, 0)
  return {
    jour,
    nDays,
    prorataPct: Math.round((jour / nDays) * 100),
    // part de l'argent daté déjà sorti — le 2e axe de la barre (argent vs temps)
    sortiPct: fixesTotal > 0 ? Math.round((fixesPassees / fixesTotal) * 100) : 0,
    fixesTotal,
    fixesPassees,
    fixesAVenir: fixesTotal - fixesPassees,
    marqueurs,
  }
}

// Saisonnier POUR VRAI = des revenus mensuels qui diffèrent d'un mois à l'autre.
// (buildSaison dérive aussi 12 mois identiques pour un revenu régulier — ce n'est
// pas du saisonnier, la moyenne mensuelle du plan reste alors la bonne histoire.)
function estSaisonnier(saison) {
  if (!saison || !Array.isArray(saison.revenusMensuels) || saison.revenusMensuels.length !== 12) return false
  return new Set(saison.revenusMensuels.map((v) => Math.round(num(v)))).size > 1
}

/**
 * Produit le verdict du jour depuis le snapshot canonique. PUR.
 * @param {object} snapshot   sortie de snapshotFromStore() / getSnapshot()
 * @param {object} [opts]     { maintenant?: Date|string } — référence temporelle (testable ;
 *                            fournir une HEURE locale, ex. '2026-07-16T12:00:00' — un ISO
 *                            date-seul est parsé UTC et peut glisser au jour précédent)
 * @returns {{ dateLabel, phrase: Array<{texte,fort?,sens?}>, note, rythme, source: 'plan'|'saison' } | null}
 */
export function construireVerdict(snapshot, opts = {}) {
  if (!snapshot || typeof snapshot !== 'object') return null
  let maintenant = opts.maintenant ? new Date(opts.maintenant) : new Date()
  if (isNaN(maintenant.getTime())) maintenant = new Date() // date invalide → jamais de NaN propagé
  const mois = maintenant.toLocaleDateString('fr-CA', { month: 'long' })
  // élision française : « d'avril / d'août / d'octobre », « de juillet »
  const deMois = /^[aàâeéèêiîoôuûy]/i.test(mois) ? `d'${mois}` : `de ${mois}`
  const dateLabel = maintenant.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })
  const rythme = construireRythme(snapshot, maintenant)

  // ── SITUATION 1 — saisonnier : le verdict du MOIS COURANT (jamais la moyenne).
  // Bloc ÉTANCHE : un profil saisonnier ne retombe JAMAIS sur le plan — la branche
  // plan afficherait la moyenne annuelle comme « revenus » d'un mois mort (§10).
  const saison = snapshot.saison
  if (estSaisonnier(saison)) {
    const rev = Math.round(num(saison.revenusMensuels[maintenant.getMonth()]))
    const cv = Math.round(num(saison.depensesMensuelles))
    // UNE seule vérité par bande : « sorties prévues » = coût de vie + épargne prévue
    // (comme la source plan) — sinon la phrase contredit la barre (épargne datée incluse).
    const ep = snapshot.depenses ? Math.round(num(snapshot.depenses.epargne)) : 0
    const sorties = cv + ep
    const flux = rev - sorties
    // L'ambre est RÉSERVÉ à la vraie exception : l'ANNÉE du plan négative. Le déficit
    // d'un mois creux est STRUCTUREL pour un saisonnier (c'est le rôle du coussin) —
    // un signal allumé 6 mois sur 12 ne signalerait plus rien (§12).
    const revAnnee = saison.revenusMensuels.reduce((s, v) => s + Math.max(0, num(v)), 0)
    const anneeNegative = revAnnee < sorties * 12
    const segments =
      sorties > 0
        ? [
            t(`En ${mois}, tes revenus estimés sont de `),
            f(formatCAD(rev)),
            t(' et tes sorties prévues de '),
            f(formatCAD(sorties)),
            t(' — flux du mois : '),
            f(
              flux >= 0 ? `+${formatCAD(flux)}` : `−${formatCAD(Math.abs(flux))}`,
              flux < 0 && anneeNegative ? 'neg' : 'pos',
            ),
            t('.'),
          ]
        : // sorties = 0 signifie « pas encore saisi », pas « la vie est gratuite » : on dit
          // SEULEMENT les revenus du mois (0 $ inclus — c'est l'estimation de l'usager).
          [t(`En ${mois}, tes revenus estimés sont de `), f(formatCAD(rev)), t('.')]
    const phrase = phraseSure(segments, 'Tes revenus varient selon les mois.')
    const note = filtrerFait('Selon tes revenus estimés, mois par mois.').texte || ''
    return { dateLabel, phrase, note, rythme, source: 'saison' }
  }

  // ── SITUATION 2 — plan mensuel : sorties prévues vs revenus, et le reste.
  const dep = snapshot.depenses
  if (dep && num(dep.total) > 0) {
    const total = Math.round(num(dep.total))
    const revenu = Math.round(num(dep.revenu))
    const reste = Math.round(num(dep.reste))
    let segments
    if (revenu > 0) {
      const suite =
        reste >= 0
          ? [t(' de revenus — il te reste '), f(formatCAD(reste)), t('.')]
          : [t(' de revenus — tes sorties prévues dépassent tes revenus de '), f(formatCAD(Math.abs(reste)), 'neg'), t('.')]
      segments = [
        t(`Selon ton plan ${deMois} : `),
        f(formatCAD(total)),
        t(' de sorties prévues sur '),
        f(formatCAD(revenu)),
        ...suite,
      ]
    } else {
      // Dépenses saisies mais pas de revenus → on dit ce qu'on SAIT, rien de plus.
      segments = [t(`Selon ton plan ${deMois} : `), f(formatCAD(total)), t(' de sorties prévues ce mois-ci.')]
    }
    const phrase = phraseSure(segments, 'Ton plan du mois est en place.')
    const note = filtrerFait('Selon ton plan du mois.').texte || ''
    return { dateLabel, phrase, note, rythme, source: 'plan' }
  }

  return null // rien à raconter → le héros ne se rend pas (data-aware)
}
