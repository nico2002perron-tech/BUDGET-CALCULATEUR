/* ============================================================================
   Galerie.jsx — LE STUDIO GUIDÉ (v3, façon Duolingo). Le remède au mur :
   UNE question à la fois, JAMAIS plus de ~5 choix à l'écran, des boutons
   joufflus qui s'enfoncent au tap (rebord 3D), une colonne centrée, peu de mots.

   ÉTAPE 0 (accueil) : la barre « décris-le » + LA carte « choisi pour toi »
   (une seule, curée) + « Qu'est-ce que tu veux surveiller ? » → 5 gros
   boutons-familles (allumés avec leur compte d'outils prêts ; éteints en
   tirets avec leur condition).
   ÉTAPE 1 (famille) : ← retour + le grand tableau de la famille + ses 3
   meilleurs outils (vraies valeurs) + « Voir les N autres ». Une famille
   éteinte → une seule invitation : « N outils s'allument avec … · 2 min ».
   ÉTAPE 2 : l'essayage (vrai bloc + formes + couleurs ; feuille du bas mobile).

   Les cerveaux restent purs (lib/galerie.js, suggestions, formesPourKPI).
   Zéro emoji, zéro dessin — icônes en ligne + vraies valeurs + couleurs vives.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { construireGalerie, DOMAINES, ACCENT_SITUATION } from '../lib/galerie.js'
import { suggererIndicateurs } from '../recettes/suggestions.js'
import { formesPourKPI, nomForme, kpiPourId } from '../recettes/bibliotheque-kpis.js'
import { PALETTE_ACCENTS } from '../lib/entites.js'
import { composerRecette } from '../recettes/composer.js'
import { formatKPI } from '../lib/format.js'
import MoteurRendu from '../recettes/MoteurRendu.jsx'
import { iconeKPI, ICONE_DOMAINE, ICONE_SITUATION, ICONES_CHOIX, I_VEDETTE, I_ECLAIR } from './iconesGalerie.jsx'

const I_ETINCELLE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
  </svg>
)
const I_FLECHE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
const I_CHEVRON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
)
const I_RETOUR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
)

const PLACEHOLDERS = [
  'ex. « est-ce que je peux me permettre un char à 30 000 $ ? »',
  'ex. « combien de mois mon coussin tient ? »',
  'ex. « où va ma paie ? »',
  'ex. « je suis paysagiste, je gagne rien l’hiver »',
  'ex. « ma valeur nette monte-tu ? »',
]

// Les 5 familles, en mots de tous les jours (le domaine reste la clé technique).
const FAMILLES = [
  { id: 'budget', label: 'Mon argent du mois', tableau: 'mon_budget' },
  { id: 'coussin', label: 'Mon coussin de sécurité', tableau: null },
  { id: 'saisonnier', label: 'Ma saison', tableau: 'revenu_saisonnier' },
  { id: 'impot', label: 'Mes impôts', tableau: 'mon_portrait' },
  { id: 'patrimoine', label: 'Mon patrimoine', tableau: 'ma_vie' },
]

const reduitMouvement = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Le bloc-héros (KPI) d'une recette — pour l'icône d'une vue sauvée. PUR.
const heroDeRecette = (recette) => (recette && Array.isArray(recette.blocs) ? recette.blocs.find((b) => b && b.KPI) : null)

/* La vraie valeur qui COMPTE jusqu'à son chiffre quand la carte entre à l'écran. */
function ValeurVivante({ valeur, unite }) {
  const ref = useRef(null)
  const [affiche, setAffiche] = useState(() => formatKPI(valeur, unite))
  useEffect(() => {
    const el = ref.current
    if (!el || typeof valeur !== 'number' || !isFinite(valeur) || valeur === 0) return
    if (reduitMouvement() || typeof IntersectionObserver === 'undefined') { setAffiche(formatKPI(valeur, unite)); return }
    let raf
    const io = new IntersectionObserver((entrees) => {
      if (!entrees[0].isIntersecting) return
      io.disconnect()
      const debut = performance.now()
      const DUREE = 700
      const tick = (t) => {
        const p = Math.min(1, (t - debut) / DUREE)
        const ease = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)
        setAffiche(formatKPI(valeur * ease, unite))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.2 })
    io.observe(el)
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [valeur, unite])
  return <div className="gal-valeur" ref={ref}>{affiche}</div>
}

/* Le « bam » : un clone de la carte s'envole vers ta tour (décoratif). */
function volVersLaTour(fromEl) {
  try {
    if (reduitMouvement() || !fromEl) return
    const cible = document.querySelector('.tour-board') || document.querySelector('.rail-item.is-active, .tab-item.is-active')
    if (!cible) return
    const a = fromEl.getBoundingClientRect()
    const b = cible.getBoundingClientRect()
    const clone = fromEl.cloneNode(true)
    Object.assign(clone.style, {
      position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
      margin: '0', zIndex: '999', pointerEvents: 'none', background: '#fff', borderRadius: '20px', overflow: 'hidden',
      boxShadow: '0 30px 60px -20px rgba(3,4,94,.35)',
      transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease',
    })
    document.body.appendChild(clone)
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    requestAnimationFrame(() => {
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.08)`
      clone.style.opacity = '0'
    })
    setTimeout(() => clone.remove(), 620)
  } catch { /* purement décoratif */ }
}

/* L'essayage (étape 2) : CRÉER SON kpi — sa cible, sa forme, sa couleur, son
   icône, SON nom. L'aperçu est le VRAI bloc, recalculé en direct (la cible passe
   par resolveKPI — jamais un chiffre inventé). Feuille du bas mobile. */
export function EssayageForme({ kpi, snapshot, onAjouter, onFermer }) {
  const formes = useMemo(() => formesPourKPI(kpi.id, snapshot, {}), [kpi.id, snapshot])
  const [forme, setForme] = useState(formes[0])
  const [accent, setAccent] = useState(kpi.accent)
  const [nom, setNom] = useState('')
  const [icone, setIcone] = useState(null) // null = l'icône automatique du KPI
  const [cible, setCible] = useState(kpi.reglage ? kpi.reglage.defaut : null)
  const apercuRef = useRef(null)
  if (formes.length === 0) return null

  const r = kpi.reglage
  const params = r && cible != null ? { cible } : {}
  const bougeCible = (delta) => setCible(Math.min(r.max, Math.max(r.min, (cible || r.defaut) + delta)))

  return (
    <>
      <div className="gal-essai-fond" onClick={onFermer} aria-hidden="true" />
      <div className="gal-essai" style={{ '--acc': accent }} role="dialog" aria-label={`Essayage — ${kpi.question}`}>
        <span className="gal-essai-poignee" aria-hidden="true" />
        <div className="gal-essai-tete">
          <span className="gal-essai-titre">{kpi.question}</span>
          <button type="button" className="gal-essai-x" onClick={onFermer} aria-label="Fermer l'essayage">×</button>
        </div>

        <div className="gal-essai-corps">
          {/* L'aperçu VIVANT : la cible, la forme et la couleur s'y reflètent en direct. */}
          <div className="gal-essai-apercu" ref={apercuRef} key={`${forme}:${cible}`}>
            <MoteurRendu recette={{ situation: `essai_${kpi.id}`, titre: '', blocs: [{ KPI: kpi.id, forme, params }] }} snapshot={snapshot} />
          </div>

          <div className="gal-essai-choix">
            {/* SA CIBLE : la tienne — le KPI se recalcule dessus, en direct. */}
            {r && (
              <>
                <span className="gal-essai-l">{r.label}</span>
                <div className="gal-cible" role="group" aria-label={`${r.label} (${r.unite})`}>
                  <button type="button" className="mis-pas gal-cible-pas" onClick={() => bougeCible(-r.pas)} aria-label={`Moins ${r.pas}`}>−</button>
                  <span className="gal-cible-val">{cible}<small>{r.unite}</small></span>
                  <button type="button" className="mis-pas gal-cible-pas" onClick={() => bougeCible(r.pas)} aria-label={`Plus ${r.pas}`}>+</button>
                </div>
              </>
            )}

            {formes.length > 1 && (
              <>
                <span className="gal-essai-l">Sa forme</span>
                <div className="gal-formes" role="group" aria-label="Choisis la forme">
                  {formes.map((f) => (
                    <button key={f} type="button" className={`gal-forme${f === forme ? ' is-choisie' : ''}`} onClick={() => setForme(f)} aria-pressed={f === forme}>
                      {nomForme(f)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <span className="gal-essai-l">Ta couleur</span>
            <div className="gal-accents" role="group" aria-label="Choisis la couleur">
              {PALETTE_ACCENTS.map((a) => (
                <button key={a.id} type="button" className={`gal-accent${a.hex === accent ? ' is-choisi' : ''}`} style={{ background: a.hex }} onClick={() => setAccent(a.hex)} aria-pressed={a.hex === accent} aria-label={`Couleur ${a.id}`} />
              ))}
            </div>

            {/* SON ICÔNE : la première = l'automatique du KPI, le reste = ton choix. */}
            <span className="gal-essai-l">Son icône</span>
            <div className="gal-icones" role="group" aria-label="Choisis l'icône">
              <button
                type="button"
                className={`gal-icone${icone == null ? ' is-choisie' : ''}`}
                onClick={() => setIcone(null)}
                aria-pressed={icone == null}
                aria-label="Icône automatique"
              >
                {iconeKPI(kpi.id, kpi.domaine)}
              </button>
              {ICONES_CHOIX.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`gal-icone${icone === c.id ? ' is-choisie' : ''}`}
                  onClick={() => setIcone(c.id)}
                  aria-pressed={icone === c.id}
                  aria-label={`Icône ${c.id}`}
                >
                  {c.svg}
                </button>
              ))}
            </div>

            {/* SON NOM : le tien. Vide = la question du registre. */}
            <span className="gal-essai-l">Son nom</span>
            <input
              type="text"
              className="gal-nom"
              value={nom}
              placeholder={kpi.question}
              maxLength={60}
              onChange={(e) => setNom(e.target.value)}
              aria-label="Nomme ton outil"
            />

            <button
              type="button"
              className="gal-ajouter"
              onClick={() => {
                volVersLaTour(apercuRef.current)
                onAjouter(
                  { situation: `kpi_${kpi.id}`, titre: nom.trim() || kpi.question, blocs: [{ KPI: kpi.id, forme, params }] },
                  accent,
                  icone,
                )
              }}
            >
              Ajouter à ma tour
            </button>
            <p className="gal-essai-note">Tu pourras tout retoucher en tout temps.</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Galerie({ snapshot, widgets = [], mesVues = [], chargement, erreur, onDecrire, onAjouter, onAppliquerVue, onSupprimerVue, onAllerSaisie }) {
  const galerie = useMemo(() => construireGalerie(snapshot), [snapshot])
  // L'invitation d'une famille éteinte vient de SES propres cartes givrées (jamais
  // de celles d'une autre famille — la mission lancée doit être la bonne).
  const givreDe = (domaineId) => galerie.indicateurs.find((k) => !k.pret && k.domaine === domaineId)
  const dejaLa = useMemo(
    () => new Set((Array.isArray(widgets) ? widgets : []).map((w) => w.recette && w.recette.situation).filter(Boolean)),
    [widgets],
  )
  // LA carte « choisi pour toi » : la meilleure suggestion, une seule (Duolingo : un pas à la fois).
  const vedette = useMemo(
    () => suggererIndicateurs(snapshot).filter((s) => !dejaLa.has(s.situation))[0] || null,
    [snapshot, dejaLa],
  )
  // LA VITRINE : la vedette se montre en VRAIE mini-tuile vivante (aperçu MoteurRendu
  // avec tes chiffres) — on VOIT la belle chose finie, on a envie de l'ajouter.
  const vedetteAccent = vedette ? ACCENT_SITUATION[vedette.situation] || '#00b4d8' : null
  const vedetteRecette = useMemo(
    () => (vedette ? composerRecette(vedette.situation, {}, snapshot) : null),
    [vedette, snapshot],
  )
  const [famille, setFamille] = useState(null) // null = accueil ; sinon id de domaine
  const [voirTout, setVoirTout] = useState(false)
  const [essai, setEssai] = useState(null)
  const [texte, setTexte] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(id)
  }, [])

  const pretsParDomaine = (id) => galerie.indicateurs.filter((k) => k.pret && k.domaine === id)
  const tableauDe = (fid) => {
    const f = FAMILLES.find((x) => x.id === fid)
    return f && f.tableau ? galerie.tableaux.find((t) => t.situation === f.tableau) : null
  }
  const domaine = DOMAINES.find((d) => d.id === famille)
  const familleDef = FAMILLES.find((f) => f.id === famille)
  const kpiEssai = essai ? galerie.indicateurs.find((k) => k.id === essai && k.pret) : null

  const soumettre = (e) => {
    e.preventDefault()
    const t = texte.trim()
    if (!t || chargement) return
    onDecrire(t)
    setTexte('')
  }
  const ouvrirFamille = (fid) => { setFamille(fid); setVoirTout(false); setEssai(null) }
  const retour = () => { setFamille(null); setVoirTout(false); setEssai(null) }

  // Une grande carte-outil (étape 1) : icône, question, TA valeur — et l'essayage dessous.
  const carteKPI = (k, i) => (
    <div key={k.id} className="gal-cellule">
      <button
        type="button"
        className={`gal-carte gal-anim${essai === k.id ? ' is-ouverte' : ''}`}
        style={{ '--acc': k.accent, '--i': Math.min(i, 8) }}
        onClick={() => setEssai(essai === k.id ? null : k.id)}
        aria-expanded={essai === k.id}
      >
        <span className="gal-ic" aria-hidden="true">{iconeKPI(k.id, k.domaine)}</span>
        <span className="gal-carte-txt">
          <h4 className="gal-q">{k.question}</h4>
          {k.texteFactuel && <p className="gal-fait">{k.texteFactuel}</p>}
        </span>
        {formatKPI(k.valeur, k.unite) !== '—' ? <ValeurVivante valeur={k.valeur} unite={k.unite} /> : <span className="gal-chev" aria-hidden="true">{I_CHEVRON}</span>}
        {dejaLa.has(`kpi_${k.id}`) && <span className="gal-deja">Dans ta tour</span>}
      </button>
      {kpiEssai && kpiEssai.id === k.id && (
        <EssayageForme
          kpi={kpiEssai}
          snapshot={snapshot}
          onAjouter={(recette, accent, icone) => { setEssai(null); onAjouter(recette, accent, icone) }}
          onFermer={() => setEssai(null)}
        />
      )}
    </div>
  )

  /* ── ÉTAPE 1 : une famille ─────────────────────────────────────────────── */
  if (famille && domaine) {
    const prets = pretsParDomaine(famille)
    const tableau = tableauDe(famille)
    const visibles = voirTout ? prets : prets.slice(0, 3)
    const reste = prets.length - visibles.length
    const givre = givreDe(famille)
    const nGivres = galerie.indicateurs.filter((k) => !k.pret && k.domaine === famille).length + (tableau && !tableau.pret ? 1 : 0)

    return (
      <section className="galerie gal-guide" aria-label="Crée tes outils">
        <div className="gal-etape-tete" style={{ '--acc': domaine.accent }}>
          <button type="button" className="gal-retour" onClick={retour} aria-label="Revenir aux familles">{I_RETOUR}</button>
          <span className="gal-ic" aria-hidden="true">{ICONE_DOMAINE[famille]}</span>
          <h2 className="gal-etape-titre">{familleDef.label}</h2>
        </div>

        {prets.length === 0 ? (
          // Famille éteinte : UNE invitation, un seul gros geste.
          <div className="gal-colonne">
            <div className="gal-eteinte gal-anim" style={{ '--acc': domaine.accent, '--i': 0 }}>
              <span className="gal-ic" aria-hidden="true">{I_ECLAIR}</span>
              <h3 className="gal-eteinte-titre">
                {(givre && `${nGivres} outil${nGivres > 1 ? 's' : ''} s’allume${nGivres > 1 ? 'nt' : ''} avec ${givre.manque}`) || 'Ces outils s’allument avec tes données'}
              </h3>
              <p className="gal-eteinte-sous">Rien n’est brisé — il manque juste une info.</p>
              <button type="button" className="gal-ajouter" onClick={() => onAllerSaisie((givre && givre.sousSection) || 'revenus')}>
                Aller la saisir · 2 min
              </button>
            </div>
          </div>
        ) : (
          <div className="gal-colonne">
            {tableau && tableau.pret && (
              <button
                type="button"
                className="gal-carte gal-grand-tableau gal-anim"
                style={{ '--acc': tableau.accent, '--i': 0 }}
                onClick={() => onAjouter(composerRecette(tableau.situation, {}, snapshot), tableau.accent)}
              >
                <span className="gal-ic" aria-hidden="true">{ICONE_SITUATION[tableau.situation] || I_VEDETTE}</span>
                <span className="gal-carte-txt">
                  <span className="gal-cat">Le grand tableau</span>
                  <h4 className="gal-q">{tableau.titre}</h4>
                </span>
                <span className="gal-chev" aria-hidden="true">{I_CHEVRON}</span>
                {dejaLa.has(tableau.situation) && <span className="gal-deja">Dans ta tour</span>}
              </button>
            )}
            {visibles.map((k, i) => carteKPI(k, i + 1))}
            {reste > 0 && (
              <button type="button" className="gal-voirplus gal-anim" style={{ '--acc': domaine.accent, '--i': visibles.length + 1 }} onClick={() => setVoirTout(true)}>
                Voir les {reste} autres
              </button>
            )}
          </div>
        )}
      </section>
    )
  }

  /* ── ÉTAPE 0 : l'accueil ───────────────────────────────────────────────── */
  return (
    <section className="galerie gal-guide" aria-label="Crée tes outils">
      <div className="gal-tete">
        <h2 className="gal-titre">Qu’est-ce qu’on crée aujourd’hui&nbsp;?</h2>
        <form className="gal-chat" onSubmit={soumettre}>
          <span className="gal-chat-ic" aria-hidden="true">{I_ETINCELLE}</span>
          <input
            className="gal-chat-input"
            type="text"
            placeholder={PLACEHOLDERS[placeholderIdx]}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            aria-label="Décris ce que tu veux suivre"
          />
          <button className="gal-chat-go" type="submit" disabled={chargement} aria-label="Créer">{I_FLECHE}</button>
        </form>
        {chargement && <p className="tour-hint">Ta tour compose ton outil…</p>}
        {erreur && <p className="tour-erreur">{erreur}</p>}
      </div>

      <div className="gal-colonne">
        {/* LA carte « choisi pour toi » — une VRAIE mini-tuile vivante (tes chiffres),
            puis un geste clair pour l'ajouter. On voit la belle chose avant de choisir. */}
        {vedette && (
          <div className="gal-carte gal-vedette gal-vedette-live gal-anim" style={{ '--acc': vedetteAccent, '--wacc': vedetteAccent, '--i': 0 }}>
            <div className="gal-vedette-tete">
              <span className="gal-ic" aria-hidden="true">{ICONE_SITUATION[vedette.situation] || I_VEDETTE}</span>
              <span className="gal-carte-txt">
                <span className="gal-cat">Choisi pour toi</span>
                <h4 className="gal-q">{vedette.titre}</h4>
                <p className="gal-fait">{vedette.raison}</p>
              </span>
            </div>
            {vedetteRecette && (
              // `inert` (React 19) neutralise d'un coup le focus clavier ET le pointeur
              // ET retire le sous-arbre de l'arbre d'accessibilité — un contrôle focusable
              // d'un bloc composé (curseur d'Horizon, segments du beignet) ne peut plus
              // être atteint au clavier sous un aperçu décoratif. Plus sûr qu'aria-hidden.
              <div className="gal-vedette-apercu" inert>
                <MoteurRendu recette={vedetteRecette} snapshot={snapshot} />
              </div>
            )}
            <button type="button" className="gal-ajouter gal-vedette-ajouter" onClick={() => onAjouter(vedetteRecette || composerRecette(vedette.situation, {}, snapshot), vedetteAccent)}>
              Ajouter à ma tour
            </button>
          </div>
        )}

        {/* MES VUES : les modèles que TU as fabriqués (structure seulement). Un tap les
            re-pose sur ta tour ; le × les retire. « Je possède mon tableau. » */}
        {mesVues.length > 0 && (
          <div className="gal-mesvues">
            <p className="gal-question">Tes vues sauvées&nbsp;:</p>
            <div className="gal-mesvues-liste">
              {mesVues.map((v) => {
                const kb = heroDeRecette(v.recette)
                const dom = kb ? (kpiPourId(kb.KPI) || {}).domaine : null
                return (
                  <div key={v.id} className="gal-vue" style={{ '--acc': v.accent || '#00b4d8' }}>
                    <button type="button" className="gal-vue-btn" onClick={() => onAppliquerVue && onAppliquerVue(v)}>
                      <span className="gal-ic" aria-hidden="true">{kb ? iconeKPI(kb.KPI, dom) : I_VEDETTE}</span>
                      <span className="gal-vue-nom">{v.nom || 'Ma vue'}</span>
                    </button>
                    <button type="button" className="gal-vue-x" onClick={() => onSupprimerVue && onSupprimerVue(v.id)} aria-label={`Retirer « ${v.nom || 'ma vue'} » de tes vues`}>×</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="gal-question">{vedette ? 'Ou choisis' : 'Choisis'} ce que tu veux surveiller&nbsp;:</p>

        {/* Les 5 familles : de GROS boutons joufflus. Éteinte = tirets + condition. */}
        {FAMILLES.map((f, i) => {
          const d = DOMAINES.find((x) => x.id === f.id)
          const n = pretsParDomaine(f.id).length + (tableauDe(f.id) && tableauDe(f.id).pret ? 1 : 0)
          const givre = n === 0 ? givreDe(f.id) : null
          return (
            <button
              key={f.id}
              type="button"
              className={`gal-famille gal-anim${n === 0 ? ' is-eteinte' : ''}`}
              style={{ '--acc': d.accent, '--i': i + 1 }}
              onClick={() => ouvrirFamille(f.id)}
            >
              <span className="gal-ic" aria-hidden="true">{ICONE_DOMAINE[f.id]}</span>
              <span className="gal-famille-txt">
                <span className="gal-famille-l">{f.label}</span>
                <span className="gal-famille-s">
                  {n > 0 ? `${n} outil${n > 1 ? 's' : ''} prêt${n > 1 ? 's' : ''}` : (givre ? `s’allume avec ${givre.manque}` : 'à allumer')}
                </span>
              </span>
              <span className="gal-chev" aria-hidden="true">{I_CHEVRON}</span>
            </button>
          )
        })}

        <p className="gal-note">Essaie tout — rien ne s’ajoute tant que tu ne le décides pas.</p>
      </div>
    </section>
  )
}
