import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'dist/client', rollupOptions: { output: {
    manualChunks(id) { if (id.endsWith('/src/data/world-memes.json')) return 'world-catalog'; },
  } } },
  server: { proxy: { '/api/match': 'http://127.0.0.1:8787' } },
});
