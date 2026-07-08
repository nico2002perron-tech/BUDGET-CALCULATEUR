/* ============================================================================
   serie.js — le contrat GÉNÉRIQUE des blocs-série (prisme3d, bandes, courbe,
   nuage). Historiquement ces blocs lisaient « 12 mois de revenus » ; depuis le
   déblocage des formes (serieDuKPI), ils reçoivent la série de N'IMPORTE
   QUELLE famille (postes du budget, projection par âge, segments du brut…).

   normaliserSerie(data) rend toujours le même paquet sûr :
     { labels, valeurs, titreBase, legende, seuil, seuilTexte, sousTexte }
   • data.labels + data.valeurs → mode générique (N points, N ≤ 12) ;
   • sinon → mode historique : data.serie sur les 12 mois (rempli à 12),
     titreBase null (le bloc garde son titre d'origine, byte-identique).
   Valeurs bornées ≥ 0 (une hauteur/aire ne peut pas montrer un négatif) ;
   le texte factuel du KPI porte la nuance, jamais un chiffre inventé ici.
   PUR — testable hors navigateur.
   ========================================================================== */
import { MOIS_COURTS, formatCAD } from './format.js'

export function normaliserSerie(data) {
  const d = data || {}
  const brute = Array.isArray(d.valeurs) ? d.valeurs : Array.isArray(d.serie) ? d.serie : []
  const generique = Array.isArray(d.labels) && d.labels.length > 0
  const n = generique ? Math.min(12, d.labels.length, brute.length) : 12
  const valeurs = brute.slice(0, n).map((v) => { const x = Number(v); return isFinite(x) && x > 0 ? x : 0 })
  while (valeurs.length < n) valeurs.push(0)
  const labels = generique ? d.labels.slice(0, n).map((t) => String(t)) : [...MOIS_COURTS]
  const seuil = Number(d.seuil) || 0
  return {
    labels,
    valeurs,
    titreBase: generique && typeof d.titreBase === 'string' && d.titreBase ? d.titreBase : null,
    legende: typeof d.legende === 'string' && d.legende ? d.legende : 'Revenus',
    seuil,
    seuilTexte:
      typeof d.seuilTexte === 'string' && d.seuilTexte
        ? d.seuilTexte
        : seuil > 0 ? `coût de vie ${formatCAD(seuil)}/mois` : '',
    sousTexte: typeof d.sousTexte === 'string' && d.sousTexte ? d.sousTexte : 'sous ton coût de vie',
  }
}

/** « sous la cible 3 mois » → « Sous la cible 3 mois » (légendes). */
export function majuscule(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

/** Montant ABRÉGÉ pour un axe (« 2,1 k$ », « 850 $ », « 1,2 M$ ») — l'échelle
 *  se lit d'un coup d'œil sans encombrer la grille. PUR. */
export function abregerMontant(v) {
  const n = Math.round(Number(v) || 0)
  const abs = Math.abs(n)
  const signe = n < 0 ? '−' : ''
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    return `${signe}${(m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toLocaleString('fr-CA')} M$`
  }
  if (abs >= 1000) {
    const k = abs / 1000
    return `${signe}${(k >= 10 ? Math.round(k) : Math.round(k * 10) / 10).toLocaleString('fr-CA')} k$`
  }
  return `${signe}${abs} $`
}

/** Étiquette d'axe bornée à `max` caractères (le libellé complet vit dans le
 *  tooltip) — les postes du budget ne débordent pas sous les barres. La coupe
 *  se fait au MOT quand c'est possible (« 34 ans » → « 34… », pas « 34 a… »). */
export function etiquetteCourte(t, max) {
  const s = String(t)
  if (s.length <= max) return s
  let court = s.slice(0, Math.max(1, max - 1))
  const espace = court.lastIndexOf(' ')
  if (espace > 0) court = court.slice(0, espace)
  return court + '…'
}
