import { defineConfig } from 'vitest/config'

// Deliberately NOT vite.config.ts: that file carries the PWA plugin, whose
// build hooks have no business running under a test server. Tests import
// plain modules from src/, so they need no plugins at all.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
