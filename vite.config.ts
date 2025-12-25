import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: env.GH_PAGES === 'true' ? '/ts-minecraft' : '/',
    optimizeDeps: {
      exclude: ['@electric-sql/pglite'],
    },
    plugins: [
      {
        enforce: 'pre',
        name: 'buildIndexHtml',
        async transformIndexHtml(html) {
          const { renderTemplate } = await import('./src/client/ui/template/main.js')
          return html.replace('<!--main-->', renderTemplate())
        },
      },
      tailwindcss(),
    ],
    worker: { format: 'es' },
  }
})
