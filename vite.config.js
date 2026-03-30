import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set base to '/your-repo-name/' when deploying to GitHub Pages
// e.g. base: '/golf-ranking/'
export default defineConfig({
  plugins: [react()],
  base: '/golf-ranking/',
})
