import { test, expect } from '@playwright/test';
import { DEFAULT_DECK } from '../src/catalog.js';
import { loadout, makeRoom, command, view } from '../server/matches.js';
import { parseProfile } from '../src/storage.js';

for(const mode of ['local','online'])test(`${mode} inspector cancellation restores piece focus and closing details preserves selection`,async({page})=>{
  const requests=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
  if(mode==='online'){
    const room=makeRoom(loadout({deck:DEFAULT_DECK,custom:[],field:'grid'}),loadout({deck:DEFAULT_DECK,custom:[],field:'grid'}),1000),snapshot=view(room,0,1,'selection-test',1001,1001);
    await page.route('**/api/match/**',route=>{requests.push(new URL(route.request().url()).pathname.split('/').at(-1));return route.fulfill({json:snapshot});});
    // Keep polling redraws outside this local selection/focus contract.
    await page.addInitScript(()=>{const timer=window.setTimeout;window.setTimeout=(fn,delay,...args)=>timer(fn,delay===1500?60000:delay,...args);});
  }
  await prepare(page);if(mode==='online'){await join(page);await expect(page.locator('#online-status')).toContainText('輪到你部署');}
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1')),before=await page.locator('.duel-table').textContent();
  for(const width of [1440,390])for(const selector of ['[data-hand="1"]','.own-formation [data-unit]']){
    await page.setViewportSize({width,height:900});const piece=page.locator(selector).first(),inspect=page.locator('#card-inspector [data-action="inspect"]'),cancel=page.locator('[data-action="cancel-selection"]');
    await piece.focus();await page.keyboard.press('Enter');await expect(piece).toHaveAttribute('aria-pressed','true');const name=await page.locator('#card-inspector h2').textContent();
    await inspect.focus();await page.keyboard.press('Enter');await expect(page.locator('#modal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#modal')).not.toBeVisible();
    await expect(piece).toHaveAttribute('aria-pressed','true');await expect(page.locator('#card-inspector h2')).toHaveText(name);await expect(inspect).toBeFocused();
    await cancel.focus();await page.keyboard.press('Enter');await expect(piece).toBeFocused();await expect(piece).toHaveAttribute('aria-pressed','false');await expect(cancel).toHaveCount(0);await expect(page.locator('.drop-valid')).toHaveCount(0);
    await page.keyboard.press('Enter');await inspect.focus();await page.keyboard.press('Escape');await expect(piece).toBeFocused();await expect(piece).toHaveAttribute('aria-pressed','false');
    await page.keyboard.press('Enter');await piece.focus();await page.keyboard.press('Escape');await expect(piece).toBeFocused();await expect(piece).toHaveAttribute('aria-pressed','false');
    await page.keyboard.press('Enter');const pile=page.locator('.duel-actions [data-action="discard"]');await pile.focus();await page.keyboard.press('Escape');await expect(pile).toBeFocused();await expect(piece).toHaveAttribute('aria-pressed','false');
  }
  expect(await page.locator('.duel-table').textContent()).toBe(before);expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);expect(requests.filter(action=>action!=='state'&&action!=='join')).toEqual([]);expect(errors).toEqual([]);
});

for(const side of [0,1])test(`online graveyard side ${side} reads public snapshots without exposing hidden cards or sending commands`,async({page})=>{
  const custom=label=>Array.from({length:9},(_,i)=>({id:`custom-discard-online-${i}`,name:`${label} ${i}`,type:i===7?'spell':i===8?'trap':'monster',tag:'bonk',cost:0,attack:1,hp:20,speed:5,image:'',flavor:'',effects:i>=7?[{trigger:i===7?'play':'hit',action:'shield',target:'self',amount:1}]:[]}));
  const first=custom('自己原卡'),second=custom('對手原卡'),deck=[...first.map(c=>c.id),first[7].id],room=makeRoom(loadout({deck,custom:first,field:'grid'}),loadout({deck,custom:second,field:'grid'}),1000);
  for(let i=0;i<2;i++){
    const p=room.game.players[i],pool=[...p.hand,...p.deck];pool.sort((a,b)=>Number(room.custom[b].type!=='monster')-Number(room.custom[a].type!=='monster'));
    p.hand=pool.slice(0,5);p.deck=pool.slice(5);
  }
  const play=(player,type)=>command(room,player,{action:'play',index:room.game.players[player].hand.findIndex(id=>room.custom[id].type===type)},1001);
  play(0,'spell');play(0,'spell');command(room,0,{action:'ready'},1002);play(1,'spell');play(1,'trap');
  const snapshot=view(room,side,5,'discard-test',1003,1003),original=JSON.stringify(snapshot),enemy=1-side,hiddenTrap=`online-${enemy}-${first[8].id}`,requests=[];
  expect(snapshot.game.players[enemy].hand.every(id=>id===null)).toBeTruthy();expect(snapshot.game.players.every(p=>p.deck.every(id=>id===null))).toBeTruthy();
  if(side===0){expect(snapshot.game.players[1].traps).toEqual(['hidden']);expect(snapshot.game.cards[hiddenTrap]).toBeUndefined();}
  let expired=false;const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/match/**',route=>{const action=new URL(route.request().url()).pathname.split('/').at(-1);requests.push(action);
    if(expired&&action==='state')return route.fulfill(side===0?{json:{status:'idle'}}:{status:401,json:{error:'連線憑證無效'}});
    return route.fulfill({json:action==='leave'?{status:'idle'}:snapshot});});
  await prepare(page);const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));await join(page);await expect(page.locator('#online-status')).toContainText(side===0?'等待對手部署':'輪到你部署');
  await page.locator('.duel-actions [data-action="discard"]').click();await expect(page.locator(`.discard-modal button[data-side="${side}"]`)).toHaveAttribute('aria-pressed','true');
  for(const owner of [0,1]){
    await page.locator(`.discard-modal button[data-side="${owner}"]`).click();const id=`online-${owner}-${first[7].id}`,row=page.locator(`[data-discard-card="${id}"]`);
    await expect(page.locator('#discard-list .discard-card')).toHaveCount(1);await expect(row).toContainText(`${owner===0?'自己':'對手'}原卡 7`);await expect(row).toContainText(owner===0?'×2':'×1');await expect(page.locator(`[data-discard-card="${hiddenTrap}"]`)).toHaveCount(0);
    await row.click();await expect(page.locator('#modal h2')).toHaveText(`${owner===0?'自己':'對手'}原卡 7`);await expect(page.locator('[data-preview]')).toHaveAttribute('data-preview',id);await expect(page.locator('#modal [data-play]')).toHaveCount(0);
    for(const selector of ['[data-add]','[data-template]','[data-edit]','[data-delete]','[data-favorite]','[data-export-card]'])await expect(page.locator(`#modal ${selector}`)).toBeHidden();
    await page.locator('[data-focus-card]').click();await expect(row).toBeFocused();
  }
  await page.keyboard.press('Escape');await expect(page.locator('.duel-actions [data-action="discard"]')).toBeFocused();
  expect(requests.every(action=>['join','state'].includes(action))).toBeTruthy();expect(JSON.stringify(snapshot)).toBe(original);expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  await page.locator('.duel-actions [data-action="discard"]').click();await page.locator('#discard-list [data-discard-card]').click();await page.locator('[data-preview]').click();await expect(page.locator('#modal-preview-stage canvas')).toBeVisible();expired=true;
  await expect(page.locator('#online-status')).toHaveCount(0);await expect(page.locator('#modal')).not.toBeVisible();await expect(page.locator('#modal-preview-stage canvas')).toHaveCount(0);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
});

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

test('invalid active decks are rejected without silently matching a starter deck',async({page,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Deck rejection uses only the local test database.');
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},{version:1,custom:[],deck:DEFAULT_DECK,web:[],stats:{}});
  await page.goto('/');
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));
  let submitted,authorization;
  await page.route('**/api/match/join',async route=>{submitted=route.request().postDataJSON();authorization=route.request().headers().authorization;await route.continue();});
  try {
    for(const [deck,error] of [[original.deck.slice(0,9),'卡組需為 10 至 30 張'],[['tape','imagination','stonks','handshake','reverse','safe','suit','fusion','tape','imagination'],'卡組需包含角色卡']]) {
      await page.evaluate(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),{...original,deck});
      await page.reload();const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
      await join(page);
      await expect(page.locator('#toast')).toContainText(error);
      await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
      expect(submitted.deck).toEqual(deck);
      expect((await page.evaluate(async authorization=>(await fetch('/api/match/state',{headers:{authorization}})).json(),authorization)).status).toBe('idle');
      expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
      expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
    }
  } finally {await page.unroute('**/api/match/join');await leave(page);}
});

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

test('mixed resource cards preview successfully and give only the opponent cards and energy online',async({page,browser,baseURL})=>{
  test.skip(!['localhost','127.0.0.1','[::1]'].includes(new URL(baseURL).hostname),'Custom resource effects run only against the local test database.');
  const context=await browser.newContext(),peer=await context.newPage();
  const monster={id:'custom-gift-unit',name:'Gift unit',type:'monster',tag:'bonk',cost:0,attack:1,hp:20,speed:5,image:'',flavor:'',effects:[]};
  const gift={...monster,id:'custom-gift-spell',name:'Gift spell',type:'spell',effects:[{trigger:'play',action:'heal',target:'ally',amount:3},{trigger:'play',action:'draw',target:'enemy',amount:1},{trigger:'play',action:'energy',target:'enemies',amount:2}]};
  const gifts=Array.from({length:9},(_,i)=>({...gift,id:`custom-gift-spell-${i}`}));
  const profile={version:1,custom:[monster,...gifts],deck:[monster.id,...gifts.map(c=>c.id)],web:[],stats:{}};
  try{
    for(const player of [page,peer]){await player.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);await player.goto(baseURL);}
    const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
    await page.locator('.hand-cards [data-hand]').first().click();await page.locator('[data-action="inspect"]').click();
    await expect(page.locator('.card-detail')).toContainText('對手抽牌 1');await expect(page.locator('.card-detail')).toContainText('對手獲得能量 2');
    await page.locator('[data-preview]').click();await expect(page.locator('[data-preview-status]')).toContainText('登場效果');await expect(page.locator('[data-preview-status]')).toContainText('手牌 0');await page.keyboard.press('Escape');
    await join(page);await join(peer);await expect(page.locator('#online-status')).toContainText('輪到你部署');await expect(peer.locator('#online-status')).toContainText('等待對手部署');
    const before=await state(page);await page.locator('.hand-cards [data-hand]').first().click();await page.locator('.own-formation .occupied').first().click();
    await expect(page.locator('.hand-cards [data-hand]')).toHaveCount(4);await expect(peer.locator('.hand-cards [data-hand]')).toHaveCount(6);
    const after=await state(page),other=await state(peer);expect(after.version).toBe(before.version+1);expect(after.game.players[after.side].energy).toBe(3);expect(other.game.players[other.side].energy).toBe(5);
    expect(after.game.players[other.side].hand).toEqual(Array(6).fill(null));expect(other.game.players[other.side].hand.every(id=>typeof id==='string')).toBe(true);
    expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  }finally{await leave(page);await leave(peer);await context.close();}
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
    const previewOpponent=async player=>{
      const before=await state(player);
      const opponent=before.game.units.find(unit=>unit.side!==before.side);
      await player.locator('.opponent-formation .occupied').first().click();await expect(player.locator('.card-detail h2')).toHaveText(opponent.name);
      await player.locator('[data-preview]').click();await expect(player.locator('#modal-preview-stage>b')).toHaveText(opponent.name);
      const canvas=player.locator('#modal-preview-stage canvas');await expect(canvas).toBeVisible();
      await expect.poll(()=>canvas.evaluate(canvas=>[...canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data].filter((value,i)=>i%4===3&&value>0).length)).toBeGreaterThan(100);
      const after=await state(player);expect(after.version).toBe(before.version);expect(after.game).toEqual(before.game);
      await player.keyboard.press('Escape');
    };
    await previewOpponent(first);
    await first.locator('.hand-cards [data-hand]').first().hover();await expect(first.locator('#card-effect-preview')).toBeVisible();
    await expect(first.locator('#card-effect-preview>b')).toHaveText(initial.game.cards[initial.game.players[initial.side].hand[0]].name);
    const card=first.locator('.hand-cards [data-hand]').first(),slot=first.locator('.own-formation [data-slot="2"]');
    const from=await card.boundingBox(),to=await slot.boundingBox();
    await first.mouse.move(from.x+from.width/2,from.y+from.height/2);await first.mouse.down();
    await first.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await first.mouse.up();
    await expect(first.locator('.hand-cards [data-hand]')).toHaveCount(4);
    await expect(second.locator('.opponent-formation .occupied')).toHaveCount(2);
    await first.getByRole('button',{name:'完成部署',exact:true}).click();
    await expect(second.locator('#online-status')).toContainText('輪到你部署');
    await previewOpponent(second);
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
    await expect.poll(()=>committed?.game.phase,{timeout:15000}).toBe('over');await page.reload({waitUntil:'domcontentloaded'});
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

for(const status of ['waiting','matched'])test(`confirmed ${status} departures survive reload after a lost request`,async({page})=>{
  const deck=loadout({deck:DEFAULT_DECK,custom:[],field:'grid'}),room=makeRoom(deck,deck,1000),initial=status==='matched'?view(room,0,0,'reload-leave',1000,1000):{status};
  const requests=[];let attempts=0;
  await page.route('**/api/match/**',route=>{
    const action=new URL(route.request().url()).pathname.split('/').at(-1);requests.push({action,authorization:route.request().headers().authorization});
    if(action==='leave')return ++attempts===1?route.abort('internetdisconnected'):route.fulfill({json:{status:'idle'}});
    return route.fulfill({json:initial});
  });
  await prepare(page);const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await join(page);await expect(page.locator('#online-status')).toContainText(status==='matched'?'輪到你部署':'尋找對手中');
  const token=await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'));
  await page.getByRole('button',{name:status==='matched'?'離開對局':'取消匹配',exact:true}).click();
  if(status==='matched')await page.getByRole('button',{name:'確認離開',exact:true}).click();
  await expect(page.locator('#online-status')).toHaveText('連線中斷，正在重試');const before=requests.length;
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible({timeout:10000});
  expect(requests.slice(before)).toEqual([{action:'leave',authorization:`Bearer ${token}`}]);expect(attempts).toBe(2);
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online-leaving'))).toBeNull();
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  await join(page);await expect(page.locator('#online-status')).toContainText(status==='matched'?'輪到你部署':'尋找對手中');
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).not.toBe(token);
  await page.getByRole('button',{name:status==='matched'?'離開對局':'取消匹配',exact:true}).click();
  if(status==='matched')await page.getByRole('button',{name:'確認離開',exact:true}).click();
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
});

test('departure storage failures retain in-memory retries without changing the profile',async({page})=>{
  let attempts=0;
  await page.route('**/api/match/**',route=>{
    const action=new URL(route.request().url()).pathname.split('/').at(-1);
    if(action==='leave')return ++attempts===1?route.abort('internetdisconnected'):route.fulfill({json:{status:'idle'}});
    return route.fulfill({json:{status:'waiting'}});
  });
  await prepare(page);await join(page);await expect(page.locator('#online-status')).toHaveText('尋找對手中');
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-online-leaving')throw new DOMException('full','QuotaExceededError');return set.call(this,key,value);};});
  await page.getByRole('button',{name:'取消匹配',exact:true}).click();await expect(page.locator('#online-status')).toHaveText('連線中斷，正在重試');
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible({timeout:10000});expect(attempts).toBe(2);
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
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

test('rejected restored sessions and departures return idle without retrying obsolete credentials',async({page})=>{
  const requests=[];let rejectLeave=false;
  await page.addInitScript(()=>{sessionStorage.setItem('meme-clash-online','damaged-session');sessionStorage.setItem('meme-clash-online-leaving','obsolete-session');});
  await page.route('**/api/match/**',route=>{
    const request=route.request(),action=new URL(request.url()).pathname.split('/').at(-1),authorization=request.headers().authorization;
    requests.push({action,authorization});
    if(authorization==='Bearer damaged-session')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'連線憑證無效'})});
    if(action==='leave'&&rejectLeave)return route.fulfill({status:401,contentType:'text/html',body:'Unauthorized'});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({status:action==='leave'?'idle':'waiting'})});
  });
  await prepare(page);const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
  await expect(page.locator('#toast')).toHaveText('連線憑證無效');
  await page.waitForTimeout(1700);expect(requests).toEqual([{action:'state',authorization:'Bearer damaged-session'}]);expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online-leaving'))).toBeNull();
  await join(page);await expect(page.locator('#online-status')).toHaveText('尋找對手中');
  const first=await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'));expect(first).toMatch(/^[a-f0-9-]{73}$/);
  rejectLeave=true;await page.getByRole('button',{name:'取消匹配',exact:true}).click();
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
  const count=requests.length;await page.waitForTimeout(1700);expect(requests).toHaveLength(count);
  await join(page);await expect(page.locator('#online-status')).toHaveText('尋找對手中');
  const next=await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'));expect(next).toMatch(/^[a-f0-9-]{73}$/);expect(next).not.toBe(first);
  expect(requests.at(-1)).toEqual({action:'join',authorization:`Bearer ${next}`});
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  rejectLeave=false;await page.getByRole('button',{name:'取消匹配',exact:true}).click();
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
});

for(const [termination,width] of [['idle',1440],['401',390]])test(`interrupted online replays recover after ${termination} and allow a new match`,async({page})=>{
  await page.setViewportSize({width,height:1080});
  const deck=loadout({deck:DEFAULT_DECK,custom:[],field:'grid'}),room=makeRoom(deck,deck,1000);
  const initial=view(room,0,0,'replay-reset',1000,1000);
  command(room,0,{action:'ready'},1000);command(room,1,{action:'ready'},1000);
  const replay=view(room,0,2,'replay-reset',1000,1000);replay.replay.duration=30000;
  let response=initial,joins=0,rejected=false;const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/match/**',route=>{
    const action=new URL(route.request().url()).pathname.split('/').at(-1);
    if(action==='state'&&rejected)return route.fulfill({status:401,contentType:'text/html',body:'Unauthorized'});
    const state=action==='leave'?{status:'idle'}:action==='join'&&++joins>1?{status:'waiting'}:response;
    return route.fulfill({contentType:'application/json',body:JSON.stringify(state)});
  });
  await prepare(page);const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await join(page);await expect(page.locator('#online-status')).toContainText('輪到你部署');
  const token=await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'));
  response=replay;await expect(page.locator('.duel-board')).toHaveClass(/is-battling/);
  response={status:'idle'};rejected=termination==='401';
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
  rejected=false;response={status:'waiting'};await join(page);
  await expect(page.locator('#online-status')).toHaveText('尋找對手中');
  expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).not.toBe(token);
  response=initial;await expect(page.locator('#online-status')).toContainText('輪到你部署');
  await expect(page.getByRole('button',{name:'完成部署',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);expect(errors).toEqual([]);
  await page.getByRole('button',{name:'離開對局',exact:true}).click();
  await page.getByRole('button',{name:'確認離開',exact:true}).click();
  await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
});

test('a delayed catalog refresh preserves online replay while a confirmed departure still stops it and retries',async({page})=>{
  const deck=loadout({deck:DEFAULT_DECK,custom:[],field:'grid'}),room=makeRoom(deck,deck,1000);
  const initial=view(room,0,0,'refresh-replay',1000,1000);
  command(room,0,{action:'ready'},1000);command(room,1,{action:'ready'},1000);
  const replay=view(room,0,2,'refresh-replay',1000,1000);replay.replay.duration=30000;
  let response=initial,releaseCatalog,releaseLeave,joins=0,departures=0;const errors=[];
  const catalogPending=new Promise(resolve=>releaseCatalog=resolve),leavePending=new Promise(resolve=>releaseLeave=resolve);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://api.imgflip.com/get_memes',async route=>{await catalogPending;await route.fulfill({json:{success:true,data:{memes:[{id:'online-late',name:'Online late meme',url:'https://i.imgflip.com/online-late.jpg'}]}}});});
  await page.route('**/api/match/**',async route=>{
    const action=new URL(route.request().url()).pathname.split('/').at(-1);
    if(action==='leave'&&++departures===1){await leavePending;return route.fulfill({status:503,json:{error:'匹配服務暫時無法連線'}});}
    return route.fulfill({json:action==='leave'?{status:'idle'}:action==='join'&&++joins>1?{status:'waiting'}:response});
  });
  try {
    await prepare(page);const saved=parseProfile(JSON.parse(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))));
    await page.locator('[data-nav="collection"]').click();const requested=page.waitForRequest('https://api.imgflip.com/get_memes');
    await page.getByRole('button',{name:'更新網路卡庫',exact:true}).click();await requested;
    await page.locator('[data-nav="battle"]').click();await join(page);
    await expect(page.locator('#online-status')).toContainText('輪到你部署');
    response=replay;await expect(page.locator('.duel-board')).toHaveClass(/is-battling/);
    const canvas=await page.locator('#arena').elementHandle();releaseCatalog();
    await expect(page.locator('#toast')).toContainText('已更新 1 個模板');expect(await canvas.evaluate(node=>node.isConnected)).toBe(true);
    await page.getByRole('button',{name:'離開對局',exact:true}).click();await page.getByRole('button',{name:'確認離開',exact:true}).click();
    await expect(page.getByRole('button',{name:'離開對局',exact:true})).toBeDisabled();expect(await canvas.evaluate(node=>node.isConnected)).toBe(false);
    releaseLeave();await expect(page.locator('#online-status')).toHaveText('連線中斷，正在重試');
    await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible({timeout:10000});expect(departures).toBe(2);
    expect(await page.evaluate(()=>sessionStorage.getItem('meme-clash-online'))).toBeNull();
    expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('meme-clash-v1')))).toEqual({...saved,web:[{id:'online-late',name:'Online late meme',url:'https://i.imgflip.com/online-late.jpg'}]});
    response={status:'waiting'};await join(page);await expect(page.locator('#online-status')).toHaveText('尋找對手中');expect(errors).toEqual([]);
    await page.getByRole('button',{name:'取消匹配',exact:true}).click();await expect(page.getByRole('button',{name:'匹配對戰',exact:true})).toBeVisible();
  } finally {releaseCatalog();releaseLeave();}
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
