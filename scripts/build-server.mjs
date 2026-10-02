import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
await build({ entryPoints: ['server/worker.js'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', minify: true, loader: { '.html': 'text' } });
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
