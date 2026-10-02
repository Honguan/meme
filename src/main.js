import { createIcons, Swords, Layers, Hammer, Search, SlidersHorizontal, ArrowUpRight, ArrowRight, ArrowLeft, Plus, Minus, X, Zap, Shield, Heart, Sparkles, Volume2, VolumeX, RotateCcw, Github, Download, Upload, RefreshCw, Trash2, Check, ChevronRight, Target, Flame, Trophy, Palette } from 'lucide';
import { CATALOG, TYPES, TAGS, FIELDS, ACTIONS, TARGETS, TRIGGERS, PRESETS, WORLD_COVERAGE, templateCards, validateCustom, effectText } from './catalog.js';
import { ARCHETYPES } from './semantics.js';
import { createGame, createDailyGame, randomWorldDeck, playCard, playError, units, combos, planAI, finishRound, isUnit } from './game.js';
import { Arena } from './arena.js';
import { mountPreview } from './preview.js';
import { THEMES, loadTheme, applyTheme } from './preferences.js';
import { loadProfile, saveProfile, parseProfile } from './storage.js';
import './style.css';

const icons = { Swords, Layers, Hammer, Search, SlidersHorizontal, ArrowUpRight, ArrowRight, ArrowLeft, Plus, Minus, X, Zap, Shield, Heart, Sparkles, Volume2, VolumeX, RotateCcw, Github, Download, Upload, RefreshCw, Trash2, Check, ChevronRight, Target, Flame, Trophy, Palette };
document.documentElement.dataset.theme=loadTheme();
const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const drawIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.8 } });
const loaded = loadProfile();
let profile = loaded.profile;
let catalog = collect();
let game = createGame({ catalog, deck: validDeck() });
let screen = 'battle', arena, query = '', filter = 'all', origin = 'all', visible = 24, mute = true, audio, counted = false;
let handoff = false, toastTimer, formBase = null;
let previewTimer, hoverCard, stopHoverPreview, stopModalPreview;
const hoverPreview = document.createElement('aside');
hoverPreview.className = 'hover-preview'; hoverPreview.hidden = true; hoverPreview.id = 'card-effect-preview';
hoverPreview.setAttribute('role','tooltip'); document.body.append(hoverPreview);
let sourceLanguage = 'all', sourceCountry = 'all', ability = 'all';
const languageNames = { ara:'العربية', ben:'বাংলা', deu:'Deutsch', eng:'English', fra:'Français', hin:'हिन्दी', jpn:'日本語', kor:'한국어', por:'Português', rus:'Русский', spa:'Español', tam:'தமிழ்', urd:'اردو', vie:'Tiếng Việt', zho:'中文' };
const regionNames = new Intl.DisplayNames(['zh-Hant'], { type: 'region' });
const app = $('#app'), modal = $('#modal');

function collect() { return [...new Map([...CATALOG, ...templateCards(profile.web), ...profile.custom].map(c => [c.id, c])).values()]; }
function validDeck() { return profile.deck.length >= 10 && profile.deck.some(id => catalog.find(c => c.id === id)?.type === 'monster') ? profile.deck : PRESETS.starter.deck; }
function persist() { try { saveProfile(profile); return true; } catch { toast('瀏覽器儲存空間不足，請匯出卡組備份'); return false; } }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200); }
function sound(kind = 'click') {
  if (mute) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    const o = audio.createOscillator(), v = audio.createGain(); o.connect(v); v.connect(audio.destination);
    o.type = 'triangle'; o.frequency.setValueAtTime(kind === 'hit' ? 145 : 440, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, audio.currentTime + .12);
    v.gain.setValueAtTime(.06, audio.currentTime); v.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .14);
    o.start(); o.stop(audio.currentTime + .15);
  } catch { mute = true; }
}
function image(card, extra = '') { return card.image ? `<img src="${esc(card.image)}" alt="${esc(card.name)}" loading="lazy" referrerpolicy="no-referrer" ${extra}>` : `<span class="art-fallback">${esc(card.name.slice(0, 2))}</span>`; }
function cardHTML(card, index = null) {
  const inHand = index !== null, num = profile.deck.filter(id => id === card.id).length;
  return `<button class="meme-card type-${card.type}" style="--tag:${TAGS[card.tag].color}" data-${inHand ? 'hand' : 'card'}="${inHand ? index : esc(card.id)}" aria-label="${esc(card.name)}，${TYPES[card.type]}，${card.cost} 能量">
    <span class="card-top"><b class="cost">${card.cost}</b><span>${TYPES[card.type]}</span><span class="card-rarity">${card.type === 'fusion' ? 'EX' : card.origin === '自訂' ? 'MY' : 'MC'}</span></span>
    <span class="card-art">${image(card)}<span class="tag-pill">${TAGS[card.tag].name}</span></span>
    <span class="card-name">${esc(card.name)}</span>
    <span class="card-ability">${esc(effectText(card))}</span>
    <span class="card-bottom">${isUnit(card) ? `<span>${icon('swords')} ${card.attack}</span><span>${icon('heart')} ${card.hp}</span>` : `<span>${icon(card.type === 'trap' ? 'shield' : 'sparkles')} ${TYPES[card.type]}</span>`}<small>${inHand ? '查看' : num ? `卡組 ×${num}` : TAGS[card.tag].name}</small></span>
  </button>`;
}
function header() {
  return `<header class="topbar"><a href="#battle" class="brand" aria-label="MEME CLASH 首頁"><span class="brand-mark">${icon('swords')}</span><span>MEME<span class="brand-light">CLASH</span><small>迷因亂鬥</small></span></a>
    <nav aria-label="主要導覽">${[['battle','swords','對決'],['collection','layers','卡牌圖鑑'],['workshop','hammer','卡組工坊']].map(([id, glyph, text]) => `<button class="nav-item ${screen === id ? 'active' : ''}" data-nav="${id}" ${game.phase === 'battle' ? 'disabled' : ''} ${screen === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${text}</span></button>`).join('')}</nav>
    <div class="header-end"><span class="edition">OPEN PLAY <b>01</b></span><button class="icon-button" data-action="appearance" title="色系設定" aria-label="色系設定" ${game.phase==='battle'?'disabled':''}>${icon('palette')}</button><a class="icon-button" href="https://github.com/Honguan/meme" target="_blank" rel="noopener noreferrer" title="GitHub 開源程式碼" aria-label="GitHub 開源程式碼">${icon('github')}</a><button class="icon-button" data-action="sound" aria-label="${mute ? '開啟音效' : '關閉音效'}" title="${mute ? '開啟音效' : '關閉音效'}" aria-pressed="${!mute}">${icon(mute ? 'volume-x' : 'volume-2')}</button></div>
  </header>`;
}
function playerHUD(side) {
  const p = game.players[side];
  return `<div class="player-hud side-${side}"><span class="player-number">0${side + 1}</span><div class="player-info"><span class="eyebrow">${side && game.mode === 'ai' ? 'CPU / OPPONENT' : 'DUELIST'}</span><b>${p.name}</b><div class="life-track"><span style="width:${p.hp / 20 * 100}%"></span></div></div><div class="life"><b>${p.hp}</b><small>LP</small></div></div>`;
}
function logHTML() { return game.log.slice(0, 6).map(l => `<li class="log-${l.kind}"><small>${String(l.round).padStart(2,'0')}</small><span>${esc(l.text)}</span></li>`).join(''); }
function setProgressHTML() {
  return Object.entries(TAGS).map(([tag, data]) => {
    const count = units(game, game.active).filter(u => u.tag === tag).length;
    return `<span class="synergy ${count >= 2 ? 'on' : ''}" style="--tag:${data.color}" title="${data.set}｜2 件：${data.bonus}｜3 件追加：${data.fullBonus}"><i></i>${data.name}<small>${count}/3</small></span>`;
  }).join('');
}
function setRulesHTML(tag) {
  const data = TAGS[tag];
  return `<div class="set-rule"><b>${data.set} · ${data.name}</b><p>2 件：${data.bonus}</p><p>3 件追加：${data.fullBonus}</p></div>`;
}
function battleHTML() {
  const p = game.players[game.active], field = FIELDS.find(f => f.id === game.field), tags = combos(game, game.active);
  return `<main class="battle-page"><div class="page-heading"><div><span class="eyebrow accent">THE MEMEVERSE</span><h1>讓迷因，正面對決<span class="period">.</span></h1></div><button class="quiet-button" data-action="new" ${game.phase === 'battle' ? 'disabled' : ''}>${icon('rotate-ccw')} 新對決</button></div>
    <div class="battle-layout"><section class="battle-main" aria-label="對戰區"><div class="battle-topline"><span class="live-dot"></span><b>${game.challenge ? `每日挑戰 ${game.challenge}` : game.mode === 'ai' ? '人機對決' : '同機雙人'}</b><span class="mode-label">${{classic:'生命決勝',knockout:'五次擊倒',sandbox:'自由沙盒'}[game.goal]}</span><span class="round-label">ROUND <b id="round-number">${String(game.round).padStart(2,'0')}</b></span></div>
    <div class="scoreboard" id="scoreboard">${playerHUD(0)}<div class="versus">VS</div>${playerHUD(1)}</div>
    <div class="arena-wrap field-${field.id}"><canvas id="arena" aria-label="迷因角色 2D 物理碰撞戰場" role="img"></canvas><div class="arena-stage"><span class="stage-index">ARENA ${String(FIELDS.indexOf(field) + 1).padStart(2,'0')}</span><span>${esc(field.name)}</span></div><span class="phase-chip" id="phase-chip">${game.phase === 'battle' ? '碰撞對決中' : game.phase === 'over' ? '對決結束' : '部署階段'}</span></div>
    <div class="field-bar"><span>${icon('layers')}<b>${esc(field.name)}</b><small>${esc(field.description)}</small></span><button class="text-button" data-action="fields" ${game.phase === 'battle' ? 'disabled' : ''}>更換場地 ${icon('arrow-up-right')}</button></div>
    <div class="unit-strip">${[0,1].map(side => `<div class="unit-team side-${side}">${[0,1,2].map(i => { const u = units(game, side)[i]; return u ? `<span class="unit-chip">${image(u)}<b>${esc(u.name)}</b><small>${u.hp} HP</small></span>` : `<span class="unit-empty">${icon('plus')} 角色席位</span>`; }).join('')}</div>`).join('')}</div>
    </section><aside class="battle-aside"><div class="aside-title"><h2>戰局</h2><span class="mono">LIVE FEED</span></div>
      <div class="energy-box"><span>${icon('zap')} 可用能量</span><strong>${game.goal === 'sandbox' ? '∞' : p.energy}<small>${game.goal === 'sandbox' ? 'FREE' : `/ ${Math.min(8, 2 + game.round)}`}</small></strong><div class="energy-pips">${Array.from({length:8},(_,i)=>`<i class="${i < p.energy || game.goal === 'sandbox' ? 'filled' : ''}"></i>`).join('')}</div></div>
      <div class="synergy-section"><h3>${icon('sparkles')} 連攜套裝 <span id="set-count">${tags.length}</span></h3><div class="synergies" id="set-progress">${setProgressHTML()}</div><details class="set-guide"><summary>套裝效果 · 2 / 3 件</summary><p>同一方存活的同陣營角色各計 1 件；重複卡也計入。3 件效果與 2 件效果疊加，離場即失去門檻加成；已獲得的資源保留。</p>${Object.keys(TAGS).map(setRulesHTML).join('')}</details></div>
      <div class="trap-section"><h3>${icon('shield')} 陷阱區</h3><div class="trap-slots">${[0,1].map(i => `<span class="${p.traps[i] ? 'armed' : ''}">${icon(p.traps[i] ? 'shield' : 'plus')}${p.traps[i] ? '已設置' : '空席'}</span>`).join('')}</div></div>
      <div class="log-section"><h3>對決紀錄<span id="collision-count">${game.collisions} 次碰撞</span></h3><ol id="battle-log" aria-live="polite" aria-relevant="additions">${logHTML()}</ol></div>
    </aside></div>
    <section class="hand-section" aria-label="手牌"><div class="hand-heading"><div><h2>${game.mode === 'local' ? `${p.name} 的` : '你的'}手牌 <span>${handoff ? '?' : p.hand.length}</span></h2><small>DECK ${p.deck.length} <span>/</span> DISCARD ${p.discard.length}</small></div><div class="turn-action"><span>${game.phase === 'battle' ? '迷因正在碰撞' : game.phase === 'over' ? 'GG. 再來一局？' : '你的回合'}</span><button class="primary-button clash-button" data-action="clash" ${game.phase !== 'plan' || handoff ? 'disabled' : ''}>${icon('swords')} ${game.mode === 'local' && game.active === 0 ? '完成部署' : '開始碰撞'} ${icon('arrow-right')}</button></div></div>
    <div class="hand-cards">${handoff ? '<div class="empty-state">等待玩家 02 接手</div>' : p.hand.map((id,i)=>cardHTML(game.cards[id],i)).join('') || '<div class="empty-state">手牌已用盡，下回合繼續抽牌。</div>'}</div></section>
    <footer class="battle-footer"><span>MEME CLASH <b>自由開打。認真亂鬥。</b></span><span>${catalog.length} CARDS <i>/</i> ${FIELDS.length} ARENAS <i>/</i> ${profile.stats.wins} WINS</span></footer></main>`;
}
function collectionHTML() {
  const filtered = catalog.filter(c => (filter === 'all' || c.type === filter) && (origin === 'all' || c.origin === origin) && (sourceLanguage === 'all' || (sourceLanguage === 'unknown' ? !c.languages?.length : c.languages?.includes(sourceLanguage))) && (sourceCountry === 'all' || c.countries?.includes(sourceCountry)) && (ability === 'all' || c.archetype === ability) && `${c.name} ${TAGS[c.tag].name} ${TAGS[c.tag].set} ${c.flavor} ${ARCHETYPES[c.archetype]?.name || ''} ${effectText(c)}`.toLowerCase().includes(query.toLowerCase()));
  return `<main class="collection-page"><div class="page-heading"><div><span class="eyebrow accent">THE COLLECTION</span><h1>整個網路，都是你的牌庫<span class="period">.</span></h1></div><button class="quiet-button" data-action="refresh">${icon('refresh-cw')} 更新網路卡庫</button></div>
    <div class="collection-toolbar"><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="搜尋迷因、陣營或效果" aria-label="搜尋卡牌" value="${esc(query)}"></label><div class="filter-tabs" role="group" aria-label="卡牌類型">${[['all','全部'],...Object.entries(TYPES)].map(([id,label])=>`<button data-filter="${id}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><select id="origin-filter" aria-label="卡牌來源">${['all','精選','網路','全球','自訂'].map(o=>`<option value="${o}" ${origin===o?'selected':''}>${o==='all'?'所有來源':o}</option>`).join('')}</select></div>
    <div class="world-filters"><span>${WORLD_COVERAGE.count.toLocaleString()} 全球模板 · ${Object.keys(WORLD_COVERAGE.languages).length} 種來源語言 · ${Object.keys(WORLD_COVERAGE.countries).length} 個來源地區</span><label>來源語言<select id="language-filter"><option value="all">所有語言</option>${Object.keys(WORLD_COVERAGE.languages).map(code=>`<option value="${code}" ${sourceLanguage===code?'selected':''}>${languageNames[code] || code}</option>`).join('')}<option value="unknown" ${sourceLanguage==='unknown'?'selected':''}>未標註</option></select></label><label>來源地區<select id="country-filter"><option value="all">所有地區</option>${Object.keys(WORLD_COVERAGE.countries).map(code=>`<option value="${code}" ${sourceCountry===code?'selected':''}>${regionNames.of(code)}</option>`).join('')}</select></label><label>梗意能力<select id="ability-filter"><option value="all">所有能力</option>${Object.entries(ARCHETYPES).map(([id,a])=>`<option value="${id}" ${ability===id?'selected':''}>${a.name}</option>`).join('')}</select></label></div>
    <div class="collection-layout"><section><div class="results-heading"><span>${filtered.length} 張卡牌</span><span>ALL UNLOCKED</span></div><div class="catalog-grid">${filtered.slice(0,visible).map(c=>cardHTML(c)).join('') || '<div class="empty-state">沒有符合條件的卡牌。</div>'}</div>${filtered.length>visible?`<button class="quiet-button load-more" data-action="more">載入更多 ${icon('plus')}</button>`:''}</section>${deckSidebar()}</div></main>`;
}
function deckSidebar() {
  const count = new Map(); profile.deck.forEach(id=>count.set(id,(count.get(id)||0)+1));
  return `<aside class="deck-sidebar"><div class="aside-title"><h2>我的卡組</h2><b class="deck-count ${profile.deck.length<10?'warning':''}">${profile.deck.length}<small>/30</small></b></div><div class="deck-list">${[...count].map(([id,n])=>{const c=catalog.find(c=>c.id===id);return c?`<div class="deck-row">${image(c)}<span><b>${esc(c.name)}</b><small>${TYPES[c.type]} · ${c.cost} 能量</small></span><b>×${n}</b><button class="icon-button small" data-remove="${esc(id)}" title="移除一張" aria-label="移除 ${esc(c.name)}">${icon('minus')}</button></div>`:'';}).join('')||'<p class="empty-state">尚未加入卡牌</p>'}</div><button class="primary-button" data-action="new">${icon('swords')} 使用卡組對決</button><div class="deck-tools"><button class="quiet-button" data-action="export">${icon('download')} 匯出</button><button class="quiet-button" data-action="import">${icon('upload')} 匯入</button></div></aside>`;
}
function effectRow(value = { trigger: 'play', action: 'shield', target: 'self', amount: 3 }) {
  return `<div class="effect-row"><label>時機<select name="trigger">${Object.entries(TRIGGERS).map(([key,name])=>`<option value="${key}" ${key===value.trigger?'selected':''}>${name}</option>`).join('')}</select></label><label>效果<select name="action">${Object.entries(ACTIONS).map(([key,name])=>`<option value="${key}" ${key===value.action?'selected':''}>${name}</option>`).join('')}</select></label><label>對象<select name="target">${Object.entries(TARGETS).map(([key,name])=>`<option value="${key}" ${key===value.target?'selected':''}>${name}</option>`).join('')}</select></label><label>數值<input name="amount" type="number" min="1" max="99" value="${value.amount}" required></label><button class="icon-button" type="button" data-action="remove-effect" aria-label="移除此效果" title="移除此效果">${icon('x')}</button></div>`;
}
function workshopHTML() {
  const c = formBase || { name:'', type:'monster', tag:'chaos', cost:2, attack:4, hp:12, speed:5, image:'', flavor:'', effects:[{ trigger:'play', action:'shield',target:'self',amount:3 }] };
  return `<main class="workshop-page"><div class="page-heading"><div><span class="eyebrow accent">MAKE YOUR OWN RULES</span><h1>你的梗，你來定義<span class="period">.</span></h1></div><span class="small-count">${profile.custom.length} 張自訂卡牌</span></div>
    <div class="workshop-layout"><section class="workshop-main"><div class="preset-band"><h2>卡組流派</h2><div class="preset-options">${Object.entries(PRESETS).map(([id,p],i)=>`<button data-preset="${id}" class="preset"><span class="preset-icon preset-${i}">${icon(i===0?'swords':i===1?'flame':'heart')}</span><span><b>${p.name}</b><small>${p.deck.length} 張卡牌</small></span>${icon('arrow-up-right')}</button>`).join('')}</div></div>
    <div class="extra-play"><button class="quiet-button" data-action="random-deck">${icon('refresh-cw')} 全球隨機套裝</button><button class="quiet-button" data-action="daily">${icon('trophy')} 每日挑戰</button></div>
    <form id="card-form"><div class="form-heading"><h2>創作卡牌</h2><span>NEW CARD / ${String(profile.custom.length+1).padStart(3,'0')}</span></div>
    <div class="form-grid"><label class="wide">卡牌名稱<input name="name" maxlength="72" value="${esc(c.name)}" placeholder="給你的傳說一個名字" required></label><label>類型<select name="type">${Object.entries(TYPES).map(([id,n])=>`<option value="${id}" ${c.type===id?'selected':''}>${n}</option>`).join('')}</select></label><label>陣營<select name="tag">${Object.entries(TAGS).map(([id,t])=>`<option value="${id}" ${c.tag===id?'selected':''}>${t.name}</option>`).join('')}</select></label><label>能量消耗<input name="cost" type="number" min="0" max="9" value="${c.cost}" required></label><label>碰撞速度<input name="speed" type="number" min="1" max="12" value="${c.speed}" required></label><label>攻擊力<input name="attack" type="number" min="0" max="99" value="${c.attack}" required></label><label>生命值<input name="hp" type="number" min="1" max="999" value="${Math.max(1,c.hp)}" required></label><label class="wide">圖片網址<input name="image" type="url" maxlength="2048" value="${esc(c.image)}" placeholder="https://…"></label><label class="wide">卡牌宣言<input name="flavor" maxlength="160" value="${esc(c.flavor)}" placeholder="這個梗的靈魂台詞"></label><label class="wide field-rule" ${c.type!=='field'?'hidden':''}>場地規則<select name="field">${FIELDS.map(f=>`<option value="${f.id}" ${c.field===f.id?'selected':''}>${f.name}：${f.description}</option>`).join('')}</select></label></div>
    <div class="form-heading effects-heading"><h3>效果連鎖</h3><button class="text-button" type="button" data-action="add-effect">${icon('plus')} 新增效果</button></div><div id="effect-rows">${c.effects.map(effectRow).join('')}</div><p class="form-error" id="form-error" role="alert"></p><button class="primary-button" type="submit">${icon('sparkles')} 鑄造卡牌</button></form>
    </section>${deckSidebar()}</div></main>`;
}
function render() {
  hideHoverPreview();
  arena?.destroy(); arena = null;
  app.innerHTML = `${header()}${screen==='battle'?battleHTML():screen==='collection'?collectionHTML():workshopHTML()}`;
  drawIcons();
  if (screen === 'battle') arena = new Arena($('#arena'), game, battleDone, () => { sound('hit'); updateBattleHUD(); });
  if (screen === 'workshop') syncTriggers();
}
function updateBattleHUD() {
  $('#scoreboard').innerHTML = playerHUD(0) + '<div class="versus">VS</div>' + playerHUD(1);
  $('#battle-log').innerHTML = logHTML(); $('#collision-count').textContent = `${game.collisions} 次碰撞`;
  $('#set-progress').innerHTML = setProgressHTML();
  $('#set-count').textContent = combos(game, game.active).length;
}
function openDialog(html, className = '') {
  hideHoverPreview();stopModalPreview?.();stopModalPreview=null;
  if (modal.open) modal.close();
  modal.className = className;
  modal.innerHTML = `<button class="icon-button close-dialog" data-action="close" aria-label="關閉" title="關閉">${icon('x')}</button>${html}`;
  modal.showModal(); drawIcons();
}
function appearanceDialog() {
  openDialog(`<div class="dialog-heading"><h2>色系設定</h2></div><fieldset class="theme-picker"><legend>配色</legend>${Object.entries(THEMES).map(([id,theme])=>`<label><input type="radio" name="theme" value="${id}" ${document.documentElement.dataset.theme===id?'checked':''}><span class="theme-swatch" style="--swatch:${theme.accent};--rival:${theme.rival}"></span><b>${theme.name}</b></label>`).join('')}</fieldset>`,'small-modal');
}
function showCard(id, handIndex = null) {
  const c = handIndex === null ? catalog.find(c=>c.id===id) : game.cards[game.players[game.active].hand[handIndex]];
  if (!c) return;
  const error = handIndex !== null ? playError(game, game.active, handIndex) : '';
  openDialog(`<div class="card-detail"><div class="detail-art" style="--tag:${TAGS[c.tag].color}">${image(c)}</div><div class="detail-body"><span class="eyebrow" style="color:${TAGS[c.tag].color}">${TYPES[c.type]} / ${TAGS[c.tag].name}</span><h2>${esc(c.name)}</h2><p class="flavor">${esc(c.flavor)}</p><div class="detail-stats"><span>${icon('zap')} ${c.cost} 能量</span>${isUnit(c)?`<span>${icon('swords')} ${c.attack}</span><span>${icon('heart')} ${c.hp}</span>`:''}</div><div class="effect-detail">${c.type==='fusion'?'<p>消耗兩名同陣營角色；繼承素材陣營及一半總攻擊。</p>':''}<p>${esc(effectText(c))}</p></div>
    <section class="modal-preview"><button class="quiet-button" data-preview="${esc(c.id)}">${icon('sparkles')} 播放效果演示</button><div id="modal-preview-stage" hidden></div></section>
    ${isUnit(c)?`<section class="set-detail" aria-label="連攜套裝">${setRulesHTML(c.tag)}<p>${c.type==='fusion'?'融合後改用素材陣營的套裝；兩份素材合為 1 件。':'同一方存活的同陣營角色各計 1 件；3 件效果與 2 件效果疊加。'}</p></section>`:''}
    ${handIndex!==null?`<label class="target-select">優先目標<select id="play-target"><option value="">自動選擇</option>${game.units.filter(u=>u.hp>0).map(u=>`<option value="${u.uid}">${u.side===game.active?'友軍':'敵軍'} · ${esc(u.name)} (${u.hp} HP)</option>`).join('')}</select></label><p class="form-error">${esc(error)}</p><button class="primary-button" data-play="${handIndex}" ${error?'disabled':''}>${icon(c.type==='monster'?'swords':'sparkles')} ${c.type==='monster'?'召喚角色':c.type==='trap'?'設置陷阱':c.type==='fusion'?'融合召喚':'發動卡牌'}</button>`:
    `<button class="primary-button" data-add="${esc(c.id)}">${icon('plus')} 加入卡組</button><button class="quiet-button" data-template="${esc(c.id)}">${icon('hammer')} 以此為範本</button>${c.origin==='自訂'?`<button class="text-button danger" data-delete="${esc(c.id)}">${icon('trash-2')} 刪除自訂卡</button>`:''}`}
    ${c.evidence?`<section class="meaning-detail"><b>梗意設計 · ${esc(ARCHETYPES[c.archetype]?.name || '待設定')}</b>${c.sourceName&&c.sourceName!==c.name?`<p>原始名稱：${esc(c.sourceName)}</p>`:''}<p>依據${c.evidence.field==='name'?'名稱':'來源標籤'}：${esc(c.evidence.value)}</p><p>${esc(c.flavor)}</p>${c.languages?.length?`<p>來源語言：${c.languages.map(code=>esc(languageNames[code] || code)).join(' · ')}</p>`:''}</section>`:''}
    ${c.source?`<a class="source-link" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">來源：${c.origin==='全球'?'templates.meme':'Imgflip'} ${icon('arrow-up-right')}</a>`:'<span class="source-link">玩家自訂作品</span>'}</div></div>`, 'card-modal');
}
function newDialog(showFields = false) {
  openDialog(`<div class="dialog-heading"><span class="eyebrow accent">NEXT MATCH</span><h2>${showFields?'選擇你的戰場':'建立新對決'}</h2></div><form id="match-form"><div class="match-options"><label>對手<select name="mode"><option value="ai" ${game.mode==='ai'?'selected':''}>網路混沌 AI</option><option value="local" ${game.mode==='local'?'selected':''}>同機雙人</option></select></label><label>勝利目標<select name="goal">${[['classic','生命決勝 · 20 LP'],['knockout','率先擊倒 5 名角色'],['sandbox','自由沙盒 · 無限能量']].map(([v,t])=>`<option value="${v}" ${game.goal===v?'selected':''}>${t}</option>`).join('')}</select></label></div><fieldset class="field-picker"><legend>場地</legend>${FIELDS.map((f,i)=>`<label class="field-option" style="--field:${f.color}"><input type="radio" name="field" value="${f.id}" ${game.field===f.id?'checked':''}><span class="field-art field-art-${f.id}"><span>0${i+1}</span>${icon(f.id==='fine'?'flame':f.id==='moon'?'sparkles':f.id==='xp'?'heart':'layers')}</span><b>${f.name}</b><small>${f.description}</small></label>`).join('')}</fieldset><p id="match-error" class="form-error" role="alert"></p><button class="primary-button" type="submit">${icon('swords')} 開始新對決 ${icon('arrow-right')}</button></form>`, 'match-modal');
}
function startClash() {
  if (game.phase !== 'plan') return;
  game.players[game.active].ready = true;
  if (game.mode === 'local' && game.active === 0) {
    game.active = 1; handoff = true; render();
      openDialog(`<div class="handoff-dialog"><span class="eyebrow accent">PLAYER 02</span><h2>換你出牌了</h2><button class="primary-button" data-action="handoff">${icon('check')} 我準備好了</button></div>`, 'small-modal');
      $('.close-dialog',modal).hidden=true; return;
  }
  if (game.mode === 'ai') planAI(game);
  if (game.phase === 'over') { battleDone(false); return; }
  game.phase = 'battle'; render(); sound(); arena.start();
}
function battleDone(advance = true) {
  if (advance) finishRound(game);
  if (game.phase === 'over' && !counted) {
    counted = true; profile.stats.games++;
    if (game.mode === 'ai') { if (game.winner === 0) profile.stats.wins++; else if (game.winner === 1) profile.stats.losses++; }
    persist();
  }
  render();
  if (game.phase === 'over') openDialog(`<div class="result-dialog">${icon('trophy')}<span class="eyebrow accent">MATCH COMPLETE</span><h2>${game.winner==='draw'?'勢均力敵':game.winner===0?'這局，你贏了！':game.mode==='local'?'玩家 02 獲勝':'這次，網路贏了'}</h2><p>${game.round} 回合 · ${game.collisions} 次碰撞</p><button class="primary-button" data-action="new">再來一局 ${icon('arrow-right')}</button></div>`, 'small-modal');
}
function addToDeck(id) {
  if (profile.deck.length>=30) return toast('卡組已滿：最多 30 張');
  if (profile.deck.filter(x=>x===id).length>=2) return toast('同一張卡最多放入 2 張');
  profile.deck.push(id); persist(); modal.close(); render(); toast('已加入卡組，下場對決生效');
}
function syncTriggers() {
  const form = $('#card-form'); if (!form) return;
  const type = form.elements.type.value, isMonster = ['monster','fusion'].includes(type);
  $('.field-rule', form).hidden = type !== 'field';
  for (const select of form.querySelectorAll('[name="trigger"]')) {
    for (const opt of select.options) opt.disabled = !isMonster && opt.value !== (type==='trap'?'hit':'play');
    if (!isMonster) select.value = type==='trap'?'hit':'play';
  }
}
async function refreshCatalog(button) {
  button.disabled = true;
  try {
    const response = await fetch('https://api.imgflip.com/get_memes', { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('網路卡庫暫時無法連線');
    const data = await response.json();
    if (!data.success || !Array.isArray(data.data?.memes)) throw new Error('卡庫資料格式無效');
    const accepted = data.data.memes.filter(m=>templateCards([m]).length).map(({id,name,url})=>({id,name,url}));
    const before = catalog.length;
    profile.web = [...new Map([...profile.web,...accepted].map(m=>[m.id,m])).values()].slice(-1000);
    catalog = collect(); persist(); render(); toast(`已更新 ${accepted.length} 個模板，新增 ${catalog.length-before} 張卡牌`);
  } catch(e) { toast(`${e.message}，保留既有卡庫`); } finally { button.disabled = false; }
}
function exportProfile() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'meme-clash-deck.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function importProfile() {
  const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('匯入檔案不得超過 2 MB');
      const incoming = parseProfile(JSON.parse(await file.text()));
      openDialog(`<div class="dialog-heading"><h2>匯入卡組</h2><p>${incoming.deck.length} 張卡組卡牌、${incoming.custom.length} 張自訂卡牌。匯入後取代目前卡組與自訂卡庫。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-import">${icon('upload')} 確認匯入</button></div>`, 'small-modal');
      $('#confirm-import').onclick = () => { profile = { ...incoming, stats: profile.stats }; catalog = collect(); persist(); modal.close(); render(); toast('卡組已匯入'); };
    } catch(e) { toast(`匯入失敗：${e.message}`); }
  }; input.click();
}
function previewHTML(card) {
  return `<b>${esc(card.name)}</b><canvas aria-label="卡牌效果演示" role="img"></canvas><p data-preview-status aria-live="polite"></p><p>${esc(effectText(card))}</p>`;
}
function hideHoverPreview() {
  clearTimeout(previewTimer);stopHoverPreview?.();stopHoverPreview=null;
  hoverCard?.removeAttribute('aria-describedby');hoverCard=null;hoverPreview.hidden=true;hoverPreview.replaceChildren();
}
function queueHoverPreview(button) {
  if (!button || modal.open || game.phase==='battle' || button===hoverCard) return;
  hideHoverPreview();hoverCard=button;
  previewTimer=setTimeout(()=>{
    if (!button.isConnected || modal.open) return;
    const id=button.dataset.card || game.players[game.active].hand[Number(button.dataset.hand)];
    const card=catalog.find(c=>c.id===id);if(!card)return;
    hoverPreview.innerHTML=previewHTML(card);hoverPreview.hidden=false;
    const rect=button.getBoundingClientRect(),width=hoverPreview.offsetWidth,height=hoverPreview.offsetHeight;
    hoverPreview.style.left=`${Math.max(12,Math.min(innerWidth-width-12,rect.left))}px`;
    hoverPreview.style.top=`${Math.max(12,Math.min(innerHeight-height-12,rect.top>=height+16?rect.top-height-12:rect.bottom+12))}px`;
    button.setAttribute('aria-describedby',hoverPreview.id);stopHoverPreview=mountPreview(hoverPreview,card);
  },350);
}
document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')queueHoverPreview(e.target.closest('.meme-card'));});
document.addEventListener('pointerout',e=>{if(hoverCard&&hoverCard.contains(e.target)&&!hoverCard.contains(e.relatedTarget))hideHoverPreview();});
document.addEventListener('focusin',e=>queueHoverPreview(e.target.closest('.meme-card')));
document.addEventListener('focusout',e=>{if(hoverCard?.contains(e.target))hideHoverPreview();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideHoverPreview();});
window.addEventListener('scroll',()=>{
  const target=hoverCard;hideHoverPreview();
  if(target?.isConnected&&target.matches(':hover,:focus'))queueHoverPreview(target);
},true);
window.addEventListener('resize',hideHoverPreview);
modal.addEventListener('close',()=>{stopModalPreview?.();stopModalPreview=null;$('#modal-preview-stage')?.replaceChildren();});

document.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.preview) {
    stopModalPreview?.();const card=catalog.find(c=>c.id===button.dataset.preview);
    const stage=$('#modal-preview-stage');stage.hidden=false;stage.innerHTML=previewHTML(card);
    stopModalPreview=mountPreview(stage,card);return;
  }
  if (button.dataset.nav) { screen=button.dataset.nav; render(); return; }
  if (button.dataset.hand!==undefined) return showCard(null,Number(button.dataset.hand));
  if (button.dataset.card) return showCard(button.dataset.card);
  if (button.dataset.play!==undefined) {
    const result = playCard(game,game.active,Number(button.dataset.play),$('#play-target')?.value);
    if (!result.ok) return toast(result.error);
    modal.close(); sound(); if(game.phase==='over') battleDone(false); else render(); return;
  }
  if (button.dataset.add) return addToDeck(button.dataset.add);
  if (button.dataset.remove) { const at=profile.deck.indexOf(button.dataset.remove); if(at>=0) profile.deck.splice(at,1); persist(); render(); return; }
  if (button.dataset.filter) { filter=button.dataset.filter; visible=24; render(); return; }
  if (button.dataset.template) { formBase=structuredClone(catalog.find(c=>c.id===button.dataset.template)); modal.close(); screen='workshop'; render(); return; }
  if (button.dataset.preset) { profile.deck=[...PRESETS[button.dataset.preset].deck]; persist(); render(); toast('已套用預設卡組'); return; }
  if (button.dataset.delete) {
    const id=button.dataset.delete;
    openDialog(`<div class="dialog-heading"><h2>刪除這張自訂卡？</h2><p>也會從卡組移除這張卡。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-delete">${icon('trash-2')} 刪除</button></div>`,'small-modal');
    $('#confirm-delete').onclick=()=>{profile.custom=profile.custom.filter(c=>c.id!==id);profile.deck=profile.deck.filter(x=>x!==id);catalog=collect();persist();modal.close();render();};return;
  }
  switch(button.dataset.action) {
    case 'appearance': appearanceDialog();break;
    case 'random-deck': {
      const next=randomWorldDeck(catalog);
      openDialog(`<div class="dialog-heading"><h2>全球隨機套裝</h2><p>${TAGS[next.tag].name} · 12 張全球角色 + 8 張支援卡</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-random">取代目前卡組</button></div>`,'small-modal');
      $('#confirm-random').onclick=()=>{profile.deck=next.deck;persist();modal.close();render();toast('已套用全球隨機套裝');};break;
    }
    case 'daily': {
      const date=new Date().toISOString().slice(0,10);
      openDialog(`<div class="dialog-heading"><h2>每日挑戰 · ${date}</h2><p>UTC 日期種子 · 固定雙方卡組與場地 · 20 LP</p><p>開始新對局；已儲存卡組不變。</p></div><button class="primary-button" id="confirm-daily">開始每日挑戰</button>`,'small-modal');
      $('#confirm-daily').onclick=()=>{game=createDailyGame(catalog,date);counted=false;handoff=false;screen='battle';modal.close();render();};break;
    }
    case 'close': modal.close(); break;
    case 'new': newDialog(); break;
    case 'fields': newDialog(true); break;
    case 'clash': startClash(); break;
    case 'handoff': handoff=false;modal.close();render();break;
    case 'sound': mute=!mute; sound(); button.innerHTML=icon(mute?'volume-x':'volume-2'); button.setAttribute('aria-label',mute?'開啟音效':'關閉音效');button.title=mute?'開啟音效':'關閉音效';button.setAttribute('aria-pressed',String(!mute));drawIcons();break;
    case 'more': visible+=24; render();break;
    case 'refresh': void refreshCatalog(button);break;
    case 'export': exportProfile();break;
    case 'import': importProfile();break;
    case 'add-effect': if($('#effect-rows').children.length>=4) toast('最多 4 組效果');else {$('#effect-rows').insertAdjacentHTML('beforeend',effectRow());syncTriggers();drawIcons();}break;
    case 'remove-effect': button.closest('.effect-row').remove();break;
  }
});
document.addEventListener('input', e => {
  if(e.target.id==='search') { const pos=e.target.selectionStart; query=e.target.value; visible=24; render(); const input=$('#search'); input.focus(); try {input.setSelectionRange(pos,pos);} catch {} }
});
document.addEventListener('change', e=>{
  if(e.target.name==='theme') {if(!applyTheme(e.target.value))toast('色系已套用，但瀏覽器無法儲存設定');render();}
  if(e.target.id==='origin-filter') {origin=e.target.value;visible=24;render();}
  if(e.target.id==='language-filter') {sourceLanguage=e.target.value;visible=24;render();}
  if(e.target.id==='country-filter') {sourceCountry=e.target.value;visible=24;render();}
  if(e.target.id==='ability-filter') {ability=e.target.value;visible=24;render();}
  if(e.target.name==='type') syncTriggers();
});
document.addEventListener('submit', e=>{
  if(e.target.id==='match-form') {
    e.preventDefault(); const values=Object.fromEntries(new FormData(e.target));
    try { game=createGame({catalog,deck:profile.deck,...values});counted=false;handoff=false;screen='battle';modal.close();render(); } catch(error) {$('#match-error').textContent=error.message;} return;
  }
  if(e.target.id==='card-form') {
    e.preventDefault(); const data=Object.fromEntries(new FormData(e.target));
    data.effects=[...$('#effect-rows').children].map(row=>({trigger:$('[name="trigger"]',row).value,action:$('[name="action"]',row).value,target:$('[name="target"]',row).value,amount:Number($('[name="amount"]',row).value)}));
    try { const card=validateCustom(data); profile.custom.push(card);catalog=collect();persist();formBase=null;screen='collection';origin='自訂';filter='all';sourceLanguage='all';sourceCountry='all';ability='all';query='';render();toast(`已鑄造「${card.name}」`); } catch(error) {$('#form-error').textContent=error.message;}
  }
});
document.addEventListener('error', e=>{if(e.target instanceof HTMLImageElement) {const parent=e.target.parentElement;e.target.remove();parent.classList.add('image-failed');parent.setAttribute('data-fallback','MEME');}},true);
modal.addEventListener('click',e=>{if(e.target===modal&&!handoff){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
modal.addEventListener('cancel',e=>{if(handoff)e.preventDefault();});
window.addEventListener('hashchange',()=>{if(location.hash==='#battle'&&game.phase!=='battle'){screen='battle';render();}});
render();
if(loaded.error) toast(loaded.error);
