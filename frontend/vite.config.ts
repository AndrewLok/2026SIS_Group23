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
    // The backend's login is a cookie. Proxying /api makes it same-origin with the page, so the
    // browser keeps and sends the cookie with no CORS setup. Only used when VITE_USE_MOCK=false.
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      // The chat socket. The browser's Origin and Host both stay the Vite address, so the
      // backend's same-origin check on the handshake passes.
      '/ws': { target: 'http://127.0.0.1:8080', ws: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
