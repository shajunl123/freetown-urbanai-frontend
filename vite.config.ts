import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set GH_PAGES=true when building for GitHub Pages
const isGithubPages = process.env.GH_PAGES === 'true'

export default defineConfig({
  plugins: [react()],
  base: isGithubPages ? '/freetown-urbanai-frontend/' : '/',
  build: {
    outDir: isGithubPages ? 'docs' : 'dist'
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
