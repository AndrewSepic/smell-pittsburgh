import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Also expose MAPBOX_ACCESS_TOKEN from the shell (public pk. token only)
  envPrefix: ['VITE_', 'MAPBOX_ACCESS_TOKEN'],
  base: './'
})
