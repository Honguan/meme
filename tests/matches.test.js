import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { matchRequest, loadout, makeRoom, command, view } from '../server/matches.js';
import { CATALOG, DEFAULT_DECK } from '../src/catalog.js';
import { createGame, random } from '../src/game.js';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0000_matchmaking.sql', import.meta.url), 'utf8'));
  return { sql, prepare(query) { return { bind(...args) {
    const s = sql.prepare(query);
    return { first: async () => s.get(...args) || null, run: () => ({ meta: { changes: s.run(...args).changes } }) };
  } }; }, async batch(statements) {
    sql.exec('BEGIN');
    try { const result=[];for(const s of statements)result.push(s.run());sql.exec('COMMIT');return result; }
    catch(error){sql.exec('ROLLBACK');throw error;}
  } };
}
const token = () => `${crypto.randomUUID()}-${crypto.randomUUID()}`;
const payload = () => ({ deck: DEFAULT_DECK, custom: [], field: 'moon' });

test('local load benchmark waits for delayed joins before cleaning up a failed batch',async()=>{
  const tickets=new Set();let joins=0,pending=false,earlyLeave=false;
  const server=createServer(async(request,response)=>{
    request.resume();const key=request.headers.authorization;
    if(request.url.endsWith('/join')){
      if(++joins===1){response.writeHead(400,{'content-type':'application/json'});response.end(JSON.stringify({error:'join failure'}));return;}
      pending=true;await new Promise(resolve=>setTimeout(resolve,100));tickets.add(key);pending=false;
    }else if(request.url.endsWith('/leave')){earlyLeave ||= pending;tickets.delete(key);}
    response.setHeader('content-type','application/json');response.end(JSON.stringify({status:request.url.endsWith('/join')?'waiting':'idle'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await assert.rejects(promisify(execFile)(process.execPath,['scripts/benchmark-matching.mjs','2',`http://127.0.0.1:${server.address().port}`]),error=>error.code===1&&/join failure/.test(error.stderr));
    assert.equal(joins,2);assert.equal(earlyLeave,false);assert.equal(tickets.size,0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('D1 adapter serializes atomic batches and rolls back every statement on failure',async()=>{
  const db=database();
  const insert=id=>db.prepare('INSERT INTO match_tickets (id,joined,seen,loadout) VALUES (?,0,0,?)').bind(id,'{}');
  try {
    await Promise.all([db.batch([insert('first')]),db.batch([insert('second')])]);
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,2);
    await assert.rejects(db.batch([insert('rolled-back'),insert('first')]));
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,2);
  } finally { db.sql.close(); }
});

async function call(db, key, action='state', data={}, now=100000) {
  const response = await matchRequest(new Request(`http://localhost/api/match/${action}`, {
    method:action==='state'?'GET':'POST',headers:{authorization:`Bearer ${key}`},
    ...(action==='state'?{}:{body:JSON.stringify(data)}),
  }), db, now);
  return { status: response.status, ...await response.json() };
}

test('stale missing or expired room cleanup cannot delete a replacement match ticket',async()=>{
  for(const missing of [false,true]){
    const db=database(),key=token(),oldPeer=token(),newPeer=token();let resume,pending;
    try {
      await call(db,key,'join',payload());const old=await call(db,oldPeer,'join',payload());assert.equal(old.status,'matched');
      if(missing)db.sql.prepare('DELETE FROM matches WHERE id = ?').run(old.id);
      const now=100000+7200001;let selected,paused=false;
      const selection=new Promise(resolve=>selected=resolve),continued=new Promise(resolve=>resume=resolve),prepare=db.prepare;
      db.prepare=query=>{
        const statement=prepare(query);if(query!=='SELECT * FROM matches WHERE id = ?')return statement;
        return {bind(...args){const bound=statement.bind(...args),first=bound.first;
          bound.first=async()=>{const row=await first();if(!paused){paused=true;selected();await continued;}return row;};return bound;
        }};
      };
      pending=call(db,key,'state',{},now);await selection;
      assert.equal((await call(db,key,'leave',{},now+1)).status,'idle');
      assert.equal((await call(db,key,'join',payload(),now+2)).status,'waiting');
      const replacement=await call(db,newPeer,'join',payload(),now+3);assert.equal(replacement.status,'matched');assert.notEqual(replacement.id,old.id);
      const tickets=db.sql.prepare('SELECT id,match_id FROM match_tickets ORDER BY id').all(),rooms=db.sql.prepare('SELECT * FROM matches ORDER BY id').all();
      resume();const stale=await pending;
      assert.deepEqual(db.sql.prepare('SELECT id,match_id FROM match_tickets ORDER BY id').all(),tickets);assert.deepEqual(db.sql.prepare('SELECT * FROM matches ORDER BY id').all(),rooms);
      assert.equal(stale.status,409);assert.match(stale.error,/對局已更新/);
      const current=await call(db,key,'state',{},now+4);assert.equal(current.status,'matched');assert.equal(current.id,replacement.id);assert.equal(current.game.phase,'plan');
      db.sql.prepare('DELETE FROM matches WHERE id = ?').run(current.id);assert.equal((await call(db,key,'state',{},now+5)).status,'idle');
    } finally {resume?.();await pending;db.sql.close();}
  }
});

test('simultaneous queue joins assign every player to exactly one two-player match',async()=>{
  const db=database(),keys=Array.from({length:8},token);
  try {
    const joined=await Promise.all(keys.map(key=>call(db,key,'join',payload())));
    assert.ok(joined.every(result=>result.status==='waiting'||result.status==='matched'));
    let states;
    for(let attempt=0;attempt<keys.length/2;attempt++) {
      states=await Promise.all(keys.map(key=>call(db,key)));
      if(states.every(state=>state.status==='matched'))break;
    }
    assert.ok(states.every(state=>state.status==='matched'));
    const pairs=new Map();
    for(const state of states) {
      const sides=pairs.get(state.id)||[];sides.push(state.side);pairs.set(state.id,sides);
    }
    assert.equal(pairs.size,4);
    for(const sides of pairs.values())assert.deepEqual(sides.sort(),[0,1]);
    const rows=db.sql.prepare('SELECT peer0,peer1 FROM matches').all();
    assert.equal(rows.length,4);assert.equal(new Set(rows.flatMap(row=>[row.peer0,row.peer1])).size,8);
    const tickets=db.sql.prepare('SELECT match_id,COUNT(*) AS count FROM match_tickets GROUP BY match_id').all();
    assert.equal(tickets.length,4);assert.ok(tickets.every(ticket=>ticket.match_id&&ticket.count===2));
  } finally { db.sql.close(); }
});

test('cancelling a candidate after selection prevents stale pairing and phantom matches',async()=>{
  const db=database(),a=token(),b=token();
  await call(db,a,'join',payload());
  let selected,resume;
  const selection=new Promise(resolve=>selected=resolve),continued=new Promise(resolve=>resume=resolve);
  const prepare=db.prepare;
  db.prepare=query=>{
    const statement=prepare(query);
    if(!query.startsWith('SELECT * FROM match_tickets WHERE match_id IS NULL'))return statement;
    return {bind(...args){
      const bound=statement.bind(...args),first=bound.first;
      bound.first=async()=>{const row=await first();selected();await continued;return row;};
      return bound;
    }};
  };
  const joining=call(db,b,'join',payload());
  try {
    await selection;
    assert.equal((await call(db,a,'leave')).status,'idle');
    resume();assert.equal((await joining).status,'waiting');
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM matches').get().count,0);
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,1);
    assert.equal((await call(db,b)).status,'waiting');
  } finally {resume();await joining;db.sql.close();}
});

test('both players can dismiss a finished match concurrently without changing its result',async()=>{
  const db=database(),a=token(),b=token();
  try {
    await call(db,a,'join',payload());await call(db,b,'join',payload());
    const row=db.sql.prepare('SELECT * FROM matches').get();
    const finished=command(JSON.parse(row.state),0,{action:'leave'},100000);
    db.sql.prepare('UPDATE matches SET state = ? WHERE id = ?').run(JSON.stringify(finished),row.id);
    const before=db.sql.prepare('SELECT state,version FROM matches WHERE id = ?').get(row.id);
    let readers=0,release;const barrier=new Promise(resolve=>release=resolve),prepare=db.prepare;
    db.prepare=query=>{
      const statement=prepare(query);
      if(query!=='SELECT * FROM matches WHERE id = ?')return statement;
      return {bind(...args){
        const bound=statement.bind(...args),first=bound.first;
        bound.first=async()=>{const result=await first();if(++readers===2)release();await barrier;return result;};
        return bound;
      }};
    };
    const results=await Promise.all([call(db,a,'leave'),call(db,b,'leave')]);
    assert.ok(results.every(result=>result.status==='idle'));
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,0);
    assert.deepEqual(db.sql.prepare('SELECT state,version FROM matches WHERE id = ?').get(row.id),before);
    assert.equal((await call(db,a)).status,'idle');assert.equal((await call(db,b)).status,'idle');
  } finally { db.sql.close(); }
});

test('simultaneous live-match departures dismiss both tickets and preserve the first committed result',async()=>{
  const db=database(),a=token(),b=token();
  try {
    await call(db,a,'join',payload());await call(db,b,'join',payload());
    const row=db.sql.prepare('SELECT * FROM matches').get();
    let readers=0,release,committed;const barrier=new Promise(resolve=>release=resolve),prepare=db.prepare;
    db.prepare=query=>{
      const statement=prepare(query);
      return {bind(...args){
        const bound=statement.bind(...args);
        if(query==='SELECT * FROM matches WHERE id = ?') {
          const first=bound.first;
          bound.first=async()=>{const result=await first();if(++readers===2)release();await barrier;return result;};
        }
        if(query.startsWith('UPDATE matches SET state = ?')) {
          const run=bound.run;
          bound.run=()=>{const result=run();if(result.meta.changes)committed=args[0];return result;};
        }
        return bound;
      }};
    };
    const results=await Promise.all([call(db,a,'leave'),call(db,b,'leave')]);
    assert.ok(results.every(result=>result.status==='idle'),JSON.stringify(results));
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,0);
    const after=db.sql.prepare('SELECT state,version FROM matches WHERE id = ?').get(row.id);
    assert.equal(after.version,row.version+1);assert.equal(after.state,committed);
    const game=JSON.parse(after.state).game;
    assert.equal(game.phase,'over');assert.ok([0,1].includes(game.winner));
    assert.equal((await call(db,a)).status,'idle');assert.equal((await call(db,b)).status,'idle');
  } finally { db.sql.close(); }
});

test('a departure conflicting with a live turn update must not silently remove its ticket',async()=>{
  const db=database(),a=token(),b=token();
  try {
    await call(db,a,'join',payload());await call(db,b,'join',payload());
    const row=db.sql.prepare('SELECT * FROM matches').get(),prepare=db.prepare;
    let updated,updating=false;
    db.prepare=query=>{
      const statement=prepare(query);
      if(!query.startsWith('UPDATE matches SET state = ?'))return statement;
      return {bind(...args){
        const bound=statement.bind(...args),run=bound.run;
        bound.run=async()=>{
          if(!updating) {
            updating=true;
            assert.equal((await call(db,a,'ready',{version:row.version})).status,'matched');
            updated=db.sql.prepare('SELECT state FROM matches WHERE id = ?').get(row.id).state;
          }
          return run();
        };
        return bound;
      }};
    };
    assert.equal((await call(db,b,'leave')).status,409);
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,2);
    assert.equal(db.sql.prepare('SELECT state FROM matches WHERE id = ?').get(row.id).state,updated);
    assert.equal((await call(db,b,'leave')).status,'idle');
    assert.equal((await call(db,a)).game.winner,0);
  } finally { db.sql.close(); }
});

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

test('canonical maximum-length cards fit the request limit while oversized JSON never enters the queue',async()=>{
  const db=database(),key=token(),prefix='https://example.com/';
  const custom=Array.from({length:30},(_,i)=>({id:`custom-bound-${i}-`.padEnd(100,'x'),name:'\u0001'.repeat(72),type:'monster',tag:'bonk',cost:9,attack:99,hp:999,speed:12,image:prefix+'\u0000'.repeat(2048-prefix.length),flavor:'\u0001'.repeat(160),effects:Array.from({length:4},()=>({trigger:'round',action:'damage',target:'enemies',amount:99}))}));
  const value={deck:custom.map(card=>card.id),custom,field:'grid'},raw=JSON.stringify(value),bytes=Buffer.byteLength(raw);
  assert.equal(loadout(value).deck.length,30);assert.ok(bytes>400000&&bytes<500000);
  try {
    assert.equal((await call(db,key,'join',value)).status,'waiting');await call(db,key,'leave');
    for(const size of [500001,500000]) {
      const response=await matchRequest(new Request('http://localhost/api/match/join',{method:'POST',headers:{authorization:`Bearer ${key}`},body:raw+' '.repeat(size-bytes)}),db,100000);
      assert.equal(response.status,size>500000?413:200);
      assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM match_tickets').get().count,size>500000?0:1);
    }
  } finally {db.sql.close();}
});

test('queue rejects invalid credentials, malformed and forged decks',async()=>{
  const db=database();
  assert.equal((await call(db,'wrong','join',payload())).status,401);
  assert.equal((await call(db,token(),'join',{...payload(),deck:Array(10).fill('__proto__')})).status,400);
  assert.equal((await call(db,token(),'join',{...payload(),deck:Array(10).fill(DEFAULT_DECK[0])})).status,400);
  assert.throws(()=>loadout({...payload(),custom:[{id:'bad',type:'bogus'}]}));
  assert.equal((await call(db,token(),'join',{padding:'x'.repeat(500001)})).status,413);
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
  const baseline=createGame({catalog:[...CATALOG,...Object.values(room.custom)],deck:p.deck.map(id=>`online-0-${id}`),opponentDeck:p.deck.map(id=>`online-1-${id}`),mode:'online',field:p.field,seed:room.game.seed});
  const {cards,rng:initialRng,...packed}=baseline;
  assert.deepEqual(room.game,{...packed,cards:undefined,rng:undefined,rngState:initialRng.state});
  assert.notEqual(room.game.players[0].hand[0],room.game.players[1].hand[0]);
  const before=JSON.stringify(room);view(room,0,0,'test',1,1);assert.equal(JSON.stringify(room),before);
  room.game.players[1].traps=['secret-trap'];
  room.custom['secret-trap']={...custom[0],id:'secret-trap',type:'trap'};
  const visible=view(room,0,0,'test',1,1);
  for(const id of room.game.players[0].hand)assert.deepEqual(visible.game.cards[id],room.custom[id]);
  for(const id of room.game.players[1].hand)assert.equal(visible.game.cards[id],undefined);
  assert.equal(visible.game.cards[DEFAULT_DECK[0]],undefined);
  for(const id of ['rng','rngState','seed'])assert.equal(visible.game[id],undefined);
  assert.deepEqual(visible.game.players[1].traps,['hidden']);assert.equal(visible.game.cards['secret-trap'],undefined);
  const played=command(room,0,{action:'play',index:0,slot:2},1);
  assert.equal(played.game.units.filter(u=>u.side===0).length,2);
  assert.equal(played.game.units.at(-1).slot,2);
  command(room,0,{action:'move',uid:played.game.units.at(-1).uid,slot:1},2);
  assert.equal(room.game.units.at(-1).slot,1);
  const rng=random(123);rng();rng();const restored=random(rng.state);
  assert.deepEqual([rng(),rng(),rng()],[restored(),restored(),restored()]);
});
