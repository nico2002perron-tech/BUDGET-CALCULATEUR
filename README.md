# Tour de contrôle financière — fondation

Le premier outil de finances personnelles québécois pensé comme une **tour de contrôle** :
une vue **composée pour ta situation** à partir de **blocs** réutilisables, où tes
**montants ne quittent jamais ton appareil**.

> Ce dépôt est la **fondation** : le moteur de recettes data-driven + **un** bloc-signature
> abouti (`flux_annuel`) comme étalon de qualité, plus trois blocs de la colonne de droite
> (`jauge`, `stat`, `fait`). Les 20+ autres blocs se déclinent ensuite, un à un, au même niveau.

Documents de référence (le « nord ») : [`VISION.md`](VISION.md), [`REGISTRE-BLOCS.md`](REGISTRE-BLOCS.md),
maquette validée [`tour-saisonnier-v2.html`](tour-saisonnier-v2.html).

## Principes (non négociables)

- **Privacy-first** — les montants vivent en `localStorage` (`budgetcalc_v1`), jamais envoyés.
  Filet de sécurité : export / import JSON (`src/lib/storage.js`).
- **Data-driven** — une **recette** `{ situation, titre, blocs:[{type, params}] }` dit *quoi*
  montrer ; les **chiffres viennent du snapshot** (`getSnapshot()`), jamais de la recette.
- **Conformité (iA/AMF)** — on décrit des **faits**, jamais de jugement/conseil. Le texte d'un
  `fait` passe par un filtre de mots interdits. Avertissement permanent en pied.

## Architecture

```
src/
  lib/
    twin.js        # fiscalité QC + projection — PORTÉ tel quel (parité 51/51 vérifiée)
    budget.js      # formules budget pures (totaux, répartition 50/30/20, fixe/variable)
    canonical.js   # le CONTRAT du snapshot → getSnapshot()
    storage.js     # silo budgetcalc_v1 + export/import + seed démo
    format.js      # formats fr-CA
  recettes/
    schema.js      # contrat de recette : validateur + bornes + filtre conformité + resolve
    registre.js    # map type → composant de bloc
    MoteurRendu.jsx# recette → registre → assemble (grille principale + colonne droite)
  blocs/
    FluxAnnuel.jsx # bloc-signature (l'etalon) — param vue:'mensuel' le reduit
    Jauge.jsx  Stat.jsx  Fait.jsx
    _gabarit.jsx   # patron pour decliner les autres blocs
  App.jsx          # coquille single-pane : bande heros + recette de demo
api/
  build-tool.js    # « phrase -> outil » (Node natif) — porte tel quel
```

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production
npm run lint     # oxlint
```

## Vérifications (scripts Node, sans navigateur sauf shot)

```bash
node scripts/parity-twin.mjs    # parite fiscale du twin porte (51 verifs, 0 ecart)
node scripts/check-data.mjs     # snapshot canonique + formules budget
node scripts/check-recette.mjs  # garde-fous : type inconnu ignore + fait interdit rejete
node scripts/check-render.mjs   # rendu headless (Vite SSR) des blocs
node scripts/shot.mjs           # captures d'ecran via Edge (necessite playwright-core)
```

## Suite

Décliner les blocs restants du `REGISTRE-BLOCS.md` (un à un, niveau étalon), puis brancher
`build-tool` pour qu'il émette des recettes, et la tuile vivante surveillée par la tour.
