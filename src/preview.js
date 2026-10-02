import { CORE, DEFAULT_DECK } from './catalog.js';
import { createGame, summon, playCard, finishRound, damage, cleanup } from './game.js';
import { Arena } from './arena.js';
import { tr } from './i18n.js';

export function previewGame(card) {
  const catalog = [...CORE.filter(c => c.id !== card.id), card];
  const game = createGame({ catalog, deck: DEFAULT_DECK, goal: 'sandbox', seed: 7 });
  game.units = [];
  for (const p of game.players) { p.hand = []; p.traps = []; }
  const support = { ...CORE.find(c => c.id === 'harold'), tag: card.tag, effects: [], attack: 1, hp: 30, name: tr('演示友軍') };
  const friend = summon(game, support, 0); friend.hp = 15;
  if (card.type === 'fusion') summon(game, support, 0);
  summon(game, { ...support, attack: 5, hp: 35, name: tr('演示敵軍') }, 1);
  summon(game, { ...support, attack: 3, hp: 35, name: tr('演示敵軍 2') }, 1);
  game.players[0].hand = [card.id];
  return game;
}

export function mountPreview(container, card) {
  const game = previewGame(card), canvas = container.querySelector('canvas'), status = container.querySelector('[data-preview-status]');
  let arena, disposed = false;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms); timers.add(id); };
  const show = label => { status.textContent = `${tr(label)} · ${tr('能量')} ${game.players[0].energy} · ${tr('手牌')} ${game.players[0].hand.length}`; };
  const resolve = (action, label) => {
    const before = new Map(game.units.map(u => [u.uid, { hp:u.hp, shield:u.shield, dead:u.dead }]));
    action();
    const changes = game.units.flatMap(u => {
      const prev = before.get(u.uid) || { hp:u.maxHp, shield:0, dead:false };
      if (u.hp === prev.hp && u.shield === prev.shield && u.dead === prev.dead) return [];
      return [{ uid:u.uid, name:u.name, tag:u.tag, side:u.side, x:u.side?865:235, y:235,
        hp:u.hp-prev.hp, shield:u.shield-prev.shield, ko:!prev.dead&&u.dead }];
    });
    const source = game.units.find(u=>u.side===0&&u.id===card.id) || game.units.find(u=>u.side===0);
    const enemy = game.units.find(u=>u.side===1);
    arena.presentImpact(550,235,source || card,enemy || card,{changes,traps:[]}); show(label);
  };
  const afterBattle = () => {
    arena.destroy();
    arena = new Arena(canvas, game, () => {}, () => {});
    resolve(() => finishRound(game), '每輪效果');
    const source = game.units.find(u=>u.side===0&&u.id===card.id&&!u.dead);
    if (source && card.effects.some(e=>e.trigger==='death')) later(() => {
      resolve(() => { damage(game,source,source.hp+source.shield);cleanup(game); }, '離場效果');
    },1100);
    later(() => show('演示完成'),2300);
  };
  arena = new Arena(canvas, game, afterBattle, () => show('碰撞效果'));
  show('效果演示');
  later(() => {
    const enemyTarget = card.effects.some(e=>e.target==='enemy'||e.target==='enemies');
    const target = game.units.find(u=>u.side===(enemyTarget?1:0));
    resolve(() => playCard(game,0,0,target.uid), '登場效果');
    later(() => { game.phase='battle';show('碰撞效果');arena.start(); },1100);
  },350);
  return () => { disposed=true;for(const id of timers)clearTimeout(id);timers.clear();arena.destroy(); };
}
