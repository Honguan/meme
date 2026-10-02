import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'dist/client' },
  server: { proxy: { '/api/match': 'http://127.0.0.1:8787' } },
});
