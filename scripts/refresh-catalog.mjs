import { mkdir, writeFile } from 'node:fs/promises';

const response = await fetch('https://api.imgflip.com/get_memes', { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Imgflip HTTP ${response.status}`);
const data = await response.json();
if (!data.success || !Array.isArray(data.data?.memes) || !data.data.memes.length) throw new Error('Invalid Imgflip catalog');
const memes = data.data.memes.map(({ id, name, url }) => ({ id, name, url }));
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/memes.json', import.meta.url), `${JSON.stringify({ source: 'https://api.imgflip.com/get_memes', fetchedAt: new Date().toISOString(), memes }, null, 2)}\n`);
console.log(`Saved ${memes.length} meme templates.`);
