import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/cards': 'http://localhost:8000',
      '/images': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
    },
  },

  // Mirror the dev proxy for `vite preview` so a built SPA can also reach the
  // backend same-origin when previewing locally.
  preview: {
    proxy: {
      '/cards': 'http://localhost:8000',
      '/images': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
    },
  },

})
