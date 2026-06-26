/* ============================================================================
   build-tool.js — Assistant « phrase → outil » du Centre financier.
   Reçoit une phrase en langage normal, demande à Claude de la classer + d'en
   extraire les paramètres, et renvoie une « spec » JSON que le client assemble
   avec ses builders (goal/cap). Claude ne fait QUE comprendre + extraire.

   Style aligné sur api/analyze-news.js : Node natif (https), zéro dépendance,
   on demande du JSON pur et on l'extrait (robuste, comme analyze-news).
   Variable d'environnement requise sur Vercel : ANTHROPIC_API_KEY
   ============================================================================ */
import https from 'node:https';

const VERSION = 6;                       // marqueur pour vérifier le déploiement
const MODEL = 'claude-opus-4-8';         // modèle principal (qualité)
const FALLBACK_MODEL = 'claude-haiku-4-5'; // repli si Opus est surchargé (529) — suffit pour cette tâche

const SYSTEM = `Tu es l'assistant de construction d'outils du « Centre financier », une plateforme québécoise d'outils financiers personnels.
Ton rôle : transformer la demande d'un utilisateur (en français) en la spécification d'UN outil de suivi.

Règles de classement (choisis le type le plus précis) :
- « goal » : objectif d'épargne vers un montant cible (achat maison / mise de fonds, voyage, auto, mariage, fonds d'urgence, rénovation, tout projet nommé). target=montant cible, monthly=épargne/mois, date=échéance.
- « cap » : compte enregistré à maximiser jusqu'à un plafond annuel (CELIAPP, CELI, REER, REEE, REEI...). target=plafond, monthly=cotisation/mois.
- « debt » : dette à rembourser (carte de crédit, prêt, marge de crédit, emprunt). target=solde de la dette, monthly=paiement/mois.
- « budget » : budget mensuel (revenus vs dépenses). Mets target, monthly, date à null (l'utilisateur remplira ses montants).
- « networth » : valeur nette / patrimoine (actifs moins passifs). Mets target, monthly, date à null.
- « unknown » : la demande ne décrit pas un outil de suivi financier ; propose alors une reformulation utile dans « note ».

Extraction :
- Montants en dollars canadiens : comprends « 40 000 $ », « 40k », « quarante mille ». Un nombre qui désigne une mensualité (« 300 par mois ») va dans « monthly », pas dans « target ».
- Date : une année seule (« d'ici 2028 ») devient « 2028-06 ». Aucune date => null.
- N'invente pas de montants : si l'utilisateur n'en donne pas, mets null.
- « note » : UNE phrase de confirmation, en tutoiement, chaleureuse et professionnelle, SANS aucun emoji.

Icônes possibles : home (immobilier), landmark (compte enregistré), plane (voyage), car (véhicule), heart (mariage), shield (fonds d'urgence), card (dette), wallet (budget), scale (valeur nette), target (générique).

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, avec EXACTEMENT ces clés :
{"kind":"goal|cap|debt|budget|networth|unknown","name":"...","icon":"home|landmark|plane|car|heart|shield|card|wallet|scale|target","target":nombre ou null,"monthly":nombre ou null,"date":"AAAA-MM" ou null,"note":"..."}`;

// ── Mode RECETTE : « situation décrite → recette de vue » (REGISTRE-BLOCS.md).
// L'IA choisit les BLOCS + leurs réglages ; les MONTANTS viennent du snapshot
// côté client, jamais d'ici. Mêmes blocs que le registre actuel.
const SYSTEM_RECETTE = `Tu es le COMPOSITEUR de vues de « la tour de contrôle », une plateforme québécoise de finances personnelles.
Ton rôle : transformer la situation décrite par l'usager en une RECETTE de vue — un JSON qui dit QUELS blocs afficher et avec QUELS réglages. Tu choisis et agences les blocs ; tu ne mets JAMAIS de montants (les chiffres viennent des données de l'usager, remplis côté client depuis le snapshot). Tu décides seulement la mise en scène.

PRINCIPE : « les blocs ne sont pas les cas ». Compose une vue UNIQUE en choisissant 3 à 5 blocs PERTINENTS à la situation, parmi les 16 ci-dessous. Varie RÉELLEMENT selon la phrase : une dette, un objectif d'épargne, un budget, des impôts ou un patrimoine ne donnent PAS les mêmes blocs.

LES 16 BLOCS (n'utilise QUE ces \`type\` exacts ; un type inconnu est ignoré). [grande]=colonne principale, [compacte]=colonne de droite :

— Budget / où va l'argent (source : revenus & dépenses saisis) —
• solde [compacte] — revenus − dépenses = ce qu'il reste (surplus/déficit). params: {}. Le verdict de base.
• repartition [grande] — besoins / désirs / épargne en % du revenu, repère 50/30/20. params: { "repere": "50/30/20" | "aucun" }.
• beignet [grande] — répartition des dépenses par catégorie. params: {}.
• barre_empilee [compacte] — part ENGAGÉE (dépenses fixes) vs LIBRE (variables). params: {}.

— Le temps (source : 12 mois de revenus/dépenses, échéances datées) —
• flux_annuel [grande] — 12 mois : revenus en barres vs ligne de dépenses. params: { "souligner": "mois_deficitaires" | "aucun", "vue": "annuel" | "mensuel" }. Idéal revenu saisonnier/irrégulier.
• calendrier [grande] — grille du mois : paies + dépenses fixes datées. params: { "souligner": "echeances_proches" | "aucun" }.
• echeancier [compacte] — liste des prochaines échéances. params: { "horizon": 7 | 14 | 30 | 60 | 90 }.

— Coussin / sécurité (source : coussin d'épargne saisi) —
• jauge [compacte] — arc : nombre de mois de dépenses couverts par ton coussin. params: { "mesure": "mois" | "montant" }.
• stat [compacte] — ton coussin d'épargne, en gros chiffre. params: { "ton": "cyan" | "bleu" | "ambre" | "vert" | "cyan_clair" }.
• coussin_urgence [grande] — fonds d'urgence : mois couverts + repères 3/6 mois. params: {}.

— Revenu brut / impôt (source : revenu BRUT annuel saisi) —
• anatomie_dollar [grande] — où va chaque dollar gagné : impôts, cotisations, dépenses, épargne. params: {}.
• impot_palier [compacte] — impôt fédéral/Québec, taux effectif, jour de libération fiscale. params: {}.

— Patrimoine / long terme (source : avoirs & dettes saisis) —
• composition [compacte] — valeur nette : actifs vs passifs (REER, CELI, maison, hypothèque, dettes). params: {}.
• patrimoine_vie [grande] — trajectoire de ta valeur nette, année par année. params: {}.
• horizon [grande] — le « et si » : l'impact d'épargner X de plus par mois. params: { "ajoutMax": 500 | 1000 | 2000, "pas": 50 | 100 }.

— Contexte (toujours factuel) —
• fait [compacte] — un constat FACTUEL calculé des données, sans aucun jugement. params: {} (laisse VIDE : la tour rédige le constat). Termine souvent une vue par un \`fait\`. INTERDIT dans tout texte : « tu devrais », « bien/mal géré », « sur la bonne voie », « en avance/retard », tout conseil ou impératif.

RÈGLES :
- Choisis 3 à 5 blocs, dont 1-2 [grande] et le reste [compacte]. Termine de préférence par un \`fait\`.
- Mets des \`params\` UNIQUEMENT parmi les valeurs listées (sinon le défaut s'applique). N'invente pas de params. JAMAIS de montants.
- \`titre\` : court, en tutoiement, factuel (ex. « Où va ton argent », « Rembourser ta carte »).

EXEMPLES (situation décrite → blocs choisis) :
1) « je veux comprendre mon budget » → {"situation":"budget","titre":"Où va ton argent","blocs":[{"type":"repartition","params":{"repere":"50/30/20"}},{"type":"beignet","params":{}},{"type":"solde","params":{}},{"type":"barre_empilee","params":{}},{"type":"fait","params":{}}]}
2) « rembourser mon prêt auto » → {"situation":"dette","titre":"Rembourser ta dette","blocs":[{"type":"composition","params":{}},{"type":"solde","params":{}},{"type":"barre_empilee","params":{}},{"type":"fait","params":{}}]}
3) « je mets de côté pour une mise de fonds » → {"situation":"objectif","titre":"Mettre de côté","blocs":[{"type":"solde","params":{}},{"type":"stat","params":{"ton":"vert"}},{"type":"flux_annuel","params":{"souligner":"aucun","vue":"annuel"}},{"type":"fait","params":{}}]}
4) « comprends-moi mes impôts » → {"situation":"impot","titre":"Où part ton dollar brut","blocs":[{"type":"anatomie_dollar","params":{}},{"type":"impot_palier","params":{}},{"type":"fait","params":{}}]}
5) « ma vie financière dans le temps » → {"situation":"patrimoine","titre":"Ta vie financière","blocs":[{"type":"patrimoine_vie","params":{}},{"type":"horizon","params":{"ajoutMax":1000,"pas":50}},{"type":"composition","params":{}},{"type":"fait","params":{}}]}
6) « je suis paysagiste, je gagne rien l'hiver » → {"situation":"revenu_saisonnier","titre":"Passer l'hiver","blocs":[{"type":"flux_annuel","params":{"souligner":"mois_deficitaires","vue":"annuel"}},{"type":"jauge","params":{"mesure":"mois"}},{"type":"stat","params":{}},{"type":"fait","params":{}}]}

Réponds UNIQUEMENT avec un objet JSON valide { "situation": "...", "titre": "...", "blocs": [ {"type":"...","params":{...}} ] }, sans aucun texte avant ou après.`;

// Maquette déterministe sans IA (clé absente) : la situation saisonnière, seul cas outillé.
function mockRecette(message) {
  void message;
  return {
    situation: 'revenu_saisonnier',
    titre: "Passer l'hiver",
    blocs: [
      { type: 'flux_annuel', params: { souligner: 'mois_deficitaires', vue: 'annuel' } },
      { type: 'jauge', params: { mesure: 'mois', cible: 5 } },
      { type: 'stat', params: {} },
      { type: 'fait', params: { texte: "Tes mois d'été financent tes mois plus tranquilles." } }
    ]
  };
}

function callClaude(apiKey, message, model, system) {
  const body = JSON.stringify({
    model: model,
    max_tokens: 800,
    system: system,
    messages: [{ role: 'user', content: message }]
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch {} resolve({ status: res.statusCode, json: j, raw: d }); });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Délai dépassé')); });
    req.write(body);
    req.end();
  });
}

// Réessaie sur erreurs transitoires (429/529/5xx) ; bascule sur le modèle de repli si le principal reste surchargé.
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function callClaudeRetry(apiKey, message, system) {
  var models = [MODEL, FALLBACK_MODEL], out;
  for (var mi = 0; mi < models.length; mi++) {
    for (var attempt = 0; attempt < 3; attempt++) {
      out = await callClaude(apiKey, message, models[mi], system);
      var s = out.status;
      if (s >= 200 && s < 300) return out;                          // succès
      var transient = (s === 429 || s === 529 || (s >= 500 && s < 600));
      if (!transient) return out;                                   // 4xx définitif → ni retry ni repli
      if (attempt < 2) await wait(400 * Math.pow(2, attempt));      // 0.4s, 0.8s, puis on tente le modèle suivant
    }
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ service: 'build-tool', version: VERSION, ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Lecture du corps : message + mode (entite | recette)
  let message = '', mode = 'entite';
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b || '{}');
    message = (b && (b.message || b.texte) ? String(b.message || b.texte) : '').trim();
    if (b && b.mode) mode = String(b.mode);
  } catch { /* ignore */ }
  if (!message) return res.status(400).json({ error: 'empty_message' });
  if (message.length > 600) message = message.slice(0, 600);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const system = (mode === 'recette') ? SYSTEM_RECETTE : SYSTEM;

  // Sans clé : en mode recette on renvoie une MAQUETTE locale (le flux reste
  // testable hors ligne) ; en mode entité on signale l'absence de clé.
  if (!apiKey) {
    if (mode === 'recette') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(Object.assign({ _mock: true }, mockRecette(message)));
    }
    return res.status(503).json({ error: 'no_key' });
  }

  try {
    const out = await callClaudeRetry(apiKey, message, system);
    const data = out.json;
    if (!data) return res.status(502).json({ error: 'bad_response', status: out.status, raw: (out.raw || '').slice(0, 300) });
    if (data.type === 'error') return res.status(502).json({ error: 'api_error', status: out.status, anthropic_type: data.error && data.error.type, message: data.error && data.error.message, request_id: data.request_id });
    if (data.stop_reason === 'refusal') {
      if (mode === 'recette') return res.status(200).json(mockRecette(message));
      return res.status(200).json({ kind: 'unknown', name: '', icon: 'target', target: null, monthly: null, date: null, note: 'Je ne peux pas traiter cette demande. Décris-moi plutôt un objectif d\'épargne à suivre.' });
    }

    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let spec;
    try { const m = txt.match(/\{[\s\S]*\}/); spec = JSON.parse(m ? m[0] : txt); }
    catch (e) { return res.status(502).json({ error: 'parse_failed', snippet: txt.slice(0, 300) }); }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(spec);
  } catch (e) {
    return res.status(502).json({ error: 'build_failed', message: e.message });
  }
};
