import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor libraries (highest priority)
          if (id.includes('node_modules/three')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          
          // Engine code (loads Three.js deps but separate from screens)
          if (id.includes('/src/engine/')) {
            return 'engine';
          }
          
          // Screens (loaded on-demand)
          if (id.includes('/src/screens/SolarSystemScreen')) {
            return 'screens-solar';
          }
          if (id.includes('/src/screens/SimulationScreen')) {
            return 'screens-simulation';
          }
          if (id.includes('/src/screens/PatternDetailsScreen')) {
            return 'screens-details';
          }
          if (id.includes('/src/screens/CosmicSignatureScreen')) {
            return 'screens-cosmic';
          }
          if (id.includes('/src/screens/')) {
            return 'screens-other';
          }
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
