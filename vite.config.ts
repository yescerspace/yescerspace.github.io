import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * GitHub Actions: `GITHUB_REPOSITORY` is `owner/repo`. Project sites live at
 * `https://<user>.github.io/<repo>/` → base `/<repo>/`.
 * User/org Pages repo `*.github.io` is served at the domain root → base `/`.
 * Local and non-CI builds: `/`.
 * `import.meta.env.BASE_URL` is derived from this; no VITE_BASE or manual env.
 */
function resolveViteBase(): string {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return '/'
  }
  const full = (process.env.GITHUB_REPOSITORY ?? '').trim()
  const parts = full.split('/').filter(Boolean)
  if (parts.length < 2) {
    return '/'
  }
  const repo = parts[1]
  if (!repo) {
    return '/'
  }
  if (repo.endsWith('.github.io')) {
    return '/'
  }
  return `/${repo}/`
}

export default defineConfig({
  base: resolveViteBase(),
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
