/* ============================================================================
   Entretien.jsx — l'entretien guidé (2-3 questions tappables). Inspiré du quiz
   de la maquette validée. Chaque réponse met à jour `reponses` → App recompose
   la recette (composer.js) → MoteurRendu re-rend la vue EN DIRECT.

   C'est l'usager qui choisit ici ; demain l'IA produira les mêmes `reponses`
   (ou directement la recette). La sortie est identique pour le moteur.
   ========================================================================== */
const QUESTIONS = [
  {
    key: 'vue',
    num: 1,
    label: 'Ton année, tu la vois comment ?',
    opts: [
      { v: 'annuel', l: 'Vue annuelle' },
      { v: 'mensuel', l: 'Mois par mois' },
    ],
  },
  {
    key: 'mesure',
    num: 2,
    label: 'Ton coussin, tu le mesures en…',
    opts: [
      { v: 'mois', l: 'Mois couverts' },
      { v: 'montant', l: 'Montant' },
    ],
  },
  {
    key: 'side',
    num: 3,
    label: 'À côté du graphe, tu veux…',
    opts: [
      { v: 'tout', l: 'Coussin + constat' },
      { v: 'coussin', l: 'Juste le coussin' },
      { v: 'fait', l: 'Juste le constat' },
    ],
  },
]

export default function Entretien({ reponses, onChange }) {
  const set = (key, v) => onChange({ ...reponses, [key]: v })

  return (
    <section className="quiz" aria-label="Compose ta vue">
      {QUESTIONS.map((q) => (
        <div className="q" key={q.key}>
          <span className="q-lbl">
            <span className="q-num">{q.num}</span>
            {q.label}
          </span>
          <div className="opts">
            {q.opts.map((o) => (
              <button
                key={o.v}
                type="button"
                className={`opt ${reponses[q.key] === o.v ? 'on' : ''}`}
                aria-pressed={reponses[q.key] === o.v}
                onClick={() => set(q.key, o.v)}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
