import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: false, // MUST BE HERE TO PREVENT BUILD FAILURES
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 30 },
            { name: 'charts-vendor', test: /node_modules[\\/](recharts|d3-|victory-vendor)[\\/]/, priority: 25 },
            { name: 'pdf-vendor', test: /node_modules[\\/](jspdf|dompurify|fflate)[\\/]/, priority: 25 },
            { name: 'canvas-vendor', test: /node_modules[\\/](html2canvas|canvg|css-line-break|text-segmentation)[\\/]/, priority: 25 },
            { name: 'auth-vendor', test: /node_modules[\\/](better-auth|@better-auth)[\\/]/, priority: 20 },
            { name: 'ui-vendor', test: /node_modules[\\/](sonner)[\\/]/, priority: 15 },
            { name: 'vendor', test: /node_modules[\\/]/, minSize: 60_000, maxSize: 450_000, priority: 5 },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})