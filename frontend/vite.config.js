import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/cards': 'http://localhost:8000',
      '/images': 'http://localhost:8000',
    },
  },

})
