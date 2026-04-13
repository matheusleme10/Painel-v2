import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — loaded first, cached aggressively
          'vendor-react': ['react', 'react-dom'],
          // Heavy file-processing libs — loaded lazily when user opens Admin
          'vendor-files': ['papaparse', 'xlsx'],
          // Screenshot lib
          'vendor-canvas': ['html2canvas'],
        },
      },
    },
  },
})
