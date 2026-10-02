export const THEMES = {
  citron: { name:'萊姆電光', accent:'#d4f75b', rival:'#fb8aac' },
  coral: { name:'珊瑚熱浪', accent:'#ffac91', rival:'#76dec5' },
  ice: { name:'冰河藍綠', accent:'#7de3ed', rival:'#ffd278' },
};
export function loadTheme() {
  try { const theme=localStorage.getItem('meme-clash-theme');return Object.hasOwn(THEMES,theme)?theme:'citron'; }
  catch { return 'citron'; }
}
export function applyTheme(theme) {
  if (!Object.hasOwn(THEMES,theme)) return false;
  document.documentElement.dataset.theme=theme;
  try { localStorage.setItem('meme-clash-theme',theme);return true; } catch { return false; }
}
