import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(appRoot, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4175',
      '/assets': 'http://127.0.0.1:4175',
      '/fonts': 'http://127.0.0.1:4175',
      '/dist': 'http://127.0.0.1:4175',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'ui-assets',
  },
})
