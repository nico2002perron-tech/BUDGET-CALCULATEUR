/* ============================================================================
   StudioConversation.jsx — Tranche studio, ÉTAGE E : LA CONVERSATION PILOTÉE + le « BAM ».

   La tour mène le fil (bulles « tour » chaleureuses + réponses tappables) :
     cout → echeance → [« laisse-moi aller voir »] → cartes de scénario → perso (nom +
     photo locale + accent) → la tuile carte_entite se matérialise dans le dashboard.

   DISCIPLINE : zéro nouvel appel IA (déterministe). Voix VERROUILLÉE (claire-
   conversationnelle), jamais froide. Faits + chemins (l'usager tape), jamais de conseil.
   Photo LOCALE (compressée/bornée), jamais envoyée. Réutilise le canal (entonnoir),
   genererScenarios, construireEntite — ne duplique rien. Pas de curseur.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { CANAUX, coerceMontant } from '../recettes/entonnoir.js'
import { genererScenarios } from '../lib/scenarios.js'
import { PALETTE_ACCENTS, photoBornee, MAX_PHOTO_CARS, accentValide } from '../lib/entites.js'
import { formatCAD } from '../lib/format.js'

// Le moment « laisse-moi aller voir » : assez long pour qu'on CROIE que la tour a
// regardé tes chiffres, pas trop pour ne pas frustrer. À régler à l'œil.
const DUREE_CALCUL = 1300

const ETAPES = CANAUX.projet_abordable.etapes
const Q = (id) => { const e = ETAPES.find((x) => x.id === id); return e ? e.question : '' }
const OPTIONS_ECHEANCE = (ETAPES.find((e) => e.id === 'echeance') || {}).options || []

// Lit une photo LOCALE : SVG → tel quel ; raster → downscale canvas + JPEG, borné (~200 Ko).
function lirePhoto(file, cb) {
  if (!file) return cb(null)
  const r = new FileReader()
  if (file.type === 'image/svg+xml') { r.onload = () => cb(photoBornee(String(r.result))); r.readAsDataURL(file); return }
  r.onload = () => {
    const img = new Image()
    img.onload = () => {
      const max = 720
      let w = img.width, h = img.height
      if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k) }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      let q = 0.82, out = c.toDataURL('image/jpeg', q)
      while (out.length > MAX_PHOTO_CARS && q > 0.4) { q -= 0.15; out = c.toDataURL('image/jpeg', q) }
      cb(photoBornee(out))
    }
    img.onerror = () => cb(null)
    img.src = String(r.result)
  }
  r.readAsDataURL(file)
}

export default function StudioConversation({ snapshot, onFini, onAnnuler }) {
  const [phase, setPhase] = useState('cout') // cout · echeance · calcul · scenarios · perso
  const [fil, setFil] = useState([{ de: 'tour', texte: 'On va voir ça ensemble. Combien coûte ton projet ?' }])
  const [cout, setCout] = useState('')
  const [echeance, setEcheance] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [scenarioChoisi, setScenarioChoisi] = useState(null)
  const [nom, setNom] = useState('')
  const [photo, setPhoto] = useState(null)
  const [couleur, setCouleur] = useState('cyan')
  const filRef = useRef(null)
  const photoRef = useRef(null)

  const direTour = (texte) => setFil((f) => [...f, { de: 'tour', texte }])
  const direToi = (texte) => setFil((f) => [...f, { de: 'toi', texte }])

  useEffect(() => { if (filRef.current) filRef.current.scrollTop = filRef.current.scrollHeight }, [fil, phase])

  // Le moment « laisse-moi aller voir » → calcule les scénarios après un court instant.
  useEffect(() => {
    if (phase !== 'calcul') return
    const id = setTimeout(() => {
      setScenarios(genererScenarios(snapshot, { cout: coerceMontant(cout), echeance }))
      direTour('Voici des chemins possibles — tape celui que tu veux suivre.')
      setPhase('scenarios')
    }, DUREE_CALCUL)
    return () => clearTimeout(id)
  }, [phase, snapshot, cout, echeance])

  const validerCout = (e) => {
    e.preventDefault()
    const m = coerceMontant(cout)
    if (m == null) return // montant non valide → on reste, rien ne casse
    direToi(formatCAD(m))
    direTour(Q('echeance'))
    setPhase('echeance')
  }
  const choisirEcheance = (opt) => {
    setEcheance(opt.id)
    direToi(opt.label)
    direTour('Laisse-moi regarder tes chiffres…')
    setPhase('calcul')
  }
  const choisirScenario = (s) => {
    setScenarioChoisi(s)
    direToi(s.label)
    direTour('Beau choix. Rends-la tienne : un nom, une photo, une couleur.')
    setPhase('perso')
  }
  const surPhoto = (e) => { const f = e.target.files && e.target.files[0]; lirePhoto(f, setPhoto); e.target.value = '' }
  const materialiser = () => {
    onFini({
      canal: 'projet_abordable',
      reponses: { cout: coerceMontant(cout), echeance, nom: nom.trim() || 'Mon projet', photo, couleur },
      scenarioChoisi,
    })
  }

  return (
    <section className="studio" aria-label="Studio — fabrique ton indicateur">
      <div className="studio-tete">
        <span className="studio-titre"><span className="brand-dot" aria-hidden="true" /> Ta tour fabrique avec toi</span>
        <button type="button" className="studio-x" onClick={onAnnuler} aria-label="Fermer">×</button>
      </div>

      <div className="studio-fil" ref={filRef}>
        {fil.map((m, i) => (
          <div className={`studio-bulle ${m.de === 'tour' ? 'is-tour' : 'is-toi'}`} key={i} style={{ '--i': i }}>{m.texte}</div>
        ))}
        {phase === 'calcul' && (
          <div className="studio-bulle is-tour studio-calc" aria-live="polite">
            <span className="studio-dots"><i /><i /><i /></span>
          </div>
        )}
      </div>

      <div className="studio-saisie">
        {phase === 'cout' && (
          <form className="studio-montant" onSubmit={validerCout}>
            <input className="chat-input" type="text" inputMode="numeric" placeholder="ex. 4 000 $" value={cout} onChange={(e) => setCout(e.target.value)} aria-label="Coût du projet" autoFocus />
            <button className="studio-go" type="submit" disabled={coerceMontant(cout) == null}>Continuer</button>
          </form>
        )}

        {phase === 'echeance' && (
          <div className="studio-chips">
            {OPTIONS_ECHEANCE.map((o) => (
              <button type="button" className="studio-chip" key={o.id} onClick={() => choisirEcheance(o)}>{o.label}</button>
            ))}
          </div>
        )}

        {phase === 'scenarios' && (
          <div className="studio-scenarios">
            {scenarios.map((s, i) => (
              <button type="button" className="studio-scn" key={i} onClick={() => choisirScenario(s)}>
                <span className="studio-scn-l">{s.label}</span>
                <span className="studio-scn-tap" aria-hidden="true">tape ›</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'perso' && (
          <div className="studio-perso" style={{ '--ce-accent': accentValide(couleur) }}>
            <input className="chat-input" type="text" placeholder="Nomme ton projet (ex. Voyage au Japon)" value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Nom du projet" maxLength={40} autoFocus />
            <div className="studio-perso-ligne">
              <button type="button" className="studio-photo-btn" onClick={() => photoRef.current && photoRef.current.click()}>
                {photo ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {photo && <span className="studio-photo-apercu" style={{ backgroundImage: `url(${photo})` }} aria-hidden="true" />}
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={surPhoto} />
            </div>
            <div className="studio-palette" role="radiogroup" aria-label="Accent de couleur">
              {PALETTE_ACCENTS.map((a) => (
                <button type="button" key={a.id} className={`studio-accent${couleur === a.id ? ' is-actif' : ''}`} style={{ background: a.hex }} onClick={() => setCouleur(a.id)} aria-label={a.id} aria-pressed={couleur === a.id} />
              ))}
            </div>
            <button type="button" className="studio-ajouter" onClick={materialiser}>Ajouter à ma tour</button>
          </div>
        )}
      </div>
    </section>
  )
}
