/* ============================================================================
   SaisieDepenses.jsx — la saisie des DÉPENSES, par classe (Besoins / Désirs /
   Épargne), en ACCORDÉON friendly : une section ouverte à la fois ; chaque ligne
   ne montre par défaut que { icône · nom · montant } — le type (fixe/variable) et
   le jour sont repliés derrière un bouton « détails ». Les catégories à 0 $ sont
   discrètes ; celles avec un montant ressortent.
   Présentation seulement : la LOGIQUE (store.depenses, maj/ajouter/supprimer) est
   inchangée.
   ========================================================================== */
import { useState } from 'react'
import { CLASSES, ABONNEMENTS_RAPIDES, depensesParDefaut, totalClasse, totalDepensesVie } from '../lib/depenses.js'
import { formatCAD } from '../lib/format.js'
import { visuelDepense } from './iconesCategories.jsx'

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
  // État d'INTERFACE seulement (n'écrit jamais dans le store) : la section ouverte.
  const [ouverte, setOuverte] = useState('besoin')

  const maj = (id, patch) => onChange(liste.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const supprimer = (id) => onChange(liste.filter((d) => d.id !== id))
  const ajouter = (classe) =>
    onChange([...liste, { id: 'custom_' + Date.now(), label: '', classe, type: 'variable', montant: null, jour: null, custom: true }])
  const ajouterAbo = (abo) => {
    if (liste.some((d) => d.id === 'abo_' + abo.id)) return
    onChange([...liste, { id: 'abo_' + abo.id, label: abo.label, classe: 'envie', type: 'fixe', montant: abo.montant, jour: 15, custom: true }])
  }
  const toggleSec = (id) => setOuverte((o) => (o === id ? null : id))

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
      <p className="card-sub">Une section à la fois — remplis, replie, passe à la suivante.</p>

      <div className="dep-acc">
        {CLASSES.map((cl) => {
          const items = liste.filter((d) => d.classe === cl.id)
          const tot = totalClasse(liste, cl.id)
          const open = ouverte === cl.id
          const nbRemplis = items.filter((d) => Number(d.montant) > 0).length
          return (
            <div className={`dep-sec ${open ? 'is-open' : ''}`} key={cl.id}>
              <button type="button" className="dep-sec-tete" aria-expanded={open} onClick={() => toggleSec(cl.id)}>
                <span className="dep-sec-l">
                  <span className="dep-sec-dot" style={{ background: cl.couleur }} aria-hidden="true" />
                  <span className="dep-sec-txt">
                    <b>{cl.label}</b>
                    <span className="dep-sec-sous">{nbRemplis > 0 ? `${nbRemplis} poste${nbRemplis > 1 ? 's' : ''}` : cl.sous}</span>
                  </span>
                </span>
                <span className="dep-sec-r">
                  <span className="dep-sec-tot">{formatCAD(tot)}<span className="dep-sec-mo"> /mois</span></span>
                  <svg className="dep-sec-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </span>
              </button>

              {open && (
                <div className="dep-sec-corps">
                  {items.map((d, i) => {
                    const v = visuelDepense(d.id, d.classe)
                    const rempli = Number(d.montant) > 0
                    return (
                      <div className={`dep-row ${rempli ? 'is-rempli' : 'is-vide'}`} key={d.id} style={{ '--cat': v.color, animationDelay: `${0.02 + i * 0.04}s` }}>
                        <span className="dep-ico" style={{ background: v.pale, color: v.color }} aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{v.icon}</svg>
                        </span>

                        {d.custom ? (
                          <input className="dep-label-input" type="text" placeholder="Nom de la dépense" value={d.label} onChange={(e) => maj(d.id, { label: e.target.value })} aria-label="Nom de la dépense" />
                        ) : (
                          <span className="dep-label">{d.label}</span>
                        )}

                        <span className="dep-montant">
                          <span className="dep-prefix">$</span>
                          <input className="dep-montant-input" inputMode="decimal" type="text" placeholder="0" value={d.montant ?? ''} onChange={(e) => maj(d.id, { montant: toNum(e.target.value) })} aria-label={`Montant — ${d.label || 'dépense'}`} />
                        </span>

                        {/* dep-meta = colonnes contrôles : sur desktop `display:contents` (chaque
                            enfant occupe sa propre colonne de la grille) ; sur mobile, devient une
                            rangée flex qui passe sous le nom. */}
                        <div className="dep-meta">
                          <span className="dep-type" role="group" aria-label="Type de dépense">
                            <button type="button" className={`dep-type-b ${d.type === 'fixe' ? 'on' : ''}`} aria-pressed={d.type === 'fixe'} onClick={() => maj(d.id, { type: 'fixe', jour: d.jour ?? 1 })}>Fixe</button>
                            <button type="button" className={`dep-type-b ${d.type === 'variable' ? 'on' : ''}`} aria-pressed={d.type === 'variable'} onClick={() => maj(d.id, { type: 'variable' })}>Variable</button>
                          </span>

                          {d.type === 'fixe' ? (
                            <span className="dep-quand" title="Jour du mois — apparaît sur ton calendrier">
                              <svg className="dep-quand-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
                              le <input className="dep-jour-input" inputMode="numeric" type="text" value={d.jour ?? 1} onChange={(e) => maj(d.id, { jour: clampJour(e.target.value) })} aria-label="Jour du mois" /> du mois
                            </span>
                          ) : (
                            <span className="dep-quand dep-quand-libre">au besoin</span>
                          )}

                          {d.custom ? (
                            <button type="button" className="dep-suppr" onClick={() => supprimer(d.id)} aria-label={`Retirer ${d.label || 'la dépense'}`}>×</button>
                          ) : (
                            <span className="dep-suppr-vide" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    )
                  })}

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
              )}
            </div>
          )
        })}
      </div>

      <p className="revenu-calc dep-total">
        Coût de vie ≈ <b>{formatCAD(coutVie)}</b> par mois{epargne > 0 ? ` · épargne ${formatCAD(epargne)}` : ''}
      </p>
    </section>
  )
}
