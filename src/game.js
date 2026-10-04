import { CATALOG, DEFAULT_DECK, TAGS, FIELDS } from './catalog.js';

export const isUnit = c => c.type === 'monster' || c.type === 'fusion';
export function random(seed) {
  const rng = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Object.defineProperty(rng, 'state', { get: () => seed });
  return rng;
}
const shuffle = (cards, rng) => {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};
export function note(g, text, kind = 'normal') { g.log.unshift({ text, kind, round: g.round }); g.log.length = Math.min(g.log.length, 50); }
export function units(g, side) { return g.units.filter(u => u.side === side && u.hp > 0); }
export function combos(g, side, required = 2) {
  const count = {};
  for (const u of units(g, side)) count[u.tag] = (count[u.tag] || 0) + 1;
  return Object.keys(count).filter(tag => count[tag] >= required);
}
export function summon(g, card, side, slot) {
  slot ??= [0,1,2].find(n=>!units(g,side).some(u=>u.slot===n)) ?? 0;
  const unit = { ...structuredClone(card), uid: `u${g.nextId++}`, side, slot, maxHp: card.hp, shield: 0, dead: false, hitUsed: false };
  g.units.push(unit);
  return unit;
}
export function draw(g, side, count = 1) {
  const p = g.players[side];
  for (let i = 0; i < count && p.hand.length < 9; i++) {
    if (!p.deck.length) { p.deck = shuffle(p.discard, g.rng); p.discard = []; }
    const id = p.deck.shift();
    if (id) p.hand.push(id);
  }
}
export function createGame({ catalog = CATALOG, deck = DEFAULT_DECK, opponentDeck, field = 'grid', mode = 'ai', goal = 'classic', seed = Date.now() } = {}) {
  const cards = Object.fromEntries(catalog.map(c => [c.id, c]));
  const valid = deck.filter(id => cards[id]);
  if (valid.length < 10 || !valid.some(id => cards[id].type === 'monster')) throw new Error('卡組至少 10 張，且需包含角色卡');
  const opponent = opponentDeck || DEFAULT_DECK;
  if (opponentDeck && (opponent.length < 10 || opponent.some(id=>!cards[id]) || !opponent.some(id=>cards[id].type==='monster'))) throw new Error('對手卡組無效');
  const g = { cards, rng: random(seed), seed, field: FIELDS.some(f => f.id === field) ? field : 'grid', mode, goal,
    round: 1, phase: 'plan', active: 0, nextId: 1, units: [], log: [], winner: null, collisions: 0,
    players: [0, 1].map(side => ({ name: side ? (mode === 'ai' ? '網路混沌 AI' : '玩家 02') : '玩家 01', hp: 20, energy: 3, deck: [], hand: [], discard: [], traps: [], ready: false, ko: 0 })) };
  for (let side = 0; side < 2; side++) {
    const p = g.players[side];
    p.deck = shuffle((mode === 'ai' || mode === 'online') && side ? opponent : valid, g.rng);
    const first = p.deck.findIndex(id => cards[id]?.type === 'monster');
    if (first >= 0) summon(g, cards[p.deck.splice(first, 1)[0]], side);
    draw(g, side, 5);
  }
  note(g, '第 1 回合：部署開始');
  return g;
}
export function randomWorldDeck(catalog = CATALOG, seed = Date.now()) {
  const rng = random(seed), tags = Object.keys(TAGS);
  const tag = tags[Math.floor(rng()*tags.length)];
  const pool = catalog.filter(c=>c.origin==='全球'&&c.type==='monster'&&c.tag===tag).map(c=>c.id);
  if (pool.length < 12) throw new Error('全球卡庫尚未備妥');
  return { tag, deck:[...shuffle(pool,rng).slice(0,12),'tape','imagination','stonks','handshake','reverse','safe','suit','fusion'] };
}
export function createDailyGame(catalog = CATALOG, date = new Date().toISOString().slice(0,10)) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('挑戰日期無效');
  const seed = Number(date.replaceAll('-',''));
  const game = createGame({ catalog, deck:randomWorldDeck(catalog,seed).deck, opponentDeck:randomWorldDeck(catalog,seed+1).deck,
    field:FIELDS[seed%FIELDS.length].id, seed, mode:'ai', goal:'classic' });
  game.challenge = date;
  return game;
}
export function fusionPair(g, side) {
  const alive = units(g, side);
  return alive.flatMap((a, i) => alive.slice(i + 1).filter(b => b.tag === a.tag).map(b => [a, b]))[0];
}
export function playError(g, side, index, targetId, slot) {
  const p = g.players[side], card = g.cards[p?.hand[index]];
  if (g.phase !== 'plan' || p?.ready || g.active !== side) return '現在不是你的部署階段';
  if (!card) return '找不到卡牌';
  if (g.goal !== 'sandbox' && card.cost > p.energy) return '能量不足';
  if (card.type === 'monster' && units(g, side).length >= 3) return '場上最多 3 名角色';
  if (card.type === 'fusion' && !fusionPair(g, side)) return '需要兩名同陣營角色作為融合素材';
  if (card.type === 'trap' && p.traps.length >= 2) return '最多設置 2 張陷阱';
  if (card.type === 'equip' && !units(g, side).length) return '先召喚一名角色';
  if (targetId && !g.units.some(u => u.uid === targetId && u.hp > 0)) return '目標已離場';
  if (targetId && !isUnit(card)) {
    const target = g.units.find(u => u.uid === targetId);
    const aimed = card.effects.filter(e => e.trigger === 'play' && !['draw','energy'].includes(e.action) && ['ally','enemy','self'].includes(e.target));
    if (card.type === 'equip' && target.side !== side || aimed.length && !aimed.some(e => target.side === (e.target === 'enemy' ? 1-side : side))) return '這張卡不能指定這個目標';
  }
  if (slot !== undefined && isUnit(card)) {
    const materials = card.type==='fusion' ? fusionPair(g,side) : [];
    if (!Number.isInteger(slot) || slot<0 || slot>2) return '位置無效';
    if (units(g,side).some(u=>u.slot===slot&&!materials.includes(u))) return '這個位置已有角色';
  }
  return '';
}
export function moveUnit(g, side, uid, slot) {
  const unit=units(g,side).find(u=>u.uid===uid);
  if(g.phase!=='plan'||g.active!==side||g.players[side].ready||!unit||!Number.isInteger(slot)||slot<0||slot>2)return false;
  const other=units(g,side).find(u=>u.slot===slot);
  if(other)other.slot=unit.slot;
  unit.slot=slot;return true;
}
function targets(g, side, target, source, targetId) {
  const friends = units(g, side), enemies = units(g, 1 - side);
  const pick = list => [list.find(u => u.uid === targetId) || list[0]].filter(Boolean);
  if (target === 'self') return source ? (source.hp > 0 && !source.dead ? [source] : []) : pick(friends);
  if (target === 'allies') return friends;
  if (target === 'enemies') return enemies;
  return pick(target === 'enemy' ? enemies : friends);
}
export function damage(g, unit, amount) {
  if (!unit || unit.dead || unit.hp <= 0) return;
  const absorbed = Math.min(unit.shield, amount);
  unit.shield -= absorbed;
  unit.hp = Math.max(0, unit.hp - amount + absorbed);
}
export function effects(g, card, side, trigger, source, targetId) {
  for (const e of card.effects.filter(e => e.trigger === trigger)) {
    const recipient = e.target === 'enemy' || e.target === 'enemies' ? 1 - side : side;
    if (e.action === 'draw') { draw(g, recipient, Math.min(e.amount, 9)); continue; }
    if (e.action === 'energy') { g.players[recipient].energy = Math.min(99, g.players[recipient].energy + e.amount); continue; }
    for (const u of targets(g, side, e.target, source, targetId)) {
      if (e.action === 'damage') damage(g, u, e.amount);
      if (e.action === 'heal') u.hp = Math.min(u.maxHp, u.hp + e.amount);
      if (e.action === 'shield') u.shield = Math.min(999, u.shield + e.amount);
      if (e.action === 'buff') u.attack = Math.min(999, u.attack + e.amount);
    }
  }
}
export function cleanup(g) {
  // Mark before resolving death effects so chained knockouts cannot retrigger themselves.
  let fallen;
  while ((fallen = g.units.find(u => u.hp <= 0 && !u.dead))) {
    fallen.dead = true;
    g.players[1 - fallen.side].ko++;
    g.players[fallen.side].hp = Math.max(0, g.players[fallen.side].hp - 2);
    g.players[fallen.side].discard.push(fallen.id);
    note(g, `${fallen.name} 被擊倒`, 'ko');
    effects(g, fallen, fallen.side, 'death', fallen);
  }
}
export function checkWinner(g) {
  if (g.goal === 'sandbox') return;
  const won = g.players.map((p, i) => g.goal === 'knockout' ? p.ko >= 5 : g.players[1 - i].hp <= 0);
  if (won.some(Boolean)) { g.winner = won.every(Boolean) ? 'draw' : won[0] ? 0 : 1; g.phase = 'over'; }
}
export function playCard(g, side, index, targetId, slot) {
  const error = playError(g, side, index, targetId, slot);
  if (error) return { ok: false, error };
  const p = g.players[side], card = g.cards[p.hand[index]];
  const before = combos(g, side);
  const fullBefore = combos(g, side, 3);
  p.hand.splice(index, 1);
  if (g.goal !== 'sandbox') p.energy -= card.cost;
  let source;
  if (card.type === 'fusion') {
    const pair = fusionPair(g, side);
    for (const u of pair) { g.units.splice(g.units.indexOf(u), 1); p.discard.push(u.id); }
    source = summon(g, { ...card, tag: pair[0].tag, attack: Math.min(999, card.attack + Math.floor((pair[0].attack + pair[1].attack) / 2)) }, side, slot);
    note(g, `${pair.map(u => u.name).join(' + ')} → ${card.name}`, 'combo');
  } else if (card.type === 'monster') source = summon(g, card, side, slot);
  else if (card.type === 'trap') p.traps.push(card.id);
  else {
    if (card.type === 'field') g.field = card.field;
    p.discard.push(card.id);
  }
  if (card.type !== 'trap') effects(g, card, side, 'play', source, targetId);
  note(g, `${p.name} ${card.type === 'trap' ? '設置陷阱' : `打出 ${card.name}`}`, card.type === 'fusion' ? 'combo' : 'normal');
  cleanup(g);
  for (const tag of combos(g, side).filter(t => !before.includes(t))) note(g, `${TAGS[tag].name}連攜啟動：${TAGS[tag].bonus}`, 'combo');
  for (const tag of combos(g, side, 3).filter(t => !fullBefore.includes(t))) note(g, `${TAGS[tag].set} 3 件套啟動：${TAGS[tag].fullBonus}`, 'combo');
  checkWinner(g);
  return { ok: true };
}
export function collide(g, a, b) {
  if (g.phase === 'over' || a.side === b.side || a.hp <= 0 || b.hp <= 0) return;
  g.collisions++;
  for (const [u, enemy] of [[a, b], [b, a]]) {
    const p = g.players[u.side];
    for (const id of p.traps.splice(0)) {
      const card = g.cards[id];
      effects(g, card, u.side, 'hit', u, enemy.uid);
      p.discard.push(id);
      note(g, `陷阱連鎖：${card.name}`, 'combo');
    }
    if (u.hp > 0 && !u.hitUsed) {
      u.hitUsed = true; effects(g, u, u.side, 'hit', u, enemy.uid);
      if (u.hp > 0 && combos(g, u.side, 3).includes('bonk')) {
        damage(g, enemy, 3);
        note(g, `${TAGS.bonk.set}：${u.name} 追加 3 傷害`, 'combo');
      }
    }
  }
  if (a.hp > 0 && b.hp > 0) {
    const power = u => u.attack + combos(g, u.side).filter(t => t === 'bonk' || t === 'chaos').length + (combos(g, u.side, 3).includes('chaos') ? 2 : 0);
    const pa = power(a), pb = power(b);
    damage(g, a, pb); damage(g, b, pa);
  }
  cleanup(g);checkWinner(g);
}
export function planAI(g) {
  const side = 1, p = g.players[side];
  g.active = side;
  for (let step = 0; step < 12 && g.phase === 'plan'; step++) {
    const options = p.hand.map((id, index) => ({ card: g.cards[id], index }))
      .filter(o => !playError(g, side, o.index))
      .sort((a, b) => (isUnit(b.card) ? 10 : 0) - (isUnit(a.card) ? 10 : 0) || b.card.cost - a.card.cost);
    if (!options.length) break;
    playCard(g, side, options[0].index);
  }
  p.ready = true;
  g.active = 0;
}
export function finishRound(g) {
  if (g.phase === 'over') return;
  cleanup(g);
  for (let side = 0; side < 2; side++) {
    if (!units(g, side).length) {
      const loss = units(g, 1 - side).length ? 3 : 1;
      g.players[side].hp = Math.max(0, g.players[side].hp - loss);
      note(g, `${g.players[side].name} 防線失守，生命 -${loss}`);
    }
    if (g.round >= 10) g.players[side].hp = Math.max(0, g.players[side].hp - 2);
  }
  checkWinner(g);
  if (g.phase === 'over') return;
  g.round++;
  g.phase = 'plan'; g.active = 0;
  g.units = g.units.filter(u => !u.dead);
  for (let side = 0; side < 2; side++) {
    const p = g.players[side], active = combos(g, side), full = combos(g, side, 3);
    p.ready = false;
    p.energy = Math.min(8, 2 + g.round) + Number(active.includes('stonks')) + Number(full.includes('stonks'));
    draw(g, side, 1 + Number(active.includes('brain')) + Number(full.includes('brain')));
  }
  for (let side = 0; side < 2; side++) {
    for (const u of units(g, side)) {
      if (u.hp <= 0 || u.dead) continue;
      const active = combos(g, side), full = combos(g, side, 3);
      u.hitUsed = false;
      if (active.includes('wholesome')) u.hp = Math.min(u.maxHp, u.hp + 2 + (full.includes('wholesome') ? 3 : 0));
      if (active.includes('glitch')) u.shield = Math.min(999, u.shield + 2 + (full.includes('glitch') ? 3 : 0));
      if (g.field === 'backrooms') u.shield = Math.min(999, u.shield + 1);
      if (g.field === 'xp') u.hp = Math.min(u.maxHp, u.hp + 2);
      effects(g, u, side, 'round', u);
      if (g.field === 'fine' && u.tag !== 'chaos') damage(g, u, 1);
    }
  }
  cleanup(g); checkWinner(g);
  note(g, `第 ${g.round} 回合：部署開始`);
}
