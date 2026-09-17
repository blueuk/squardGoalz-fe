import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/kakao': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/login': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/rate': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/user': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/schedule': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/vote': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/team_member': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/common_cd': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/team_info': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/stardium': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/teamArrange': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/memberScore': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/record': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/position_point': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/teamAccount': { target: 'http://8.235.113.192:8000', changeOrigin: true },
      '/payment': { target: 'http://8.235.113.192:8000', changeOrigin: true }
    }
  }
})
