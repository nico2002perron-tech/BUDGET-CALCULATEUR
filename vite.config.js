import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En production, api/build-tool.js est une fonction serverless ESM (Vercel). En
// dev, Vite ne sert pas /api : ce plugin invoque le handler avec un shim req/res,
// pour que le chat marche en `npm run dev` (mock si pas de ANTHROPIC_API_KEY).
function devApi() {
  const url = new URL('./api/build-tool.js', import.meta.url).href
  let n = 0
  return {
    name: 'dev-api-build-tool',
    configureServer(server) {
      server.middlewares.use('/api/build-tool', (req, res) => {
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          try {
            const mod = await import(`${url}?t=${n++}`) // ?t= force le rechargement à chaud
            req.body = raw ? JSON.parse(raw) : {}
            res.status = (c) => { res.statusCode = c; return res }
            res.json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)) }
            await mod.default(req, res)
          } catch (e) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'dev_api_failed', message: e && e.message }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Rend ANTHROPIC_API_KEY (depuis .env.local) visible au handler dev via
  // process.env, pour brancher la VRAIE IA en local sans la mettre dans le code.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  }
  return { plugins: [react(), devApi()] }
})
