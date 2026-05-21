import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget =
    env.VITE_BACKEND_URL || env.VITE_API_TARGET || 'http://localhost:3399'
  const proxyTarget = { target: backendTarget, changeOrigin: true }

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Proxy: em dev, chamadas do React vão para o AdonisJS
    server: {
      port: 5173,
      proxy: {
        '/api': proxyTarget,
        '/login': proxyTarget,
        '/logout': proxyTarget,
        '/cadastrar': proxyTarget,
        '/alterar-senha': proxyTarget,
        '/recuperar-senha': proxyTarget,
        '/album': proxyTarget,
        '/shop': proxyTarget,
        '/stickers': proxyTarget,
        '/uploads': proxyTarget,
        '/audios': proxyTarget,
      },
    },

    build: {
      // Gera o bundle em web/dist — o script copy-to-public.mjs copia para ../public
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  }
})
