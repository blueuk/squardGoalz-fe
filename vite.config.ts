import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/kakao': { target: 'http://localhost:8000', changeOrigin: true },
      '/login': { target: 'http://localhost:8000', changeOrigin: true },
      '/rate': { target: 'http://localhost:8000', changeOrigin: true },
      '/user': { target: 'http://localhost:8000', changeOrigin: true },
      '/schedule': { target: 'http://localhost:8000', changeOrigin: true },
      '/vote': { target: 'http://localhost:8000', changeOrigin: true },
      '/team_member': { target: 'http://localhost:8000', changeOrigin: true },
      '/common_cd': { target: 'http://localhost:8000', changeOrigin: true }
    }
  }
})
