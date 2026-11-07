import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { main: resolve(__dirname, 'electron/main.ts') } } }
  },
  preload: {
    build: { rollupOptions: { input: { preload: resolve(__dirname, 'electron/preload.ts') } } }
  },
  renderer: {
    root: '.',
    build: { rollupOptions: { input: { index: resolve(__dirname, 'index.html') } } },
    plugins: [react(), tailwindcss()]
  }
})
