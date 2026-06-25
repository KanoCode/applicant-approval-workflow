import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Lets the frontend call same-origin /api/* during local dev while
      // the actual API runs on :4000 (started via docker-compose or
      // `npm run dev` in backend/). Avoids needing CORS-aware absolute
      // URLs sprinkled through the frontend code.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
