# REGISTRE DE BLOCS — le trésor de la tour de contrôle

> La bibliothèque de pièces visuelles fiables que l'IA *assemble* (jamais ne génère) pour composer
> une vue unique à chaque situation de vie. À lire avec VISION.md.
>
> **Principe fondateur : les blocs ne sont pas les cas.** Les blocs sont le vocabulaire ; les cas
> sont les phrases. ~21 blocs paramétrables → un nombre pratiquement illimité de vues uniques,
> parce que l'unicité vient de l'**agencement + les paramètres**, pas du nombre de blocs.

---

## Comment ça marche (rappel)

1. L'usager décrit sa situation + répond à 2-3 questions tappables.
2. L'IA (`build-tool` étendu) écrit une **recette** : quels blocs, quels réglages.
3. Le **moteur de rendu** lit la recette, pige dans ce registre, assemble la vue.
4. La vue s'ajoute au dashboard comme **tuile vivante** (re-rendue à jour, surveillée par la tour).

L'IA choisit les blocs + règle leurs paramètres + rédige les *faits* (garde-fou conformité).
L'**agencement** (ordre, importance) est géré par la tour, par exception — pas par l'IA, pas par l'usager.

---

## Les 21 blocs (7 familles)

Chaque bloc : ce qu'il montre · ses paramètres clés · les situations qu'il sert.

### Famille 1 — Proportion & cible (« où j'en suis vers quelque chose »)

**1. `jauge`** — un arc qui montre une valeur vers une cible.
- params : `mesure` (montant / mois / pourcentage), `valeur`, `cible`, `unite`
- sert : coussin d'hiver, fonds d'urgence, % d'un plafond atteint

**2. `barre_progression`** — progression linéaire vers un objectif.
- params : `valeur`, `cible`, `etiquetteGauche`, `etiquetteDroite`
- sert : objectif d'épargne, remboursement de dette, mise de fonds

**3. `anneau_multi`** — plusieurs objectifs en anneaux concentriques.
- params : `objectifs[]` (chacun : nom, valeur, cible, couleur)
- sert : quelqu'un qui suit 2-3 objectifs en parallèle

### Famille 2 — Répartition (« comment ça se divise »)

**4. `beignet`** — répartition par catégorie (palette vive autorisée).
- params : `postes[]` (nom, montant, couleur), `centre` (libellé)
- sert : où va l'argent, composition d'un patrimoine, sources de revenu

**5. `barre_empilee`** — deux ou trois parts dans une barre pleine.
- params : `segments[]` (nom, montant, couleur)
- sert : engagé/libre, fixe/variable, actifs/passifs

**6. `repartition_cible`** — réel vs repère (ex. 50/30/20), étiqueté « à titre de repère ».
- params : `reel` {besoins, envies, epargne}, `repere` {50, 30, 20}
- sert : équilibre du budget, vue « besoins/envies/épargne »

### Famille 3 — Montant & état (« un chiffre qui compte »)

**7. `compteur`** — un montant qui s'anime de 0 à sa valeur.
- params : `source`, `prefixe`, `suffixe`
- sert : total mis de côté, total d'une dette, valeur d'un actif

**8. `stat`** — gros chiffre + contexte + variation (delta).
- params : `valeur`, `label`, `delta`, `sensDelta`
- sert : valeur nette, coût mensuel d'une charge, revenu du mois

**9. `solde`** — revenus − dépenses = surplus ou déficit, clairement coloré.
- params : `revenus`, `depenses`
- sert : « est-ce que je finis mon mois dans le vert », le verdict de base

### Famille 4 — Le temps (« quand »)

**10. `flux_annuel`** — 12 mois, revenus en barres vs ligne de dépenses (BLOC-SIGNATURE).
- params : `revenus[12]`, `depenses`, `souligner` (ex. mois déficitaires)
- sert : revenu saisonnier, revenu irrégulier, vue annuelle

**11. `calendrier`** — grille mensuelle d'échéances (LE journal de bord).
- params : `evenements[]` (jour, montant, type fixe/variable, libellé), `filtre`
- sert : dépenses fixes/à venir, paiements récurrents, flux du mois

**12. `ligne_evolution`** — une tendance dans le temps, avec boutons de période + survol.
- params : `serie[]` (date, valeur), `periodes` (2sem/1mois/3mois/1an)
- sert : valeur nette dans le temps, épargne qui grimpe, dette qui descend

**13. `echeancier`** — liste des prochaines échéances (les imminentes).
- params : `evenements[]`, `horizon` (jours)
- sert : « les 30 prochains jours », anti-surprise

**14. `chronologie`** — compte à rebours vers une date.
- params : `dateCible`, `label`, `progression`
- sert : saison morte qui approche, échéance d'un objectif, date butoir

### Famille 5 — Scénario (« et si »)

**15. `curseur_etsi`** — explore un changement et voit l'impact en direct.
- params : `variable` (épargne, paiement…), `min`, `max`, `impact` (ce qui bouge)
- sert : « et si j'épargnais X de plus », « et si je remboursais Y »

**16. `comparaison`** — deux états côte à côte (avant/après, option A/B).
- params : `gauche` {label, valeur}, `droite` {label, valeur}
- sert : scénario A vs B, situation actuelle vs visée

### Famille 6 — Sens & contexte (factuel, conforme)

**17. `fait`** — un constat factuel, rédigé par l'IA (garde-fou conformité : aucun jugement).
- params : `texte` (validé contre les mots interdits)
- sert : contextualiser n'importe quelle vue (« tes 6 mois d'été génèrent 87 % de ton revenu »)

**18. `repere`** — une comparaison neutre, étiquetée « à titre de comparaison ».
- params : `texte`, `valeurRepere`
- sert : situer un montant sans le juger

**19. `liste`** — des éléments itemisés.
- params : `items[]` (libellé, montant, méta)
- sert : tes dettes, tes abonnements, tes sources de revenu

### Famille 7 — Surveillance (« la tour pense »)

**20. `attention`** — une exception factuelle (ce qui demande l'attention).
- params : `texte`, `severite` (info / ambre), `action` (drill-down)
- sert : coussin qui stagne, enveloppe qui déborde, échéance proche

**21. `carte_entite`** — résumé d'une entité suivie (créée par le chat).
- params : `entite` (nom, icône, progrès, ETA)
- sert : afficher un objectif/dette/compte comme tuile vivante

---

## Le schéma de recette (le contrat IA → moteur)

La sortie complète de l'IA pour composer une vue. Du JSON, pas du code.

```json
{
  "situation": "revenu_saisonnier",
  "titre": "Passer l'hiver",
  "blocs": [
    { "type": "flux_annuel", "params": { "souligner": "mois_deficitaires" } },
    { "type": "jauge",       "params": { "mesure": "mois", "cible": 5 } },
    { "type": "compteur",    "params": { "source": "coussin" } },
    { "type": "fait",        "params": { "texte": "Tes 6 mois d'été génèrent 87 % de ton revenu annuel." } }
  ]
}
```

Règles du contrat :
- `type` doit exister dans le registre (sinon ignoré — jamais d'erreur).
- `params` validés contre les paramètres permis du bloc (valeurs hors borne → défaut sûr).
- Les **montants** ne viennent pas de la recette : ils viennent du snapshot canonique (`source`
  pointe vers une donnée). L'IA décide *quoi montrer*, pas *les chiffres*.
- Le `texte` d'un `fait` passe par le filtre de conformité (mots interdits → bloqué).

---

## La preuve : mêmes blocs, situations différentes

Trois situations de vie, composées à partir du **même** registre. Remarque les blocs qui reviennent.

**Travailleur saisonnier — « passer l'hiver »**
`flux_annuel` · `jauge`(mois) · `compteur`(coussin) · `fait`

**Tu gardes un parent — « ce que ça me coûte »**
`stat`(coût mensuel) · `jauge`(% du revenu) · `echeancier`(paiements récurrents) · `fait`

**Travailleur autonome — « ne pas dépenser l'argent du fisc »**
`compteur`(réservé impôts) · `barre_empilee`(net vs réservé) · `calendrier`(échéances TPS/TVQ) · `fait`

**Congé parental qui s'en vient — « voir la transition »**
`ligne_evolution`(revenu projeté) · `chronologie`(jusqu'au congé) · `jauge`(coussin) · `comparaison`(avant/après RQAP) · `fait`

`jauge`, `compteur`, `fait` reviennent partout. Quatre vues radicalement différentes, un seul registre.
C'est ça, « les blocs ne sont pas les cas ».

---

## Pourquoi s'arrêter à ~21

- **Au-delà, l'IA hésite** : trop de choix = plus d'erreurs de composition.
- **Cohérence** : 21 blocs polis = une identité ; 60 = un patchwork.
- **Qualité** : mieux vaut 21 blocs *wow* que 60 corrects.
- La couverture vient de la **composition**, pas de l'inventaire. Si une « nouvelle situation »
  demande un nouveau bloc, demande-toi d'abord : est-ce un *paramètre* d'un bloc existant ?
  (Ex. « vue mensuelle » = `flux_annuel` avec un param, pas un nouveau bloc.)

**Quand ajouter un 22e bloc :** seulement si une *grammaire visuelle* genuinement nouvelle apparaît
(quelque chose qu'aucun bloc existant ne peut faire, même paramétré). Rare. Additif quand ça arrive.

---

## Ordre de construction (le trésor d'abord)

1. **Bâtir le registre** : les 21 blocs comme composants paramétrables, testés isolément.
   Commencer par le bloc-signature (`flux_annuel`) comme étalon de qualité, puis décliner.
2. **Le schéma de recette** + le validateur (types permis, params bornés, filtre conformité).
3. **Le moteur de rendu** data-driven : recette → registre → vue assemblée.
4. **`build-tool` étendu** : émet une recette en plus de la spec d'entité.
5. **La tuile vivante** : recette + entité sauvegardées, re-rendues à jour, surveillées par la tour.

Tout ça vit dans le nouveau projet React, sur la fondation portée (twin + build-tool + canonical).
