/* ============================================================================
   _gabarit.jsx — PATRON commun pour décliner les 20 autres blocs au niveau de
   l'étalon (FluxAnnuel). N'est PAS dans le registre : c'est un modèle à copier.

   Le contrat d'un bloc :
     - reçoit { params, data } ;
       · params = réglages issus de la RECETTE (bornés par schema.js) ;
       · data   = chiffres issus du SNAPSHOT (jamais de la recette).
     - respecte prefers-reduced-motion ;
     - rend une <section className="card"> : card-title + card-sub + corps
       (SVG fait main, zéro lib) + legend optionnelle ;
     - textes FACTUELS uniquement (aucun jugement — VISION §11).

   Pour ajouter un bloc :
     1. copier ce fichier en blocs/MonBloc.jsx ;
     2. l'enregistrer dans recettes/registre.js (1 ligne) ;
     3. déclarer ses bornes + resolve(snapshot) dans recettes/schema.js (BLOCS).
   ========================================================================== */

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function Gabarit({ params = {}, data = {} }) {
  const reduce = reduceMotion()
  void params // réglages de la recette (bornés)
  void data // chiffres du snapshot
  void reduce // à utiliser pour activer/désactiver les animations

  return (
    <section className="card">
      <div className="card-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
        Titre du bloc
      </div>
      <p className="card-sub">Sous-titre factuel décrivant ce que montre le bloc.</p>
      {/* corps : SVG fait main */}
    </section>
  )
}
