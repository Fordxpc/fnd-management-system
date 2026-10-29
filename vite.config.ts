// @ts-ignore
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: false
  },
  server: {
    proxy: {
      // Forward all /api requests to the local Cloudflare Worker
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})