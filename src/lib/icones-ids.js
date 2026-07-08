/* ============================================================================
   icones-ids.js — les IDS d'icônes offertes à la retouche, en DONNÉE PURE.

   Node (les scripts de garde) et la barre-copilote (actions.js) valident un
   changement d'icône contre CETTE liste — sans importer iconesGalerie.jsx (qui
   porte du JSX et ne s'importe pas hors navigateur). iconesGalerie.jsx associe
   chaque id à son glyphe SVG en DÉRIVANT de cette liste : une seule source de
   vérité pour l'ordre et l'appartenance, aucune dérive possible. PUR.
   ========================================================================== */
export const ICONES_IDS = [
  'portefeuille', 'bouclier', 'vagues', 'recu', 'courbe', 'pieces', 'coussin',
  'cible', 'eclair', 'etoile', 'coeur', 'drapeau', 'maison', 'soleil',
]
