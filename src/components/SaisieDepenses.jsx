/* ============================================================================
   SaisieDepenses.jsx — la saisie des DÉPENSES, par classe (Besoins / Désirs /
   Épargne). Chaque poste : montant, type (fixe → daté / variable), et son JOUR
   du mois s'il est fixe → il atterrit sur le calendrier. Catégories pré-remplies
   (placeholders gris, jamais de grille vide), abonnements rapides, ajout custom.
   On ne touche pas à la logique : on écrit dans store.depenses (silo local).
   ========================================================================== */
import { CLASSES, ABONNEMENTS_RAPIDES, depensesParDefaut, totalClasse, totalDepensesVie } from '../lib/depenses.js'
import { formatCAD } from '../lib/format.js'

function toNum(v) {
  if (v === '' || v == null) return null
  const clean = String(v).replace(/[^\d.]/g, '')
  if (clean === '' || clean === '.') return null // saisie non numérique → vide (pas un 0 fantôme)
  const n = Number(clean)
  return isFinite(n) ? n : null
}
function clampJour(v) {
  const n = toNum(v) || 1
  return Math.min(31, Math.max(1, Math.round(n)))
}

export default function SaisieDepenses({ depenses, onChange }) {
  const liste = Array.isArray(depenses) && depenses.length ? depenses : depensesParDefaut()

  const maj = (id, patch) => onChange(liste.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const supprimer = (id) => onChange(liste.filter((d) => d.id !== id))
  const ajouter = (classe) =>
    onChange([...liste, { id: 'custom_' + Date.now(), label: '', classe, type: 'variable', montant: null, jour: null, custom: true }])
  const ajouterAbo = (abo) => {
    if (liste.some((d) => d.id === 'abo_' + abo.id)) return
    onChange([...liste, { id: 'abo_' + abo.id, label: abo.label, classe: 'envie', type: 'fixe', montant: abo.montant, jour: 15, custom: true }])
  }

  const coutVie = totalDepensesVie(liste)
  const epargne = totalClasse(liste, 'epargne')

  return (
    <section className="card saisie">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7h18v12H3z" /><path d="M3 11h18M16 15h2" />
        </svg>
        Tes dépenses
      </div>
      <p className="card-sub">Combien, et quand — les postes fixes se posent sur ton calendrier.</p>

      {CLASSES.map((cl) => {
        const items = liste.filter((d) => d.classe === cl.id)
        const tot = totalClasse(liste, cl.id)
        return (
          <div className="dep-groupe" key={cl.id}>
            <div className="dep-groupe-tete">
              <span className="dep-groupe-l">
                <b>{cl.label}</b> <span className="dep-groupe-sous">{cl.sous}</span>
              </span>
              <span className="dep-groupe-tot">{formatCAD(tot)}<span className="dep-groupe-mo"> /mois</span></span>
            </div>

            {items.map((d) => (
              <div className="dep-row" key={d.id}>
                {d.custom ? (
                  <input className="dep-label-input" type="text" placeholder="Nom de la dépense" value={d.label} onChange={(e) => maj(d.id, { label: e.target.value })} aria-label="Nom de la dépense" />
                ) : (
                  <span className="dep-label">{d.label}</span>
                )}

                <span className="dep-type" role="group" aria-label="Type de dépense">
                  <button type="button" className={`dep-type-b ${d.type === 'fixe' ? 'on' : ''}`} aria-pressed={d.type === 'fixe'} onClick={() => maj(d.id, { type: 'fixe', jour: d.jour ?? 1 })}>Fixe</button>
                  <button type="button" className={`dep-type-b ${d.type === 'variable' ? 'on' : ''}`} aria-pressed={d.type === 'variable'} onClick={() => maj(d.id, { type: 'variable' })}>Variable</button>
                </span>

                <span className="dep-montant">
                  <span className="dep-prefix">$</span>
                  <input className="dep-montant-input" inputMode="decimal" type="text" placeholder="0" value={d.montant ?? ''} onChange={(e) => maj(d.id, { montant: toNum(e.target.value) })} aria-label={`Montant — ${d.label || 'dépense'}`} />
                </span>

                {d.type === 'fixe' ? (
                  <span className="dep-jour">le <input className="dep-jour-input" inputMode="numeric" type="text" value={d.jour ?? 1} onChange={(e) => maj(d.id, { jour: clampJour(e.target.value) })} aria-label="Jour du mois" /></span>
                ) : (
                  <span className="dep-jour dep-jour-vide" aria-hidden="true">—</span>
                )}

                {d.custom ? (
                  <button type="button" className="dep-suppr" onClick={() => supprimer(d.id)} aria-label={`Retirer ${d.label || 'la dépense'}`}>×</button>
                ) : (
                  <span className="dep-suppr-vide" aria-hidden="true" />
                )}
              </div>
            ))}

            {cl.id === 'envie' && (
              <div className="dep-abos">
                {ABONNEMENTS_RAPIDES.map((a) => {
                  const ajoute = liste.some((d) => d.id === 'abo_' + a.id)
                  return (
                    <button type="button" key={a.id} className={`dep-abo ${ajoute ? 'on' : ''}`} disabled={ajoute} onClick={() => ajouterAbo(a)}>
                      + {a.label} <span className="dep-abo-m">{a.montant}$</span>
                    </button>
                  )
                })}
              </div>
            )}

            <button type="button" className="dep-ajouter" onClick={() => ajouter(cl.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
              Ajouter une dépense
            </button>
          </div>
        )
      })}

      <p className="revenu-calc dep-total">
        Coût de vie ≈ <b>{formatCAD(coutVie)}</b> par mois{epargne > 0 ? ` · épargne ${formatCAD(epargne)}` : ''}
      </p>
    </section>
  )
}
