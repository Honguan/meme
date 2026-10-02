import snapshot from './data/memes.json' with { type: 'json' };

export const TYPES = { monster: '角色', spell: '魔法', trap: '陷阱', equip: '裝備', field: '場地', fusion: '融合' };
export const TAGS = {
  chaos: { name: '混沌', color: '#fb8aac', bonus: '碰撞傷害 +1', set: '一切都很好', fullBonus: '碰撞傷害再 +2' },
  wholesome: { name: '療癒', color: '#76dec5', bonus: '每輪全隊回復 2', set: '笑著撐下去', fullBonus: '每輪全隊再回復 3' },
  brain: { name: '腦洞', color: '#d4f75b', bonus: '每輪多抽 1 張', set: '宇宙大腦', fullBonus: '每輪再多抽 1 張（手牌上限 9）' },
  stonks: { name: '財富', color: '#ffd278', bonus: '每輪能量 +1', set: '一起上月球', fullBonus: '每輪能量再 +1' },
  bonk: { name: '暴擊', color: '#8fc9f9', bonus: '全隊碰撞傷害 +1', set: '全員 BONK', fullBonus: '每名角色每輪首次碰撞，對碰撞目標額外造成 3 傷害' },
  glitch: { name: '錯亂', color: '#c3aaff', bonus: '每輪護盾 +2', set: '現實出錯了', fullBonus: '每輪全隊護盾再 +3' },
};
export const FIELDS = [
  { id: 'grid', name: '網路競技場', subtitle: 'THE ORIGINAL', description: '標準碰撞規則。', color: '#d4f75b', image: 'https://i.imgflip.com/28j0te.jpg' },
  { id: 'fine', name: 'This Is Fine', subtitle: 'EVERYTHING IS FINE', description: '每輪開始：非混沌角色受到 1 點傷害。', color: '#ff9473', image: 'https://i.imgflip.com/wxica.jpg' },
  { id: 'moon', name: 'To The Moon', subtitle: 'ZERO GRAVITY', description: '所有角色碰撞速度提升 35%。', color: '#8fc9f9', image: 'https://i.imgflip.com/46e43q.png' },
  { id: 'backrooms', name: '無限後室', subtitle: 'LEVEL 0', description: '每輪開始：全體角色護盾 +1。', color: '#ead489', image: 'https://i.imgflip.com/2fm6x.jpg' },
  { id: 'xp', name: '療癒大草原', subtitle: 'TOUCH GRASS', description: '每輪開始：全體角色回復 2 點生命。', color: '#76dec5', image: 'https://i.imgflip.com/gk5el.jpg' },
];
export const ACTIONS = { damage: '造成傷害', heal: '回復生命', shield: '獲得護盾', buff: '增加攻擊', draw: '抽牌', energy: '獲得能量' };
export const TARGETS = { ally: '一名友軍', allies: '全體友軍', enemy: '一名敵軍', enemies: '全體敵軍', self: '自己' };
export const TRIGGERS = { play: '打出時', hit: '首次碰撞時', round: '每輪開始時', death: '被擊倒時' };
const fx = (action, amount, target = 'self', trigger = 'play') => ({ action, amount, target, trigger });
const art = (file) => `https://i.imgflip.com/${file}`;
const curated = [
  ['doge', 'Doge', 'much wow. very bonk.', 'monster', 'bonk', 2, 4, 12, '43a45p.png', [fx('buff', 1, 'self', 'hit')]],
  ['harold', 'Harold', '笑著，撐過這一回合。', 'monster', 'wholesome', 2, 2, 16, 'gk5el.jpg', [fx('heal', 2, 'self', 'round')]],
  ['girl', '災難女孩', '有些人，只想看場地燃燒。', 'monster', 'chaos', 3, 4, 12, '23ls.jpg', [fx('damage', 2, 'enemies', 'death')]],
  ['drake', 'Drake', '這個不要。這個可以。', 'monster', 'stonks', 2, 3, 12, '30b1gx.jpg', [fx('energy', 1)]],
  ['cat', '不服的貓', '你說你的，我打我的。', 'monster', 'bonk', 2, 4, 10, '345v97.jpg', [fx('shield', 2, 'self', 'hit')]],
  ['brain', '宇宙大腦', '你的下一步，我已經做完了。', 'monster', 'brain', 3, 3, 13, '1jwhww.jpg', [fx('draw', 1)]],
  ['sponge', '嘲諷海綿', '你 的 傷 害 也 就 這 樣。', 'monster', 'glitch', 2, 3, 11, '1otk96.jpg', [fx('shield', 2, 'self', 'round')]],
  ['monkey', '眼神飄移', '看不到我，看不到我。', 'monster', 'glitch', 1, 2, 8, '2gnnjh.jpg', [fx('shield', 3)]],
  ['kermit', '邪惡的我', '再打一次，就一次。', 'monster', 'chaos', 2, 3, 11, '1e7ql7.jpg', [fx('damage', 2, 'enemy', 'hit')]],
  ['leo', '乾杯 Leo', '這一杯，敬你的連攜。', 'monster', 'stonks', 2, 3, 12, '39t1o.jpg', [fx('energy', 1, 'self', 'round')]],
  ['imagination', '想像力', '規則之外，還有更多可能。', 'spell', 'brain', 1, 0, 0, '3i7p.jpg', [fx('draw', 2)]],
  ['bonk', 'BONK!', '回去，現在。', 'spell', 'bonk', 2, 0, 0, '9ehk.jpg', [fx('damage', 5, 'enemy')]],
  ['tape', '萬用膠帶', '裂了？貼起來就好了。', 'spell', 'wholesome', 1, 0, 0, '2reqtg.png', [fx('heal', 5, 'allies')]],
  ['stonks', '交易提案', '我拿能量，你拿勝利。', 'spell', 'stonks', 0, 0, 0, '54hjww.jpg', [fx('energy', 2)]],
  ['handshake', '史詩握手', '兩個梗，一個夢。', 'spell', 'bonk', 2, 0, 0, '28j0te.jpg', [fx('buff', 2, 'allies')]],
  ['reverse', 'UNO 逆轉', '你的攻擊，我收到了。', 'trap', 'glitch', 1, 0, 0, '3lmzyx.jpg', [fx('damage', 5, 'enemy', 'hit')]],
  ['pikachu', '驚訝皮卡丘', '竟然真的打過來了。', 'trap', 'chaos', 1, 0, 0, '2kbn1e.jpg', [fx('damage', 3, 'enemies', 'hit')]],
  ['safe', '安全下莊', '這回合，誰都別想帶走我。', 'trap', 'wholesome', 1, 0, 0, '2odckz.jpg', [fx('shield', 5, 'allies', 'hit')]],
  ['suit', '紳士套裝', '優雅，而且有點痛。', 'equip', 'stonks', 1, 0, 0, '2ybua0.png', [fx('buff', 2, 'ally'), fx('shield', 2, 'ally')]],
  ['mind', 'Change My Mind', '改變主意？先打穿這面盾。', 'equip', 'brain', 1, 0, 0, '24y43o.jpg', [fx('shield', 6, 'ally')]],
  ['fine', 'This Is Fine', '一切都很好。真的。', 'field', 'chaos', 1, 0, 0, 'wxica.jpg', []],
  ['moon', '一直都在月球', 'Always has been.', 'field', 'stonks', 1, 0, 0, '46e43q.png', []],
  ['fusion', '究極迷因體', '兩名同陣營角色，融合升級。', 'fusion', 'brain', 3, 7, 22, '33e92f.jpg', [fx('shield', 4)]],
];
export const CORE = curated.map(([id, name, flavor, type, tag, cost, attack, hp, file, effects]) => ({
  id, name, flavor, type, tag, cost, attack, hp, speed: 5, image: art(file), effects,
  source: 'https://imgflip.com/memetemplates', origin: '精選', ...(type === 'field' ? { field: id } : {}),
}));
export function templateCards(memes) {
  const tags = Object.keys(TAGS);
  return memes.filter(m => m && typeof m.id === 'string' && typeof m.name === 'string' && safeImage(m.url)).map((m) => {
    const seed = [...m.id].reduce((n, char) => n + char.charCodeAt(0), 0);
    const tag = tags[seed % tags.length];
    const effects = {
      chaos: [fx('damage', 2, 'enemy', 'hit')], wholesome: [fx('heal', 2, 'self', 'round')],
      brain: [fx('draw', 1)], stonks: [fx('energy', 1)],
      bonk: [fx('buff', 1, 'self', 'hit')], glitch: [fx('shield', 3)],
    };
    return { id: `web-${m.id}`, name: m.name.slice(0, 72), type: 'monster', tag, cost: 1 + seed % 3,
      attack: 2 + seed % 4, hp: 8 + seed % 8, speed: 4 + seed % 3, effects: effects[tag], image: m.url,
      flavor: '來自網路的另一種可能。', source: `https://imgflip.com/memetemplate/${encodeURIComponent(m.id)}`, origin: '網路' };
  });
}
export const CATALOG = [...CORE, ...templateCards(snapshot.memes)];
export const DEFAULT_DECK = ['doge', 'harold', 'drake', 'cat', 'girl', 'brain', 'sponge', 'kermit', 'leo', 'monkey', 'bonk', 'tape', 'imagination', 'stonks', 'handshake', 'reverse', 'safe', 'suit', 'mind', 'fusion'];
export const PRESETS = {
  starter: { name: '網路原住民', deck: DEFAULT_DECK },
  chaos: { name: '混沌燃燒流', deck: ['girl','girl','kermit','kermit','doge','cat','sponge','monkey','pikachu','pikachu','bonk','bonk','fine','fine','stonks','handshake','fusion','tape','reverse','imagination'] },
  wholesome: { name: '不死療癒流', deck: ['harold','harold','cat','cat','drake','leo','brain','brain','tape','tape','safe','safe','mind','mind','suit','reverse','handshake','fusion','stonks','imagination'] },
};

export function safeImage(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
export function effectText(card) {
  if (card.type === 'field') return FIELDS.find(f => f.id === card.field)?.description ?? '';
  return card.effects.map(e => `${TRIGGERS[e.trigger]}：${TARGETS[e.target]}${ACTIONS[e.action]} ${e.amount}`).join('；');
}
export function validateCustom(input) {
  if (!input || typeof input !== 'object' || !Object.hasOwn(TYPES, input.type) || !Object.hasOwn(TAGS, input.tag)) throw new Error('卡牌類型或陣營無效');
  const name = String(input.name ?? '').trim();
  if (!name || name.length > 72) throw new Error('名稱需為 1 至 72 字');
  const number = (key, min, max) => {
    const n = Number(input[key]);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${key} 需為 ${min} 至 ${max} 的整數`);
    return n;
  };
  if (input.image && !safeImage(input.image)) throw new Error('圖片必須是 HTTPS 網址');
  if (!Array.isArray(input.effects) || input.effects.length > 4) throw new Error('每張卡最多 4 組效果');
  const effects = input.effects.map(e => {
    if (!e || !Object.hasOwn(ACTIONS, e.action) || !Object.hasOwn(TARGETS, e.target) || !Object.hasOwn(TRIGGERS, e.trigger) || !Number.isInteger(e.amount) || e.amount < 1 || e.amount > 99) throw new Error('效果格式無效');
    if (!['monster', 'fusion'].includes(input.type) && e.trigger !== (input.type === 'trap' ? 'hit' : 'play')) throw new Error('此卡牌的觸發時機無效');
    return { action: e.action, target: e.target, trigger: e.trigger, amount: e.amount };
  });
  if (input.type === 'field' && !FIELDS.some(f => f.id === input.field)) throw new Error('請選擇場地規則');
  return { id: `custom-${globalThis.crypto.randomUUID()}`, name, type: input.type, tag: input.tag,
    cost: number('cost', 0, 9), attack: number('attack', 0, 99), hp: number('hp', 1, 999), speed: number('speed', 1, 12),
    image: input.image || '', flavor: String(input.flavor ?? '').slice(0, 160), effects, origin: '自訂',
    ...(input.type === 'field' ? { field: input.field } : {}) };
}
