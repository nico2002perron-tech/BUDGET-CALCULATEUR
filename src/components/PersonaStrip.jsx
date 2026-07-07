/* ============================================================================
   PersonaStrip.jsx — LA PERSONNALITÉ d'un KPI (carré de sable).

   4 personnalités : neutre (rien — juste la métrique) · mascotte (l'icône de
   la catégorie devient un personnage NOMMÉ) · mentor (une VOIX nommée énonce
   le fait) · entité nommée (nom + photo LOCALE compressée + couleur — le
   pipeline photo du studio, réutilisé via lib/photo.js).

   GARDE-FOU AMF : la personnification donne une IDENTITÉ et une VOIX, jamais
   un jugement — le fait affiché est le texteFactuel du KPI, repassé par
   filtrerFait ; aucune binette émotive ; l'ambre reste réservé à l'exception.
   PRÉSENTATION PURE : aucun chiffre calculé ici (le fait vient de resolveKPI).

   props : { persona {type, voix?, nom?, photo?, couleur?}, onChange, kpi
             (résolution du KPI), kpiId, domaine }
   ========================================================================== */
import { useRef } from 'react'
import { filtrerFait } from '../recettes/schema.js'
import { PALETTE_ACCENTS, accentValide, photoBornee } from '../lib/entites.js'
import { lirePhoto } from '../lib/photo.js'
import { MASCOTTES, MASCOTTE_REPLI, VOIX_MENTOR } from '../lib/personas.js'
import { sons } from '../lib/sons.js'
import { iconeKPI } from './iconesGalerie.jsx'
const TYPES_PERSONA = [
  { id: 'neutre', label: 'Neutre' },
  { id: 'mascotte', label: 'Mascotte' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'entite', label: 'Entité nommée' },
]

const initiales = (nom) => nom.split(' ').map((m) => m[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

export default function PersonaStrip({ persona, onChange, kpi, kpiId, domaine }) {
  const photoRef = useRef(null)
  const p = persona && persona.type ? persona : { type: 'neutre' }
  // LE fait : celui du KPI (déjà filtré par resolveKPI), repassé au filtre —
  // jamais une phrase de persona qui n'est pas un fait.
  const f = filtrerFait((kpi && kpi.texteFactuel) || '')
  const fait = f.ok && f.texte ? f.texte : ''
  const poser = (maj) => onChange({ ...p, ...maj })
  const voix = VOIX_MENTOR.find((v) => v.id === p.voix) || VOIX_MENTOR[0]

  return (
    <div className="persona">
      <div className="sable-types" role="group" aria-label="Personnalité du KPI">
        <span className="sable-types-l">Personnalité</span>
        {TYPES_PERSONA.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sable-type${p.type === t.id ? ' est-actif' : ''}`}
            aria-pressed={p.type === t.id}
            onClick={() => { sons.tap(); onChange(t.id === 'neutre' ? { type: 'neutre' } : { ...p, type: t.id }) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* MASCOTTE : le personnage de la catégorie (bulle accent) + le fait. */}
      {p.type === 'mascotte' && (
        <div className="persona-bande" role="note">
          <span className="persona-bulle" aria-hidden="true">{iconeKPI(kpiId, domaine)}</span>
          <p className="persona-texte">
            <b>{MASCOTTES[domaine] || MASCOTTE_REPLI}</b>
            {fait && <span> · {fait}</span>}
          </p>
        </div>
      )}

      {/* MENTOR : une voix (initiales) énonce le fait ; 3 voix au choix. */}
      {p.type === 'mentor' && (
        <div className="persona-bande" role="note">
          <span className="persona-avatar" aria-hidden="true">{initiales(voix.nom)}</span>
          <div className="persona-corps">
            <p className="persona-texte">
              <b>{voix.nom}</b>
              {fait && <span> : « {fait} »</span>}
            </p>
            <div className="persona-voix" role="group" aria-label="Choisir la voix">
              {VOIX_MENTOR.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`persona-voix-chip${voix.id === v.id ? ' est-choisie' : ''}`}
                  aria-pressed={voix.id === v.id}
                  onClick={() => { sons.tap(); poser({ voix: v.id }) }}
                >
                  {v.nom}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ENTITÉ NOMMÉE : nom + photo locale (re-bornée AU RENDU : data:image/
          seulement — jamais une URL réseau d'un silo importé) + couleur. */}
      {p.type === 'entite' && (() => { const photo = photoBornee(p.photo); return (
        <div className="persona-bande persona-entite" role="note" style={{ '--pacc': accentValide(p.couleur) }}>
          {photo ? (
            <span className="persona-photo" style={{ backgroundImage: `url(${photo})` }} aria-hidden="true" />
          ) : (
            <span className="persona-bulle persona-init" aria-hidden="true">{String(p.nom || 'E').trim().charAt(0).toUpperCase() || 'E'}</span>
          )}
          <div className="persona-corps">
            <p className="persona-texte">
              <b>{p.nom || 'Ton entité'}</b>
              {fait && <span> · {fait}</span>}
            </p>
            <div className="persona-form">
              <input
                type="text"
                className="persona-nom"
                placeholder="Nomme-la (ex. Mon phare)"
                value={p.nom || ''}
                maxLength={40}
                onChange={(e) => poser({ nom: e.target.value })}
                aria-label="Nom de l’entité"
              />
              <button type="button" className="persona-photo-btn" onClick={() => photoRef.current && photoRef.current.click()}>
                {p.photo ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const fich = e.target.files && e.target.files[0]
                  // mise à jour FONCTIONNELLE : le décodage est asynchrone — le nom ou
                  // la couleur tapés entre-temps ne sont jamais écrasés.
                  lirePhoto(fich, (ph) => onChange((prev) => ({ ...(prev && prev.type ? prev : p), type: 'entite', photo: ph })))
                  e.target.value = ''
                }}
              />
              <div className="gal-accents" role="group" aria-label="Couleur de l’entité">
                {PALETTE_ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`gal-accent${(p.couleur || 'cyan') === a.id ? ' is-choisi' : ''}`}
                    style={{ background: a.hex }}
                    onClick={() => poser({ couleur: a.id })}
                    aria-label={`Couleur ${a.id}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) })()}
    </div>
  )
}
