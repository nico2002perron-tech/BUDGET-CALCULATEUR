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

// ── Mode COMPARER : « phrase → contextes de comparaison » (carré de sable).
// L'IA choisit QUELS contextes ajouter parmi la liste DISPONIBLE envoyée par le
// client (forme des données seulement — jamais un montant). Les séries sont
// ensuite résolues LOCALEMENT depuis le snapshot (schema.js/resoudreComparaisons).
const SYSTEM_COMPARER = `Tu es le SÉLECTIONNEUR de comparaisons de « la tour de contrôle », une plateforme québécoise de finances personnelles.
On te donne : le KPI regardé (id + question), si les revenus sont saisonniers, les DONNÉES PRÉSENTES (clés), la liste des CONTEXTES DISPONIBLES (ids), et la phrase de l'usager.
Ton rôle : choisir 1 à 3 contextes PARMI la liste disponible SEULEMENT — tu ne crées jamais de contexte, tu ne mets JAMAIS de chiffres (les valeurs se calculent sur l'appareil de l'usager).

Sens des contextes : "moyenne" = sa moyenne mensuelle lissée ; "cout_vie" = son coût de vie mensuel ; "an_passe" = la même métrique l'an passé.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{"series":[{"contexte":"<id disponible>","label":"<2-4 mots, tutoiement, factuel>"}]}
- "label" : court et factuel (ex. « ta moyenne », « ton coût de vie »), SANS emoji, sans conseil ni jugement.
- La phrase demande un contexte hors liste → omets-le (série vide permise : {"series":[]}).`;

// ── Mode PILOTER : « phrase → ACTIONS » (barre-copilote « Demande à ta tour »).
// L'IA ne fait que CHOISIR des actions dans un vocabulaire FERMÉ, parmi les
// options OFFERTES envoyées par le client (formes/contextes/couleurs = forme des
// données seulement, jamais un montant du silo). Le client VALIDE + applique
// chaque action (actions.js) : une action impossible est refusée honnêtement.
const SYSTEM_PILOTER_SABLE = `Tu es le COPILOTE de « la tour de contrôle », une plateforme québécoise de finances personnelles. L'usager regarde UN indicateur dans son « carré de sable » et te parle en français.
Ton rôle : traduire sa phrase en une LISTE d'ACTIONS, dans l'ordre. Tu NE calcules RIEN, tu NE mets AUCUN montant venant des données (les chiffres vivent sur l'appareil de l'usager). Le SEUL nombre que tu peux écrire est celui que l'usager PRONONCE lui-même (ex. « une cible de 4000 »).

On te donne : l'indicateur (id + question), sa forme actuelle, les FORMES OFFERTES (ids), les LECTURES OFFERTES (dérivées : brut/pct_revenu/pct_depenses), les DÉCOUPES OFFERTES (par_categorie/fixe_variable), les CONTEXTES de comparaison OFFERTS (ids), les COULEURS offertes (ids), si une cible est réglable (+ son unité).

VERBES (n'utilise QUE ceux-ci ; ne choisis QUE parmi les options offertes) :
- {"verbe":"changer_forme","forme":"<id parmi les FORMES OFFERTES>"}
- {"verbe":"changer_mesure","mesure":"<id parmi les LECTURES OFFERTES>"} — la LECTURE du chiffre : brut=montant, pct_revenu=en % du revenu, pct_depenses=en % des dépenses.
- {"verbe":"changer_decoupe","decoupe":"<id parmi les DÉCOUPES OFFERTES>"} — comment TRANCHER le tout : par_categorie ou fixe_variable.
- {"verbe":"ajouter_comparateur","contexte":"<id parmi les CONTEXTES OFFERTS>"}
- {"verbe":"retirer_comparateur","contexte":"<id>"}
- {"verbe":"poser_cible","valeur":<nombre prononcé par l'usager>}
- {"verbe":"retirer_cible"}
- {"verbe":"changer_couleur","couleur":"<id parmi les COULEURS offertes>"}
- {"verbe":"renommer","titre":"<court, tutoiement, factuel, sans emoji>"}

Sens des formes courantes : prisme3d=3D en relief, bandes=barres, courbe=ligne, nuage=bulles, beignet=circulaire, anneau3d=anneau, stat=un chiffre, jauge=arc, fait=une phrase.
Sens des contextes : moyenne=sa moyenne, cout_vie=son coût de vie, an_passe=l'an passé.
Une phrase peut donner PLUSIEURS actions (« mon logement en % de mes dépenses, en fixe/variable » → changer_mesure + changer_decoupe ; « en courbe avec une cible de 4000 » → changer_forme + poser_cible). Une demande impossible/hors options → ne l'inclus pas (liste vide permise).

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour : {"actions":[ ... ]}`;

// ── Mode PILOTER, surface BOARD : l'usager parle à SON TABLEAU (« ajoute mon
// coussin », « c'est quoi mon plus gros poste ? », « enlève-la », « agrandis »).
const SYSTEM_PILOTER_BOARD = `Tu es le COPILOTE de « la tour de contrôle », une plateforme québécoise de finances personnelles. L'usager regarde SON TABLEAU d'indicateurs (des tuiles) et te parle en français.
Ton rôle : traduire sa phrase en une LISTE d'ACTIONS. Tu NE calcules RIEN, tu NE mets AUCUN montant.

On te donne : les TUILES actuelles (id + indicateur + taille), et les INDICATEURS OFFERTS (id + question) qu'on peut créer ou dont on peut donner la réponse.

VERBES (n'utilise QUE ceux-ci ; ne choisis QUE parmi les ids offerts/présents) :
- {"verbe":"creer_widget","kpi":"<id d'un INDICATEUR OFFERT>"} — pour « ajoute/montre/suis <indicateur> ».
- {"verbe":"repondre_kpi","kpi":"<id d'un INDICATEUR OFFERT>"} — quand l'usager POSE une QUESTION (« c'est quoi… », « combien… », « il me reste… ») : pose la tuile qui répond.
- {"verbe":"retirer_widget","cible":"<id d'une TUILE présente>"} — pour « enlève/retire <tuile> ».
- {"verbe":"redimensionner","cible":"<id d'une TUILE>","taille":"s|m|l|xl"} — « agrandis » → l ou xl, « réduis » → s.
- {"verbe":"ouvrir_sable","cible":"<id d'une TUILE>"} — « ouvre/retouche <tuile> ».

Associe l'indicateur le plus PERTINENT à la demande (coussin→sécurité, solde→ce qu'il reste, top_categorie→plus gros poste, taux_effectif→impôts, valeur_nette→patrimoine…). Une demande sans indicateur/tuile correspondante → liste vide.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour : {"actions":[ ... ]}`;

// Maquette déterministe du mode piloter (clé absente) : mots-clés → actions.
// Couvre les commandes courantes → le copilote marche HORS LIGNE pour tous.
function mockPiloter(message, p) {
  if (p && p.surface === 'board') return mockPiloterBoard(message, p);
  return mockPiloterSable(message, p);
}
function mockPiloterSable(message, p) {
  const t = String(message || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ctx = p || {};
  const formes = Array.isArray(ctx.formesOffertes) ? ctx.formesOffertes : [];
  const contextes = Array.isArray(ctx.contextesOfferts) ? ctx.contextesOfferts : [];
  const couleurs = Array.isArray(ctx.couleurs) ? ctx.couleurs : [];
  const actions = [];
  const retrait = /\b(enleve|retire|efface|sans|plus de|enleves)\b/.test(t);

  // FORME (synonymes → id) ; on ne propose que si elle est offerte
  const FORME_MOTS = [
    ['prisme3d', /(prisme|relief|\b3d\b|trois? ?d)/], ['courbe', /(courbe|ligne|lineaire)/],
    ['bandes', /(bande|barre|histogramme)/], ['nuage', /(nuage|bulle|point)/],
    ['beignet', /(beignet|circulaire|camembert|secteur|donut)/], ['anneau3d', /(anneau|couronne)/],
    ['stat', /(chiffre|nombre|gros chiffre|un seul)/], ['jauge', /(jauge|arc|cadran)/], ['fait', /(constat|une phrase|en mots)/],
  ];
  for (const [id, re] of FORME_MOTS) { if (re.test(t) && formes.includes(id)) { actions.push({ verbe: 'changer_forme', forme: id }); break; } }

  // LA LECTURE (dérivée) : « en % de mon revenu / de mes dépenses », « en montant »
  const mesures = Array.isArray(ctx.mesuresOffertes) ? ctx.mesuresOffertes : [];
  const MESURE_MOTS = [
    ['pct_revenu', /(%|pourcent|pour ?cent|part|portion).{0,24}(revenu|paye|salaire|gagne)/],
    ['pct_depenses', /(%|pourcent|pour ?cent|part|portion).{0,24}(depense|budget)/],
    ['brut', /(en montant|en dollars?|en \$|montant brut|valeur brute|montant nu|remets le montant)/],
  ];
  for (const [id, re] of MESURE_MOTS) { if (re.test(t) && mesures.includes(id)) { actions.push({ verbe: 'changer_mesure', mesure: id }); break; } }

  // LA DÉCOUPE : « fixe/variable », « par catégorie »
  const decoupes = Array.isArray(ctx.decoupesOffertes) ? ctx.decoupesOffertes : [];
  const DECOUPE_MOTS = [
    ['fixe_variable', /(fixe.{0,5}variable|variable.{0,5}fixe|fixe ?\/ ?variable|engage|par fixe)/],
    ['par_categorie', /(par categorie|par poste|categorie)/],
  ];
  for (const [id, re] of DECOUPE_MOTS) { if (re.test(t) && decoupes.includes(id)) { actions.push({ verbe: 'changer_decoupe', decoupe: id }); break; } }

  // CIBLE : « cible/objectif de 4000 », « 4 000 par mois » ; ou retrait
  if (ctx.cible && ctx.cible.present) {
    if (retrait && /(cible|objectif)/.test(t)) actions.push({ verbe: 'retirer_cible' });
    else {
      const m = t.match(/(?:cible|objectif|vise|a)\D{0,12}?(\d[\d\s]{1,9})/) || t.match(/(\d[\d\s]{2,9})\s*(?:\$|par mois|\/mois|mois|%)/);
      if (m) { const v = parseInt(m[1].replace(/\s/g, ''), 10); if (isFinite(v)) actions.push({ verbe: 'poser_cible', valeur: v }); }
    }
  }

  // COMPARATEURS (saisonnier) : ajoute/retire selon les sujets nommés
  const CTX_MOTS = [['moyenne', /(moyenne|lissee?)/], ['cout_vie', /(cout|couts|vie|depense|seuil)/], ['an_passe', /(an passe|l an dernier|annee derniere|historique|passee?)/]];
  for (const [id, re] of CTX_MOTS) {
    if (re.test(t) && contextes.includes(id)) actions.push({ verbe: retrait ? 'retirer_comparateur' : 'ajouter_comparateur', contexte: id });
  }

  // COULEUR (mot → id de palette)
  const COUL_MOTS = [['vert', /vert/], ['cyan', /(cyan|turquoise)/], ['ocean', /(ocean|bleu fonce|bleu marine)/], ['indigo', /indigo/], ['lavande', /(lavande|mauve|violet|lilas)/], ['magenta', /(magenta|rose|fuchsia)/]];
  for (const [id, re] of COUL_MOTS) { if (re.test(t) && couleurs.includes(id)) { actions.push({ verbe: 'changer_couleur', couleur: id }); break; } }

  // RENOMMER : « appelle/renomme/nomme … "X" » ou « … : X »
  const ren = message.match(/(?:appelle[- ]?la|appelle|renomme[- ]?la|renomme|nomme[- ]?la|nomme|titre)\s*[:«"]?\s*([^"»]{2,40})/i);
  if (ren && /appelle|renomme|nomme|titre/i.test(message)) {
    const titre = ren[1].replace(/["»].*$/, '').trim();
    if (titre) actions.push({ verbe: 'renommer', titre });
  }

  return { actions };
}

// Maquette déterministe du mode piloter (board) : mots-clés → indicateur → action.
function mockPiloterBoard(message, p) {
  const t = String(message || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const offerts = Array.isArray(p && p.kpisOfferts) ? p.kpisOfferts.map((k) => k && k.id) : [];
  const tuiles = Array.isArray(p && p.tuiles) ? p.tuiles : [];
  const actions = [];
  // Associer un INDICATEUR (id) à la phrase, parmi les offerts.
  const KPI_MOTS = [
    ['mois_couverts', /(coussin|securite|fonds d urgence|urgence|tient combien|combien de mois)/],
    ['montant_coussin', /(combien de cote|combien j ai de cote)/],
    ['solde_mois', /(reste|solde|surplus|ce qu il reste|il me reste)/],
    ['top_categorie', /(plus gros poste|grosse categorie|ou va|quel poste|pese le plus|plus gros)/],
    ['cout_vie_mensuel', /(cout de vie|couter de vivre|coute de vivre)/],
    ['taux_epargne', /(taux d epargne|part.*cote|combien je mets)/],
    ['equilibre_503020', /(50 ?30 ?20|budget.*balance|equilibre)/],
    ['taux_effectif', /(impot|imposition|taxes)/],
    ['revenu_net_mensuel', /(net|revenu net|reste net)/],
    ['valeur_nette', /(valeur nette|je vaux|patrimoine net|combien je vaux)/],
    ['patrimoine_retraite', /(retraite|a la retraite)/],
    ['trajectoire_patrimoine', /(patrimoine.*evolue|evolue.*patrimoine|trajectoire)/],
    ['amplitude_revenus', /(revenus varient|saison|amplitude|revenu variable)/],
  ];
  let kpi = null;
  for (const [id, re] of KPI_MOTS) { if (re.test(t) && offerts.includes(id)) { kpi = id; break; } }
  // La tuile visée : celle qui porte ce kpi, sinon « la dernière/celle-là ».
  const tuileDe = (k) => tuiles.find((x) => x && x.kpi === k);
  const derniere = tuiles.length ? tuiles[tuiles.length - 1] : null;
  const retrait = /\b(enleve|enleves|retire|retires|efface|supprime|vire|jette)\b/.test(t);
  const ouvre = /\b(ouvre|retouche|modifie|change|edite)\b/.test(t);
  const agrandir = /\b(agrandis|plus grand|plus grande|plus gros|en grand)\b/.test(t);
  const reduire = /\b(reduis|reduit|plus petit|plus petite|rapetisse)\b/.test(t);
  const cibleTuile = (kpi && tuileDe(kpi)) || (/(la|celle|ca|cette|derniere)/.test(t) ? derniere : null);

  if (retrait && cibleTuile) actions.push({ verbe: 'retirer_widget', cible: cibleTuile.id });
  else if (ouvre && cibleTuile) actions.push({ verbe: 'ouvrir_sable', cible: cibleTuile.id });
  else if ((agrandir || reduire) && cibleTuile) actions.push({ verbe: 'redimensionner', cible: cibleTuile.id, taille: agrandir ? 'l' : 's' });
  else if (kpi) {
    const question = /\?|c est quoi|combien|quel|quelle|est-ce|quest|ou va|comment/.test(t);
    actions.push({ verbe: question ? 'repondre_kpi' : 'creer_widget', kpi });
  }
  return { actions };
}

// Maquette déterministe du mode comparer (clé absente) : mots-clés → contextes.
function mockComparer(message, disponibles) {
  const dispo = Array.isArray(disponibles) ? disponibles : [];
  const t = String(message || '').toLowerCase();
  const series = [];
  const ajoute = (contexte, label) => { if (dispo.includes(contexte) && !series.some(s => s.contexte === contexte)) series.push({ contexte, label }); };
  if (/moyenne|liss/.test(t)) ajoute('moyenne', 'ta moyenne');
  if (/co[uû]t|vie|d[ée]pense|seuil/.test(t)) ajoute('cout_vie', 'ton coût de vie');
  if (/pass[ée]|dernier|historique/.test(t)) ajoute('an_passe', 'l’an passé');
  if (series.length === 0) ajoute('moyenne', 'ta moyenne');
  return { series };
}

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

  // Lecture du corps : message + mode (entite | recette | comparer | piloter)
  let message = '', mode = 'entite', comparer = null, piloter = null;
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b || '{}');
    message = (b && (b.message || b.texte) ? String(b.message || b.texte) : '').trim();
    if (b && b.mode) mode = String(b.mode);
    if (mode === 'comparer') {
      // FORME des données seulement (privacy) : ids, question, clés, booléen.
      // Chaque champ est BORNÉ (endpoint public : pas de prompt gonflé par un POST direct).
      comparer = {
        kpi: String(b.kpi || '').slice(0, 60),
        question: String(b.question || '').slice(0, 200),
        saisonnier: !!b.saisonnier,
        donneesDisponibles: Array.isArray(b.donneesDisponibles) ? b.donneesDisponibles.slice(0, 20).map((x) => String(x).slice(0, 40)) : [],
        contextesDisponibles: Array.isArray(b.contextesDisponibles) ? b.contextesDisponibles.slice(0, 10).map((x) => String(x).slice(0, 40)) : [],
      };
    }
    if (mode === 'piloter') {
      // FORME seulement (privacy) : ids d'options offertes + booléens + unité.
      // AUCUN montant du silo — seul le nombre PRONONCÉ par l'usager (dans la phrase) circule.
      const cible = b.cible && typeof b.cible === 'object' ? b.cible : {};
      piloter = {
        surface: String(b.surface || 'sable').slice(0, 20),
        kpi: String(b.kpi || '').slice(0, 60),
        question: String(b.question || '').slice(0, 200),
        formeActive: String(b.formeActive || '').slice(0, 30),
        formesOffertes: Array.isArray(b.formesOffertes) ? b.formesOffertes.slice(0, 16).map((x) => String(x).slice(0, 30)) : [],
        mesuresOffertes: Array.isArray(b.mesuresOffertes) ? b.mesuresOffertes.slice(0, 8).map((x) => String(x).slice(0, 30)) : [],
        decoupesOffertes: Array.isArray(b.decoupesOffertes) ? b.decoupesOffertes.slice(0, 8).map((x) => String(x).slice(0, 30)) : [],
        contextesOfferts: Array.isArray(b.contextesOfferts) ? b.contextesOfferts.slice(0, 10).map((x) => String(x).slice(0, 30)) : [],
        couleurs: Array.isArray(b.couleurs) ? b.couleurs.slice(0, 10).map((x) => String(x).slice(0, 20)) : [],
        cible: { present: !!cible.present, unite: String(cible.unite || '').slice(0, 12), posee: !!cible.posee },
        // surface board : l'inventaire des tuiles + les indicateurs offerts (ids + questions).
        tuiles: Array.isArray(b.tuiles) ? b.tuiles.slice(0, 40).map((x) => ({ id: String((x && x.id) || '').slice(0, 40), kpi: String((x && x.kpi) || '').slice(0, 60), taille: String((x && x.taille) || '').slice(0, 4) })) : [],
        kpisOfferts: Array.isArray(b.kpisOfferts) ? b.kpisOfferts.slice(0, 30).map((x) => ({ id: String((x && x.id) || '').slice(0, 60), question: String((x && x.question) || '').slice(0, 120) })) : [],
      };
    }
  } catch { /* ignore */ }
  if (!message) return res.status(400).json({ error: 'empty_message' });
  if (message.length > 600) message = message.slice(0, 600);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const system = (mode === 'comparer') ? SYSTEM_COMPARER : (mode === 'recette') ? SYSTEM_RECETTE
    : (mode === 'piloter') ? ((piloter && piloter.surface === 'board') ? SYSTEM_PILOTER_BOARD : SYSTEM_PILOTER_SABLE)
    : SYSTEM;
  const texteUsager = message; // la phrase BRUTE (le mock lit celle-ci, jamais le gabarit)
  if (mode === 'comparer') {
    const c = comparer || { kpi: '', question: '', saisonnier: false, donneesDisponibles: [], contextesDisponibles: [] };
    message = `KPI : ${c.kpi} — « ${c.question} »\nRevenus saisonniers : ${c.saisonnier ? 'oui' : 'non'}\nDonnées présentes : ${c.donneesDisponibles.join(', ') || '(aucune)'}\nContextes disponibles : ${c.contextesDisponibles.join(', ') || '(aucun)'}\nDemande de l'usager : ${message}`;
  }
  if (mode === 'piloter') {
    const p = piloter || { surface: 'sable', kpi: '', question: '', formeActive: '', formesOffertes: [], contextesOfferts: [], couleurs: [], cible: { present: false, unite: '', posee: false }, tuiles: [], kpisOfferts: [] };
    if (p.surface === 'board') {
      const tuiles = (p.tuiles || []).map((x) => `${x.id} (${x.kpi || 'vue'}${x.taille ? ', ' + x.taille : ''})`).join(' ; ') || '(aucune)';
      const kpis = (p.kpisOfferts || []).map((k) => `${k.id} : « ${k.question} »`).join('\n') || '(aucun)';
      message = `Tuiles actuelles : ${tuiles}\nIndicateurs offerts :\n${kpis}\nDemande de l'usager : ${message}`;
    } else {
      message = `Indicateur : ${p.kpi} — « ${p.question} »\nForme actuelle : ${p.formeActive || '(aucune)'}\nFormes offertes : ${p.formesOffertes.join(', ') || '(aucune)'}\nLectures offertes (dérivées) : ${(p.mesuresOffertes || []).join(', ') || '(aucune)'}\nDécoupes offertes : ${(p.decoupesOffertes || []).join(', ') || '(aucune)'}\nContextes de comparaison offerts : ${p.contextesOfferts.join(', ') || '(aucun)'}\nCouleurs offertes : ${p.couleurs.join(', ') || '(aucune)'}\nCible réglable : ${p.cible.present ? `oui (unité ${p.cible.unite || '?'}, ${p.cible.posee ? 'déjà posée' : 'non posée'})` : 'non'}\nDemande de l'usager : ${message}`;
    }
  }

  // Sans clé : en modes recette/comparer on renvoie une MAQUETTE locale (le flux
  // reste testable hors ligne) ; en mode entité on signale l'absence de clé.
  if (!apiKey) {
    res.setHeader('Cache-Control', 'no-store');
    if (mode === 'recette') return res.status(200).json(Object.assign({ _mock: true }, mockRecette(message)));
    if (mode === 'comparer') return res.status(200).json(Object.assign({ _mock: true }, mockComparer(texteUsager, comparer && comparer.contextesDisponibles)));
    if (mode === 'piloter') return res.status(200).json(Object.assign({ _mock: true }, mockPiloter(texteUsager, piloter)));
    return res.status(503).json({ error: 'no_key' });
  }

  try {
    const out = await callClaudeRetry(apiKey, message, system);
    const data = out.json;
    if (!data) return res.status(502).json({ error: 'bad_response', status: out.status, raw: (out.raw || '').slice(0, 300) });
    if (data.type === 'error') return res.status(502).json({ error: 'api_error', status: out.status, anthropic_type: data.error && data.error.type, message: data.error && data.error.message, request_id: data.request_id });
    if (data.stop_reason === 'refusal') {
      if (mode === 'comparer') return res.status(200).json(mockComparer(texteUsager, comparer && comparer.contextesDisponibles));
      if (mode === 'piloter') return res.status(200).json(mockPiloter(texteUsager, piloter));
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
