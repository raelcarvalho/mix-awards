import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget =
    env.VITE_BACKEND_URL ||
    env.VITE_API_TARGET ||
    env.BACKEND_URL ||
    env.API_TARGET ||
    'http://localhost:3400'
  const proxyTarget = { target: backendTarget, changeOrigin: true }
  // Steam/OpenID depends on callback realm host, so we preserve dev host (:5173)
  // for /auth routes instead of rewriting Host to backend target.
  const authProxyTarget = { target: backendTarget, changeOrigin: false }

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
        '/auth': authProxyTarget,
        '/login': proxyTarget,
        '/logout': proxyTarget,
        '/cadastrar': proxyTarget,
        '/alterar-senha': proxyTarget,
        '/recuperar-senha': proxyTarget,
        // trailing slash: só faz proxy das chamadas de API (/album/stickers, /album/ack-novas,
        // /shop/comprar, ...) e NÃO das rotas de página da SPA (/album, /album-stickers, /shop),
        // que precisam cair no index.html do React ao dar F5.
        '/album/': proxyTarget,
        '/shop/': proxyTarget,
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
            motion: ['framer-motion'],
          },
        },
      },
    },
  }
})
