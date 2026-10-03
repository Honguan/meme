import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { matchRequest, loadout, makeRoom, command, view } from '../server/matches.js';
import { DEFAULT_DECK } from '../src/catalog.js';
import { random } from '../src/game.js';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0000_matchmaking.sql', import.meta.url), 'utf8'));
  return { sql, prepare(query) { return { bind(...args) {
    const s = sql.prepare(query);
    return { first: async () => s.get(...args) || null, run: async () => ({ meta: { changes: s.run(...args).changes } }) };
  } }; }, async batch(statements) {
    sql.exec('BEGIN');
    try { const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result; }
    catch(error){sql.exec('ROLLBACK');throw error;}
  } };
}
const token = () => `${crypto.randomUUID()}-${crypto.randomUUID()}`;
const payload = () => ({ deck: DEFAULT_DECK, custom: [], field: 'moon' });
async function call(db, key, action='state', data={}, now=100000) {
  const response = await matchRequest(new Request(`http://localhost/api/match/${action}`, {
    method:action==='state'?'GET':'POST',headers:{authorization:`Bearer ${key}`},
    ...(action==='state'?{}:{body:JSON.stringify(data)}),
  }), db, now);
  return { status: response.status, ...await response.json() };
}

test('concurrent commands commit one version and rejected targets leave authoritative state unchanged',async()=>{
  const db=database(),a=token(),b=token();
  await call(db,a,'join',payload());await call(db,b,'join',payload());
  const results=await Promise.all([call(db,a,'ready',{version:0}),call(db,a,'ready',{version:0})]);
  assert.equal(results.filter(r=>r.status==='matched').length,1);
  assert.equal(results.filter(r=>r.status===409).length,1);
  const state=await call(db,b);assert.equal(state.version,1);assert.equal(state.turn,1);
  db.sql.close();
  const p=loadout(payload()),room=makeRoom(p,p,0);
  room.game.players[0].hand=['bonk'];room.game.players[0].energy=9;
  const before=JSON.stringify(room);
  assert.throws(()=>command(room,0,{action:'play',index:0,targetId:room.game.units.find(u=>u.side===0).uid},1),/這張卡不能指定這個目標/);
  assert.equal(JSON.stringify(room),before);
});

test('match queue pairs two clients, hides private state, enforces turns and versions', async()=>{
  const db=database(),a=token(),b=token();
  assert.equal((await call(db,a,'join',payload())).status,'waiting');
  const second=await call(db,b,'join',payload()),first=await call(db,a);
  assert.equal(first.id,second.id);assert.notEqual(first.side,second.side);
  assert.equal(first.game.field,'moon');assert.equal(first.game.mode,'online');
  assert.ok(first.game.players[1].hand.every(id=>id===null));
  assert.ok(first.game.players[0].deck.every(id=>id===null));
  assert.equal(first.game.rngState,undefined);assert.equal(first.game.seed,undefined);
  assert.equal((await call(db,b,'ready',{version:0})).status,409);
  const next=await call(db,a,'ready',{version:0});assert.equal(next.turn,1);
  assert.equal((await call(db,b,'ready',{version:0})).status,409);
  const clash=await call(db,b,'ready',{version:next.version});
  assert.ok(clash.replay.frames.length>0);assert.ok(clash.battling);
  assert.equal(clash.replay.round,1);assert.equal(clash.game.round,2);
  assert.equal((await call(db,b,'ready',{version:clash.version})).status,409);
  const resumed=await call(db,b,'state',{},107000);
  assert.equal(resumed.battling,false);assert.equal(resumed.turn,1);
  assert.equal((await call(db,a,'leave')).status,'idle');
  const won=await call(db,b);assert.equal(won.game.phase,'over');assert.equal(won.game.winner,1);
  db.sql.close();
});

test('queue cancellation and expiry never become AI matches; absent peers forfeit',async()=>{
  const db=database(),a=token(),b=token();
  await call(db,a,'join',payload());assert.equal((await call(db,a,'leave')).status,'idle');
  await call(db,a,'join',payload());assert.equal((await call(db,a,'state',{},121001)).status,'idle');
  await call(db,a,'join',payload(),130000);await call(db,b,'join',payload(),130001);
  const result=await call(db,a,'state',{},176002);
  assert.equal(result.game.winner,0);assert.equal(result.game.phase,'over');
  db.sql.close();
});

test('queue rejects invalid credentials, malformed and forged decks',async()=>{
  const db=database();
  assert.equal((await call(db,'wrong','join',payload())).status,401);
  assert.equal((await call(db,token(),'join',{...payload(),deck:Array(10).fill('__proto__')})).status,400);
  assert.equal((await call(db,token(),'join',{...payload(),deck:Array(10).fill(DEFAULT_DECK[0])})).status,400);
  assert.throws(()=>loadout({...payload(),custom:[{id:'bad',type:'bogus'}]}));
  assert.equal((await call(db,token(),'join',{padding:'x'.repeat(100001)})).status,413);
  db.sql.close();
});

test('a live player exceeding the deployment deadline forfeits, and strangers cannot inspect a match',async()=>{
  const db=database(),a=token(),b=token();
  await call(db,a,'join',payload());await call(db,b,'join',payload());
  assert.equal((await call(db,token())).status,'idle');
  db.sql.prepare('UPDATE match_tickets SET seen = ?').run(190001);
  const expired=await call(db,a,'state',{},190001);
  assert.equal(expired.game.phase,'over');assert.equal(expired.game.winner,1);
  db.sql.close();
});

test('custom cards are namespaced, snapshots do not mutate authority, and RNG resumes exactly',()=>{
  const custom=Array.from({length:10},(_,i)=>({id:`c-${i}`,name:`Card ${i}`,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',effects:[]}));
  const p=loadout({deck:custom.map(c=>c.id),custom,field:'grid'}),room=makeRoom(p,p,0);
  assert.notEqual(room.game.players[0].hand[0],room.game.players[1].hand[0]);
  const before=JSON.stringify(room);view(room,0,0,'test',1,1);assert.equal(JSON.stringify(room),before);
  room.game.players[1].traps=['secret-trap'];
  room.custom['secret-trap']={...custom[0],id:'secret-trap',type:'trap'};
  const visible=view(room,0,0,'test',1,1);
  assert.deepEqual(visible.game.players[1].traps,['hidden']);assert.equal(visible.game.cards['secret-trap'],undefined);
  const played=command(room,0,{action:'play',index:0,slot:2},1);
  assert.equal(played.game.units.filter(u=>u.side===0).length,2);
  assert.equal(played.game.units.at(-1).slot,2);
  command(room,0,{action:'move',uid:played.game.units.at(-1).uid,slot:1},2);
  assert.equal(room.game.units.at(-1).slot,1);
  const rng=random(123);rng();rng();const restored=random(rng.state);
  assert.deepEqual([rng(),rng(),rng()],[restored(),restored(),restored()]);
});
