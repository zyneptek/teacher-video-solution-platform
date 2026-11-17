import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Geliştirmede /api istekleri sunucuya yönlendirilir (CORS gerekmez).
  server: { proxy: { '/api': 'http://localhost:4000' } },
})
