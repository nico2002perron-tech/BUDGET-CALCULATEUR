/* ============================================================================
   photo.js — lecture d'une photo LOCALE, compressée et BORNÉE (jamais envoyée).
   SVG → tel quel ; raster → downscale canvas 720 px + JPEG à qualité dégressive
   jusqu'à tenir sous ~200 Ko (photoBornee). Extrait du studio pour être
   RÉUTILISÉ (conversation studio, personnalité du carré de sable).
   ========================================================================== */
import { photoBornee, MAX_PHOTO_CARS } from './entites.js'

/** Lit un File image → cb(base64 borné | null). Tout reste sur l'appareil. */
export function lirePhoto(file, cb) {
  if (!file) return cb(null)
  const r = new FileReader()
  if (file.type === 'image/svg+xml') { r.onload = () => cb(photoBornee(String(r.result))); r.readAsDataURL(file); return }
  r.onload = () => {
    const img = new Image()
    img.onload = () => {
      const max = 720
      let w = img.width, h = img.height
      if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k) }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      let q = 0.82, out = c.toDataURL('image/jpeg', q)
      while (out.length > MAX_PHOTO_CARS && q > 0.4) { q -= 0.15; out = c.toDataURL('image/jpeg', q) }
      cb(photoBornee(out))
    }
    img.onerror = () => cb(null)
    img.src = String(r.result)
  }
  r.readAsDataURL(file)
}
