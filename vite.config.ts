import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pwa } from './build/pwa'
import { siteMeta } from './build/siteMeta'

// The service worker is generated after every build by `build/pwa.ts` from the
// template in `src/sw/sw.template.js` (M24); registration is `src/pwa.ts`.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteMeta(), pwa()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
})
