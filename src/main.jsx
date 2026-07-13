import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css' // LA couche de tokens de peau — DOIT venir avant index.css
import './index.css'
import './atelier.css' // le passage tour→atelier + l'anneau — APRÈS index.css
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
