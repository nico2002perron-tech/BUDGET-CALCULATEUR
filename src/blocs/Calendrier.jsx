/* ============================================================================
   Calendrier.jsx — bloc « journal de bord » : une grille mensuelle qui montre
   l'argent qui RENTRE (paies, cyan) et qui SORT (dépenses fixes, ambre), jour
   par jour. Navigation entre les mois. Faits seulement (VISION §11).
   props :
     params : { vue:'mois', souligner:'echeances_proches'|'aucun' }
     data   : { revenus:{…modèle de paie}, depenses:[{jour,label,montant,classe,type}] }  ← snapshot
   ========================================================================== */
import { useState } from 'react'
import { evenementsDuMois } from '../lib/calendrier.js'
import { formatCAD } from '../lib/format.js'

const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

export default function Calendrier({ params = {}, data = {} }) {
  const [offset, setOffset] = useState(0)
  const [sel, setSel] = useState(null)

  const base = new Date()
  const total = base.getMonth() + offset
  const y = base.getFullYear() + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12

  const revenus = data.revenus || {}
  const depRec = Array.isArray(data.depenses) ? data.depenses : []
  const { nDays, entrees, sorties } = evenementsDuMois(revenus, depRec, y, m)

  // Agrégation par jour.
  const parJour = {}
  const slot = (j) => (parJour[j] = parJour[j] || { entree: 0, sortie: 0, items: [] })
  entrees.forEach((e) => { const s = slot(e.jour); s.entree += e.montant; s.items.push({ ...e, sens: 'entree' }) })
  sorties.forEach((x) => { const s = slot(x.jour); s.sortie += x.montant; s.items.push({ ...x, sens: 'sortie' }) })

  const startDow = (new Date(y, m, 1).getDay() + 6) % 7 // lundi = 0
  const cellules = []
  for (let i = 0; i < startDow; i++) cellules.push(null)
  for (let d = 1; d <= nDays; d++) cellules.push(d)

  const isToday = (d) => base.getFullYear() === y && base.getMonth() === m && base.getDate() === d
  const totEntrees = entrees.reduce((a, e) => a + e.montant, 0)
  const totSorties = sorties.reduce((a, e) => a + e.montant, 0)

  // souligner : la prochaine sortie du mois (≥ aujourd'hui si on est dans le mois courant)
  let proche = null
  if (params.souligner !== 'aucun') {
    const depuis = base.getFullYear() === y && base.getMonth() === m ? base.getDate() : 1
    const joursSortie = sorties.map((s) => s.jour).filter((j) => j >= depuis).sort((a, b) => a - b)
    proche = joursSortie.length ? joursSortie[0] : null
  }

  const aller = (pas) => { setOffset((o) => o + pas); setSel(null) }
  const jourSel = sel != null ? parJour[sel] : null

  return (
    <section className="card cal">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
        Ton calendrier
      </div>

      <div className="cal-nav">
        <button type="button" className="cal-nav-b" onClick={() => aller(-1)} aria-label="Mois précédent">‹</button>
        <span className="cal-nav-lbl">{MOIS_LONG[m]} {y}</span>
        <button type="button" className="cal-nav-b" onClick={() => aller(1)} aria-label="Mois suivant">›</button>
      </div>

      <div className="cal-sem" aria-hidden="true">
        {JOURS.map((j, i) => <span key={j} className={`cal-sem-c ${i >= 5 ? 'we' : ''}`}>{j}</span>)}
      </div>

      <div className="cal-grille" role="grid">
        {cellules.map((d, i) => {
          if (d == null) return <span key={`p${i}`} className="cal-cell cal-pad" />
          const s = parJour[d]
          const actif = sel === d
          return (
            <button
              type="button"
              key={d}
              className={`cal-cell ${s ? 'plein' : ''} ${isToday(d) ? 'today' : ''} ${proche === d ? 'proche' : ''} ${actif ? 'sel' : ''}`}
              onClick={() => setSel(actif ? null : d)}
              aria-label={`${d} ${MOIS_LONG[m]}${s ? '' : ' — rien'}`}
            >
              <span className="cal-cell-d">{d}</span>
              <span className="cal-cell-pts">
                {s && s.entree > 0 && <span className="cal-pt cal-in" />}
                {s && s.sortie > 0 && <span className="cal-pt cal-out" />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="cal-pied">
        {jourSel ? (
          <div className="cal-detail">
            <div className="cal-detail-tete">{sel} {MOIS_LONG[m]}</div>
            <ul className="cal-detail-liste">
              {jourSel.items.map((it, k) => (
                <li key={k} className={it.sens === 'entree' ? 'in' : 'out'}>
                  <span className="cal-detail-l">{it.label}</span>
                  <span className="cal-detail-m">{it.sens === 'entree' ? '+' : '−'}{formatCAD(it.montant)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="cal-resume">
            <span className="cal-resume-in"><span className="cal-pt cal-in" /> {formatCAD(totEntrees)} de paies</span>
            <span className="cal-resume-out"><span className="cal-pt cal-out" /> {formatCAD(totSorties)} de sorties fixes</span>
          </div>
        )}
      </div>
      <p className="cal-aide">Touche un jour pour voir ce qui s&rsquo;y passe.</p>
    </section>
  )
}
