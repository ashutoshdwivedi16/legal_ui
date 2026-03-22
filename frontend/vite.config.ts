import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/framework/core'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true,
    },
    proxy: {
      // ── All compliance AI endpoints ───────────────────────────────────
      // /us/common/ai/v1/compliance/**  →  http://localhost:9090 (real FastAPI backend)
      '/us/common/ai': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
      // ── All admin endpoints (users, roles, auth, audit-logs, …) ──────
      // /us/common/admin/v1/**  →  http://localhost:8080 (same path)
      '/us/common/admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // ── axios baseURL is /api/v1 so requests arrive as /api/v1/xyz ───
      // Strip /api/v1  →  /us/common/admin/v1/xyz  (no double /v1)
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, '/us/common/admin/v1'),
      },
    },
  },
})
