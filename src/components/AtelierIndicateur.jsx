/* ============================================================================
   AtelierIndicateur.jsx — Pas 3b : L'ATELIER D'ASSEMBLAGE.

   Remplace la rangée de pastilles plates par une CONVERSATION EN ENTONNOIR : une
   question à la fois, l'indicateur s'assemble pièce par pièce sur un établi, jusqu'au
   verrouillage « Ajouter à ma tour ».

   DISCIPLINE : c'est de la mise en scène par-dessus le moteur existant. L'entonnoir
   (entonnoir.js, données pures) nourrit composerRecette — AUCUNE nouvelle logique de
   composition, AUCUN appel IA. Les pièces de l'établi SONT les blocs que la recette
   produira (réutilisés, pas réinventés). Le rendu final réutilise le STAGGER de
   MoteurRendu (anime) — on n'invente pas une 2e animation de montage de blocs.
   ========================================================================== */
import { useMemo, useState } from 'react'
import { noeudCourant, resoudreEntonnoir, cheminLisible } from '../recettes/entonnoir.js'
import { composerRecette } from '../recettes/composer.js'
import { filtrerFait } from '../recettes/schema.js'
import { evaluerGraphe } from '../lib/graphe.js'
import { formatCAD } from '../lib/format.js'
import MoteurRendu from '../recettes/MoteurRendu.jsx'
import ChoixAngle from '../recettes/ChoixAngle.jsx'
import { formesPourKPI } from '../recettes/bibliotheque-kpis.js'

/* ── Les DEUX réglages à ajuster sans rien casser ─────────────────────────── */
// 1) Ton d'animation : la pièce glisse et se pose (posé/serein, jamais clinquant — §12).
const ANIM = { duree: 360, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
// 2) Après assemblage : l'établi se replie sur l'indicateur fini, avec une trace
//    discrète rouvrable « assemblé à partir de N pièces ».
const REPLIER_APRES = true
/* ─────────────────────────────────────────────────────────────────────────── */

// Les pièces SONT les blocs de composerRecette — on les nomme, on ne les réinvente pas.
const PIECE_BLOC = {
  flux_annuel: 'Ton année en barres',
  jauge: 'Ta jauge de coussin',
  stat: 'Un chiffre clé',
  fait: 'Un constat factuel',
  repartition: 'Ta règle 50/30/20',
  beignet: 'Le beignet des dépenses',
  solde: 'Ton solde du mois',
  barre_empilee: 'Fixe vs variable',
  coussin_urgence: 'Ton fonds d’urgence',
  anatomie_dollar: 'L’anatomie de ta paie',
  impot_palier: 'Tes impôts par palier',
  patrimoine_vie: 'Ta valeur nette dans le temps',
  horizon: 'Le « et si » de l’épargne',
  composition: 'La composition de ton patrimoine',
  chaine: 'La chaîne vers ton objectif',
}
const nomPiece = (type) => PIECE_BLOC[type] || type

// Étiquette de la « destination » captée (objectif) — la personnalisation vit ICI,
// à l'affichage, pas dans la recette (les 12 chemins partagent la même recette).
const DESTINATIONS = { maison: 'Maison', voyage: 'Voyage', auto: 'Auto', fonds_urgence: 'Fonds d’urgence' }

const I_PIECE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 4v16" />
  </svg>
)
const I_PIN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
)
const I_OUTIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20l8.5-8.5" /><path d="M14.5 3.5l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6L10.8 7.2l2.6-1.1 1.1-2.6z" />
  </svg>
)

// Phrase FACTUELLE de verrouillage (passe par filtrerFait — aucun jugement, §11).
function phraseAssemblee(situation, blocs, snapshot) {
  let texte
  if (situation === 'objectif_epargne') {
    // L'horizon doit refléter l'objectif CHOISI (porté par le héros KPI), pas l'objectif
    // par défaut — sinon la phrase (« … à N mois ») diverge du chiffre du héros.
    const kb = Array.isArray(blocs) ? blocs.find((b) => b && b.KPI) : null
    const objectif = kb && kb.params ? kb.params.objectif : null
    const g = evaluerGraphe(snapshot, objectif ? { objectif } : {})
    if (g.actif) {
      const cap = formatCAD(g.noeuds.capaciteEpargne.valeur)
      const h = g.objectif.horizonMois
      texte =
        h === 0
          ? `Ta cible est déjà atteinte ; ta capacité d’épargne est de ${cap} par mois.`
          : h == null
            ? `Ta capacité d’épargne actuelle est de ${cap} par mois.`
            : `Au rythme actuel, ta capacité d’épargne de ${cap} par mois place ta cible à ${h} mois.`
    } else {
      texte = 'Ajoute ton revenu net dans « Mes données » pour estimer l’horizon de cet objectif.'
    }
  } else {
    texte = `Ton indicateur réunit ${blocs.length} ${blocs.length > 1 ? 'blocs' : 'bloc'} à partir de tes données.`
  }
  const f = filtrerFait(texte)
  return f.ok && f.texte ? f.texte : `Ton indicateur réunit ${blocs.length} blocs à partir de tes données.`
}

export default function AtelierIndicateur({ snapshot, onAjouter }) {
  const [chemin, setChemin] = useState([])
  const [replieOuvert, setReplieOuvert] = useState(false)
  // Porte « pendant » : explorer d'autres angles du héros KPI avant d'ajouter. Non bloquant
  // (la forme posée = le recommandé ; ceci est optionnel).
  const [angleOuvert, setAngleOuvert] = useState(false)
  const [formeChoisie, setFormeChoisie] = useState(null) // null = on garde le recommandé

  const noeud = noeudCourant(chemin)
  const { situation, reponses, complet } = useMemo(() => resoudreEntonnoir(chemin), [chemin])
  const recette = useMemo(
    () => (situation ? composerRecette(situation, reponses, snapshot) : null),
    [situation, reponses, snapshot],
  )
  const blocs = recette ? recette.blocs : []
  // Le héros KPI (s'il existe) + la recette EFFECTIVEMENT affichée (forme échangée si choisie).
  const kpiBloc = recette ? recette.blocs.find((b) => b && b.KPI) : null
  const recetteAffichee = useMemo(() => {
    if (!recette || !formeChoisie || !kpiBloc) return recette
    return { ...recette, blocs: recette.blocs.map((b) => (b && b.KPI === kpiBloc.KPI ? { ...b, forme: formeChoisie } : b)) }
  }, [recette, formeChoisie, kpiBloc])
  // Les pièces se révèlent une par réponse (plafonné au nombre de blocs réels).
  const piecesVisibles = complet ? blocs.length : Math.min(chemin.length, blocs.length)
  const fil = cheminLisible(chemin)
  const destination = reponses && reponses.objectif ? DESTINATIONS[reponses.objectif] : null

  // Tout changement de chemin remet l'angle au recommandé (on ne traîne pas un choix
  // d'angle d'une autre destination).
  const resetAngle = () => { setAngleOuvert(false); setFormeChoisie(null) }
  const choisir = (repId) => { resetAngle(); setChemin((c) => [...c, repId]) }
  const reculerA = (i) => { resetAngle(); setChemin((c) => c.slice(0, i)) } // tap sur un fil d'Ariane
  const recommencer = () => { resetAngle(); setChemin([]); setReplieOuvert(false) }
  const ajouter = () => { if (recetteAffichee) { onAjouter(recetteAffichee); recommencer() } }

  return (
    <section className="atelier" aria-label="Atelier d'assemblage d'indicateur">
      {/* En-tête héros : le point d'entrée évident de la surface « créer ». */}
      <div className="atelier-hero-tete">
        <span className="atelier-hero-ic" aria-hidden="true">{I_OUTIL}</span>
        <div className="atelier-hero-txt">
          <h2 className="atelier-hero-titre">Crée ton indicateur</h2>
          <p className="atelier-hero-sous">Laisse-toi guider — ta tour l’assemble pièce par pièce.</p>
        </div>
      </div>

      {/* Fil d'Ariane des choix + compteur de pièces */}
      <div className="atelier-tete">
        <div className="atelier-fil">
          <button type="button" className="atelier-fil-pas atelier-fil-racine" onClick={recommencer} disabled={chemin.length === 0}>
            Début
          </button>
          {fil.map((e, i) => (
            <span className="atelier-fil-suite" key={`${e.repId}-${i}`}>
              <span className="atelier-fil-sep" aria-hidden="true">›</span>
              <button type="button" className="atelier-fil-pas" onClick={() => reculerA(i)}>{e.label}</button>
            </span>
          ))}
        </div>
        {piecesVisibles > 0 && (
          <span className="atelier-compteur">{piecesVisibles} {piecesVisibles > 1 ? 'pièces' : 'pièce'}</span>
        )}
      </div>

      {/* L'établi : les pièces s'assemblent, reliées par un fil */}
      {!(complet && REPLIER_APRES && !replieOuvert) ? (
        <div className="atelier-etabli">
          {destination && (
            <div className="atelier-destination">
              <span className="atelier-piece-ic" aria-hidden="true">{I_PIN}</span>
              <span>Ta destination&nbsp;: <b>{destination}</b></span>
            </div>
          )}
          {piecesVisibles === 0 ? (
            <p className="atelier-vide">Ton indicateur s’assemble ici, pièce par pièce.</p>
          ) : (
            <ol className="atelier-pieces">
              {blocs.slice(0, piecesVisibles).map((b, i) => (
                <li
                  className="atelier-piece"
                  key={`${b.type}-${i}`}
                  style={{ animationDuration: `${ANIM.duree}ms`, animationTimingFunction: ANIM.easing, animationDelay: `${i * 90}ms` }}
                >
                  <span className="atelier-piece-ic" aria-hidden="true">{I_PIECE}</span>
                  <span className="atelier-piece-nom">{nomPiece(b.type)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <button type="button" className="atelier-trace" onClick={() => setReplieOuvert(true)} aria-expanded={replieOuvert}>
          Assemblé à partir de {blocs.length} {blocs.length > 1 ? 'pièces' : 'pièce'} · revoir
        </button>
      )}

      {/* La question courante OU le verrouillage final */}
      {noeud ? (
        <div className="atelier-question">
          <p className="atelier-q">{noeud.question}</p>
          <div className="atelier-opts">
            {noeud.reponses.map((r) => (
              <button type="button" className="atelier-opt" key={r.id} onClick={() => choisir(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="atelier-verrou">
          <div className="atelier-badge"><span className="atelier-badge-dot" aria-hidden="true" />Indicateur assemblé</div>
          <p className="atelier-phrase">{phraseAssemblee(situation, blocs, snapshot)}</p>
          {recetteAffichee && (
            <div className="atelier-apercu tour-vues is-anime">
              <span className="atelier-apercu-tag">Aperçu — ta tour a assemblé ceci</span>
              {kpiBloc && formesPourKPI(kpiBloc.KPI, snapshot, kpiBloc.params).length > 1 && (
                <div className="atelier-angles">
                  <button type="button" className="atelier-autres-angles" onClick={() => setAngleOuvert((o) => !o)} aria-expanded={angleOuvert}>
                    {angleOuvert ? 'Masquer les angles' : 'Voir autrement'}
                  </button>
                  {angleOuvert && (
                    <ChoixAngle
                      kpiId={kpiBloc.KPI}
                      snapshot={snapshot}
                      ctx={kpiBloc.params}
                      recommande={kpiBloc.recommande || kpiBloc.forme}
                      formeActuelle={formeChoisie || kpiBloc.forme}
                      onChoisir={(f) => setFormeChoisie(f)}
                    />
                  )}
                </div>
              )}
              <MoteurRendu recette={recetteAffichee} snapshot={snapshot} anime />
            </div>
          )}
          <div className="atelier-actions">
            <button type="button" className="atelier-recommencer" onClick={recommencer}>↺ Recommencer</button>
            <button type="button" className="atelier-ajouter" onClick={ajouter}>Ajouter à ma tour</button>
          </div>
        </div>
      )}
    </section>
  )
}
