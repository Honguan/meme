import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { classifyMeme } from '../src/semantics.js';

const root = new URL('../.artifacts/world-crawl/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));
const currentIds = new Set(index.map(m => m.id));
const files = (await readdir(root)).filter(f => f !== 'index.json' && f.endsWith('.json')).sort();
const cards = [], seenNames = new Set(), seenImages = new Set(), excluded = { duplicate: 0, unclassified: 0, unavailable: 0 };
for (const file of files) {
  const m = JSON.parse(await readFile(new URL(file, root), 'utf8'));
  if (!currentIds.has(m.id)) { excluded.unavailable++; continue; }
  if (m.status !== 'published' || m.isSfw !== true || !m.primaryImageUrl?.startsWith('https://')) { excluded.unavailable++; continue; }
  const nameKey = m.name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (seenNames.has(nameKey) || seenImages.has(m.primaryImageUrl)) { excluded.duplicate++; continue; }
  const match = classifyMeme(m);
  if (!match) { excluded.unclassified++; continue; }
  seenNames.add(nameKey); seenImages.add(m.primaryImageUrl);
  cards.push({ id: `world-${m.id}`, name: m.name, image: m.primaryImageUrl,
    source: `https://api.templates.meme/api/templates/${encodeURIComponent(m.slug)}`,
    languages: (m.languages || []).map(l => l.code), countries: (m.countries || []).map(c => c.code),
    archetype: match.id, evidence: match.evidence });
}
cards.sort((a, b) => a.name.localeCompare(b.name, 'en'));
const counts = key => Object.fromEntries([...cards.reduce((map, c) => {
  for (const value of Array.isArray(c[key]) ? c[key] : [c[key]]) map.set(value, (map.get(value) || 0) + 1);
  return map;
}, new Map())].sort(([a], [b]) => a.localeCompare(b)));
const snapshot = { source: 'https://api.templates.meme/api/templates', collectedAt: (await stat(new URL('index.json', root))).mtime.toISOString().slice(0,10),
  policy: 'Published SFW image/poster templates; normalized-name and exact-image deduplication; semantic source-label mapping; unclassified records excluded.',
  excluded, coverage: { languages: counts('languages'), countries: counts('countries'), archetypes: counts('archetype') }, cards };
if (cards.length < 3000) throw new Error(`Only ${cards.length} qualified cards; need at least 3000.`);
await writeFile(new URL('../src/data/world-memes.json', import.meta.url), JSON.stringify(snapshot));
console.log(JSON.stringify({ cards: cards.length, excluded, coverage: snapshot.coverage }, null, 2));
