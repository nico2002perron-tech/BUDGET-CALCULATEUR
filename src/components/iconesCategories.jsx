/* ============================================================================
   iconesCategories.jsx — l'habillage VIVANT mais CALME de la saisie : une icône
   Lucide-like dans une PASTILLE de couleur douce, une couleur CONSTANTE par
   catégorie (repère de scan, pas décoration). Esprit Wealthsimple/Revolut :
   accents doux sur fond clair, jamais d'arc-en-ciel criard.
   Purement cosmétique — aucune donnée, aucun calcul. Catégorie custom → repli
   par classe.
   ========================================================================== */
import { couleurClasse } from '../lib/depenses.js'

// Icônes ligne (24×24, stroke = currentColor) — sobres, bien dessinées, jamais d'emoji.
const I = {
  maison: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  auto: <><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11" /><path d="M4 11h16v6H4z" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></>,
  panier: <><circle cx="9.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /><path d="M3 4h2l2.3 11h10l1.7-7H6.5" /></>,
  bouclier: <><path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.2-7 8.5-4-1.3-7-4.1-7-8.5V6.1l7-2.6z" /><path d="M9 12l2 2 4-4" /></>,
  banque: <><path d="M4 21h16" /><path d="M5 21V10M9 21V10M15 21V10M19 21V10" /><path d="M12 3.5 20 8H4l8-4.5z" /></>,
  resto: <><path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3" /><path d="M17 3c-1.4 0-2.5 2-2.5 5s1.1 4 2.5 4v9" /></>,
  abo: <><rect x="3" y="5" width="18" height="13" rx="2.2" /><path d="M10 9.3l4 2.4-4 2.4z" /><path d="M8 21h8" /></>,
  sac: <><path d="M6.5 8h11l1 12.5h-13L6.5 8z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  avion: <><path d="M21.5 4.5 2.8 11l6.7 2.4L12 20.5l2.7-4 5 3.5 1.8-15.5z" /><path d="m9.5 13.4 5-4" /></>,
  points: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>,
  cochon: <><path d="M16 7c2.9 0 5 2 5 4.5 0 1.1-.4 2-1 2.8V17h-2.3l-.5-1.4c-.5.2-1.1.3-1.7.3H10c-.6 0-1.1-.1-1.6-.3L8 17H5.8v-2.7C5 13.6 4.3 12.6 4.3 11.4 4.3 8.9 6.9 7 10 7h6z" /><circle cx="8.3" cy="11.3" r="1" /><path d="M11 6.6c.7-.6 1.6-.9 2.6-.9" /><path d="M21 11.4h-1.4" /></>,
  etiquette: <><path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 .8z" /><circle cx="7.5" cy="7.5" r="1.4" /></>,
}

// Map catégorie pré-remplie → { couleur d'accent + fond pastel assorti + icône }.
// Palette CALME et distincte (une teinte par catégorie) :
const VISUEL = {
  cat_logement:      { color: '#2d68d8', pale: '#e9effc', icon: I.maison },   // bleu
  cat_transport:     { color: '#cf6a1f', pale: '#fbeede', icon: I.auto },     // orange
  cat_alimentation:  { color: '#1f9268', pale: '#e3f4ee', icon: I.panier },   // vert
  cat_protection:    { color: '#0e8ba0', pale: '#e1f3f6', icon: I.bouclier }, // sarcelle
  cat_dettes_impots: { color: '#5b53c9', pale: '#ece9fb', icon: I.banque },   // indigo
  wcat_sorties:      { color: '#d24d80', pale: '#fae9f1', icon: I.resto },    // rose
  wcat_abonnements:  { color: '#8b46c9', pale: '#f2e9fb', icon: I.abo },      // violet
  wcat_shopping:     { color: '#c2891b', pale: '#f8efd8', icon: I.sac },      // ambre
  wcat_voyages:      { color: '#0fa0c0', pale: '#e0f4fa', icon: I.avion },    // cyan
  wcat_autres:       { color: '#5a6b8c', pale: '#eef1f6', icon: I.points },   // neutre
  fix_epargne:       { color: '#0f8a5f', pale: '#e2f3ea', icon: I.cochon },   // vert
}

/** Convertit un #rrggbb en fond très pâle (repli pour les catégories custom). */
function palir(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mix = (c) => Math.round(c + (255 - c) * 0.9)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

/**
 * Visuel d'une dépense : { color, pale, icon }.
 * @param {string} id     id de la dépense (catégorie pré-remplie ou custom_*)
 * @param {string} classe 'besoin' | 'envie' | 'epargne' (repli)
 */
export function visuelDepense(id, classe) {
  if (VISUEL[id]) return VISUEL[id]
  const color = couleurClasse(classe)
  return { color, pale: palir(color), icon: I.etiquette }
}
