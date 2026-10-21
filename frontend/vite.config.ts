import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bind IPv4 explicitly; the default resolves to ::1 only on this machine.
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Only used in backend mode (npm run dev:backend). Proxying keeps the API on the same
    // origin as the app, so the backend's session cookie needs no CORS set-up.
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
