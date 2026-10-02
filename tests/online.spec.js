import { test, expect } from '@playwright/test';

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
