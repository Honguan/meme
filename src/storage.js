import { CATALOG, DEFAULT_DECK, validateCustom, templateCards } from './catalog.js';

export const STORAGE_KEY = 'meme-clash-v1';
export function parseProfile(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.custom) || data.custom.length > 1000) throw new Error('不支援的卡組格式');
  const custom = data.custom.map(card => {
    const clean = validateCustom(card);
    if (typeof card.id !== 'string' || !/^custom-[a-zA-Z0-9-]{1,64}$/.test(card.id)) throw new Error('自訂卡牌 ID 無效');
    return { ...clean, id: card.id };
  });
  if (new Set(custom.map(c => c.id)).size !== custom.length) throw new Error('自訂卡牌 ID 重複');
  const web = Array.isArray(data.web) ? data.web.slice(0, 1000).filter(m => m && typeof m.name === 'string') : [];
  const ids = new Set([...CATALOG, ...custom, ...templateCards(web)].map(c => c.id));
  if (!Array.isArray(data.deck) || data.deck.length > 30 || data.deck.some(id => !ids.has(id))) throw new Error('卡組包含無效卡牌或超過 30 張');
  const stats = { wins: 0, losses: 0, games: 0 };
  for (const k of Object.keys(stats)) if (Number.isSafeInteger(data.stats?.[k]) && data.stats[k] >= 0) stats[k] = data.stats[k];
  return { version: 1, custom, web, deck: data.deck, stats };
}
export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { profile: parseProfile(JSON.parse(raw)), error: '' };
  } catch { return { profile: freshProfile(), error: '存檔無法讀取，已載入預設卡組。原始存檔尚未覆寫。' }; }
  return { profile: freshProfile(), error: '' };
}
export function freshProfile() { return { version: 1, custom: [], web: [], deck: [...DEFAULT_DECK], stats: { wins: 0, losses: 0, games: 0 } }; }
export function saveProfile(profile) { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
