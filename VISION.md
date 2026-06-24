# VISION — Groupe Financier Ste-Foy · Plateforme d'outils financiers

> Ce document est le « nord » du projet. Quand quelque chose se remêle, on revient ici.
> Il décrit ce qu'on bâtit, pourquoi, à quoi ça doit ressembler, et ce qui est hors scope.
> À garder dans le repo (ex. `VISION.md`) et à donner en contexte au début de chaque session de développement.

---

## 1. En une phrase

**Le premier outil de finances personnelles québécois qui pense comme une tour de contrôle : il surveille ton argent, te montre où tu t'en vas, fabrique tes propres outils de suivi en langage naturel — et tes montants ne quittent jamais ton appareil.**

C'est ça, la phrase de test. Si une décision de design ne sert pas cette phrase, on la remet en question.

---

## 2. Pour qui

Le **grand public québécois**. Pas des conseillers, pas des comptables, pas des power-users. Quelqu'un qui veut surtout savoir une chose : *« Est-ce que je finis mon mois dans le vert, et est-ce que je m'en vais dans la bonne direction? »*

Conséquence directe sur chaque décision : **moins de friction, moins de décisions à prendre, plus de clarté.** Chaque option de configuration qu'on ajoute, c'est du monde qu'on risque de perdre. La puissance doit atterrir comme de la simplicité.

---

## 3. Les trois choses qui nous rendent uniques (le fossé)

Un beau tableau de bord financier, il en existe mille (Mint, YNAB, Monarch). Ce qui nous rend **défendable**, c'est la combinaison de trois choses que personne d'autre n'a au même endroit :

1. **Le moteur fiscal québécois** (`twin-engine.js`). Paliers fédéral + Québec, RRQ, PSV avec récupération, CELIAPP/CELI/REER, projection patrimoniale. Personne au grand public ne modélise la fiscalité QC pour vrai — le marché est « trop petit » pour les gros joueurs. C'est notre fossé technique.

2. **L'IA qui fabrique des outils sur mesure** (`build-tool` / `moteur-prototype`). L'usager décrit un besoin en langage naturel, et l'app construit l'outil de suivi correspondant. C'est l'App Engine de ServiceNow, en français, pour la finance perso. Aucun concurrent grand public ne laisse l'usager créer ses propres types d'objets.

3. **Le privacy-first** : « le plan dans le nuage, l'argent chez le client. » Voir section 4. C'est un argument de vente, pas juste une contrainte.

**Stratégie : on pousse ces trois forces à fond plutôt que de copier les features que les gros ont déjà.** Les gros ne peuvent pas nous suivre sur le québécois fiscal (trop petit pour eux) ni sur le privacy-first (ça casse leur modèle de données). C'est là notre territoire.

---

## 4. Le principe fondateur — la confidentialité

> **« Le plan dans le nuage, l'argent chez le client. »**

- Les **montants personnels de l'usager** (revenus, dépenses, soldes, valeur nette) restent en **`localStorage`**, sur son appareil. Ils ne sont **jamais** envoyés à un serveur.
- Ce qui peut vivre dans le nuage : les **structures** (recettes d'outils, modèles génériques), jamais les chiffres.
- L'IA (`build-tool`) ne reçoit que **l'intention / la description**, jamais les montants. *(But cible : la classification se fait côté serveur, l'extraction des chiffres se fait côté client. À finaliser.)*
- Conséquence : un **export / import JSON** est essentiel comme filet de sécurité (si l'usager vide sa cache, il perd tout).

Cette règle est **non négociable**. Toute feature qui l'enfreint (agrégation bancaire automatique, base de données centrale des montants, sync non chiffrée) est hors scope.

---

## 5. La métaphore centrale — la tour de contrôle est le cerveau

Inspiration : le **single-pane of glass** de ServiceNow et la **source unique de vérité** de Snowflake.

La **tour de contrôle est la maison**. On l'ouvre, on est chez soi. Tous les outils (budget, hypothèque, simulateur, créer-un-outil) s'ouvrent **dans** la tour, pas sur des pages séparées. On ne « change jamais de page » : le contenu change *dans la coquille*, sans rechargement.

Distinction clé, à ne jamais perdre : **une tour de contrôle, ce n'est pas un tableau de bord.**

- Un **tableau de bord** affiche des chiffres. On regarde, on décide soi-même.
- Une **tour de contrôle** fait trois choses de plus :
  - **Pilotée par l'exception** — elle montre ce qui demande l'attention, pas tout.
  - **Prédictive** — où on s'en va, pas juste où on est.
  - **Actionnable** — on corrige depuis la tour, sans la quitter.

Les deux coexistent à **deux altitudes** : la tour (le cockpit) en haut, le tableau de bord (la profondeur) en dessous, atteint par drill-down.

---

## 6. Architecture en couches

```
┌─────────────────────────────────────────────────────────┐
│  COQUILLE single-pane (nav persistante, friendly, mobile) │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  TOUR DE CONTRÔLE (cockpit)  ← l'écran d'accueil      │ │
│  │  TABLEAU DE PROFONDEUR (graphiques)  ← drill-down     │ │
│  │  OUTILS (budget, hypothèque, simulateur, créer)       │ │
│  │     s'ouvrent en panneaux, sans recharger             │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  COUCHE CANONIQUE (canonical.js) — getSnapshot()          │
│  une seule source de vérité, lue par toutes les vues      │
├─────────────────────────────────────────────────────────┤
│  MOTEURS                                                  │
│  · twin-engine.js  — projection + fiscalité QC            │
│  · build-tool      — IA qui classe l'intention            │
│  · budget.js       — budget, fixe/variable                │
├─────────────────────────────────────────────────────────┤
│  DONNÉES — localStorage (les montants restent ici)        │
│  gfsf_budget_v2 · gfsf_twin_v1 · gfsf_hypo_v1 · gfsf_profile│
└─────────────────────────────────────────────────────────┘
```

Principe : **chaque vue lit `getSnapshot()`**, jamais les clés `localStorage` directement. C'est ce qui garantit qu'aucun onglet ne contredit l'autre.

---

## 7. La tour de contrôle — en détail

### 7a. Le cockpit (la vue mince, l'écran d'accueil)

Dans l'ordre vertical :

1. **Depuis ta dernière visite** — un fil court de « nouvelles » construit depuis les horodatages (`meta.freshness`) : factures passées, valeur nette qui a bougé, jours restants au mois. S'écrit à l'arrivée. C'est le moteur de retour : il y a *toujours* quelque chose de nouveau à lire.

2. **Le héros** — le **seul** bloc en dégradé navy→cyan (`#03045e → #00b4d8`). Contient :
   - **Le verdict du jour** : une phrase **factuelle** (jamais un jugement). Ex. : « À ton rythme, tes dépenses projetées du mois sont de 4 417 $, sur une enveloppe de 4 500 $. »
   - **L'altitude condensée** : barre de rythme (dépensé vs budget + marqueur du prorata du mois écoulé) + projection fin de mois.

3. **Ce qui demande ton attention** — le centre nerveux. Les **exceptions**, triées par sévérité, chacune **actionnable** (bouton « Voir » → drill-down). Quand il n'y a aucune exception → un état **calme et gratifiant** (« Tout est sous contrôle »), jamais un vide.

4. **À venir · imminents** — les 2-3 prochaines échéances (≤ ~10 jours), pas la liste complète.

5. **Actions** — « Ajouter une transaction », « Créer un outil ».

**Le moteur de règles des exceptions** (calculé localement depuis le snapshot, faits seulement) :
- Rythme global dépassé (dépensé > prorata du mois).
- Échéance / renouvellement dans ≤ 7 jours.
- Catégorie qui déborde — *seulement si* le budget par catégorie existe.
- Objectif sans cotisation mensuelle.
- Données périmées (> 21 jours).

### 7b. Le tableau de profondeur (la couche en dessous)

Atteint par drill-down depuis le cockpit. Des graphiques **utiles et concrets**, pas abstraits :

- **« Où est passé ton argent »** — beignet par catégorie, **palette vive** (le seul endroit où plein de couleurs se justifie), survol animé (segment qui grossit, centre qui affiche la catégorie). Données : dépenses par catégorie.
- **« Ton budget : engagé vs libre »** — barre empilée fixe (engagé) / variable (libre), depuis `budget.engageLibre`. Répond à « combien de mon mois est déjà verrouillé ».
- **« Ta valeur nette »** — interactive : boutons de période (2 sem / 1 mois / 3 mois / 1 an), repère qui suit la souris (date + montant), et bascule **Évolution / Composition**. La composition ventile les vrais postes du twin (maison, REER, CELI, non-enregistré, autres actifs ; hypothèque, autres dettes).
- **« Tes objectifs »** — les outils créés via `build-tool` (`entites[]`), avec progrès et ETA. Micro-célébration quand un cap est franchi.
- **« Explore · projection »** (déclassée, exploratoire) — la projection « et si » : un curseur fait bouger l'année d'indépendance en direct. Toujours étiquetée « selon tes hypothèses ».

---

## 8. L'IA qui fabrique des outils — la feature la plus différenciante

`build-tool` (`api/build-tool.js`) + `moteur-prototype.html`. C'est l'App Engine, en français.

**Le flux :**
1. L'usager décrit un besoin en langage naturel (ex. « acheter une maison à 40 000 $ d'ici 2028 », « un objectif voyage de 5 000 $ »).
2. Claude **classe l'intention** dans un des 5 archétypes et extrait les paramètres (nom, icône, cible, montant mensuel, échéance).
3. Le client assemble une **fiche éditable** — un outil de suivi fonctionnel.

**Les 5 archétypes :**
- **`goal`** — objectif d'épargne vers un montant cible (maison, voyage, auto, mariage, fonds d'urgence, rénovation).
- **`cap`** — compte enregistré à maximiser jusqu'à un plafond (CELIAPP, CELI, REER, REEE, REEI).
- **`debt`** — dette à rembourser (carte, prêt, marge).
- **`budget`** — budget mensuel (revenus vs dépenses).
- **`networth`** — valeur nette (actifs − passifs).

**Pourquoi c'est énorme** (la distinction qui compte) :
- Ce qui est **énorme** : fabriquer des *outils de suivi qui pensent*. Chaque outil créé devient une **entité que la tour surveille** — un objectif avec son ETA, une dette qui descend, un actif dans la valeur nette. L'outil se branche dans le moteur de règles, les exceptions, la projection. L'usager n'arrange pas des cases vides : **chaque case qu'il crée pense.**
- Ce qui est **surévalué** : laisser l'usager *réarranger les tuiles* de son dashboard. Pour le grand public, c'est un piège — il veut que le bon truc soit déjà à la bonne place, pas designer son écran.

**La rampe d'accès (indispensable) :** une feature aussi puissante a besoin d'exemples, sinon la page blanche intimide. Prévoir une **galerie de modèles experts curés par GFSF** (« Plan jeune diplômé » = fonds d'urgence + CELIAPP + prêt étudiant ; « Fonds d'urgence 3-6 mois » ; etc.). L'usager **adopte un modèle et l'ajuste** au lieu de partir du vide. Curé par GFSF (pas soumis par la foule — risque de conformité). Servi d'un fichier statique au départ ; une base (Supabase) seulement plus tard si le besoin se confirme.

---

## 9. La navigation — single-pane, friendly, mobile-first

Inspiré de ServiceNow/Snowflake **mais chaleureux et grand public**, pas clinique.

**Le principe :** on ne quitte jamais la coquille. Une nav **persistante** (toujours visible) + un **état actif criant** (où je suis) + le **contenu qui change en place** (sans recharger).

- **Desktop** : barre du haut sticky, pilules arrondies, item actif en **cyan plein** + `aria-current`. « ← Retour au site » discret à gauche.
- **Mobile (<768px)** : **barre d'onglets en bas, façon app native** (icône + mini-libellé), cibles ≥ 48px, safe-area iOS respectée, barre fixe pendant le scroll. C'est ce qui fait « friendly » et familier pour le grand public.
- **Onglets** (4, courts) : Tour de contrôle · Budget · Mon espace · Créer un outil. (Le Simulateur vit dans « Mon espace ».)
- **« Friendly »** = coins arrondis généreux, micro-transitions douces, langage humain, cyan chaleureux pour « toi, ici ». Jamais de gris clinique.
- **Fil d'Ariane** (à la Snowflake) quand on plonge dans un détail : *Tour › Budget › Restaurants*, remontable d'un clic.

**Cible technique :** les outils s'ouvrent en **panneaux par-dessus la tour, sans rechargement** (le vrai single-pane). On y arrive par étapes pour ne pas tout déstabiliser.

---

## 10. Le modèle de données

**Source unique : `canonical.js` → `window.GFSF_Profile.getSnapshot()`**, qui agrège tous les silos en un seul objet :

```
{
  meta:        { generatedAt, freshness, completeness },
  identity:    { prenom, age, situation },
  budget:      { revenuMensuel, budgetTotal, depenseTotal,
                 parCategorie[], repartition, engageLibre{engage,libre,total} },
  hypotheque:  { solde, taux, paiementMensuel, prochainPaiement } | null,
  patrimoine:  { valeurNette, actifs, passifs, historique[], tendanceMensuelle,
                 composition{ actifs{maison,reer,celi,nonEnregistre,autresActifs},
                              passifs{hypotheque,autresDettes}, net } } | null,
  projection:  { finDeMois, horizon[], ageRetraite } | null,
  entites:     [ { id, kind, name, icon, target, monthly, date, progres, eta } ],
  aVenir:      [ { date, type, label, montant } ]
}
```

**Silos `localStorage`** (les montants vivent ici) : `gfsf_budget_v2`, `gfsf_twin_v1`, `gfsf_hypo_v1`, `gfsf_profile`, `financialTwinHistory`.

**Règles d'or du snapshot :** read-only, jamais inventer une valeur (absente → `null`), déléguer les maths au twin, chaque lecture dans un `try/catch` (un silo corrompu ne plante jamais `getSnapshot()`).

---

## 11. Conformité (cadre iA / AMF)

L'outil est **informatif**, pas un conseiller. Règle simple : **on décrit des faits, on ne porte pas de jugement.**

- ✅ Permis : « Tes dépenses projetées sont de 4 417 $ sur 4 500 $ », « Restaurants : 86 % de l'enveloppe utilisée ».
- ❌ Interdit : « sur la bonne voie », « en avance/retard », « bien/mal géré », « tu devrais », « coupe », « rembourse », tout impératif, tout conseil.
- Les **projections** sont toujours étiquetées « selon tes hypothèses » + rendement affiché.
- **Avertissement permanent** en pied : « Outil informatif. Ne constitue pas un conseil financier personnalisé. »

Test mental : *est-ce que c'est ce qu'un cadran afficherait (ok) ou ce qu'un conseiller dirait (non)?*

---

## 12. Le langage de design

- **Marque** : navy `#03045e` (`--brand-dark`), cyan `#00b4d8` (`--brand-primary`), accent `#0077b6` (`--brand-accent`), fond clair (`--bg-light` / `#f3f6fa`). Typo **Montserrat**.
- **Hiérarchie d'abord** : **un seul moment héros** (le bloc foncé dégradé), tout le reste en **cartes blanches nettes** sur fond clair aéré. Le défaut à éviter : une grille de cartes toutes du même poids (= boueux, sans héros).
- **Le verre (glassmorphism)** sert *uniquement* sur les zones foncées (héros / horizon) — là où il a quelque chose à flouter. Jamais sur le blanc.
- **Couleur = sens** : cyan = « toi / maintenant », ambre/corail *uniquement* pour l'exception. Le beignet a droit à sa palette vive (chaque catégorie = une couleur) ; partout ailleurs, navy/cyan calme.
- **Friendly, façon Apple/app native** : coins arrondis généreux, ombres douces, mouvement subtil et utile (jamais clinquant), `prefers-reduced-motion` respecté.
- **Mobile-first** : tout doit être beau et utilisable à 375px ; barre d'onglets en bas.

---

## 13. Dans le scope / Hors scope

**Dans le scope :**
- La tour (cockpit + profondeur), le single-pane, la nav friendly/mobile.
- La couche canonique, le twin (fiscalité QC), `build-tool` + la galerie de modèles experts.
- L'interface en **langage naturel branchée sur le twin local** (le plus gros levier futur : « pose une question à ta tour, elle répond avec tes vrais chiffres, sans qu'ils quittent ton appareil »).

**Hors scope (et pourquoi) :**
- ❌ **Snowflake (le produit)** — c'est un entrepôt de données d'entreprise, surdimensionné, cher, et ça brise le privacy-first. (L'inspiration « source unique », elle, on la garde via `canonical.js`.)
- ❌ **Agrégation bancaire automatique** (Plaid/Flinks) — coûteux, cauchemar de conformité, et contredit « l'argent reste chez le client ».
- ❌ **Base de données centrale des montants** — viole le principe fondateur.
- ⏳ **Supabase** — pas maintenant. Justifié seulement plus tard, pour la *bibliothèque de modèles* (structures, zéro montant) ou un éventuel côté pro/conseiller.
- ⏳ **Sync multi-appareils** — seulement avec chiffrement côté client, plus tard, si réclamé.
- ⏳ **Réarrangement de tuiles par l'usager** — gadget pour le grand public ; pas une priorité.

---

## 14. État actuel et feuille de route

**Déjà en place :** couche canonique (`canonical.js`), twin (`twin-engine.js`), `build-tool` (5 archétypes en ligne), tour de contrôle (cockpit + tableau de profondeur), barre de nav (`nav.js`), graphiques validés.

**Note importante :** en production, le domaine redirige actuellement `/compas` vers une page de maintenance (`vercel.json`) — les outils ne sont **pas encore publics**. Le lancement = retirer cette redirection.

**Feuille de route (dans l'ordre, une chose à la fois) :**
1. **Ménage** — supprimer les pages mortes/dev (fait ou en cours).
2. **Coquille single-pane** — nav friendly + mobile (barre du bas), état actif évident.
3. **Swap sans rechargement** — les outils s'ouvrent en panneaux dans la tour.
4. **Brancher `build-tool` à fond dans la tour** — que les outils créés apparaissent dans les exceptions, objectifs, valeur nette.
5. **La galerie de modèles experts** (la rampe d'accès).
6. **Tester avec de vraies données**, polir, puis **lancer** (retirer la redirection de maintenance).
7. *(Plus tard)* l'interface en langage naturel.

**Discipline :** la fondation avant le brillant. Une chose à la fois. On ne recommence pas de zéro — on garde le cœur (canonique, twin, build-tool, fiscalité QC) et on réorganise la surface.

---

## 15. Comment utiliser ce document

- C'est le **nord**. Avant d'ajouter une feature, vérifier qu'elle sert la phrase de la section 1 et respecte le principe de la section 4.
- Le donner **en contexte** à Claude Code au début d'une session, pour qu'il code dans le bon cadre.
- Quand ça « se remêle » : revenir ici, pas créer un nouveau projet. Le désordre vient des décisions empilées, pas du repo.
- Le mettre à jour quand une décision d'architecture change (et seulement là).
