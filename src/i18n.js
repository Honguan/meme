import { MESSAGES } from './locales.js';

export const LANGUAGES = { 'zh-Hant':'繁體中文', en:'English', ja:'日本語', es:'Español' };
let locale = 'zh-Hant';
try { const saved=localStorage.getItem('meme-clash-language');if(Object.hasOwn(LANGUAGES,saved))locale=saved; } catch {}
export const getLocale = () => locale;
export function setLocale(value) {
  if (!Object.hasOwn(LANGUAGES,value)) return false;
  locale=value;
  try { localStorage.setItem('meme-clash-language',value);return true; } catch { return false; }
}
const substitute = (text, values) => text.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
const fragments = Object.keys(MESSAGES).filter(k=>!k.includes('{')).sort((a,b)=>b.length-a.length);
const matcher = new RegExp(fragments.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');

// Dynamic values are interpolated after translation so player-authored names stay intact.
export function tr(text, values = {}) {
  text=String(text ?? '');
  if(locale==='zh-Hant')return substitute(text,values);
  const trimmed=text.trim(), entry=MESSAGES[trimmed];
  if(entry)return text.replace(trimmed,()=>substitute(entry[locale],values));
  if(trimmed.includes(' → '))return text;
  let m;
  if((m=trimmed.match(/^(友軍|敵軍) · (.+)$/)))return `${tr(m[1])} · ${m[2]}`;
  if((m=trimmed.match(/^第 (\d+) 回合：部署開始$/)))return tr('第 {round} 回合：部署開始',{round:m[1]});
  if((m=trimmed.match(/^(.+) 被擊倒$/)))return tr('{name} 被擊倒',{name:m[1]});
  if((m=trimmed.match(/^(.+) 打出 (.+)$/)))return tr('{player} 打出 {card}',{player:tr(m[1]),card:m[2]});
  if((m=trimmed.match(/^(.+) 設置陷阱$/)))return tr('{player} 設置陷阱',{player:tr(m[1])});
  if((m=trimmed.match(/^(.+) 防線失守，生命 -(\d+)$/)))return tr('{player} 防線失守，生命 -{amount}',{player:tr(m[1]),amount:m[2]});
  if((m=trimmed.match(/^陷阱連鎖：(.*)$/)))return tr('陷阱連鎖：{card}',{card:m[1]});
  if((m=trimmed.match(/^已鑄造「(.*)」$/)))return tr('已鑄造「{card}」',{card:m[1]});
  if((m=trimmed.match(/^移除 (.+)$/)))return tr('移除 {card}',{card:m[1]});
  if((m=trimmed.match(/^(.+)連攜啟動：(.+)$/)))return tr('{tag}連攜啟動：{bonus}',{tag:tr(m[1]),bonus:tr(m[2])});
  if((m=trimmed.match(/^(.+) 3 件套啟動：(.+)$/)))return tr('{set} 3 件套啟動：{bonus}',{set:tr(m[1]),bonus:tr(m[2])});
  if((m=trimmed.match(/^全員 BONK：(.+) 追加 3 傷害$/)))return tr('全員 BONK：{name} 追加 3 傷害',{name:m[1]});
  if((m=trimmed.match(/^(\w+) 需為 (\d+) 至 (\d+) 的整數$/)))return tr('{field} 需為 {min} 至 {max} 的整數',{field:m[1],min:m[2],max:m[3]});
  return substitute(text.replace(matcher,key=>MESSAGES[key][locale]+(locale==='ja'?'':' ')).replace(/ +([，。：；、？！,.:;!?])/g,'$1').replace(/ {2,}/g,' ').trim(),values);
}

const originalContent = '[data-original],script,style,textarea,.card-name,.unit-chip b,.deck-row>span>b,.detail-body>h2,.art-fallback,.hover-preview>b,#modal-preview-stage>b,#interface-language option,#language-filter option:not([value="all"]):not([value="unknown"])';
export function localize(root) {
  document.documentElement.lang=locale;
  document.title=`MEME CLASH · ${tr('迷因亂鬥')}`;
  if(locale==='zh-Hant')return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(!node.parentElement.closest(originalContent)&&/\p{Script=Han}/u.test(node.nodeValue))node.nodeValue=tr(node.nodeValue);
  }
  for(const element of [root,...root.querySelectorAll('[aria-label],[title],[placeholder]')]){
    if(element.closest(originalContent)||element.matches('.meme-card'))continue;
    for(const attr of ['aria-label','title','placeholder'])if(element.hasAttribute(attr))element.setAttribute(attr,tr(element.getAttribute(attr)));
  }
}
