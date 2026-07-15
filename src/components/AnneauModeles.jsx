/* ============================================================================
   AnneauModeles.jsx — LE PRÉSENTOIR DE L'ATELIER (ex-anneau 3D).

   Ce n'est PAS un dashboard-builder (VISION §8 : réarranger des tuiles vides est
   un piège). Le présentoir SÉLECTIONNE un KPI de REGISTRE_KPIS — chaque KPI PENSE
   (il a son `requiert`, son `resolve`, ses formes). C'est le modèle Otto : piger
   dans un répertoire vérifié, jamais générer.

   LOT 4 — L'anneau 3D est devenu un RAIL PLAT À CRANS. L'anneau ne rendait lisible
   qu'UNE plaque sur sept (les autres inclinées, floutées, opacité 0.1), il tournait
   tout seul, et cliquer une plaque latérale la faisait tourner au lieu de l'ajouter.
   La 3D n'apportait ici ni information ni navigation. Le rail : 3-4 cartes DROITES
   et 100 % lisibles, rien ne bouge sans geste, un clic = un sens (toujours ajouter).
   Le mouvement réduit devient un simple `scroll-behavior:auto` en CSS — plus de fork.

   ZÉRO DONNÉE NOUVELLE. Un KPI dont la donnée manque n'est jamais caché en silence :
   il devient une chip « À allumer » SOUS le rail (subordonné, pas éliminé), porte
   vers « Mes données ». resolveKPI refuse déjà d'inventer un chiffre.
   ========================================================================== */
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { REGISTRE_KPIS, DONNEE_DISPO, resolveKPI, resoudreForme } from '../recettes/bibliotheque-kpis.js'
import { formatKPI } from '../lib/format.js'
import MoteurRendu from '../recettes/MoteurRendu.jsx'

// Le rail montre UN KPI par domaine (diversité, pas un catalogue) — ordre de
// priorité : budget d'abord (universel), puis le reste. La liste plate, elle, montre tout.
const ORDRE_DOMAINES = ['budget', 'coussin', 'patrimoine', 'objectif', 'impot', 'saisonnier', 'dette']
const LABEL_DOMAINE = { budget: 'Budget', coussin: 'Coussin', patrimoine: 'Patrimoine', objectif: 'Objectif', impot: 'Impôt', saisonnier: 'Saisonnier', dette: 'Dette' }
const MAX_RAIL = 6 // + « Crée le tien » = 7 plaques au plus sur le rail

/* La donnée manquante, dite en français — jamais en nom de variable. `section` DOIT
   être une mission réelle (missions.js n'a que revenus/depenses/placements) : router
   vers une clé inexistante blanchit l'atelier. coussin se remplit dans la mission
   revenus ; patrimoine/projection dans placements. */
const OU_LA_PRENDRE = {
  capacite: { texte: 'tes revenus', section: 'revenus' },
  depenses: { texte: 'tes dépenses', section: 'depenses' },
  categories: { texte: 'tes catégories de dépenses', section: 'depenses' },
  coussin: { texte: 'ton coussin', section: 'revenus' },
  patrimoine: { texte: 'ton patrimoine', section: 'placements' },
  projection: { texte: 'ton âge et ton horizon', section: 'placements' },
  fiscalite: { texte: 'ton revenu brut', section: 'revenus' },
}
const sectionPour = (r) => (OU_LA_PRENDRE[r] && OU_LA_PRENDRE[r].section) || 'revenus'
const textePour = (r) => (OU_LA_PRENDRE[r] && OU_LA_PRENDRE[r].texte) || r


/* Dégraissage de la phrase : si elle COMMENCE par le nombre déjà affiché en gros,
   on retire le nombre en tête (« 47 % de tes dépenses… » → « de tes dépenses… ») ;
   sinon on la montre TELLE QUELLE — jamais mutilée (les texteFactuel de
   bibliotheque-kpis.js sont conformes/filtrés et servent ailleurs : on n'y touche
   pas ; une redondance vaut mieux qu'une phrase cassée). */
function phrasePlaque(texte, montre) {
  const t = String(texte || '').trim()
  if (montre && montre !== '—' && t.startsWith(montre)) {
    const reste = t.slice(montre.length).replace(/^[\s,.;:–—-]+/, '').trim()
    if (reste.length >= 4) return reste.charAt(0).toLowerCase() + reste.slice(1)
  }
  return t
}

/* LE CONTENU d'une plaque — mémoïsé (il ne dépend que de {p, snapshot}). LOT 4 :
   plus de lustre baladeur ni de reflet inversé. L'aperçu (le VRAI bloc) n'est plus
   un fond-fantôme derrière le texte : c'est une bande sparkline NETTE, en pleine
   opacité, dans le flux — label → chiffre → aperçu → phrase. */
const PlaqueContenu = memo(function PlaqueContenu({ p, snapshot }) {
  const montre = !p.creer && p.dispo ? formatKPI(p.resolu?.valeur, p.resolu?.unite) : null
  const aChiffre = montre != null && montre !== '—' // faux pour une valeur OBJET (ex. l'équilibre en parts)
  const phrase = !p.creer && p.dispo ? phrasePlaque(p.resolu?.texteFactuel, montre) : ''
  return (
    <>
      <span className="pl-arete" />
      {p.creer ? (
        <span className="pl-vide">
          <span className="pl-vide-plus">+</span>
          <b>Crée le tien</b>
          <span>Dis-le dans tes mots</span>
        </span>
      ) : !p.dispo ? (
        /* ÉTEINTE — INCHANGÉE : c'est ICI que vit l'honnêteté sur la donnée. La
           donnée manquante est écrite ; la plaque est la porte vers « Mes données ».
           (Rendue en plaque pleine seulement quand TOUT est éteint — nouvel usager ;
           sinon les éteintes sont des chips sous le rail.) */
        <>
          <div className="pl-tete"><span className="pl-n">{p.kpi.question}</span></div>
          <span className="pl-src">{p.kpi.requiert.map((r) => textePour(r)).join(' + ')}</span>
          <p className="pl-manque">Il me manque {p.manque.map((r) => textePour(r)).join(' et ')}.</p>
          <span className="pl-ajout pl-aller">Aller la remplir →</span>
        </>
      ) : (
        /* ALLUMÉE — elle PRÉSENTE : le CHIFFRE est la réponse, la question chuchote
           au-dessus, l'aperçu (le vrai bloc) est une bande nette sous le chiffre. */
        <div className={`pl-corps${aChiffre ? '' : ' pl-corps-obj'}`}>
          <span className="pl-label">{p.kpi.question}</span>
          {aChiffre && <span className="pl-chiffre">{montre}</span>}
          {/* L'aperçu = le graphe, montré SEULEMENT pour un KPI en PARTS (valeur-objet,
              sans chiffre unique) : là le graphe EST la réponse. Pour un KPI scalaire,
              le chiffre héros + la phrase disent tout — un bloc plein réduit à une bande
              ne ferait que redoubler le chiffre (composition « 114 000 $ ») ou clipper
              son en-tête/ses aides (flux_annuel « Survole un mois… »). Mieux vaut une
              plaque nette qu'une vignette encombrée. */}
          {!aChiffre && p.recette && (
            <div className="pl-apercu">
              <MoteurRendu recette={p.recette} snapshot={snapshot} apercu />
            </div>
          )}
          {aChiffre && phrase && <p className="pl-phrase">{phrase}</p>}
          <span className="pl-ajout">+ Ajouter à ma tour</span>
        </div>
      )}
    </>
  )
})

export default function AnneauModeles({ snapshot, widgets = [], onAjouter, onAllerSaisie, onCreer }) {
  /* Les KPIs déjà posés sur la tour (par l'emplacement KPI de leur recette) : on
     ne les repropose pas dans le rail. */
  const dejaPosees = useMemo(() => {
    const s = new Set()
    for (const w of Array.isArray(widgets) ? widgets : []) {
      const kb = w && w.recette && Array.isArray(w.recette.blocs) ? w.recette.blocs[0] : null
      if (kb && kb.KPI) s.add(kb.KPI)
    }
    return s
  }, [widgets])

  /* ── TOUTES les plaques candidates (non-posées), pour la LISTE PLATE « Voir tout ».
        Un KPI éteint reste visible : c'est une invitation à remplir la donnée. ─── */
  const toutesPlaques = useMemo(() => {
    return REGISTRE_KPIS
      .filter((k) => !dejaPosees.has(k.id))
      .map((k) => {
        const manque = k.requiert.filter((r) => !(DONNEE_DISPO[r] && DONNEE_DISPO[r](snapshot)))
        const dispo = manque.length === 0
        const forme = dispo ? resoudreForme(k.id, k.blocsCompatibles[0], snapshot, {}) : null
        return {
          kpi: k, dispo, manque, forme,
          resolu: dispo ? resolveKPI(k.id, snapshot) : null,
          recette: dispo && forme ? { situation: `kpi_${k.id}`, titre: k.question, blocs: [{ KPI: k.id, forme, params: {} }] } : null,
        }
      })
      // Une plaque ALLUMÉE doit RÉELLEMENT dire quelque chose. Un KPI dont la donnée de base
      // est là mais qui ne résout à RIEN (ex. objectif sans cible — il faut un PROJET, pas une
      // donnée) n'est pas offert : sinon plaque muette qui, faute de chiffre, bascule dans
      // l'aperçu-chaîne et affiche le repli 10 000 $ (revue nuage P4 #2). L'ÉTEINTE reste (elle
      // invite à remplir la donnée manquante). Un KPI en parts (valeur-objet) passe (≠ null).
      .filter((p) => {
        if (!p.dispo) return true
        const r = p.resolu
        return !!(r && (r.valeur != null || (r.texteFactuel && r.texteFactuel.trim())))
      })
      .sort((a, b) => Number(b.dispo) - Number(a.dispo)) // dispo d'abord (liste plate)
  }, [snapshot, dejaPosees])

  /* ── LE RAIL : au plus 6 plaques DISPO, un KPI par domaine (VISION §8 : une
        recommandation, pas un catalogue) + « Crée le tien ». Les ÉTEINTES sortent
        du rail → chips « À allumer » dessous (au plus 2). Exception : un nouvel
        usager n'a AUCUNE dispo → on garde alors les éteintes comme cartes pleines
        dans le rail (sinon il serait vide). ─── */
  const { railData, eteintes } = useMemo(() => {
    const dispo = []
    const pris = new Set()
    for (const dom of ORDRE_DOMAINES) {
      if (dispo.length >= MAX_RAIL) break
      const k = toutesPlaques.find((x) => x.kpi.domaine === dom && x.dispo && !pris.has(x.kpi.id))
      if (k) { dispo.push(k); pris.add(k.kpi.id) }
    }
    const ets = []
    for (const dom of ORDRE_DOMAINES) {
      if (ets.length >= 2) break
      const k = toutesPlaques.find((x) => x.kpi.domaine === dom && !x.dispo && !pris.has(x.kpi.id))
      if (k) { ets.push(k); pris.add(k.kpi.id) }
    }
    if (dispo.length === 0) return { railData: [...ets, { creer: true }], eteintes: [] }
    return { railData: [...dispo, { creer: true }], eteintes: ets }
  }, [toutesPlaques])

  const [voirTout, setVoirTout] = useState(false) // l'exhaustivité : une LISTE PLATE, jamais un présentoir
  const railRef = useRef(null)
  const refs = useRef([])
  const [fleches, setFleches] = useState(false) // flèches affichées seulement si le rail déborde
  const [domActif, setDomActif] = useState(null) // le domaine dont la plaque est la plus centrée

  // Les flèches n'ont de sens que si le contenu déborde de la vue (sinon tout est
  // déjà visible). On réévalue au montage, au resize, et quand le rail change.
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const maj = () => setFleches(el.scrollWidth > el.clientWidth + 4)
    maj()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(maj) : null
    if (ro) ro.observe(el)
    if (typeof window !== 'undefined') window.addEventListener('resize', maj)
    return () => { if (ro) ro.disconnect(); if (typeof window !== 'undefined') window.removeEventListener('resize', maj) }
  }, [railData.length, voirTout])

  // Le domaine actif = la plaque la plus visible dans le rail (pour surligner sa
  // chip de nav). Si IntersectionObserver manque, les chips restent un sommaire
  // nommé sans état actif — elles naviguent quand même.
  useEffect(() => {
    if (voirTout) return
    const el = railRef.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver((ents) => {
      let best = null
      for (const e of ents) if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e
      if (best) { const dom = best.target.getAttribute('data-dom'); if (dom) setDomActif(dom) }
    }, { root: el, threshold: [0.5, 0.75, 1] })
    refs.current.forEach((n) => { if (n) io.observe(n) })
    return () => io.disconnect()
  }, [railData, voirTout])

  // L'ACTION d'une plaque — partagée par le rail ET la liste plate. Un clic = un
  // sens, toujours : ajouter (dispo), aller saisir (éteinte), créer.
  const choisirPlaque = (p) => {
    if (p.creer) { onCreer?.(); return }
    if (!p.dispo) { onAllerSaisie?.(sectionPour(p.manque[0])); return }
    if (p.recette) onAjouter?.(p.recette)
  }

  // Le lissage du défilement RESPECTE prefers-reduced-motion (un behavior:'smooth'
   // passé en JS prime sur le scroll-behavior CSS — on le décide donc ici).
  const comportement = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')
  const versDomaine = (dom) => {
    const i = railData.findIndex((p) => !p.creer && p.kpi && p.kpi.domaine === dom)
    if (i >= 0 && refs.current[i]) refs.current[i].scrollIntoView({ inline: 'center', behavior: comportement(), block: 'nearest' })
  }
  const glisser = (dir) => { railRef.current?.scrollBy({ left: dir * 292, behavior: comportement() }) }

  // Les domaines présents dans le rail (pour les chips de nav — un sommaire nommé).
  const domainesRail = useMemo(() => {
    const seen = []
    for (const p of railData) if (!p.creer && p.kpi && !seen.includes(p.kpi.domaine)) seen.push(p.kpi.domaine)
    return seen
  }, [railData])

  if (voirTout) {
    /* L'EXHAUSTIVITÉ existe, mais elle ne s'impose pas : une LISTE PLATE (pas un
       présentoir), scrollable, tous les indicateurs, chacun avec son chiffre ou sa
       donnée manquante. On y va par choix, on en revient d'un geste. */
    return (
      <div className="carrousel">
        <div className="anneau-liste">
          <div className="al-tete">
            <button type="button" className="al-retour" onClick={() => setVoirTout(false)}>‹ Le présentoir</button>
            <span className="al-titre">Tous tes indicateurs</span>
          </div>
          <div className="al-grille">
            {toutesPlaques.map((p) => (
              <button
                key={p.kpi.id}
                type="button"
                className={`al-item${p.dispo ? '' : ' eteinte'}`}
                onClick={() => choisirPlaque(p)}
              >
                <span className="al-q">{p.kpi.question}</span>
                {p.dispo ? (
                  <span className="al-val">{formatKPI(p.resolu?.valeur, p.resolu?.unite)}</span>
                ) : (
                  <span className="al-manque">Il manque {p.manque.map((r) => textePour(r)).join(', ')}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="carrousel">
      {/* NAVIGATION NOMMÉE — un sommaire par domaine, pas des points anonymes. */}
      {domainesRail.length > 1 && (
        <div className="pres-nav">
          {domainesRail.map((dom) => (
            <button
              key={dom}
              type="button"
              className={`pres-nav-chip${dom === domActif ? ' on' : ''}`}
              onClick={() => versDomaine(dom)}
            >
              {LABEL_DOMAINE[dom] || dom}
            </button>
          ))}
        </div>
      )}

      {/* LE RAIL — plat, à crans (scroll-snap). Les flèches défilent, elles ne
          tournent rien. Tout ce qu'on voit est droit et lisible. (Classe « pres- »
          et non « rail- » : « .rail » est déjà la barre de navigation gauche.) */}
      <div className="pres-vue">
        {fleches && <button type="button" className="car-fl car-fl-g" onClick={() => glisser(-1)} aria-label="Défiler vers la gauche">‹</button>}
        <div className="pres-piste" ref={railRef}>
          {railData.map((p, i) => (
            <button
              key={p.creer ? 'creer' : p.kpi.id}
              type="button"
              ref={(el) => { refs.current[i] = el }}
              data-dom={p.creer || !p.kpi ? '' : p.kpi.domaine}
              className={`plaque${p.creer ? ' creer' : ''}${!p.creer && !p.dispo ? ' eteinte' : ''}`}
              onClick={() => choisirPlaque(p)}
            >
              <PlaqueContenu p={p} snapshot={snapshot} />
            </button>
          ))}
        </div>
        {fleches && <button type="button" className="car-fl car-fl-d" onClick={() => glisser(1)} aria-label="Défiler vers la droite">›</button>}
      </div>

      {/* LES ÉTEINTES — subordonnées, sous le rail. Des chips « à allumer », pas des
          cartes pleines : présentes (jamais cachées) mais claires sur leur état. */}
      {eteintes.length > 0 && (
        <div className="pres-eteintes">
          <span className="pres-eteintes-tag">À allumer</span>
          {eteintes.map((p) => (
            <button
              key={p.kpi.id}
              type="button"
              className="chip-eteinte"
              onClick={() => onAllerSaisie?.(sectionPour(p.manque[0]))}
            >
              {p.kpi.question}
            </button>
          ))}
        </div>
      )}

      {/* L'exhaustivité, discrète, HORS du rail — on ne l'impose pas. */}
      <button type="button" className="car-tout" onClick={() => setVoirTout(true)}>
        Voir tous les indicateurs ({toutesPlaques.length})
      </button>
    </div>
  )
}
