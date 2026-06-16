import { defineConfig } from 'vite'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'

// Збірка у dist/, звідки Neutralino її віддає (documentRoot=/dist/).
// neutralino.js лежить у public/ — Vite віддає його як /neutralino.js
// у dev і копіює у dist/ при збірці (та сама схема, що в робочому mini-buh).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.js'],
  },
})
