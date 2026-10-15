import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

// No "npm run dev", roda a mesma funcao /api/email que a Vercel usa em producao.
const exigir = createRequire(import.meta.url);
const apiEmailLocal = {
  name: 'api-email-local',
  configureServer(server) {
    server.middlewares.use('/api/email', async (req, res) => {
      let corpo = '';
      for await (const parte of req) corpo += parte;
      try { req.body = JSON.parse(corpo || '{}'); } catch { req.body = {}; }
      const resposta = {
        status(c) { res.statusCode = c; return resposta; },
        json(o) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); },
      };
      delete exigir.cache[exigir.resolve('../api/email.js')];
      await exigir('../api/email.js')(req, resposta);
    });
  },
};

export default defineConfig({
  plugins: [react(), apiEmailLocal],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          graficos: ['recharts'],
        },
      },
    },
  },
  server: { port: 5174 },
});
