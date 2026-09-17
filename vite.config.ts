import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (mode === 'production') {
    const apiUrl = env.VITE_API_URL?.trim();
    if (!apiUrl) {
      throw new Error(
        'VITE_API_URL es obligatoria para el build de producción. Configurala en Vercel → Environment Variables.',
      );
    }
    if (apiUrl.startsWith('/')) {
      throw new Error(
        'VITE_API_URL de producción debe ser una URL absoluta de la API, no una ruta relativa.',
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY ?? 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
