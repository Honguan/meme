import { test, expect } from '@playwright/test';
import { DEFAULT_DECK } from '../src/catalog.js';

test('local D1 handles simultaneous queues, duplicate commands and cancellation without orphan players',async({page,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Queue bursts run only against the local test database.');
  await page.goto('/');
  const result=await page.evaluate(async deck=>{
    const keys=Array.from({length:10},()=>`${crypto.randomUUID()}-${crypto.randomUUID()}`);
    const call=async(key,action='state',data={})=>{
      const response=await fetch(`/api/match/${action}`,{method:action==='state'?'GET':'POST',
        headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},
        ...(action==='state'?{}:{body:JSON.stringify(data)})});
      return {http:response.status,...await response.json()};
    };
    const loadout={deck,custom:[],field:'grid'};
    try {
      const joined=await Promise.all(keys.slice(0,8).map(key=>call(key,'join',loadout)));
      let states;
      for(let attempt=0;attempt<4;attempt++) {
        states=await Promise.all(keys.slice(0,8).map(key=>call(key)));
        if(states.every(state=>state.status==='matched'))break;
      }
      const active=states.findIndex(state=>state.status==='matched'&&state.side===state.turn);
      const commands=active<0?[]:await Promise.all([0,1].map(()=>call(keys[active],'ready',{version:states[active].version})));
      const departed=await Promise.all(keys.slice(0,8).map(key=>call(key,'leave')));
      const dismissed=await Promise.all(keys.slice(0,8).map(key=>call(key)));
      await call(keys[8],'join',loadout);
      const race=await Promise.all([call(keys[9],'join',loadout),call(keys[8],'leave')]);
      return {joined,states,commands,departed,dismissed,race,cancelled:await call(keys[8]),remaining:await call(keys[9])};
    } finally {await Promise.all(keys.map(key=>call(key,'leave')));}
  },DEFAULT_DECK);
  expect(result.joined.every(state=>state.http===200&&['waiting','matched'].includes(state.status))).toBeTruthy();
  expect(result.states.every(state=>state.http===200&&state.status==='matched')).toBeTruthy();
  const pairs=new Map();
  for(const state of result.states){const sides=pairs.get(state.id)||[];sides.push(state.side);pairs.set(state.id,sides);}
  expect(pairs.size).toBe(4);for(const sides of pairs.values())expect(sides.sort()).toEqual([0,1]);
  expect(result.commands.map(state=>state.http).sort()).toEqual([200,409]);
  expect(result.departed.every(state=>state.http===200&&state.status==='idle')).toBeTruthy();
  expect(result.dismissed.every(state=>state.http===200&&state.status==='idle')).toBeTruthy();
  expect(result.race.every(state=>state.http===200)).toBeTruthy();
  expect(result.cancelled.status).toBe('idle');expect(result.remaining.http).toBe(200);
  if(result.remaining.status==='matched') {
    expect(result.remaining.game.phase).toBe('over');expect(result.remaining.game.winner).toBe(result.remaining.side);
  } else expect(result.remaining.status).toBe('waiting');
});

test('local D1 lets both players dismiss a completed match at the same time',async({page,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Synthetic matches run only against the local test database.');
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const keys=Array.from({length:2},()=>`${crypto.randomUUID()}-${crypto.randomUUID()}`);
    const call=async(key,action='state',data={})=>{
      const response=await fetch(`/api/match/${action}`,{method:action==='state'?'GET':'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},...(action==='state'?{}:{body:JSON.stringify(data)})});
      return {http:response.status,...await response.json()};
    };
    const custom=Array.from({length:10},(_,i)=>({id:`custom-dismiss-${i}`,name:`Dismiss ${i}`,type:'monster',tag:'bonk',cost:0,attack:1,hp:20,speed:5,image:'',flavor:'',effects:[{trigger:'play',action:'damage',target:'self',amount:99},{trigger:'play',action:'draw',target:'self',amount:9}]}));
    const loadout={deck:custom.map(card=>card.id),custom,field:'grid'};
    try {
      await call(keys[0],'join',loadout);await call(keys[1],'join',loadout);
      const states=await Promise.all(keys.map(key=>call(key))),active=states.findIndex(state=>state.side===state.turn);
      let state=states[active];const plays=[];
      for(let i=0;i<10;i++){state=await call(keys[active],'play',{version:state.version,index:0});plays.push(state.http);}
      const finished=await Promise.all(keys.map(key=>call(key)));
      const dismissed=await Promise.all(keys.map(key=>call(key,'leave')));
      return {plays,finished,dismissed,after:await Promise.all(keys.map(key=>call(key)))};
    } finally {await Promise.all(keys.map(key=>call(key,'leave')));}
  });
  expect(result.plays).toEqual(Array(10).fill(200));
  expect(result.finished.every(state=>state.http===200&&state.game.phase==='over')).toBeTruthy();
  expect(result.finished[0].game.winner).toBe(result.finished[1].game.winner);
  expect(result.dismissed.every(state=>state.http===200&&state.status==='idle')).toBeTruthy();
  expect(result.after.every(state=>state.http===200&&state.status==='idle')).toBeTruthy();
});

async function prepare(page) {
  const custom=Array.from({length:10},(_,i)=>({id:`custom-online-${i}`,name:`線上測試 ${i}`,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}));
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),{version:1,custom,deck:custom.map(c=>c.id),web:[],stats:{}});
  await page.goto('/',{waitUntil:'domcontentloaded'});
}
async function join(page) {
  await page.getByRole('button',{name:'匹配對戰',exact:true}).click();
  await page.getByRole('button',{name:'開始匹配',exact:true}).click();
}
async function state(page) {
  return page.evaluate(async()=>{
    const token=sessionStorage.getItem('meme-clash-online');
    return (await fetch('/api/match/state',{headers:{authorization:`Bearer ${token}`}})).json();
  });
}
async function leave(page) {
  await page.evaluate(async()=>{
    const token=sessionStorage.getItem('meme-clash-online');
    if(token)await fetch('/api/match/leave',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:'{}'});
  }).catch(()=>{});
}

test('local UI matches complete custom decks whose UTF-8 payload exceeds 100 KB',async({page,browser,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Large synthetic decks run only against the local test database.');
  const context=await browser.newContext({viewport:{width:390,height:844}}),peer=await context.newPage(),prefix='https://example.com/';
  const custom=Array.from({length:30},(_,i)=>({id:`custom-utf8-${i}`,name:'迷'.repeat(72),type:'monster',tag:'bonk',cost:9,attack:99,hp:999,speed:12,image:prefix+'迷'.repeat(2048-prefix.length),flavor:'迷'.repeat(160),effects:Array.from({length:4},()=>({trigger:'round',action:'damage',target:'enemies',amount:99}))}));
  const profile={version:1,custom,deck:custom.map(card=>card.id),web:[],decks:[],stats:{}};
  try {
    for(const player of [page,peer]) {
      await player.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);
      await player.route('https://example.com/**',route=>route.abort());await player.goto(baseURL);
    }
    const request=page.waitForRequest('**/api/match/join');await join(page);
    const sent=await request;expect(sent.postDataBuffer().length).toBeGreaterThan(100000);expect((await sent.response()).status()).toBe(200);
    await join(peer);await expect(page.locator('#online-status')).toContainText('輪到你部署');await expect(peer.locator('#online-status')).toContainText('等待對手部署');
    const first=await state(page),second=await state(peer);expect(first.id).toBe(second.id);expect(first.side).not.toBe(second.side);
    expect(first.game.players[0].deck.length+first.game.players[0].hand.length+first.game.units.filter(unit=>unit.side===0).length).toBe(30);
  } finally {await leave(page);await leave(peer);await context.close();}
});

test('two independent players match, deploy, replay the same battle and reconnect',async({browser})=>{
  test.setTimeout(60000);
  const a=await browser.newContext(),b=await browser.newContext({viewport:{width:390,height:844}});
  const first=await a.newPage(),second=await b.newPage(),errors=[];
  first.on('pageerror',e=>errors.push(e.message));second.on('pageerror',e=>errors.push(e.message));
  try {
    await prepare(first);await prepare(second);
    const saved=await first.evaluate(()=>localStorage.getItem('meme-clash-v1'));
    await join(first);await expect(first.locator('#online-status')).toHaveText('尋找對手中');
    await join(second);
    await expect(first.locator('#online-status')).toContainText('輪到你部署');
    await expect(second.locator('#online-status')).toContainText('等待對手部署');
    await expect(second.getByRole('button',{name:'完成部署',exact:true})).toBeDisabled();
    const initial=await state(first),peer=await state(second);
    expect(initial.id).toBe(peer.id);expect(initial.side).not.toBe(peer.side);
    expect(initial.game.players[1].hand.every(id=>id===null)).toBeTruthy();
    expect(initial.game.players[0].deck.every(id=>id===null)).toBeTruthy();
    const card=first.locator('.hand-cards [data-hand]').first(),slot=first.locator('.own-formation [data-slot="2"]');
    const from=await card.boundingBox(),to=await slot.boundingBox();
    await first.mouse.move(from.x+from.width/2,from.y+from.height/2);await first.mouse.down();
    await first.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await first.mouse.up();
    await expect(first.locator('.hand-cards [data-hand]')).toHaveCount(4);
    await expect(second.locator('.opponent-formation .occupied')).toHaveCount(2);
    await first.getByRole('button',{name:'完成部署',exact:true}).click();
    await expect(second.locator('#online-status')).toContainText('輪到你部署');
    await second.getByRole('button',{name:'完成部署',exact:true}).click();
    await expect(first.locator('.duel-board')).toHaveClass(/is-battling/);
    await first.screenshot({path:'.artifacts/online-clash.png'});
    await expect(first.locator('#round-number')).toHaveText('02',{timeout:15000});
    await expect(second.locator('#round-number')).toHaveText('02',{timeout:15000});
    const left=await state(first),right=await state(second);
    expect(left.game.units).toEqual(right.game.units);expect(left.replay).toEqual(right.replay);
    await first.reload({waitUntil:'domcontentloaded'});
    await expect(first.locator('#online-status')).toContainText('等待對手部署',{timeout:15000});
    expect((await state(first)).id).toBe(initial.id);
    expect(await first.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
    await a.setOffline(true);
    await expect(first.locator('#online-status')).toHaveText('連線中斷，正在重試',{timeout:15000});
    await a.setOffline(false);
    await expect(first.locator('#online-status')).toContainText('等待對手部署',{timeout:15000});
    await second.screenshot({path:'.artifacts/online-mobile.png',fullPage:true});
    expect(await second.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await first.getByRole('button',{name:'離開對局',exact:true}).click();
    await first.getByRole('button',{name:'確認離開',exact:true}).click();
    await expect(second.getByRole('heading',{name:'這局，你贏了！'})).toBeVisible();
    expect(errors).toEqual([]);
  } finally {await a.setOffline(false);await leave(first);await leave(second);await a.close();await b.close();}
});

test('confirmed departures retry disconnects, unavailable service and conflicts without losing the leave intent',async({page,browser,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Departure recovery uses only the local test database.');
  const context=await browser.newContext({viewport:{width:390,height:844}}),peer=await context.newPage();
  let attempts=0,committed;
  try {
    await prepare(page);await prepare(peer);
    const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
    await join(page);await join(peer);
    await expect(page.locator('#online-status')).toContainText('輪到你部署');
    await expect(peer.locator('#online-status')).toContainText('等待對手部署');
    await page.route('**/api/match/leave',async route=>{
      attempts++;
      if(attempts===1)return route.abort('internetdisconnected');
      if(attempts<4)return route.fulfill({status:attempts===2?503:409,contentType:'application/json',body:JSON.stringify({error:attempts===2?'匹配服務暫時無法連線':'對局已更新，請重試'})});
      if(attempts===4) {
        expect((await route.fetch()).status()).toBe(200);committed=await state(peer);
        return route.abort('failed');
      }
      return route.continue();
    });
    await page.getByRole('button',{name:'離開對局',exact:true}).click();
    await page.getByRole('button',{name:'確認離開',exact:true}).click();
    await expect(page.locator('#online-status')).toHaveText('連線中斷，正在重試');
    await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible({timeout:15000});
    expect(attempts).toBe(5);
    expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
    expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
    await expect(peer.getByRole('heading',{name:'這局，你贏了！'})).toBeVisible();
    const after=await state(peer);expect(after.game.phase).toBe('over');expect(after.game.winner).toBe(committed.side);
    expect(after.game.winner).toBe(committed.game.winner);expect(after.version).toBe(committed.version);
    await page.unroute('**/api/match/leave');await join(page);
    await expect(page.locator('#online-status')).toHaveText('尋找對手中');
    await page.getByRole('button',{name:'取消匹配',exact:true}).click();
    await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
  } finally {await page.unroute('**/api/match/leave');await leave(page);await leave(peer);await context.close();}
});

test('queue cancellation retries a lost request until the ticket is removed',async({page,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Queue recovery uses only the local test database.');
  let attempts=0;
  try {
    await prepare(page);await join(page);await expect(page.locator('#online-status')).toHaveText('尋找對手中');
    await page.route('**/api/match/leave',route=>++attempts===1?route.abort('internetdisconnected'):route.continue());
    await page.getByRole('button',{name:'取消匹配',exact:true}).click();
    await expect(page.locator('#online-status')).toHaveText('連線中斷，正在重試');
    await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible({timeout:10000});
    expect(attempts).toBe(2);expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
  } finally {await page.unroute('**/api/match/leave');await leave(page);}
});

test('matchmaking can be cancelled and reports an unavailable service without a fake opponent',async({page})=>{
  await prepare(page);await join(page);await expect(page.locator('#online-status')).toHaveText('尋找對手中');
  await page.getByRole('button',{name:'取消匹配',exact:true}).click();
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
  await page.route('**/api/match/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'匹配服務暫時無法連線'})}));
  await join(page);await expect(page.locator('#online-status')).toHaveText('連線中斷，正在重試');
  await expect(page.getByRole('button',{name:'完成部署',exact:true})).toBeDisabled();
  await page.unroute('**/api/match/**');
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible({timeout:15000});
});
