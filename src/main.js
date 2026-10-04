import { createIcons, Swords, Layers, Hammer, Search, SlidersHorizontal, ArrowUpRight, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Plus, Minus, X, Zap, Shield, Heart, Sparkles, Volume2, VolumeX, RotateCcw, Github, Download, Upload, RefreshCw, Trash2, Check, ChevronRight, Target, Flame, Trophy, Palette, Save, Pencil, Star } from 'lucide';
import { CATALOG, TYPES, TAGS, FIELDS, ACTIONS, TARGETS, TRIGGERS, PRESETS, WORLD_COVERAGE, templateCards, validateCustom, effectText } from './catalog.js';
import { ARCHETYPES } from './semantics.js';
import { createGame, createDailyGame, randomWorldDeck, playCard, playError, units, combos, planAI, finishRound, isUnit, moveUnit } from './game.js';
import { bindDrag, dropIntent } from './drag.js';
import { Arena } from './arena.js';
import { MatchClient } from './online.js';
import { mountPreview } from './preview.js';
import { THEMES, loadTheme, applyTheme } from './preferences.js';
import { LANGUAGES, getLocale, setLocale, tr, localize } from './i18n.js';
import { loadProfile, saveProfile, parseProfile } from './storage.js';
import { loadDraft, saveDraft } from './draft.js';
import './style.css';
import './duel.css';

const icons = { Swords, Layers, Hammer, Search, SlidersHorizontal, ArrowUpRight, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Plus, Minus, X, Zap, Shield, Heart, Sparkles, Volume2, VolumeX, RotateCcw, Github, Download, Upload, RefreshCw, Trash2, Check, ChevronRight, Target, Flame, Trophy, Palette, Save, Pencil, Star };
document.documentElement.dataset.theme=loadTheme();
const $ = (s, root = document) => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
const drawIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.8 } });
const loaded = loadProfile();
let profile = loaded.profile;
const loadedDraft = loadDraft(profile.custom);
let recoveryRaw = loaded.error ? loaded.raw ?? null : null;
let persistedRaw = loaded.raw ?? null;
let catalog = collect();
let game = createGame({ catalog, deck: validDeck() });
let screen = 'battle', arena, query = '', filter = 'all', origin = 'all', visible = 24, mute = true, audio, counted = false;
let handoff = false, toastTimer, formBase = loadedDraft.card, editingId = loadedDraft.editingId, editSource = loadedDraft.source, draftFailed = loadedDraft.error;
let savedDeckId = '', deckName = '';
let dialogReturn = null;
let selected = null, dragging = false, cancelDrag;
let online = null, onlineBusy = false, replaying = false, replayKey = '';
const network = new MatchClient(receiveOnline, message => {
  if (online) online.error = true;
  onlineBusy = false;
  if (!replaying) render();
  toast(message);
});
let previewTimer, hoverCard, stopHoverPreview, stopModalPreview;
const hoverPreview = document.createElement('aside');
hoverPreview.className = 'hover-preview'; hoverPreview.hidden = true; hoverPreview.id = 'card-effect-preview';
hoverPreview.setAttribute('role','tooltip'); document.body.append(hoverPreview);
let sourceLanguage = 'all', sourceCountry = 'all', ability = 'all', sortOrder = 'catalog', favoritesOnly = false;
let refreshingCatalog = false;
const languageNames = { ara:'العربية', ben:'বাংলা', deu:'Deutsch', eng:'English', fra:'Français', hin:'हिन्दी', jpn:'日本語', kor:'한국어', por:'Português', rus:'Русский', spa:'Español', tam:'தமிழ்', urd:'اردو', vie:'Tiếng Việt', zho:'中文' };
let regionNames = new Intl.DisplayNames([getLocale()], { type: 'region' });
const app = $('#app'), modal = $('#modal');

function collect() { return [...new Map([...CATALOG, ...templateCards(profile.web), ...profile.custom].map(c => [c.id, c])).values()]; }
function validDeck() { return profile.deck.length >= 10 && profile.deck.some(id => catalog.find(c => c.id === id)?.type === 'monster') ? profile.deck : PRESETS.starter.deck; }
function canPlay() { return game.phase==='plan'&&!handoff&&!onlineBusy&&(!online||(online.status==='matched'&&!online.error&&!online.battling&&online.turn===online.side)); }
function onlineStatus() {
  if (!online) return '';
  if (online.error) return '連線中斷，正在重試';
  if (online.status==='joining') return '正在連線';
  if (online.status==='waiting') return '尋找對手中';
  if (game.phase==='over') return '對決結束';
  if (replaying||online.battling) return '碰撞對決中';
  return `${tr(online.turn===online.side?'輪到你部署':'等待對手部署')} · ${online.remaining} s${online.opponentOffline?` · ${tr('對手暫時離線')}`:''}`;
}
function receiveOnline(state) {
  if (state.status==='idle') {
    const previous=online;online=null;onlineBusy=false;replaying=false;replayKey='';
    if(previous){modal.close();game=createGame({catalog,deck:validDeck()});screen='battle';render();}
    return;
  }
  const changed=!online||online.version!==state.version||online.status!==state.status||online.battling!==state.battling||online.error;
  const resumeCompleted=state.status==='matched'&&!online?.id&&!state.battling;
  online=state;onlineBusy=false;
  if (replaying) return;
  if (!changed) { const status=$('#online-status');if(status)status.textContent=tr(onlineStatus());return; }
  if(state.status==='matched') {
    screen='battle';modal.close();handoff=false;
    const key=`${state.id}:${state.replay?.round}`;
    if(resumeCompleted)replayKey=key;
    if(state.replay&&key!==replayKey) {
      replayKey=key;replaying=true;
      game=structuredClone(state.game);game.phase='battle';game.round=state.replay.round;
      state.replay.energy.forEach((energy,i)=>game.players[i].energy=energy);
      render();arena.startReplay(state.replay);return;
    }
    game=state.game;
    if(game.phase==='over'){battleDone(false);return;}
  }
  render();
}
async function onlineCommand(action,data={}) {
  if(onlineBusy||!online)return;
  onlineBusy=true;cancelDrag?.();render();
  await network.send(action,{version:online.version,...data});
}
function matchmakingDialog() {
  openDialog(`<div class="dialog-heading"><h2>線上匹配</h2><p>自由卡組 · 20 LP · 每次部署 90 秒</p><p>自訂卡可參戰；場地採先進入佇列的玩家設定。</p></div><form id="online-form"><label>場地<select name="field">${FIELDS.map(f=>`<option value="${f.id}" ${game.field===f.id?'selected':''}>${f.name}</option>`).join('')}</select></label><p class="form-error" id="online-error" role="alert"></p><button class="primary-button" type="submit">${icon('swords')} 開始匹配</button></form>`,'small-modal');
}
function persist(next = profile, replace = false) {
  if (recoveryRaw !== null && !replace) { recoveryDialog(); return false; }
  try {
    const raw=saveProfile(next,persistedRaw);
    if(raw===null){toast('存檔已在其他分頁更新，請先匯出備份並重新載入');return false;}
    persistedRaw=raw;recoveryRaw=null;const changed=next.custom!==profile.custom||next.web!==profile.web;profile=next;
    if(changed){catalog=collect();if(editingId&&!profile.custom.some(c=>c.id===editingId&&JSON.stringify(c)===editSource)){editingId='';editSource='';storeCardDraft();}}
    return true;
  } catch { toast('瀏覽器儲存空間不足，請匯出卡組備份'); return false; }
}
function storeCardDraft() {
  const ok=saveDraft(formBase?{card:formBase,editingId,source:editSource}:null);
  if(!ok&&!draftFailed)toast('無法暫存草稿，重新整理可能遺失');
  draftFailed=!ok;
  return ok;
}
function clearCardDraft() {
  if(!saveDraft(null)){toast('無法清除暫存草稿，重新整理可能再次出現');return false;}
  editingId='';editSource='';formBase=null;draftFailed=false;modal.close();render();return true;
}
function startCardDraft(card, edit = false) {
  if(edit&&editingId===card.id&&formBase){modal.close();screen='workshop';render();return;}
  const draft={card:structuredClone(card),editingId:edit?card.id:'',source:edit?JSON.stringify(card):''};
  const start=()=>{
    if(!saveDraft(draft))return toast('無法暫存草稿，請重試');
    formBase=draft.card;editingId=draft.editingId;editSource=draft.source;draftFailed=false;
    modal.close();screen='workshop';render();
  };
  if(!formBase){start();return;}
  openDialog(`<div class="dialog-heading"><h2>取代目前草稿？</h2><p>此操作無法還原。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-replace-draft">${icon('check')} 確認覆寫</button></div>`,'small-modal');
  $('#confirm-replace-draft').onclick=start;
}
function recoveryDialog() {
  openDialog(`<div class="dialog-heading"><h2>存檔無法讀取</h2><p>原始存檔已保留。覆寫後無法還原，請先下載原始存檔。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="export-recovery">${icon('download')} 下載原始存檔</button><button class="quiet-button" data-action="import">${icon('upload')} 匯入</button><button class="primary-button" id="confirm-reset-save">${icon('refresh-cw')} 覆寫為預設卡組</button></div>`, 'small-modal save-recovery');
  $('#confirm-reset-save').onclick=()=>{if(!persist(profile,true))return;modal.close();render();};
}
function saveDeck() {
  const name = $('#deck-name').value.trim();
  if (!name || name.length > 48) return toast('卡組名稱需為 1 至 48 字');
  if (profile.deck.length > 30) return toast('卡組已滿：最多 30 張');
  if (profile.deck.some(id => profile.deck.filter(card => card === id).length > 2)) return toast('同一張卡最多放入 2 張');
  const existing = profile.decks.find(saved => saved.id === savedDeckId && saved.name === name) || profile.decks.find(saved => saved.name === name);
  if (!existing && profile.decks.length >= 20) return toast('最多保存 20 組卡組');
  const save = () => {
    let id = existing?.id;
    if (!id) do { id = `deck-${crypto.randomUUID()}`; } while (profile.decks.some(saved => saved.id === id));
    const saved = { id, name, deck: [...profile.deck] };
    const decks = existing ? profile.decks.map(item => item.id === id ? saved : item) : [...profile.decks, saved];
    if (!persist({ ...profile, decks })) return;
    savedDeckId = id; deckName = name; modal.close(); render(); toast(saved.deck.length<10||!saved.deck.some(id=>catalog.find(c=>c.id===id)?.type==='monster')?'卡組草稿已保存':'卡組已保存');
  };
  if (!existing) return save();
  openDialog(`<div class="dialog-heading"><h2>覆寫已保存卡組？</h2><p data-original>${esc(name)}</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-save-deck">${icon('save')} 確認覆寫</button></div>`, 'small-modal');
  $('#confirm-save-deck').onclick = save;
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = tr(message); $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200); }
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
function image(card, extra = '') { return card.image ? `<img data-card-art src="${esc(card.image)}" alt="${esc(card.name)}" loading="lazy" referrerpolicy="no-referrer" ${extra}>` : `<span class="art-fallback" role="img" aria-label="${esc(card.name)}" data-original>${esc(card.name.slice(0, 2))}</span>`; }
function cardHTML(card, index = null) {
  const inHand = index !== null, num = profile.deck.filter(id => id === card.id).length;
  return `<button class="meme-card type-${card.type}" style="--tag:${TAGS[card.tag].color}" data-${inHand ? 'hand' : 'card'}="${inHand ? index : esc(card.id)}" aria-label="${esc(card.name)}，${tr(TYPES[card.type])}，${card.cost} ${tr('能量')}">
    <span class="card-top"><b class="cost">${card.cost}</b><span>${TYPES[card.type]}</span><span class="card-rarity">${!inHand&&profile.favorites.includes(card.id)?icon('star','favorite-mark'):''}${card.type === 'fusion' ? 'EX' : card.origin === '自訂' ? 'MY' : 'MC'}</span></span>
    <span class="card-art">${image(card)}<span class="tag-pill">${TAGS[card.tag].name}</span></span>
    <span class="card-name">${esc(card.name)}</span>
    <span class="card-ability">${esc(effectText(card))}</span>
    <span class="card-bottom">${isUnit(card) ? `<span>${icon('swords')} ${card.attack}</span><span>${icon('heart')} ${card.hp}</span>` : `<span>${icon(card.type === 'trap' ? 'shield' : 'sparkles')} ${TYPES[card.type]}</span>`}<small>${inHand ? '查看' : num ? `卡組 ×${num}` : TAGS[card.tag].name}</small></span>
  </button>`;
}
function header() {
  return `<header class="topbar"><a href="#battle" class="brand" aria-label="MEME CLASH 首頁"><span class="brand-mark">${icon('swords')}</span><span>MEME<span class="brand-light">CLASH</span><small>迷因亂鬥</small></span></a>
    <nav aria-label="主要導覽">${[['battle','swords','對決'],['collection','layers','卡牌圖鑑'],['workshop','hammer','卡組工坊']].map(([id, glyph, text]) => `<button class="nav-item ${screen === id ? 'active' : ''}" data-nav="${id}" ${game.phase === 'battle' ? 'disabled' : ''} ${screen === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${text}</span></button>`).join('')}</nav>
    <div class="header-end">${recoveryRaw!==null?`<button class="icon-button" data-action="recovery" title="原始存檔恢復" aria-label="原始存檔恢復">${icon('download')}</button>`:''}<button class="icon-button" data-action="appearance" title="語言與色系" aria-label="語言與色系" ${game.phase==='battle'?'disabled':''}>${icon('palette')}</button><a class="icon-button" href="https://github.com/Honguan/meme" target="_blank" rel="noopener noreferrer" title="GitHub 開源程式碼" aria-label="GitHub 開源程式碼">${icon('github')}</a><button class="icon-button" data-action="sound" aria-label="${mute ? '開啟音效' : '關閉音效'}" title="${mute ? '開啟音效' : '關閉音效'}" aria-pressed="${!mute}">${icon(mute ? 'volume-x' : 'volume-2')}</button></div>
  </header>`;
}
function playerHUD(side) {
  const p = game.players[side];
  const face=units(game,side)[0];
  return `<div class="player-hud side-${side}"><span class="duelist-avatar">${face?image(face):icon('swords')}</span><div class="player-info"><b>${p.name}</b><div class="life-track"><span style="width:${p.hp / 20 * 100}%"></span></div></div><div class="life"><small>LP</small><b>${p.hp}</b></div></div>`;
}
function logHTML() { return game.log.slice(0, 6).map(l => `<li class="log-${l.kind}"><small>${String(l.round).padStart(2,'0')}</small><span data-original>${esc(tr(l.text))}</span></li>`).join(''); }
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
  return `<main class="duel-page"><div class="duel-toolbar"><h1>對戰</h1><span>${online?'線上匹配':game.challenge?`每日挑戰 ${game.challenge}`:game.mode==='ai'?'人機對決':'同機雙人'}</span><span>${{classic:'生命決勝',knockout:'五次擊倒',sandbox:'自由沙盒'}[game.goal]}</span>${online?`<button class="text-button" data-action="leave-online" ${onlineBusy?'disabled':''}>${icon('x')} ${online.status==='matched'?'離開對局':'取消匹配'}</button>`:`<button class="quiet-button" data-action="matchmaking" ${game.phase==='battle'?'disabled':''}>${icon('swords')} 匹配對戰</button><button class="text-button" data-action="daily" ${game.phase==='battle'?'disabled':''}>${icon('trophy')} 每日挑戰</button><button class="icon-button" data-action="new" title="新對決" aria-label="新對決" ${game.phase==='battle'?'disabled':''}>${icon('rotate-ccw')}</button>`}</div>
    ${online?`<div class="online-status" role="status"><span id="online-status" data-original>${esc(tr(onlineStatus()))}</span>${online.status==='matched'?`<small>${tr('對局')} ${online.id.slice(0,8)}</small>`:''}</div>`:''}
    <div class="duel-layout"><aside class="card-inspector" id="card-inspector">${inspectorHTML()}</aside>
    <section class="duel-table" aria-label="對戰區"><div id="scoreboard" class="duel-scoreboard">${playerHUD(1-game.active)}${playerHUD(game.active)}</div>
      <div class="duel-round"><span id="phase-chip">${game.phase==='battle'?'碰撞對決中':game.phase==='over'?'對決結束':'部署階段'}</span><span>回合 <b id="round-number">${String(game.round).padStart(2,'0')}</b></span></div>
      <div class="duel-board ${game.phase==='battle'?'is-battling':''}" data-phase="${game.phase}"><canvas id="arena" aria-label="迷因角色 2D 物理碰撞戰場" role="img"></canvas>
        <div class="formation opponent-formation">${formationHTML(1-game.active)}</div>
        <div class="board-midline"><button class="field-token" data-drop data-kind="field" data-side="${game.active}" aria-label="場地區" title="${esc(field.description)}">${icon('layers')}<span>${esc(field.name)}</span></button><span class="board-wordmark">MEME<span>CLASH</span></span><button class="cast-zone" data-drop data-kind="cast" data-side="${game.active}" aria-label="魔法區">${icon('sparkles')}<span>魔法區</span></button></div>
        <div class="formation own-formation">${formationHTML(game.active)}</div>
        <div class="drop-status" id="drop-status" role="status" aria-live="polite"></div>
      </div>
      <div class="duel-actions"><div class="energy-box"><span>${icon('zap')} 能量</span><strong>${game.goal==='sandbox'?'∞':p.energy}<small>/ ${Math.min(8,2+game.round)}</small></strong></div><span class="pile-count">${icon('layers')} ${p.deck.length}<small>牌庫</small></span><button class="pile-count" data-action="discard" title="墓地" aria-label="墓地" ${game.phase==='battle'||handoff||online&&online.status!=='matched'?'disabled':''}>${icon('trash-2')} ${p.discard.length}<small>墓地</small></button><button class="primary-button clash-button" data-action="clash" ${!canPlay()?'disabled':''}>${icon('swords')} ${online||game.mode==='local'&&game.active===0?'完成部署':'開始碰撞'} ${icon('arrow-right')}</button></div>
      <section class="hand-section" aria-label="手牌"><div class="hand-heading"><h2>手牌 <span>${handoff?'?':p.hand.length}</span></h2><button class="text-button" data-action="fields" ${game.phase==='battle'?'disabled':''}>更換場地 ${icon('arrow-up-right')}</button></div><div class="hand-cards">${handoff?'<div class="empty-state">等待玩家 02 接手</div>':p.hand.map((id,i)=>cardHTML(game.cards[id],i)).join('')||'<div class="empty-state">手牌已用盡，下回合繼續抽牌。</div>'}</div></section>
    </section><aside class="duel-feed"><div class="synergy-section"><h3>${icon('sparkles')} 連攜套裝 <span id="set-count">${tags.length}</span></h3><div class="synergies" id="set-progress">${setProgressHTML()}</div><details class="set-guide"><summary>套裝效果 · 2 / 3 件</summary><p>同陣營角色湊滿 2 名或 3 名就有加成，重複卡也算。角色離場後重新計算，已拿到的能量、手牌與護盾不會收回。</p>${Object.keys(TAGS).map(setRulesHTML).join('')}</details></div><div class="log-section"><h3>對決紀錄<span id="collision-count">${game.collisions} 次碰撞</span></h3><ol id="battle-log" aria-live="polite" aria-relevant="additions">${logHTML()}</ol></div></aside></div></main>`;
}
function formationHTML(side) {
  const p=game.players[side];
  return `<div class="support-slots">${[0,1].map(i=>`<button class="support-slot ${p.traps[i]?'armed':''}" data-drop data-kind="trap" data-side="${side}" ${p.traps[i]?'data-occupied="true"':''} aria-label="${tr('陷阱區')} ${i+1}">${icon('shield')}<span>${p.traps[i]?'已設置':'陷阱區'}</span></button>`).join('')}</div><div class="unit-slots">${[0,1,2].map(slot=>{
    const u=units(game,side).find(u=>u.slot===slot);
    return `<button class="board-slot ${u?'occupied':''} side-${side}" data-drop data-kind="unit" data-side="${side}" data-slot="${slot}" ${u?`data-unit="${u.uid}" data-uid="${u.uid}"`:''} aria-label="${tr(side===game.active?'友軍':'敵軍')} ${slot+1}${u?` ${esc(u.name)}`:''}" ${game.phase!=='plan'||handoff?'disabled':''}>${u?`${image(u)}<span class="board-unit-name" data-original>${esc(u.name)}</span><span class="board-stats"><b>${icon('swords')} ${u.attack}</b><b>${icon('heart')} ${u.hp}</b>${u.shield?`<b>${icon('shield')} ${u.shield}</b>`:''}</span><span class="unit-faction" style="--tag:${TAGS[u.tag].color}"></span>`:`${icon('plus')}<span>角色區</span><small>0${slot+1}</small>`}</button>`;
  }).join('')}</div>`;
}
function selectedCard() { return selected?.uid?game.units.find(u=>u.uid===selected.uid):game.cards[game.players[game.active].hand[selected?.index ?? 0]]; }
function inspectorHTML() {
  const c=handoff?null:selectedCard();
  return c?`<div class="inspector-art">${image(c)}</div><div class="inspector-copy"><span class="eyebrow">${TYPES[c.type]} · ${TAGS[c.tag].name}</span><h2 data-original>${esc(c.name)}</h2><p>${esc(effectText(c))}</p><div class="inspector-stats">${icon('zap')} ${c.cost}${isUnit(c)?`${icon('swords')} ${c.attack}${icon('heart')} ${c.hp}`:''}</div><button class="text-button" data-action="inspect">卡牌詳情 ${icon('arrow-up-right')}</button>${selected?`<button class="icon-button cancel-selection" data-action="cancel-selection" aria-label="取消選擇" title="取消選擇">${icon('x')}</button>`:''}</div>`:'<div class="inspector-empty">MEME CLASH</div>';
}
function collectionHTML() {
  const search=query.toLowerCase(), favorites=new Set(profile.favorites);
  const filtered = catalog.filter(c => (!favoritesOnly || favorites.has(c.id)) && (filter === 'all' || c.type === filter) && (origin === 'all' || c.origin === origin) && (sourceLanguage === 'all' || (sourceLanguage === 'unknown' ? !c.languages?.length : c.languages?.includes(sourceLanguage))) && (sourceCountry === 'all' || c.countries?.includes(sourceCountry)) && (ability === 'all' || c.archetype === ability) && (!search || `${c.name} ${TAGS[c.tag].name} ${TAGS[c.tag].set} ${c.flavor} ${ARCHETYPES[c.archetype]?.name || ''} ${tr(TAGS[c.tag].name)} ${tr(TAGS[c.tag].set)} ${tr(ARCHETYPES[c.archetype]?.name || '')} ${effectText(c)}`.toLowerCase().includes(search)));
  if(sortOrder==='name'){const compare=new Intl.Collator(getLocale(),{numeric:true}).compare;filtered.sort((a,b)=>compare(a.name,b.name));}
  else if(sortOrder==='cost')filtered.sort((a,b)=>a.cost-b.cost);
  else if(sortOrder==='attack'||sortOrder==='hp')filtered.sort((a,b)=>b[sortOrder]-a[sortOrder]);
  return `<main class="collection-page"><div class="page-heading"><h1>卡牌圖鑑</h1><button class="quiet-button" data-action="refresh" aria-busy="${refreshingCatalog}" ${refreshingCatalog?'disabled':''}>${icon('refresh-cw')} 更新網路卡庫</button></div>
    <div class="collection-toolbar"><label class="search-box">${icon('search')}<input id="search" type="search" placeholder="搜尋迷因、陣營或效果" aria-label="搜尋卡牌" value="${esc(query)}"></label><div class="filter-tabs" role="group" aria-label="卡牌類型">${[['all','全部'],...Object.entries(TYPES)].map(([id,label])=>`<button data-filter="${id}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><select id="origin-filter" aria-label="卡牌來源">${['all','精選','網路','全球','自訂'].map(o=>`<option value="${o}" ${origin===o?'selected':''}>${o==='all'?'所有來源':o}</option>`).join('')}</select></div>
    <div class="world-filters"><span>${WORLD_COVERAGE.count.toLocaleString()} 全球模板 · ${Object.keys(WORLD_COVERAGE.languages).length} 種來源語言 · ${Object.keys(WORLD_COVERAGE.countries).length} 個來源地區</span><label>來源語言<select id="language-filter"><option value="all">所有語言</option>${Object.keys(WORLD_COVERAGE.languages).map(code=>`<option value="${code}" ${sourceLanguage===code?'selected':''}>${languageNames[code] || code}</option>`).join('')}<option value="unknown" ${sourceLanguage==='unknown'?'selected':''}>未標註</option></select></label><label>來源地區<select id="country-filter"><option value="all">所有地區</option>${Object.keys(WORLD_COVERAGE.countries).map(code=>`<option value="${code}" ${sourceCountry===code?'selected':''}>${regionNames.of(code)}</option>`).join('')}</select></label><label>梗意能力<select id="ability-filter"><option value="all">所有能力</option>${Object.entries(ARCHETYPES).map(([id,a])=>`<option value="${id}" ${ability===id?'selected':''}>${a.name}</option>`).join('')}</select></label></div>
    <div class="collection-layout"><section><div class="results-heading"><span>${filtered.length} 張卡牌</span><label class="favorites-filter"><input id="favorites-only" type="checkbox" ${favoritesOnly?'checked':''}>只看收藏</label><select id="sort-order" aria-label="卡牌排序">${[['catalog','原始順序'],['name','名稱順序'],['cost','能量低至高'],['attack','攻擊力高至低'],['hp','生命值高至低']].map(([id,label])=>`<option value="${id}" ${sortOrder===id?'selected':''}>${label}</option>`).join('')}</select></div><div class="catalog-grid">${filtered.slice(0,visible).map(c=>cardHTML(c)).join('') || '<div class="empty-state">沒有符合條件的卡牌。</div>'}</div>${filtered.length>visible?`<button class="quiet-button load-more" data-action="more">載入更多 ${icon('plus')}</button>`:''}</section>${deckSidebar()}</div></main>`;
}
function deckSidebar() {
  const count = new Map(); profile.deck.forEach(id=>count.set(id,(count.get(id)||0)+1));
  const savedControls = `<div class="saved-decks"><label for="saved-deck">已保存卡組</label><div class="saved-deck-row deck-select-row"><select id="saved-deck"><option value="">選擇卡組</option>${profile.decks.map(saved=>`<option data-original value="${esc(saved.id)}" ${saved.id===savedDeckId?'selected':''}>${esc(saved.name)}</option>`).join('')}</select><button class="icon-button" data-action="rename-deck" title="重新命名卡組" aria-label="重新命名卡組" ${savedDeckId?'':'disabled'}>${icon('pencil')}</button><button class="icon-button" data-action="delete-deck" title="刪除已保存卡組" aria-label="刪除已保存卡組" ${savedDeckId?'':'disabled'}>${icon('trash-2')}</button></div><label for="deck-name">卡組名稱</label><div class="saved-deck-row"><input id="deck-name" value="${esc(deckName)}" maxlength="48" autocomplete="off"><button class="icon-button" data-action="save-deck" title="保存卡組" aria-label="保存卡組">${icon('save')}</button></div></div>`;
  return `<aside class="deck-sidebar"><div class="aside-title"><h2>我的卡組</h2><b class="deck-count ${profile.deck.length<10?'warning':''}">${profile.deck.length}<small>/30</small></b></div>${savedControls}<div class="deck-list">${[...count].map(([id,n])=>{const c=catalog.find(c=>c.id===id);return c?`<div class="deck-row">${image(c)}<span><b>${esc(c.name)}</b><small>${TYPES[c.type]} · ${c.cost} 能量</small></span><b>×${n}</b><button class="icon-button small" data-remove="${esc(id)}" title="移除一張" aria-label="移除 ${esc(c.name)}">${icon('minus')}</button></div>`:'';}).join('')||'<p class="empty-state">尚未加入卡牌</p>'}</div><button class="primary-button" data-action="new">${icon('swords')} 使用卡組對決</button><div class="deck-tools"><button class="quiet-button" data-action="export">${icon('download')} 匯出</button><button class="quiet-button" data-action="import">${icon('upload')} 匯入</button></div></aside>`;
}
function effectRow(value = { trigger: 'play', action: 'shield', target: 'self', amount: 3 }) {
  return `<div class="effect-row"><label>時機<select name="trigger">${Object.entries(TRIGGERS).map(([key,name])=>`<option value="${key}" ${key===value.trigger?'selected':''}>${name}</option>`).join('')}</select></label><label>效果<select name="action">${Object.entries(ACTIONS).map(([key,name])=>`<option value="${key}" ${key===value.action?'selected':''}>${name}</option>`).join('')}</select></label><label>對象<select name="target">${Object.entries(TARGETS).map(([key,name])=>`<option value="${key}" ${key===value.target?'selected':''}>${name}</option>`).join('')}</select></label><label>數值<input name="amount" type="number" min="1" max="99" value="${esc(value.amount)}" required></label><div class="effect-tools"><button class="icon-button" type="button" data-action="effect-up" aria-label="上移效果" title="上移效果">${icon('arrow-up')}</button><button class="icon-button" type="button" data-action="effect-down" aria-label="下移效果" title="下移效果">${icon('arrow-down')}</button><button class="icon-button" type="button" data-action="remove-effect" aria-label="移除此效果" title="移除此效果">${icon('x')}</button></div></div>`;
}
function syncEffectOrder() {
  const rows=[...$('#effect-rows').children];
  rows.forEach((row,index)=>{ $('[data-action="effect-up"]',row).disabled=index===0; $('[data-action="effect-down"]',row).disabled=index===rows.length-1; });
}
function readCardForm(form) {
  const data=Object.fromEntries(new FormData(form));
  data.effects=[...form.querySelectorAll('.effect-row')].map(row=>({trigger:$('[name="trigger"]',row).value,action:$('[name="action"]',row).value,target:$('[name="target"]',row).value,amount:$('[name="amount"]',row).value}));
  return data;
}
function workshopHTML() {
  const c = formBase || { name:'', type:'monster', tag:'chaos', cost:2, attack:4, hp:12, speed:5, image:'', flavor:'', effects:[{ trigger:'play', action:'shield',target:'self',amount:3 }] };
  return `<main class="workshop-page"><div class="page-heading"><h1>卡組工坊</h1><span class="small-count">${profile.custom.length} 張自訂卡牌</span></div>
    <div class="workshop-layout"><section class="workshop-main"><div class="preset-band"><h2>卡組流派</h2><div class="preset-options">${Object.entries(PRESETS).map(([id,p],i)=>`<button data-preset="${id}" class="preset"><span class="preset-icon preset-${i}">${icon(i===0?'swords':i===1?'flame':'heart')}</span><span><b>${p.name}</b><small>${p.deck.length} 張卡牌</small></span>${icon('arrow-up-right')}</button>`).join('')}</div></div>
    <div class="extra-play"><button class="quiet-button" data-action="random-deck">${icon('refresh-cw')} 全球隨機套裝</button><button class="quiet-button" data-action="daily">${icon('trophy')} 每日挑戰</button></div>
    <form id="card-form"><div class="form-heading"><h2>${editingId?'編輯卡牌':'創作卡牌'}</h2><span>${editingId?'EDIT CARD':`NEW CARD / ${String(profile.custom.length+1).padStart(3,'0')}`}</span><button class="icon-button" type="button" data-action="${editingId?'cancel-edit':'clear-draft'}" aria-label="${editingId?'取消編輯':'清除草稿'}" title="${editingId?'取消編輯':'清除草稿'}">${icon(editingId?'x':'trash-2')}</button></div>
    <div class="form-grid"><label class="wide">卡牌名稱<input name="name" maxlength="72" value="${esc(c.name)}" placeholder="卡牌名稱" required></label><label>類型<select name="type">${Object.entries(TYPES).map(([id,n])=>`<option value="${id}" ${c.type===id?'selected':''}>${n}</option>`).join('')}</select></label><label>陣營<select name="tag">${Object.entries(TAGS).map(([id,t])=>`<option value="${id}" ${c.tag===id?'selected':''}>${t.name}</option>`).join('')}</select></label><label>能量消耗<input name="cost" type="number" min="0" max="9" value="${esc(c.cost)}" required></label><label>碰撞速度<input name="speed" type="number" min="1" max="12" value="${esc(c.speed)}" required></label><label>攻擊力<input name="attack" type="number" min="0" max="99" value="${esc(c.attack)}" required></label><label>生命值<input name="hp" type="number" min="1" max="999" value="${typeof c.hp==='string'?esc(c.hp):Math.max(1,c.hp)}" required></label><label class="wide">圖片網址<input name="image" type="url" maxlength="2048" value="${esc(c.image)}" placeholder="https://…"></label><label class="wide">卡牌宣言<input name="flavor" maxlength="160" value="${esc(c.flavor)}" placeholder="台詞或備註"></label><label class="wide field-rule" ${c.type!=='field'?'hidden':''}>場地規則<select name="field">${FIELDS.map(f=>`<option value="${f.id}" ${c.field===f.id?'selected':''}>${f.name}：${f.description}</option>`).join('')}</select></label></div>
    <div class="form-heading effects-heading"><h3>效果連鎖</h3><button class="text-button" type="button" data-action="add-effect">${icon('plus')} 新增效果</button></div><div id="effect-rows">${c.effects.map(effectRow).join('')}</div><p class="form-error" id="form-error" role="alert"></p><button class="primary-button" type="submit">${icon(editingId?'save':'sparkles')} ${editingId?'儲存修改':'鑄造卡牌'}</button></form>
    </section>${deckSidebar()}</div></main>`;
}
function render() {
  if(arena?.running&&arena.game===game&&!onlineBusy)return;
  cancelDrag?.();selected=null;
  hideHoverPreview();
  arena?.destroy(); arena = null;
  app.innerHTML = `${header()}${screen==='battle'?battleHTML():screen==='collection'?collectionHTML():workshopHTML()}`;
  drawIcons();
  if(online) {
    for(const button of app.querySelectorAll('[data-nav],[data-action="fields"]'))button.disabled=true;
    if(!canPlay())for(const button of app.querySelectorAll('[data-hand],[data-drop]'))button.disabled=true;
  }
  if (screen === 'battle') arena = new Arena($('#arena'), game, battleDone, () => { sound('hit'); updateBattleHUD(); });
  if (screen === 'workshop') { syncTriggers();syncEffectOrder(); }
  localize(app);
}
function updateBattleHUD() {
  $('#scoreboard').innerHTML = playerHUD(1-game.active) + playerHUD(game.active);
  $('#battle-log').innerHTML = logHTML(); $('#collision-count').textContent = tr(`${game.collisions} 次碰撞`);
  $('#set-progress').innerHTML = setProgressHTML();
  $('#set-count').textContent = combos(game, game.active).length;
  localize($('#scoreboard'));localize($('#battle-log'));localize($('#set-progress'));
}
function openDialog(html, className = '') {
  if(!modal.open){const element=document.activeElement;dialogReturn=app.contains(element)?{screen,element}:null;}
  hideHoverPreview();stopModalPreview?.();stopModalPreview=null;
  if (modal.open) modal.close();
  modal.className = className;
  modal.innerHTML = `<button class="icon-button close-dialog" data-action="close" aria-label="關閉" title="關閉">${icon('x')}</button>${html}`;
  $('h2',modal).id = 'dialog-title';
  modal.setAttribute('aria-labelledby','dialog-title');
  localize(modal);modal.showModal(); drawIcons();
}
function appearanceDialog() {
  openDialog(`<div class="dialog-heading"><h2>語言與色系</h2></div><label class="language-choice">介面語言<select id="interface-language">${Object.entries(LANGUAGES).map(([id,name])=>`<option value="${id}" ${getLocale()===id?'selected':''}>${name}</option>`).join('')}</select></label><fieldset class="theme-picker"><legend>配色</legend>${Object.entries(THEMES).map(([id,theme])=>`<label><input type="radio" name="theme" value="${id}" ${document.documentElement.dataset.theme===id?'checked':''}><span class="theme-swatch" style="--swatch:${theme.accent};--rival:${theme.rival}"></span><b>${theme.name}</b></label>`).join('')}</fieldset>`,'small-modal');
}
function displayCard(id) { return (screen==='battle'&&game.cards[id]) || catalog.find(c=>c.id===id); }
function discardDialog(side = game.active, focusId) {
  const count=new Map();for(const id of [...game.players[side].discard].reverse())count.set(id,(count.get(id)||0)+1);
  openDialog(`<div class="dialog-heading"><h2>墓地</h2></div><div class="filter-tabs" role="group" aria-label="墓地">${game.players.map((p,i)=>`<button data-action="discard" data-side="${i}" class="${i===side?'active':''}" aria-pressed="${i===side}"><span>${esc(p.name)}</span><span> · ${p.discard.length}</span></button>`).join('')}</div><div class="deck-list" id="discard-list" data-side="${side}">${[...count].map(([id,n],i)=>{const c=game.cards[id];return c?`<button class="deck-row discard-card" data-discard-card="${esc(id)}" aria-labelledby="discard-name-${i} discard-count-${i}">${image(c)}<span><b id="discard-name-${i}" data-original>${esc(c.name)}</b><small>${TYPES[c.type]} · ${c.cost} 能量</small></span><b id="discard-count-${i}">×${n}</b>${icon('chevron-right')}</button>`:'';}).join('')||'<p class="empty-state">尚無棄牌</p>'}</div>`,'small-modal discard-modal');
  (focusId?$(`[data-discard-card="${CSS.escape(focusId)}"]`,modal):$(`[data-side="${side}"]`,modal))?.focus();
}
function showCard(id, handIndex = null, readOnly = false) {
  const c = handIndex === null ? displayCard(id) : game.cards[game.players[game.active].hand[handIndex]];
  if (!c) return;
  const error = handIndex !== null ? playError(game, game.active, handIndex) : '';
  const favorite=profile.favorites.includes(c.id),favoriteLabel=tr(favorite?'取消收藏':'收藏卡牌');
  openDialog(`<div class="card-detail"><div class="detail-art" style="--tag:${TAGS[c.tag].color}">${image(c)}</div><div class="detail-body"><span class="eyebrow" style="color:${TAGS[c.tag].color}">${TYPES[c.type]} / ${TAGS[c.tag].name}</span><div class="detail-heading"><h2 data-original>${esc(c.name)}</h2><button class="icon-button favorite-toggle" data-favorite="${esc(c.id)}" aria-pressed="${favorite}" aria-label="${favoriteLabel}" title="${favoriteLabel}" ${catalog.some(card=>card.id===c.id)?'':'disabled'}>${icon('star')}</button></div><p class="flavor" ${c.origin==='自訂'?'data-original':''}>${esc(c.flavor)}</p><div class="detail-stats"><span>${icon('zap')} ${c.cost} 能量</span>${isUnit(c)?`<span>${icon('swords')} ${c.attack}</span><span>${icon('heart')} ${c.hp}</span>`:''}</div><div class="effect-detail">${c.type==='fusion'?'<p>消耗兩名同陣營角色；繼承素材陣營及一半總攻擊。</p>':''}<p>${esc(effectText(c))}</p></div>
    <section class="modal-preview"><button class="quiet-button" data-preview="${esc(c.id)}">${icon('sparkles')} 播放效果演示</button><div id="modal-preview-stage" hidden></div></section>
    ${isUnit(c)?`<section class="set-detail" aria-label="連攜套裝">${setRulesHTML(c.tag)}<p>${c.type==='fusion'?'融合後改用素材陣營的套裝；兩份素材合為 1 件。':'同一方存活的同陣營角色各計 1 件；3 件效果與 2 件效果疊加。'}</p></section>`:''}
    ${handIndex!==null?`<label class="target-select">優先目標<select id="play-target"><option value="">自動選擇</option>${game.units.filter(u=>u.hp>0&&!playError(game,game.active,handIndex,u.uid)).map(u=>`<option value="${u.uid}">${u.side===game.active?'友軍':'敵軍'} · ${esc(u.name)} (${u.hp} HP)</option>`).join('')}</select></label><p class="form-error">${esc(error)}</p><button class="primary-button" data-play="${handIndex}" ${error?'disabled':''}>${icon(c.type==='monster'?'swords':'sparkles')} ${c.type==='monster'?'召喚角色':c.type==='trap'?'設置陷阱':c.type==='fusion'?'融合召喚':'發動卡牌'}</button>`:
    `<button class="primary-button" data-add="${esc(c.id)}">${icon('plus')} 加入卡組</button><button class="quiet-button" data-template="${esc(c.id)}">${icon('hammer')} 以此為範本</button>${c.origin==='自訂'?`<button class="quiet-button" data-edit="${esc(c.id)}">${icon('hammer')} 編輯卡牌</button><button class="text-button danger" data-delete="${esc(c.id)}">${icon('trash-2')} 刪除自訂卡</button>`:''}`}
    ${c.evidence?`<section class="meaning-detail"><b>梗意設計 · ${esc(ARCHETYPES[c.archetype]?.name || '待設定')}</b>${c.sourceName&&c.sourceName!==c.name?`<p>原始名稱：<span data-original>${esc(c.sourceName)}</span></p>`:''}<p>依據${c.evidence.field==='name'?'名稱':'來源標籤'}：<span data-original>${esc(c.evidence.value)}</span></p><p>${esc(c.flavor)}</p>${c.languages?.length?`<p>來源語言：<span data-original>${c.languages.map(code=>esc(languageNames[code] || code)).join(' · ')}</span></p>`:''}</section>`:''}
    ${c.source?`<a class="source-link" href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">來源：${c.origin==='全球'?'templates.meme':'Imgflip'} ${icon('arrow-up-right')}</a>`:'<span class="source-link">玩家自訂作品</span>'}</div></div>`, 'card-modal');
  if(online||readOnly)for(const button of modal.querySelectorAll('[data-add],[data-template],[data-edit],[data-delete],[data-favorite]'))button.hidden=true;
}
function newDialog(showFields = false) {
  openDialog(`<div class="dialog-heading"><span class="eyebrow accent">NEXT MATCH</span><h2>${showFields?'選擇你的戰場':'建立新對決'}</h2></div><form id="match-form"><div class="match-options"><label>對手<select name="mode"><option value="ai" ${game.mode==='ai'?'selected':''}>網路混沌 AI</option><option value="local" ${game.mode==='local'?'selected':''}>同機雙人</option></select></label><label>勝利目標<select name="goal">${[['classic','生命決勝 · 20 LP'],['knockout','率先擊倒 5 名角色'],['sandbox','自由沙盒 · 無限能量']].map(([v,t])=>`<option value="${v}" ${game.goal===v?'selected':''}>${t}</option>`).join('')}</select></label></div><fieldset class="field-picker"><legend>場地</legend>${FIELDS.map((f,i)=>`<label class="field-option" style="--field:${f.color}"><input type="radio" name="field" value="${f.id}" ${game.field===f.id?'checked':''}><span class="field-art field-art-${f.id}"><span>0${i+1}</span>${icon(f.id==='fine'?'flame':f.id==='moon'?'sparkles':f.id==='xp'?'heart':'layers')}</span><b>${f.name}</b><small>${f.description}</small></label>`).join('')}</fieldset><p id="match-error" class="form-error" role="alert"></p><button class="primary-button" type="submit">${icon('swords')} 開始新對決 ${icon('arrow-right')}</button></form>`, 'match-modal');
}
function startClash() {
  if(online){if(canPlay())void onlineCommand('ready');return;}
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
  if(online) {
    if(replaying){replaying=false;game=online.game;}
    render();
    if(game.phase==='over')openDialog(`<div class="result-dialog">${icon('trophy')}<h2>${game.winner==='draw'?'勢均力敵':game.winner===online.side?'這局，你贏了！':'對手獲勝'}</h2><p>${game.round} 回合 · ${game.collisions} 次碰撞</p><button class="primary-button" data-action="finish-online">返回對戰</button></div>`,'small-modal');
    return;
  }
  if (advance) finishRound(game);
  if (game.phase === 'over' && !counted) {
    counted = true; const stats = { ...profile.stats, games: profile.stats.games + 1 };
    if (game.mode === 'ai') { if (game.winner === 0) stats.wins++; else if (game.winner === 1) stats.losses++; }
    persist({ ...profile, stats });
  }
  render();
  if (game.phase === 'over') openDialog(`<div class="result-dialog">${icon('trophy')}<span class="eyebrow accent">MATCH COMPLETE</span><h2>${game.winner==='draw'?'勢均力敵':game.winner===0?'這局，你贏了！':game.mode==='local'?'玩家 02 獲勝':'這次，網路贏了'}</h2><p>${game.round} 回合 · ${game.collisions} 次碰撞</p><button class="primary-button" data-action="new">再來一局 ${icon('arrow-right')}</button></div>`, 'small-modal');
}
function addToDeck(id) {
  if (!catalog.some(c=>c.id===id)) return toast('找不到卡牌');
  if (profile.deck.length>=30) return toast('卡組已滿：最多 30 張');
  if (profile.deck.filter(x=>x===id).length>=2) return toast('同一張卡最多放入 2 張');
  if (!persist({ ...profile, deck: [...profile.deck, id] })) return;
  modal.close(); render(); toast('已加入卡組，下場對決生效');
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
  if (refreshingCatalog) return;
  refreshingCatalog = true; button.disabled = true; button.setAttribute('aria-busy','true');
  try {
    const response = await fetch('https://api.imgflip.com/get_memes', { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('網路卡庫暫時無法連線');
    const data = await response.json();
    if (!data.success || !Array.isArray(data.data?.memes)) throw new Error('卡庫資料格式無效');
    const accepted = data.data.memes.filter(m=>templateCards([m]).length).map(({id,name,url})=>({id,name,url}));
    const before = catalog.length;
    const referenced = new Set([...profile.deck, ...profile.decks.flatMap(saved=>saved.deck), ...profile.favorites]);
    const existingIds = new Set(profile.web.map(m=>m.id));
    const templates = [...new Map([...profile.web,...accepted].map(m=>[m.id,m])).values()];
    const required = templates.filter(m=>existingIds.has(m.id)&&referenced.has(templateCards([m])[0]?.id));
    const requiredIds = new Set(required.map(m=>m.id));
    const recent = templates.filter(m=>!requiredIds.has(m.id));
    const web = [...required, ...recent.slice(Math.max(0,recent.length+required.length-1000))];
    if (!persist({ ...profile, web })) return;
    render(); toast(`已更新 ${accepted.length} 個模板，新增 ${catalog.length-before} 張卡牌`);
  } catch(e) { toast(`${e.message}，保留既有卡庫`); } finally {
    refreshingCatalog = false;
    const current = app.querySelector('[data-action="refresh"]') || button;
    current.disabled = false; current.setAttribute('aria-busy','false');
  }
}
function exportProfile(raw = JSON.stringify(profile,null,2), filename = 'meme-clash-deck.json') {
  const url = URL.createObjectURL(new Blob([raw], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
let importVersion = 0;
function importProfile() {
  const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const version = ++importVersion;
    try {
      if (file.size > 10_000_000) throw new Error('匯入檔案不得超過 10 MB');
      const raw = await file.text();
      if (version !== importVersion) return;
      const incoming = parseProfile(JSON.parse(raw));
      openDialog(`<div class="dialog-heading"><h2>匯入卡組</h2><p>${incoming.deck.length} 張卡組卡牌、${incoming.custom.length} 張自訂卡牌、${incoming.decks.length} 組已保存卡組。匯入後取代目前卡組、已保存卡組、自訂卡庫與收藏。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-import">${icon('upload')} 確認匯入</button></div>`, 'small-modal');
      $('#confirm-import').onclick = () => { if (!persist({ ...incoming, stats: recoveryRaw!==null?incoming.stats:profile.stats },true)) return; savedDeckId='';deckName='';modal.close();render();toast('卡組已匯入'); };
    } catch(e) { if (version === importVersion) toast(`匯入失敗：${e.message}`); }
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
  if (!button || modal.open || dragging || selected || game.phase==='battle' || button===hoverCard) return;
  hideHoverPreview();hoverCard=button;
  previewTimer=setTimeout(()=>{
    if (!button.isConnected || modal.open) return;
    const id=button.dataset.card || game.players[game.active].hand[Number(button.dataset.hand)];
    const card=displayCard(id);if(!card)return;
    hoverPreview.innerHTML=previewHTML(card);localize(hoverPreview);hoverPreview.hidden=false;
    const rect=button.getBoundingClientRect(),width=hoverPreview.offsetWidth,height=hoverPreview.offsetHeight;
    hoverPreview.style.left=`${Math.max(12,Math.min(innerWidth-width-12,rect.left))}px`;
    hoverPreview.style.top=`${Math.max(12,Math.min(innerHeight-height-12,rect.top>=height+16?rect.top-height-12:rect.bottom+12))}px`;
    button.setAttribute('aria-describedby',hoverPreview.id);stopHoverPreview=mountPreview(hoverPreview,card);
  },350);
}
document.addEventListener('error',e=>{
  if(!e.target.matches?.('img[data-card-art]'))return;
  const fallback=document.createElement('span');fallback.className='art-fallback';fallback.dataset.original='';fallback.setAttribute('role','img');fallback.setAttribute('aria-label',e.target.alt);fallback.textContent=e.target.alt.slice(0,2);e.target.replaceWith(fallback);
},true);
document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')queueHoverPreview(e.target.closest('.meme-card'));});
document.addEventListener('pointerout',e=>{if(hoverCard&&hoverCard.contains(e.target)&&!hoverCard.contains(e.relatedTarget))hideHoverPreview();});
document.addEventListener('focusin',e=>queueHoverPreview(e.target.closest('.meme-card')));
document.addEventListener('focusout',e=>{if(hoverCard?.contains(e.target))hideHoverPreview();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideHoverPreview();selected=null;paintSelection();}});
window.addEventListener('scroll',()=>{
  const target=hoverCard;hideHoverPreview();
  if(target?.isConnected&&target.matches(':hover,:focus'))queueHoverPreview(target);
},true);
window.addEventListener('resize',hideHoverPreview);
modal.addEventListener('close',()=>{
  if(modal.open)return;
  stopModalPreview?.();stopModalPreview=null;$('#modal-preview-stage')?.replaceChildren();
  const origin=dialogReturn;dialogReturn=null;
  if($('#interface-language',modal)){$('[data-action="appearance"]')?.focus();return;}
  if(!origin||origin.screen!==screen||app.contains(document.activeElement))return;
  const opener=origin.element;let target=opener.isConnected?opener:null;
  if(!target){
    const key=['card','action','nav','hand'].find(key=>opener.hasAttribute(`data-${key}`));
    if(opener.id)target=app.querySelector(`#${CSS.escape(opener.id)}`);
    else if(key)target=app.querySelector(`[data-${key}="${CSS.escape(opener.dataset[key])}"]`);
  }
  if(!target||target.disabled)target=opener.hasAttribute('data-card')?$('#favorites-only'):opener.closest('.saved-decks')?$('#saved-deck'):null;
  target?.focus();
});

function selectPiece(button) {
  clearTimeout(toastTimer);$('#toast').classList.remove('show');
  hideHoverPreview();
  selected=button.dataset.hand!==undefined?{index:Number(button.dataset.hand)}:{uid:button.dataset.unit};
  paintSelection();
}
function selectionIntent(zone) {
  if(!selected||!zone)return {error:'已取消'};
  if(selected.uid)return {error:zone.dataset.kind==='unit'&&Number(zone.dataset.side)===game.active?'':'只能調整自己的角色位置',slot:Number(zone.dataset.slot)};
  return dropIntent(game,selected.index,zone.dataset);
}
function paintSelection() {
  if(screen!=='battle'||!$('#card-inspector'))return;
  $('#card-inspector').innerHTML=inspectorHTML();localize($('#card-inspector'));drawIcons();
  $('#drop-status').textContent=selected?.index!==undefined?tr(playError(game,game.active,selected.index)):'';
  for(const button of app.querySelectorAll('[data-hand],[data-unit]')){
    const on=selected&&(selected.uid?button.dataset.unit===selected.uid:Number(button.dataset.hand)===selected.index&&button.hasAttribute('data-hand'));
    button.classList.toggle('is-selected',!!on);button.setAttribute('aria-pressed',String(!!on));
  }
  for(const zone of app.querySelectorAll('[data-drop]'))zone.classList.toggle('drop-valid',!!selected&&!selectionIntent(zone).error);
}
function playFromHand(index,targetId,slot) {
  if(online){if(canPlay()){modal.close();void onlineCommand('play',{index,targetId:targetId||undefined,slot});return true;}return false;}
  const result=playCard(game,game.active,index,targetId,slot);
  if(!result.ok){toast(result.error);return false;}
  modal.close();selected=null;sound();
  if(game.phase==='over')battleDone(false);else {
    render();
    const target=targetId?$(`[data-unit="${targetId}"]`):slot!==undefined?$(`.own-formation [data-slot="${slot}"]`):$('.own-formation');
    target?.classList.add('just-played');
  }
  return true;
}
function dropSelected(zone) {
  dragging=false;
  const intent=selectionIntent(zone);
  if(intent.error){if(zone)toast(intent.error);selected=null;paintSelection();return;}
  if(selected.uid){if(online){void onlineCommand('move',{uid:selected.uid,slot:intent.slot});return;}moveUnit(game,game.active,selected.uid,intent.slot);sound();render();}
  else playFromHand(selected.index,intent.targetId,intent.slot);
}
cancelDrag=bindDrag(app,{
  canStart:button=>screen==='battle'&&canPlay()&&!modal.open&&(button.hasAttribute('data-hand')||Number(button.dataset.side)===game.active),
  start:button=>{dragging=true;selectPiece(button);},
  over:zone=>{
    for(const current of app.querySelectorAll('.drop-hover'))current.classList.remove('drop-hover');
    const intent=selectionIntent(zone);if(!intent.error)zone.classList.add('drop-hover');
    $('#drop-status').textContent=zone?tr(intent.error||(selected.uid?'調整站位':isUnit(selectedCard())?'召喚角色':'發動卡牌')):'';
  },
  drop:zone=>{for(const current of app.querySelectorAll('.drop-hover'))current.classList.remove('drop-hover');$('#drop-status').textContent='';dropSelected(zone);},
  cancel:()=>{dragging=false;selected=null;paintSelection();if($('#drop-status'))$('#drop-status').textContent='';for(const current of app.querySelectorAll('.drop-hover'))current.classList.remove('drop-hover');}
});

document.addEventListener('click', e => {
  if(e.target.closest('a.brand')&&location.hash==='#battle'&&game.phase!=='battle'&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){screen='battle';render();return;}
  const button = e.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.preview) {
    const card=displayCard(button.dataset.preview);if(!card)return;stopModalPreview?.();
    const stage=$('#modal-preview-stage');stage.hidden=false;stage.innerHTML=previewHTML(card);localize(stage);
    stopModalPreview=mountPreview(stage,card);return;
  }
  if (button.dataset.nav) { screen=button.dataset.nav; render(); return; }
  if (button.dataset.hand!==undefined) {if(game.phase==='plan'&&!handoff)selectPiece(button);return;}
  if (button.hasAttribute('data-drop')) {
    if(game.phase!=='plan'||handoff)return;
    if(selected)return dropSelected(button);
    if(button.dataset.unit){if(Number(button.dataset.side)===game.active)selectPiece(button);else showCard(game.units.find(u=>u.uid===button.dataset.unit)?.id);}
    return;
  }
  if (button.dataset.discardCard) {
    const side=$('#discard-list').dataset.side,id=button.dataset.discardCard;
    showCard(id,null,true);
    $('.detail-body',modal).insertAdjacentHTML('afterbegin',`<button class="text-button" data-action="discard" data-side="${side}" data-focus-card="${esc(id)}">${icon('arrow-left')} 墓地</button>`);
    localize(modal);drawIcons();$('[data-focus-card]',modal).focus();return;
  }
  if (button.dataset.card) return showCard(button.dataset.card);
  if (button.dataset.play!==undefined) {
    playFromHand(Number(button.dataset.play),$('#play-target')?.value);return;
  }
  if (button.dataset.add) return addToDeck(button.dataset.add);
  if (button.dataset.favorite) {
    const id=button.dataset.favorite;if(!catalog.some(c=>c.id===id))return toast('找不到卡牌');
    const favorite=!profile.favorites.includes(id),favorites=favorite?[...profile.favorites,id]:profile.favorites.filter(value=>value!==id);
    if(!persist({...profile,favorites}))return;
    button.setAttribute('aria-pressed',String(favorite));const label=tr(favorite?'取消收藏':'收藏卡牌');button.setAttribute('aria-label',label);button.title=label;
    if(screen==='collection')render();return;
  }
  if (button.dataset.remove) {
    const at=profile.deck.indexOf(button.dataset.remove),focused=button===document.activeElement,row=[...app.querySelectorAll('[data-remove]')].indexOf(button);
    if(at>=0&&persist({...profile,deck:profile.deck.filter((_,i)=>i!==at)})){
      render();const rows=app.querySelectorAll('[data-remove]');if(focused)(rows[Math.min(row,rows.length-1)]||$('#deck-name')).focus();
    }
    return;
  }
  if (button.dataset.filter) { const focused=button===document.activeElement;filter=button.dataset.filter; visible=24; render();if(focused)$(`[data-filter="${filter}"]`).focus(); return; }
  if (button.dataset.edit) { const card=profile.custom.find(c=>c.id===button.dataset.edit);if(card)startCardDraft(card,true);return; }
  if (button.dataset.template) { const card=displayCard(button.dataset.template);if(!card)return toast('找不到卡牌');startCardDraft(card);return; }
  if (button.dataset.preset) { if(!persist({...profile,deck:[...PRESETS[button.dataset.preset].deck]}))return;savedDeckId='';deckName='';render();toast('已套用預設卡組');return; }
  if (button.dataset.delete) {
    const id=button.dataset.delete;
    openDialog(`<div class="dialog-heading"><h2>刪除這張自訂卡？</h2><p>也會從目前及所有已保存卡組移除這張卡，並取消收藏。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-delete">${icon('trash-2')} 刪除</button></div>`,'small-modal');
    $('#confirm-delete').onclick=()=>{if(!persist({...profile,custom:profile.custom.filter(c=>c.id!==id),deck:profile.deck.filter(x=>x!==id),decks:profile.decks.map(saved=>({...saved,deck:saved.deck.filter(x=>x!==id)})),favorites:profile.favorites.filter(x=>x!==id)}))return;modal.close();render();};return;
  }
  switch(button.dataset.action) {
    case 'discard':
      if(screen==='battle'&&!handoff&&game.phase!=='battle'&&(!online||online.status==='matched')){
        if(!modal.open)button.focus();
        discardDialog(button.dataset.side===undefined?game.active:Number(button.dataset.side),button.dataset.focusCard);
      }break;
    case 'save-deck': saveDeck();break;
    case 'rename-deck': {
      const saved=profile.decks.find(item=>item.id===savedDeckId);if(!saved)break;
      openDialog(`<div class="dialog-heading"><h2>重新命名卡組</h2></div><form id="rename-deck-form"><label>卡組名稱<input name="name" maxlength="48" value="${esc(saved.name)}" required></label><p class="form-error" id="rename-error" role="alert"></p><div class="dialog-actions"><button class="quiet-button" type="button" data-action="close">取消</button><button class="primary-button" type="submit">${icon('check')} 儲存修改</button></div></form>`,'small-modal');
      $('#rename-deck-form').onsubmit=e=>{
        e.preventDefault();const name=new FormData(e.currentTarget).get('name').trim();
        if(!name||name.length>48){$('#rename-error').textContent=tr('卡組名稱需為 1 至 48 字');return;}
        if(profile.decks.some(item=>item.id!==saved.id&&item.name===name)){$('#rename-error').textContent=tr('已有同名卡組');return;}
        if(!persist({...profile,decks:profile.decks.map(item=>item.id===saved.id?{...item,name}:item)}))return;
        deckName=name;modal.close();render();toast('卡組已重新命名');
      };break;
    }
    case 'delete-deck': {
      const saved=profile.decks.find(item=>item.id===savedDeckId);if(!saved)break;
      openDialog(`<div class="dialog-heading"><h2>刪除已保存卡組？</h2><p data-original>${esc(saved.name)}</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-delete-deck">${icon('trash-2')} 刪除</button></div>`,'small-modal');
      $('#confirm-delete-deck').onclick=()=>{if(!persist({...profile,decks:profile.decks.filter(item=>item.id!==saved.id)}))return;savedDeckId='';deckName='';modal.close();render();};break;
    }
    case 'matchmaking': matchmakingDialog();break;
    case 'leave-online':
      if(online.status!=='matched'||game.phase==='over'){void onlineCommand('leave');break;}
      openDialog(`<div class="dialog-heading"><h2>離開對局？</h2><p>離開會判負。</p></div><button class="quiet-button" data-action="close">取消</button><button class="primary-button" data-action="finish-online">確認離開</button>`,'small-modal');break;
    case 'finish-online': modal.close();replaying=false;void onlineCommand('leave');break;
    case 'inspect': {const c=selectedCard();if(c)showCard(c.id,selected?.uid?null:selected?.index??0);break;}
    case 'cancel-selection': selected=null;paintSelection();break;
    case 'appearance': appearanceDialog();break;
    case 'random-deck': {
      const next=randomWorldDeck(catalog);
      openDialog(`<div class="dialog-heading"><h2>全球隨機套裝</h2><p>${TAGS[next.tag].name} · 12 張全球角色 + 8 張支援卡</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-random">取代目前卡組</button></div>`,'small-modal');
      $('#confirm-random').onclick=()=>{if(!persist({...profile,deck:next.deck}))return;savedDeckId='';deckName='';modal.close();render();toast('已套用全球隨機套裝');};break;
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
    case 'sound': mute=!mute; sound(); button.innerHTML=icon(mute?'volume-x':'volume-2'); button.setAttribute('aria-label',tr(mute?'開啟音效':'關閉音效'));button.title=tr(mute?'開啟音效':'關閉音效');button.setAttribute('aria-pressed',String(!mute));drawIcons();break;
    case 'more': {const next=visible,focused=button===document.activeElement;visible+=24;render();if(focused)app.querySelectorAll('.catalog-grid [data-card]')[next]?.focus();break;}
    case 'refresh': void refreshCatalog(button);break;
    case 'export': exportProfile();break;
    case 'recovery': recoveryDialog();break;
    case 'export-recovery': if(recoveryRaw!==null)exportProfile(recoveryRaw,'meme-clash-recovery.json');break;
    case 'import': importProfile();break;
    case 'cancel-edit':
    case 'clear-draft':
      openDialog(`<div class="dialog-heading"><h2>清除這份草稿？</h2><p>此操作無法還原。</p></div><div class="dialog-actions"><button class="quiet-button" data-action="close">取消</button><button class="primary-button" id="confirm-clear-draft">${icon('trash-2')} 清除草稿</button></div>`,'small-modal');
      $('#confirm-clear-draft').onclick=clearCardDraft;break;
    case 'add-effect': if($('#effect-rows').children.length>=4) toast('最多 4 組效果');else {$('#effect-rows').insertAdjacentHTML('beforeend',effectRow());syncTriggers();syncEffectOrder();formBase=readCardForm($('#card-form'));storeCardDraft();localize($('#effect-rows'));drawIcons();}break;
    case 'remove-effect': {
      const row=button.closest('.effect-row'),next=row.nextElementSibling||row.previousElementSibling,focused=document.activeElement===button;
      row.remove();syncEffectOrder();formBase=readCardForm($('#card-form'));storeCardDraft();
      if(focused)(next?$('[data-action="remove-effect"]',next):$('[data-action="add-effect"]')).focus();break;
    }
    case 'effect-up': case 'effect-down': {
      const row=button.closest('.effect-row'),up=button.dataset.action==='effect-up',neighbor=up?row.previousElementSibling:row.nextElementSibling;
      if(!neighbor)break;
      if(up)neighbor.before(row);else neighbor.after(row);
      syncEffectOrder();formBase=readCardForm($('#card-form'));storeCardDraft();
      (button.disabled?$(`[data-action="${up?'effect-down':'effect-up'}"]`,row):button).focus();break;
    }
  }
});
function updateSearch(input) {
  const pos=input.selectionStart;query=input.value;visible=24;render();
  const next=$('#search');next.focus();try {next.setSelectionRange(pos,pos);} catch {}
}
document.addEventListener('compositionend',e=>{if(e.target.id==='search')updateSearch(e.target);});
document.addEventListener('input', e => {
  if(e.target.closest('#card-form')){formBase=readCardForm(e.target.form);storeCardDraft();}
  if(e.target.id==='deck-name')deckName=e.target.value;
  if(e.target.id==='search'&&!e.isComposing)updateSearch(e.target);
});
document.addEventListener('change', e=>{
  if(e.target.id==='saved-deck') {
    const saved=profile.decks.find(item=>item.id===e.target.value);
    if(!saved){savedDeckId='';render();$('#saved-deck').focus();return;}
    if(!persist({...profile,deck:[...saved.deck]})){e.target.value=savedDeckId;return;}
    savedDeckId=saved.id;deckName=saved.name;render();$('#saved-deck').focus();
  }
  if(e.target.id==='interface-language') {
    const saved=setLocale(e.target.value);regionNames=new Intl.DisplayNames([getLocale()],{type:'region'});
    render();appearanceDialog();$('#interface-language').focus();
    if(!saved)toast('語言已套用，但瀏覽器無法儲存設定');
  }
  if(e.target.name==='theme') {if(!applyTheme(e.target.value))toast('色系已套用，但瀏覽器無法儲存設定');render();}
  if(e.target.id==='origin-filter') {origin=e.target.value;visible=24;render();}
  if(e.target.id==='language-filter') {sourceLanguage=e.target.value;visible=24;render();}
  if(e.target.id==='country-filter') {sourceCountry=e.target.value;visible=24;render();}
  if(e.target.id==='ability-filter') {ability=e.target.value;visible=24;render();}
  if(e.target.id==='sort-order') {sortOrder=e.target.value;visible=24;render();}
  if(['origin-filter','language-filter','country-filter','ability-filter','sort-order'].includes(e.target.id))$(`#${e.target.id}`).focus();
  if(e.target.id==='favorites-only') {favoritesOnly=e.target.checked;visible=24;render();$('#favorites-only').focus();}
  if(e.target.name==='type') {syncTriggers();localize($('#effect-rows'));}
  if(e.target.closest('#card-form')){formBase=readCardForm(e.target.form);storeCardDraft();}
});
document.addEventListener('submit', e=>{
  if(e.target.id==='online-form') {
    e.preventDefault();const field=new FormData(e.target).get('field'),deck=profile.deck;
    const known=new Set(CATALOG.map(c=>c.id));
    online={status:'joining'};onlineBusy=true;counted=false;replayKey='';screen='battle';modal.close();render();
    void network.join({deck,field,custom:catalog.filter(c=>deck.includes(c.id)&&!known.has(c.id))}).catch(error=>{online=null;onlineBusy=false;render();toast(error.message);});return;
  }
  if(e.target.id==='match-form') {
    e.preventDefault(); const values=Object.fromEntries(new FormData(e.target));
    try { game=createGame({catalog,deck:profile.deck,...values});counted=false;handoff=false;screen='battle';modal.close();render(); } catch(error) {$('#match-error').textContent=tr(error.message);} return;
  }
  if(e.target.id==='card-form') {
    e.preventDefault();
    if(!editingId&&profile.custom.length>=1000){$('#form-error').textContent=tr('最多保存 1000 張自訂卡牌');return;}
    const data=readCardForm(e.target);
    data.effects.forEach(effect=>effect.amount=Number(effect.amount));
    try {
      const edited=!!editingId;
      if(edited&&!profile.custom.some(c=>c.id===editingId))throw new Error('找不到卡牌');
      const card=validateCustom(data);if(edited)card.id=editingId;
      const custom=edited?profile.custom.map(c=>c.id===editingId?card:c):[...profile.custom,card];
      if(!persist({...profile,custom}))return;
      editingId='';editSource='';formBase=null;const cleared=storeCardDraft();screen='collection';origin='自訂';filter='all';sourceLanguage='all';sourceCountry='all';ability='all';query='';render();toast(cleared?(edited?'卡牌已保存':`已鑄造「${card.name}」`):'卡牌已保存，但無法清除暫存草稿');
    } catch(error) {$('#form-error').textContent=tr(error.message);}
  }
});
modal.addEventListener('click',e=>{if(e.target===modal&&!handoff){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
modal.addEventListener('cancel',e=>{if(handoff)e.preventDefault();});
window.addEventListener('hashchange',()=>{if(location.hash==='#battle'&&game.phase!=='battle'){screen='battle';render();}});
render();
if(network.token){online={status:'joining'};render();void network.send('state');}
if(recoveryRaw!==null) recoveryDialog();else if(loaded.error) toast(loaded.error);
else if(loadedDraft.error)toast('無法讀取暫存草稿，原始資料已保留');
else if(loadedDraft.changed)toast('原卡牌已變更，草稿改為製作新卡');
else if(formBase)toast('已恢復卡牌草稿');
