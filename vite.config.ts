import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// Dev server only: the calibration recorder (src/game/recorder.ts) posts each run here, and
// it is written to one JSON file per run. RECORDINGS_DIR overrides the folder.
function recordings(): Plugin {
  const dir = resolve(process.env.RECORDINGS_DIR ?? 'recordings')
  return {
    name: 'heaviest-recordings',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__recordings', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body) as { id: unknown }
            if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) {
              throw new Error('bad recording id')
            }
            mkdirSync(dir, { recursive: true })
            writeFileSync(join(dir, `${id}.json`), body)
            res.statusCode = 204
          } catch (e) {
            res.statusCode = 400
            server.config.logger.warn(`recordings: ${String(e)}`)
          }
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), recordings()],
  base: process.env.BASE_URL || '/',
})
