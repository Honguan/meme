import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../.artifacts/world-crawl/', import.meta.url);
await mkdir(root, { recursive: true });
const cached = new Set(await readdir(root));
const api = 'https://api.templates.meme/api/templates';
const refresh = process.argv.includes('--refresh');
async function fetchJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.status === 429) { await delay(Math.max(3000, Number(response.headers.get('retry-after') || 15) * 1000)); continue; }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.json();
    } catch (error) { if (attempt === 4) throw error; await delay(1000 * (attempt + 1)); }
  }
  throw new Error(`Rate limit retry budget exceeded: ${url}`);
}
let index;
if (cached.has('index.json') && !refresh) index = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
else {
  index = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const data = await fetchJson(`${api}?limit=100&page=${page}&sortBy=newest`);
    pages = data.pagination.totalPages; index.push(...data.templates);
    if (page % 10 === 0) console.log(`Index ${page}/${pages}: ${index.length}`);
    await delay(180);
  }
  await writeFile(new URL('index.json', root), JSON.stringify(index));
}
const queue = index.filter(m => m.isSfw !== false && !m.isAudioOnly && m.primaryImageUrl?.startsWith('https://') && (refresh || !cached.has(`${m.id}.json`)));
let done = 0, failed = 0;
console.log(`Published candidates: ${index.length}; cached: ${[...cached].filter(f => f !== 'index.json').length}; pending: ${queue.length}`);
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const item = queue.shift();
    try {
      const detail = await fetchJson(`${api}/${encodeURIComponent(item.slug)}`);
      if (detail.id !== item.id) throw new Error(`Unexpected source ID ${item.slug}`);
      await writeFile(new URL(`${item.id}.json`, root), JSON.stringify(detail));
      done++;
    } catch (error) { failed++; console.error(error.message); }
    if ((done + failed) % 100 === 0) console.log(`Details ${done} saved, ${failed} failed, ${queue.length} remaining`);
    await delay(350);
  }
}));
console.log(`Collection finished: ${done} new details, ${failed} failures. Run again to resume failed entries.`);
if (failed) process.exitCode = 1;
