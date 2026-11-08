import { defineConfig } from 'vitest/config'

// Unit tests run in Node (no browser, no Electron). UI is checked by running the app (see TESTING.md).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts']
  }
})
