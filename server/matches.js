import { CATALOG, FIELDS, validateCustom } from '../src/catalog.js';
import { createGame, random, playCard, moveUnit, finishRound, note } from '../src/game.js';
import { createBattle } from '../src/physics.js';

const cards = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const known = id => Object.hasOwn(cards, id);
const QUEUE_TTL = 20000, OFFLINE_TTL = 45000, TURN_TTL = 90000, MATCH_TTL = 7200000;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const pack = g => ({ ...g, cards: undefined, rng: undefined, rngState: g.rng.state });
const unpack = room => ({ ...room.game, cards: { ...cards, ...room.custom }, rng: random(room.game.rngState) });
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);

export function loadout(input) {
  if (!input || !Array.isArray(input.deck) || input.deck.length < 10 || input.deck.length > 30) fail('卡組需為 10 至 30 張');
  if (!Array.isArray(input.custom) || input.custom.length > 30) fail('自訂卡格式無效');
  const custom = Object.create(null);
  for (const card of input.custom) {
    if (typeof card?.id !== 'string' || !/^[\w-]{1,100}$/.test(card.id) || known(card.id) || custom[card.id]) fail('自訂卡識別碼無效');
    try { custom[card.id] = { ...validateCustom(card), id: card.id }; } catch (error) { fail(error.message); }
  }
  const counts = Object.create(null);
  for (const id of input.deck) {
    if (typeof id !== 'string' || !(known(id) || custom[id])) fail('卡組含有未知卡牌');
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > 2) fail('同一張卡最多放入 2 張');
  }
  if (!input.deck.some(id => (known(id) ? cards[id] : custom[id]).type === 'monster')) fail('卡組需包含角色卡');
  return { deck: input.deck, custom, field: FIELDS.some(f => f.id === input.field) ? input.field : 'grid' };
}

export function makeRoom(first, second, now) {
  const custom = {}, decks = [first, second].map((p, side) => p.deck.map(id => {
    if (known(id)) return id;
    const key = `online-${side}-${id}`;
    custom[key] = { ...p.custom[id], id: key };
    return key;
  }));
  const g = createGame({ catalog: [...CATALOG, ...Object.values(custom)], deck: decks[0], opponentDeck: decks[1],
    mode: 'online', field: first.field, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
  return { game: pack(g), custom, deadline: now + TURN_TTL, replay: null, battleUntil: 0 };
}

function simulate(g) {
  const replay = { round: g.round, field: g.field, units: structuredClone(g.units), energy: g.players.map(p=>p.energy), frames: [] };
  let hits = [];
  const battle = createBattle(g, (x, y, a, b, report) => hits.push({ x, y, a: a.uid, b: b.uid, report }));
  for (let tick = 1; tick <= 300; tick++) {
    const done = battle.step();
    if (tick % 3 === 0 || hits.length || done) {
      replay.frames.push({ at: tick * 1000 / 60, positions: [...battle.bodies].map(([id, b]) => [id, b.position.x, b.position.y]),
        units: g.units.map(u => [u.uid, u.hp, u.shield, u.dead, u.attack]), hp: g.players.map(p => p.hp),
        collisions: g.collisions, log: structuredClone(g.log.slice(0, 6)), hits });
      hits = [];
    }
    if (done) break;
  }
  battle.dispose();
  replay.duration = replay.frames.at(-1).at + 850;
  return replay;
}

export function command(room, side, input, now) {
  const g = unpack(room);
  if (input.action === 'leave') {
    if (g.phase !== 'over') { g.phase = 'over'; g.winner = 1 - side; note(g, '對手已離開'); }
  } else {
    if (now < room.battleUntil || g.phase !== 'plan' || g.active !== side || g.players[side].ready) fail('現在不是你的部署階段', 409);
    if (input.action === 'play') {
      if (!Number.isInteger(input.index) || input.index < 0 || input.index > 8 || (input.targetId !== undefined && typeof input.targetId !== 'string')) fail('出牌資料無效');
      const result = playCard(g, side, input.index, input.targetId, input.slot);
      if (!result.ok) fail(result.error);
    } else if (input.action === 'move') {
      if (!moveUnit(g, side, input.uid, input.slot)) fail('位置無效');
    } else if (input.action === 'ready') {
      g.players[side].ready = true;
      if (!g.players[1 - side].ready) g.active = 1 - side;
      else {
        g.phase = 'battle'; room.replay = simulate(g);
        room.battleUntil = now + room.replay.duration;
        finishRound(g);
        if (g.phase === 'plan') g.active = (g.round - 1) % 2;
      }
      room.deadline = Math.max(now, room.battleUntil) + TURN_TTL;
    } else fail('未知操作');
  }
  room.game = pack(g);
  return room;
}

export function view(room, side, version, id, now, peerSeen) {
  const g = unpack({ ...room, game: structuredClone(room.game) }), visible = new Set(g.units.map(u => u.id));
  for (let i = 0; i < 2; i++) {
    const p = g.players[i];
    p.discard.forEach(c => visible.add(c));
    if (i === side) { p.hand.forEach(c => visible.add(c)); p.traps.forEach(c => visible.add(c)); }
    else { p.hand = p.hand.map(() => null); p.traps = p.traps.map(() => 'hidden'); }
    p.deck = p.deck.map(() => null);
  }
  const turn = g.active;
  g.active = side;
  g.cards = Object.fromEntries([...visible].map(id => [id, g.cards[id]]));
  delete g.rng; delete g.rngState; delete g.seed;
  return { status: 'matched', id, side, version, turn, game: g, replay: room.replay,
    remaining: Math.max(0, Math.ceil((room.deadline - now) / 1000)), battling: now < room.battleUntil,
    opponentOffline: now - peerSeen > 10000 };
}

async function pair(db, ticket, now) {
  const other = await stmt(db, 'SELECT * FROM match_tickets WHERE match_id IS NULL AND id != ? AND seen > ? ORDER BY joined, id LIMIT 1', ticket.id, now - QUEUE_TTL).first();
  if (!other) return;
  const id = crypto.randomUUID(), room = makeRoom(JSON.parse(other.loadout), JSON.parse(ticket.loadout), now);
  // The guarded INSERT and both ticket assignments commit in one D1 transaction.
  await db.batch([
    stmt(db, `INSERT INTO matches (id,peer0,peer1,state,version,expires) SELECT ?,?,?,?,0,?
      WHERE (SELECT COUNT(*) FROM match_tickets WHERE id IN (?,?) AND match_id IS NULL AND seen > ?) = 2`,
    id, other.id, ticket.id, JSON.stringify(room), now + MATCH_TTL, other.id, ticket.id, now - QUEUE_TTL),
    stmt(db, 'UPDATE match_tickets SET match_id = ? WHERE id IN (?,?) AND EXISTS (SELECT 1 FROM matches WHERE id = ?)', id, other.id, ticket.id, id),
  ]);
}

export async function matchRequest(request, db, now = Date.now()) {
  try {
    if (!db) fail('匹配服務暫時無法連線', 503);
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!/^[a-f0-9-]{73}$/.test(token || '')) fail('連線憑證無效', 401);
    const id = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2, '0')).join('');
    const action = new URL(request.url).pathname.split('/').at(-1);
    if (!['state','join','leave','play','move','ready'].includes(action)) fail('未知操作', 404);
    if (!['GET','POST'].includes(request.method) || (action === 'state') !== (request.method === 'GET')) fail('不支援的請求', 405);
    let input = {};
    if (request.method === 'POST') {
      let size = 0;
      const chunks = [];
      if (request.body) for await (const chunk of request.body) {
        size += chunk.byteLength;
        if (size > 100000) fail('卡組資料過大', 413);
        chunks.push(chunk);
      }
      const raw = await new Blob(chunks).text();
      try { input = JSON.parse(raw); } catch { fail('資料格式無效'); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) fail('資料格式無效');
    }
    let ticket = await stmt(db, 'SELECT * FROM match_tickets WHERE id = ?', id).first();
    if (action === 'join' && !ticket?.match_id) {
      const value = loadout(input);
      await stmt(db, `INSERT INTO match_tickets (id,joined,seen,loadout) VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET seen=excluded.seen,loadout=excluded.loadout WHERE match_id IS NULL`, id, now, now, JSON.stringify(value)).run();
      ticket = await stmt(db, 'SELECT * FROM match_tickets WHERE id = ?', id).first();
      await db.batch([
        stmt(db, 'DELETE FROM matches WHERE expires < ?', now),
        stmt(db, 'DELETE FROM match_tickets WHERE seen < ? AND id != ?', now - MATCH_TTL, id),
      ]);
    }
    if (!ticket) return json({ status: 'idle' });
    if (action === 'leave' && !ticket.match_id) {
      await stmt(db, 'DELETE FROM match_tickets WHERE id = ? AND match_id IS NULL', id).run();
      ticket = await stmt(db, 'SELECT * FROM match_tickets WHERE id = ?', id).first();
      if (!ticket) return json({ status: 'idle' });
    }
    if (!ticket.match_id && action === 'state' && now - ticket.seen > QUEUE_TTL) {
      await stmt(db, 'DELETE FROM match_tickets WHERE id = ? AND match_id IS NULL AND seen < ?', id, now - QUEUE_TTL).run();
      ticket = await stmt(db, 'SELECT * FROM match_tickets WHERE id = ?', id).first();
      if (!ticket) return json({ status: 'idle' });
    }
    await stmt(db, 'UPDATE match_tickets SET seen = ? WHERE id = ?', now, id).run();
    if (!ticket.match_id) {
      await pair(db, ticket, now);
      ticket = await stmt(db, 'SELECT * FROM match_tickets WHERE id = ?', id).first();
      if (!ticket) return json({ status: 'idle' });
      if (!ticket.match_id) return json({ status: 'waiting' });
    }
    let row = await stmt(db, 'SELECT * FROM matches WHERE id = ?', ticket.match_id).first();
    if (!row || row.expires < now) {
      await stmt(db, 'DELETE FROM match_tickets WHERE id = ?', id).run();
      return json({ status: 'idle' });
    }
    const side = row.peer0 === id ? 0 : row.peer1 === id ? 1 : fail('無法進入此對局', 403);
    const peer = await stmt(db, 'SELECT seen FROM match_tickets WHERE id = ?', side ? row.peer0 : row.peer1).first();
    let room = JSON.parse(row.state), changed = false;
    if (room.game.phase !== 'over' && (now - (peer?.seen || 0) > OFFLINE_TTL || now > room.deadline)) {
      const loser = now - (peer?.seen || 0) > OFFLINE_TTL ? 1 - side : room.game.active;
      room = command(room, loser, { action: 'leave' }, now); changed = true;
    } else if (!['state','join'].includes(action)) {
      if (action !== 'leave' && input.version !== row.version) fail('對局已更新，請重試', 409);
      room = command(room, side, { ...input, action }, now); changed = true;
    }
    if (changed) {
      const saved = await stmt(db, 'UPDATE matches SET state = ?, version = version + 1 WHERE id = ? AND version = ?', JSON.stringify(room), row.id, row.version).run();
      if (!saved.meta.changes) fail('對局已更新，請重試', 409);
      row.version++;
    }
    if (action === 'leave') {
      await stmt(db, 'DELETE FROM match_tickets WHERE id = ? AND match_id = ?', id, row.id).run();
      return json({ status: 'idle' });
    }
    return json(view(room, side, row.version, row.id, now, peer?.seen || 0));
  } catch (error) {
    if (!error.status) console.error('Match request failed', error);
    return json({ error: error.status ? error.message : '匹配服務暫時無法連線' }, error.status || 503);
  }
}
