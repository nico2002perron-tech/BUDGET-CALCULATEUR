/* ============================================================================
   sons.js — les petits sons de l'interface. SYNTHÉTISÉS (WebAudio) : zéro
   fichier, zéro réseau — rien ne quitte l'appareil, rien n'est téléchargé.
   DISCRETS (volumes minuscules) et DÉSACTIVABLES (store.sons, bouton dans
   l'en-tête du board). Le contexte audio ne naît qu'au premier geste de
   l'usager (politique d'autoplay des navigateurs) et tout échec est muet.
   ========================================================================== */

let actif = true
let ctx = null

/** Active/désactive tous les sons (branché sur store.sons). */
export function reglerSons(on) {
  actif = on !== false
}

function contexte() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { ctx = null }
  }
  if (ctx && ctx.state === 'suspended') { try { ctx.resume() } catch { /* muet */ } }
  return ctx
}

function bip(freqDe, freqA, duree, vol, forme = 'sine') {
  if (!actif) return
  const c = contexte()
  if (!c) return
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = forme
    o.frequency.setValueAtTime(freqDe, c.currentTime)
    if (freqA !== freqDe) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqA), c.currentTime + duree)
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duree)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    o.stop(c.currentTime + duree + 0.02)
  } catch { /* décoratif — jamais une erreur pour un son */ }
}

/** Les trois gestes sonores de la tour : tap (pastille), ouvre (le sable
 *  grandit), pose (épingler / ajouter — la tuile se pose). */
export const sons = {
  tap: () => bip(660, 520, 0.06, 0.07, 'triangle'),
  ouvre: () => bip(300, 560, 0.14, 0.055, 'sine'),
  pose: () => { bip(430, 300, 0.12, 0.085, 'sine'); setTimeout(() => bip(570, 570, 0.09, 0.055, 'sine'), 75) },
}
