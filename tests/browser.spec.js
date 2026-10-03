import { test, expect } from '@playwright/test';
import { freshProfile, parseProfile } from '../src/storage.js';
import { CATALOG } from '../src/catalog.js';
import { DRAFT_KEY } from '../src/draft.js';

test('failed card art falls back without changing authored names or saved data',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const profile=freshProfile();profile.custom=['broken','working','empty'].map((id,i)=>({id:`custom-art-${id}`,name:['生命故障圖','生命正常圖','生命無圖'][i],type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:i===2?'':`https://art.test/${id}.png`,flavor:'',effects:[]}));profile.deck[0]=profile.custom[0].id;
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);
  await page.route('https://art.test/broken.png',route=>route.fulfill({status:404,body:'missing'}));
  await page.route('https://art.test/working.png',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'}));
  await page.goto('/');await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');
  const broken=page.locator('[data-card="custom-art-broken"]'),working=page.locator('[data-card="custom-art-working"]'),empty=page.locator('[data-card="custom-art-empty"]');
  await expect(broken.locator('.art-fallback')).toHaveText('生命');await expect(broken.locator('img')).toHaveCount(0);
  await expect(empty.locator('.art-fallback')).toHaveText('生命');await expect(working.locator('img')).toHaveJSProperty('naturalWidth',20);
  await page.locator('.deck-list').scrollIntoViewIfNeeded();await expect(page.locator('.deck-row').first().locator('.art-fallback')).toHaveText('生命');
  await expect(broken.locator('.art-fallback')).toHaveAttribute('aria-label','生命故障圖');
  const portrait=await page.locator('.deck-row').first().locator('.art-fallback').boundingBox();expect(portrait.width).toBe(34);expect(portrait.height).toBe(36);
  await broken.click();await expect(page.locator('.detail-art .art-fallback')).toHaveText('生命');await expect(page.locator('.detail-art img')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('failed-art-dialog.png')});await page.getByRole('button',{name:'關閉',exact:true}).click();
  await page.locator('[data-action="appearance"]').click();await page.locator('#interface-language').selectOption('en');await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(broken.locator('.art-fallback')).toHaveText('生命');await expect(empty.locator('.art-fallback')).toHaveText('生命');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(profile);
  await page.setViewportSize({width:390,height:844});await broken.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('failed-art-mobile.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('failed duel art fits avatars and occupied lanes on desktop and mobile',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const profile=freshProfile();profile.custom=Array.from({length:5},(_,i)=>({id:`custom-duel-art-${i}`,name:`生命角色 ${i}`,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'https://art.test/broken.png',flavor:'',effects:[]}));profile.deck=profile.custom.flatMap(c=>[c.id,c.id]);
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);await page.route('https://art.test/broken.png',route=>route.fulfill({status:404,body:'missing'}));await page.goto('/');
  const art=page.locator('.board-slot.side-0.occupied>.art-fallback'),avatar=page.locator('.player-hud.side-0 .art-fallback');await expect(art).toHaveText('生命');await expect(avatar).toHaveText('生命');
  for(const [width,height,artHeight,avatarHeight] of [[1440,1080,92,44],[390,844,65,33]]){
    await page.setViewportSize({width,height});expect((await art.boundingBox()).height).toBe(artHeight);expect((await avatar.boundingBox()).height).toBe(avatarHeight);
    expect(await art.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;})).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath(`failed-duel-${width}.png`)});
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(profile);
  expect(errors).toEqual([]);
});

test('arena image cache stays bounded while reusing active art and reloading evicted images',async({page})=>{
  test.skip(!!process.env.TEST_BASE_URL,'Image cache instrumentation requires the managed Vite source server.');
  await page.route('**/cache-test/*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'}));
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {Arena}=await import('/src/arena.js'),{createGame}=await import('/src/game.js');
    const canvas=document.createElement('canvas'),game=createGame(),arena=new Arena(canvas,game,()=>{},()=>{});arena.destroy();
    const set=Map.prototype.set;let cache;
    Map.prototype.set=function(key,value){if(typeof key==='string'&&key.startsWith('/cache-test/'))cache=this;return set.call(this,key,value);};
    const unit={...game.units[0],image:'/cache-test/hot.svg'};
    try{
      arena.drawUnit(unit,100,100);const hot=cache.get(unit.image);let first;
      for(let i=0;i<260;i++){arena.drawUnit({...unit,image:`/cache-test/${i}.svg`},100,100);if(i===0)first=cache.get('/cache-test/0.svg');arena.drawUnit(unit,100,100);}
      const size=cache.size,hotReused=cache.get(unit.image)===hot,oldestEvicted=!cache.has('/cache-test/0.svg');
      arena.drawUnit({...unit,image:'/cache-test/0.svg'},100,100);const reloaded=cache.get('/cache-test/0.svg');await reloaded.decode();arena.drawUnit({...unit,image:'/cache-test/0.svg'},100,100);
      return {size,finalSize:cache.size,hotReused,oldestEvicted,reloaded:reloaded!==first,pixel:[...arena.ctx.getImageData(100,100,1,1).data]};
    }finally{Map.prototype.set=set;arena.destroy();}
  });
  expect(result.size).toBeLessThanOrEqual(128);expect(result.finalSize).toBeLessThanOrEqual(128);expect(result.hotReused).toBeTruthy();expect(result.oldestEvicted).toBeTruthy();expect(result.reloaded).toBeTruthy();expect(result.pixel).toEqual([255,0,0,255]);
});

test('discarding a new card draft confirms first and clears only after storage removal succeeds',async({page})=>{
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();
  await page.locator('#card-form [name="name"]').fill('準備放棄的草稿');await page.locator('#card-form [name="hp"]').fill('');
  const profile=await page.evaluate(()=>localStorage.getItem('meme-clash-v1')),draft=await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY);
  await page.getByRole('button',{name:'清除草稿',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBe(draft);await expect(page.locator('#card-form [name="name"]')).toHaveValue('準備放棄的草稿');
  await page.evaluate(key=>{window.clearFails=true;const remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(k===key&&window.clearFails)throw new Error('denied');return remove.call(this,k);};},DRAFT_KEY);
  await page.getByRole('button',{name:'清除草稿',exact:true}).click();await page.locator('#confirm-clear-draft').click();await expect(page.locator('#toast')).toContainText('無法清除暫存草稿');
  await expect(page.getByRole('heading',{name:'清除這份草稿？',exact:true})).toBeVisible();expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBe(draft);
  await page.keyboard.press('Escape');await expect(page.locator('#card-form [name="name"]')).toHaveValue('準備放棄的草稿');await expect(page.locator('#card-form [name="hp"]')).toHaveValue('');
  await page.evaluate(()=>window.clearFails=false);await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'清除草稿',exact:true}).click();await page.screenshot({path:'.artifacts/clear-draft-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.locator('#confirm-clear-draft').click();
  await expect(page.locator('#card-form [name="name"]')).toHaveValue('');await expect(page.locator('#card-form [name="hp"]')).toHaveValue('12');expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBeNull();
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(profile);await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#card-form [name="name"]')).toHaveValue('');
});

test('card drafts restore blank values and zero effects after reload without touching profiles',async({page,context})=>{
  await page.goto('/');const stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.locator('[data-nav="workshop"]').click();
  const form=()=>page.locator('#card-form');
  await form().locator('[name="name"]').fill('重新整理草稿');await form().locator('[name="flavor"]').fill('未完成 "輸入"');
  await form().locator('[name="hp"]').fill('');await form().locator('[name="amount"]').fill('');
  for(let i=0;i<3;i++)await page.locator('[data-action="add-effect"]').click();
  await page.reload();await page.locator('[data-nav="workshop"]').click();
  await expect(form().locator('[name="name"]')).toHaveValue('重新整理草稿');await expect(form().locator('[name="flavor"]')).toHaveValue('未完成 "輸入"');
  await expect(form().locator('[name="hp"]')).toHaveValue('');await expect(form().locator('[name="amount"]').first()).toHaveValue('');await expect(form().locator('.effect-row')).toHaveCount(4);
  const other=await context.newPage();await other.goto('/');await other.locator('[data-nav="workshop"]').click();await expect(other.locator('#card-form [name="name"]')).toHaveValue('');await other.close();
  for(let i=0;i<4;i++)await page.locator('[data-action="remove-effect"]').first().click();
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(form().locator('.effect-row')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await form().locator('[name="hp"]').fill('17');await form().locator('[type="submit"]').click();
  expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBeNull();
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(form().locator('[name="name"]')).toHaveValue('');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom[0].effects)).toEqual([]);
});

test('edit drafts restore only unchanged source cards and never overwrite changed sources',async({page})=>{
  const profile=freshProfile(),original={id:'custom-reload-edit',name:'原始角色',type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'原始宣言',effects:[]};profile.custom=[original];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  const form=()=>page.locator('#card-form');
  const edit=async()=>{await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');await page.locator(`[data-card="${original.id}"]`).click();await page.locator(`[data-edit="${original.id}"]`).click();};
  await page.goto('/');await edit();const stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await form().locator('[name="name"]').fill('保留編輯');await form().locator('[name="hp"]').fill('');
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toBeVisible();
  await expect(form().locator('[name="name"]')).toHaveValue('保留編輯');await expect(form().locator('[name="hp"]')).toHaveValue('');expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await form().locator('[name="hp"]').fill('24');await form().locator('[type="submit"]').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom.map(c=>c.id))).toEqual([original.id]);expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBeNull();
  await edit();await form().locator('[name="name"]').fill('取消內容');await page.locator('[data-action="cancel-edit"]').click();
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(form().locator('[name="name"]')).toHaveValue('');expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBeNull();
  await edit();await form().locator('[name="name"]').fill('匯入前草稿');
  const incoming=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));incoming.custom[0].name='匯入的新版本';
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-action="import"]').click();await (await chooser).setFiles({name:'changed-source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});await page.locator('#confirm-import').click();
  await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toHaveCount(0);await expect(form().locator('[name="name"]')).toHaveValue('匯入前草稿');
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(form().locator('[name="name"]')).toHaveValue('匯入前草稿');await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toHaveCount(0);
  for(const remove of [false,true]){
    await edit();await form().locator('[name="name"]').fill(remove?'來源刪除草稿':'來源更新草稿');
    await page.evaluate(remove=>{const p=JSON.parse(localStorage.getItem('meme-clash-v1'));if(remove)p.custom=p.custom.filter(c=>c.id!=='custom-reload-edit');else p.custom.find(c=>c.id==='custom-reload-edit').name='外部新版';localStorage.setItem('meme-clash-v1',JSON.stringify(p));},remove);
    await page.reload();await expect(page.locator('#toast')).toContainText('原卡牌已變更');await page.locator('[data-nav="workshop"]').click();
    await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toHaveCount(0);await expect(form().locator('[name="name"]')).toHaveValue(remove?'來源刪除草稿':'來源更新草稿');
    await form().locator('[type="submit"]').click();const custom=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom);
    expect(custom.at(-1).id).not.toBe(original.id);if(!remove)expect(custom.find(c=>c.id===original.id).name).toBe('外部新版');else expect(custom.some(c=>c.id===original.id)).toBeFalsy();
  }
});

test('draft storage failures preserve editor memory and malformed drafts remain harmless',async({page})=>{
  await page.goto('/');const stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));await page.locator('[data-nav="workshop"]').click();
  await page.evaluate(key=>{window.draftFails=true;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&window.draftFails)throw new Error('quota');return set.call(this,k,v);};},DRAFT_KEY);
  await page.locator('#card-form [name="name"]').fill('記憶體草稿');await expect(page.locator('#toast')).toContainText('無法暫存草稿');
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#card-form [name="name"]')).toHaveValue('記憶體草稿');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.evaluate(()=>window.draftFails=false);await page.locator('#card-form [name="name"]').fill('再次暫存');await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#card-form [name="name"]')).toHaveValue('再次暫存');
  await page.locator('#card-form [type="submit"]').click();const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom[0].id);
  await page.locator(`[data-card="${id}"]`).click();await page.locator(`[data-edit="${id}"]`).click();
  await page.evaluate(key=>{const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new Error('quota');return set.call(this,k,v);};Storage.prototype.removeItem=function(k){if(k===key)throw new Error('denied');return remove.call(this,k);};},DRAFT_KEY);
  await page.locator('#card-form [name="name"]').fill('取消失敗的編輯');await expect(page.locator('#toast')).toContainText('無法暫存草稿');await page.locator('[data-action="cancel-edit"]').click();await expect(page.locator('#toast')).toContainText('無法清除暫存草稿');
  await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toBeVisible();await expect(page.locator('#card-form [name="name"]')).toHaveValue('取消失敗的編輯');
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toBeVisible();await expect(page.locator('#card-form [name="name"]')).toHaveValue('再次暫存');
  await page.locator('[data-action="cancel-edit"]').click();await page.locator('#card-form [name="name"]').fill('不可信輸入');
  await page.evaluate(key=>{const draft=JSON.parse(sessionStorage.getItem(key));draft.card.cost=draft.card.speed=draft.card.attack=draft.card.hp=draft.card.effects[0].amount='" onfocus="window.injected=1';sessionStorage.setItem(key,JSON.stringify(draft));},DRAFT_KEY);
  await page.reload();await page.locator('[data-nav="workshop"]').click();expect(await page.locator('#card-form [onfocus]').count()).toBe(0);expect(await page.evaluate(()=>window.injected)).toBeUndefined();
  await page.evaluate(key=>sessionStorage.setItem(key,'{broken'),DRAFT_KEY);await page.reload();await expect(page.locator('#toast')).toContainText('無法讀取暫存草稿');await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#card-form [name="name"]')).toHaveValue('');
  expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBe('{broken');
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));await page.getByRole('button',{name:'清除草稿',exact:true}).click();await page.locator('#confirm-clear-draft').click();expect(await page.evaluate(key=>sessionStorage.getItem(key),DRAFT_KEY)).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
});

test('card sources keep imported library details fresh and active battle previews unchanged',async({page})=>{
  const profile=freshProfile(),original={id:'custom-source-test',name:'當局舊卡',type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'原始效果',effects:[{trigger:'hit',action:'shield',target:'self',amount:3}]};
  profile.custom=[original];profile.deck=[original.id,'tape','imagination','stonks','handshake','reverse','safe','suit','fusion','tape'];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  await expect(page.locator('.own-formation .board-unit-name')).toHaveText(original.name);
  await page.locator('[data-nav="collection"]').click();
  const incoming={...profile,custom:[{...original,name:'卡庫新版本',attack:9,flavor:'匯入效果',effects:[{trigger:'hit',action:'damage',target:'enemies',amount:9}]}]};
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-action="import"]').click();await (await chooser).setFiles({name:'updated-card.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
  await page.locator('#confirm-import').click();const stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');
  const library=page.locator(`.catalog-grid [data-card="${original.id}"]`);await library.hover();
  await expect(page.locator('#card-effect-preview')).toBeVisible();await expect(page.locator('#card-effect-preview>b')).toHaveText(incoming.custom[0].name);
  await library.click();await expect(page.locator('.card-detail h2')).toHaveText(incoming.custom[0].name);await expect(page.locator('.effect-detail')).toContainText('9');
  await page.locator('[data-preview]').click();await expect(page.locator('#modal-preview-stage>b')).toHaveText(incoming.custom[0].name);
  await page.keyboard.press('Escape');await page.locator('[data-nav="battle"]').click();
  await expect(page.locator('.own-formation .board-unit-name')).toHaveText(original.name);
  await page.locator('.own-formation .occupied').click();await page.locator('[data-action="inspect"]').click();
  await expect(page.locator('.card-detail h2')).toHaveText(original.name);await expect(page.locator('.effect-detail')).toContainText('3');
  await page.locator('[data-preview]').click();await expect(page.locator('#modal-preview-stage>b')).toHaveText(original.name);
  await expect(page.locator('#modal-preview-stage canvas')).toBeVisible();await expect(page.locator('.own-formation .board-unit-name')).toHaveText(original.name);
  await page.locator('[data-preview]').evaluate(button=>button.dataset.preview='missing-card');await page.locator('[data-preview]').click();
  await expect(page.locator('#modal-preview-stage>b')).toHaveText(original.name);
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);expect(errors).toEqual([]);
});

test('stale tabs cannot overwrite another tab cards or recovery replacements',async({page,context})=>{
  await page.goto('/');const other=await context.newPage();await other.goto('/');
  const craft=async(tab,name)=>{await tab.locator('[data-nav="workshop"]').click();await tab.locator('#card-form [name="name"]').fill(name);await tab.locator('#card-form [type="submit"]').click();};
  const stored=()=>page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await craft(page,'分頁 A 的新卡');const first=await stored();
  await craft(other,'分頁 B 的草稿');await expect(other.locator('#toast')).toContainText('存檔已在其他分頁更新');
  expect(await stored()).toBe(first);await expect(other.locator('#card-form [name="name"]')).toHaveValue('分頁 B 的草稿');
  const download=other.waitForEvent('download');await other.locator('[data-action="export"]').click();
  const file=await download,stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8')).custom).toEqual([]);
  await page.reload();await other.reload();await expect(other.getByRole('heading',{name:'存檔無法讀取',exact:true})).toHaveCount(0);
  const editing=JSON.parse(first).custom[0].id;await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');await page.locator(`[data-card="${editing}"]`).click();await page.locator(`[data-edit="${editing}"]`).click();await page.locator('#card-form [name="name"]').fill('跨頁衝突的編輯草稿');
  await craft(other,'分頁 B 的新卡');const second=await stored();expect(JSON.parse(second).custom.map(card=>card.name)).toEqual(['分頁 A 的新卡','分頁 B 的新卡']);
  await craft(other,'分頁 B 的第三張卡');const third=await stored();expect(JSON.parse(third).custom).toHaveLength(3);
  await page.locator('#card-form [type="submit"]').click();await expect(page.locator('#toast')).toContainText('存檔已在其他分頁更新');await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toBeVisible();await expect(page.locator('#card-form [name="name"]')).toHaveValue('跨頁衝突的編輯草稿');expect(await stored()).toBe(third);
  await page.locator('[data-nav="workshop"]').click();await page.locator('[data-remove]').first().click();await expect(page.locator('#toast')).toContainText('存檔已在其他分頁更新');expect(await stored()).toBe(third);
  const damaged='{"version":1,"custom":[';await page.evaluate(raw=>localStorage.setItem('meme-clash-v1',raw),damaged);await page.reload();
  await expect(page.getByRole('heading',{name:'存檔無法讀取',exact:true})).toBeVisible();
  await other.evaluate(raw=>localStorage.setItem('meme-clash-v1',raw),third);
  await page.locator('#confirm-reset-save').click();await expect(page.locator('#toast')).toContainText('存檔已在其他分頁更新');expect(await stored()).toBe(third);
  await expect(page.getByRole('heading',{name:'存檔無法讀取',exact:true})).toBeVisible();
  await page.reload();await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(3);
});

test('unfinished card drafts survive redraws and clear only after successful creation',async({page})=>{
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();
  const form=()=>page.locator('#card-form');
  const read=()=>form().evaluate(form=>({...Object.fromEntries(new FormData(form)),effects:[...form.querySelectorAll('.effect-row')].map(row=>Object.fromEntries([...row.querySelectorAll('input,select')].map(input=>[input.name,input.value])))}));
  await form().locator('[name="name"]').fill('草稿 原創角色');await form().locator('[name="flavor"]').fill('尚未完成 "狀態"');
  await form().locator('[name="tag"]').selectOption('brain');await form().locator('[name="cost"]').fill('');await form().locator('[name="hp"]').fill('');
  await form().locator('[name="trigger"]').selectOption('round');await page.locator('[data-action="add-effect"]').click();
  await form().locator('[name="action"]').nth(1).selectOption('draw');await form().locator('[name="amount"]').nth(1).fill('');
  const original=await read();
  await page.locator('[data-action="appearance"]').click();await page.locator('#interface-language').selectOption('en');await page.keyboard.press('Escape');
  expect(await read()).toEqual(original);
  await page.locator('[data-action="appearance"]').click();await page.locator('[name="theme"]').nth(1).check();await page.keyboard.press('Escape');
  expect(await read()).toEqual(original);
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();expect(await read()).toEqual(original);
  await page.locator('#deck-name').fill('Draft companion');await page.locator('[data-action="save-deck"]').click();expect(await read()).toEqual(original);
  await page.locator('[data-preset="chaos"]').click();expect(await read()).toEqual(original);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom)).toEqual([]);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await form().locator('[name="cost"]').fill('2');await form().locator('[name="hp"]').fill('23');await form().locator('[name="amount"]').nth(1).fill('7');
  await form().locator('[name="type"]').selectOption('trap');
  expect(await form().locator('[name="trigger"]').evaluateAll(selects=>selects.map(select=>select.value))).toEqual(['hit','hit']);
  const trap=await read();await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();expect(await read()).toEqual(trap);
  await page.locator('[data-action="remove-effect"]').first().click();await page.locator('[data-action="remove-effect"]').first().click();
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('.effect-row')).toHaveCount(0);
  await page.locator('[data-action="add-effect"]').click();await expect(form().locator('[name="trigger"]')).toHaveValue('hit');
  await page.evaluate(()=>{window.storageFails=true;const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return setItem.call(this,key,value);};});
  await form().locator('[type="submit"]').click();await expect(page.locator('#toast')).toContainText('Browser storage unavailable');
  const rejected=await read();await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();expect(await read()).toEqual(rejected);
  await page.evaluate(()=>window.storageFails=false);await form().locator('[type="submit"]').click();
  const custom=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom);expect(custom).toHaveLength(1);
  expect(custom[0].name).toBe(original.name);expect(custom[0].type).toBe('trap');expect(custom[0].effects[0].trigger).toBe('hit');
  await page.locator('[data-nav="workshop"]').click();await expect(form().locator('[name="name"]')).toHaveValue('');
  await expect(form().locator('[name="type"]')).toHaveValue('monster');await expect(form().locator('[name="trigger"]')).toHaveValue('play');
});

test('unreadable saves remain recoverable until an explicit replacement succeeds',async({page})=>{
  const raw='{"version":1,"custom":[{"name":"不可遺失的卡牌"}]';
  await page.addInitScript(raw=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',raw);},raw);
  await page.goto('/');await page.keyboard.press('Escape');await page.locator('[data-nav="collection"]').click();
  await page.locator('[data-remove]').first().click();
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(raw);
  await expect(page.getByRole('heading',{name:'存檔無法讀取',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await page.locator('[data-nav="workshop"]').click();
  await page.locator('#card-form [name="name"]').fill('恢復鎖中的草稿');await page.locator('#card-form [type="submit"]').click();
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(raw);
  await page.keyboard.press('Escape');await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();
  await expect(page.locator('#card-form [name="name"]')).toHaveValue('恢復鎖中的草稿');
  await page.getByRole('button',{name:'原始存檔恢復',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載原始存檔',exact:true}).click();
  const file=await download;expect(file.suggestedFilename()).toBe('meme-clash-recovery.json');
  const stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(raw);
  await page.screenshot({path:'.artifacts/save-recovery-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.artifacts/save-recovery-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  const actions=await page.locator('.save-recovery .dialog-actions>button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,fits:button.scrollWidth<=button.clientWidth};}));
  expect(actions.every(button=>button.width>280&&button.height<80&&button.fits)).toBeTruthy();
  expect(actions[1].y).toBeGreaterThan(actions[0].y+actions[0].height);expect(actions[2].y).toBeGreaterThan(actions[1].y+actions[1].height);
  await page.getByRole('button',{name:'關閉',exact:true}).click();
  await page.getByRole('button',{name:'原始存檔恢復',exact:true}).click();
  await page.evaluate(()=>{window.storageFails=true;const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return setItem.call(this,key,value);};});
  await page.getByRole('button',{name:'覆寫為預設卡組',exact:true}).click();await expect(page.locator('#toast')).toContainText('瀏覽器儲存空間不足');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(raw);
  await expect(page.getByRole('heading',{name:'存檔無法讀取',exact:true})).toBeVisible();
  await page.evaluate(()=>window.storageFails=false);await page.getByRole('button',{name:'覆寫為預設卡組',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(freshProfile());
  await expect(page.getByRole('button',{name:'原始存檔恢復',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.locator('#modal')).not.toBeVisible();
});

test('recovery imports restore backup statistics only after a successful confirmed write',async({page})=>{
  const backup=freshProfile();backup.stats={wins:7,losses:4,games:11};
  backup.decks=[{id:'recovered-deck',name:'Recovered deck',deck:[...backup.deck]}];
  await page.addInitScript(()=>{if(localStorage.getItem('meme-clash-v1')===null)localStorage.setItem('meme-clash-v1','');localStorage.setItem('meme-clash-language','en');});
  await page.goto('/');await expect(page.getByRole('heading',{name:'Save could not be read',exact:true})).toBeVisible();
  const upload=async()=>{
    const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import',exact:true}).click();
    await (await chooser).setFiles({name:'recovered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  };
  await upload();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe('');
  await page.getByRole('button',{name:'Recover original save',exact:true}).click();await upload();
  await page.evaluate(()=>{window.storageFails=true;const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return setItem.call(this,key,value);};});
  await page.locator('#confirm-import').click();await expect(page.locator('#toast')).toContainText('Browser storage unavailable');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe('');
  await page.evaluate(()=>window.storageFails=false);await page.locator('#confirm-import').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(backup);
  await expect(page.getByRole('button',{name:'Recover original save',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.locator('#modal')).not.toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).stats)).toEqual(backup.stats);
});

test('latest selected import keeps its confirmation when older reads finish or fail',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const profile=freshProfile(),incoming=freshProfile();
  incoming.custom=['first','second'].map(id=>({id:`custom-import-${id}`,name:id,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}));
  await page.addInitScript(profile=>{
    localStorage.setItem('meme-clash-v1',JSON.stringify(profile));localStorage.setItem('meme-clash-language','en');
    const text=File.prototype.text;
    File.prototype.text=function(){
      const read=text.call(this);
      if(this.name==='slow-error.json')return new Promise((resolve,reject)=>{window.finishImport=()=>reject(new Error('Old read failed'));});
      if(this.name==='slow.json')return new Promise((resolve,reject)=>{window.finishImport=()=>read.then(resolve,reject);});
      return read;
    };
  },profile);
  await page.goto('/');await page.locator('[data-nav="collection"]').click();
  const upload=async(name,raw)=>{
    const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import',exact:true}).click();
    await (await chooser).setFiles({name,mimeType:'application/json',buffer:Buffer.from(raw)});
  };
  for(const [name,old] of [['slow.json',JSON.stringify(profile)],['slow.json','{'],['slow-error.json','']]){
    await upload(name,old);await upload('latest.json',JSON.stringify(incoming));
    await expect(page.locator('#confirm-import')).toBeVisible();const confirmation=await page.locator('#modal').textContent();
    await page.evaluate(()=>window.finishImport());
    await expect(page.locator('#modal')).toHaveText(confirmation);
    await expect(page.locator('#toast')).not.toContainText('Import failed');
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(profile);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  await upload('latest.json',JSON.stringify(incoming));await page.locator('#confirm-import').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(parseProfile(incoming));
  expect(errors).toEqual([]);
});

test('deck-only updates reuse the catalog and empty searches skip per-card text construction',async({page})=>{
  const profile=freshProfile();
  profile.web=Array.from({length:1000},(_,i)=>({id:`catalog-cache-${i}`,name:`Dancing ${i}`,url:'https://example.com/template.png'}));
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);
  await page.goto('/');await page.locator('[data-nav="collection"]').click();
  await expect(page.locator('.results-heading')).toContainText(String(CATALOG.length+profile.web.length));
  const work=await page.evaluate(()=>{
    const clone=window.structuredClone,lower=String.prototype.toLowerCase;let clones=0,searches=0;
    window.structuredClone=(...args)=>{clones++;return clone(...args);};
    String.prototype.toLowerCase=function(){if(this.startsWith('Dancing '))searches++;return lower.call(this);};
    try {document.querySelector('[data-remove]').click();return {clones,searches};}
    finally {window.structuredClone=clone;String.prototype.toLowerCase=lower;}
  });
  expect(work).toEqual({clones:0,searches:0});await expect(page.locator('.deck-count')).toContainText(String(profile.deck.length-1));
  await page.getByRole('searchbox',{name:'搜尋卡牌'}).fill('DANCING 987');await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(1);await expect(page.locator('.catalog-grid .meme-card')).toContainText('Dancing 987');
  const searches=await page.evaluate(()=>{
    const lower=String.prototype.toLowerCase;let count=0;
    String.prototype.toLowerCase=function(){if(this.startsWith('Dancing '))count++;return lower.call(this);};
    try {const input=document.querySelector('#search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));return count;}
    finally {String.prototype.toLowerCase=lower;}
  });
  expect(searches).toBe(0);await expect(page.locator('.results-heading')).toContainText(String(CATALOG.length+profile.web.length));
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).web.length)).toBe(1000);
});

test('catalog search keeps the composing input until commit or cancellation',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const profile=freshProfile();profile.custom=['中文迷因','日本語ミーム'].map((name,i)=>({id:`custom-ime-${i}`,name,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}));
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);await page.goto('/');
  await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1')),search=page.getByRole('searchbox',{name:'搜尋卡牌'}),cards=page.locator('.catalog-grid .meme-card');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:844});await search.fill('');await expect(cards).toHaveCount(2);
    const composing=await search.evaluate(input=>{
      input.focus();input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      for(const value of ['ㄓ','中文']){input.value=value;input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText',data:value}));}
      return {connected:input.isConnected,focused:document.activeElement===input};
    });
    expect(composing).toEqual({connected:true,focused:true});await expect(cards).toHaveCount(2);
    await search.evaluate(input=>{input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'}));input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:false}));});
    await expect(search).toHaveValue('中文');await expect(search).toBeFocused();await expect(cards).toHaveCount(1);await expect(cards).toContainText('中文迷因');
    const cancelled=await search.evaluate(input=>{
      input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='取消候選';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
      const connected=input.isConnected;input.value='中文';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:''}));return connected;
    });
    expect(cancelled).toBe(true);await expect(search).toHaveValue('中文');await expect(cards).toHaveCount(1);
    await search.fill('日本語');await expect(cards).toHaveCount(1);await expect(cards).toContainText('日本語ミーム');
  }
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  expect(errors).toEqual([]);
});

test('collection sorts every matching card before pagination without changing saved cards',async({page})=>{
  const profile=freshProfile();profile.custom=Array.from({length:26},(_,i)=>({id:`custom-sort-${i}`,name:i===0?'Sort 10':i===1?'Sort 2':`Z ${i}`,type:'monster',tag:'bonk',cost:i===25?0:1,attack:i,hp:i+10,speed:5,image:'',flavor:'',effects:[]}));
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);
  await page.goto('/');await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1')),cards=page.locator('.catalog-grid [data-card]'),order=page.getByRole('combobox',{name:'卡牌排序',exact:true});
  await expect(cards).toHaveCount(24);await expect(cards.first()).toHaveAttribute('data-card','custom-sort-0');
  await page.locator('[data-action="more"]').click();await expect(cards).toHaveCount(26);
  for(const mode of ['cost','attack','hp']) {await order.selectOption(mode);await expect(cards).toHaveCount(24);await expect(cards.first()).toHaveAttribute('data-card','custom-sort-25');}
  await order.selectOption('name');await expect(cards.nth(0)).toHaveAttribute('data-card','custom-sort-1');await expect(cards.nth(1)).toHaveAttribute('data-card','custom-sort-0');
  await page.getByRole('searchbox',{name:'搜尋卡牌'}).fill('Sort');await expect(cards).toHaveCount(2);await expect(cards.first()).toHaveAttribute('data-card','custom-sort-1');
  await page.locator('[data-nav="workshop"]').click();await page.locator('[data-nav="collection"]').click();await expect(order).toHaveValue('name');await expect(cards).toHaveCount(2);
  await page.locator('[data-action="appearance"]').click();await page.locator('#interface-language').selectOption('en');await page.keyboard.press('Escape');await expect(page.getByRole('combobox',{name:'Card order',exact:true})).toHaveValue('name');
  await expect(page.locator('#sort-order option[value="cost"]')).toHaveText('Energy: low to high');await expect(cards.first()).toContainText('Sort 2');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'.artifacts/card-sort-mobile.png',fullPage:true});
  await page.getByRole('searchbox',{name:'Search cards'}).fill('');await page.locator('#sort-order').selectOption('catalog');await expect(cards.first()).toHaveAttribute('data-card','custom-sort-0');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
});

test('named deck drafts save empty and role-free builds but cannot start a duel',async({page})=>{
  const profile=freshProfile();profile.deck=[];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();await page.getByLabel('卡組名稱',{exact:true}).fill('未完成構思');await page.getByRole('button',{name:'保存卡組',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('卡組草稿已保存');
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0]);expect(draft.deck).toEqual([]);
  const unit=CATALOG.find(c=>c.type==='monster').id;
  await page.locator('[data-nav="collection"]').click();await page.locator(`.catalog-grid [data-card="${unit}"]`).click();await page.locator(`[data-add="${unit}"]`).click();
  await page.locator('[data-nav="workshop"]').click();await page.getByRole('button',{name:'保存卡組',exact:true}).click();await page.locator('#confirm-save-deck').click();await expect(page.locator('#toast')).toHaveText('卡組草稿已保存');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0].deck)).toEqual([unit]);await page.locator(`[data-remove="${unit}"]`).click();
  const cards=['tape','imagination','stonks','handshake','reverse','safe','suit','fusion','tape','imagination'];
  await page.locator('[data-nav="collection"]').click();
  for(const id of cards){await page.locator(`.catalog-grid [data-card="${id}"]`).click();await page.locator(`[data-add="${id}"]`).click();}
  await page.locator('[data-nav="workshop"]').click();await page.getByRole('button',{name:'保存卡組',exact:true}).click();await page.locator('#confirm-save-deck').click();
  const updated=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0]);expect(updated).toEqual({...draft,deck:cards});
  await page.getByRole('button',{name:'使用卡組對決',exact:true}).click();await page.locator('#match-form [type="submit"]').click();await expect(page.locator('#match-error')).toContainText('角色');await page.keyboard.press('Escape');
  await page.locator('[data-preset="chaos"]').click();await page.getByLabel('卡組名稱',{exact:true}).fill('完整構思');await page.getByRole('button',{name:'保存卡組',exact:true}).click();await expect(page.locator('#toast')).toHaveText('卡組已保存');
  await page.getByLabel('已保存卡組',{exact:true}).selectOption(draft.id);await page.reload();await page.locator('[data-nav="workshop"]').click();await page.getByLabel('已保存卡組',{exact:true}).selectOption(draft.id);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));expect(stored.deck).toEqual(cards);expect(stored.decks).toHaveLength(2);expect(stored.decks[0]).toEqual(updated);
  const file=page.waitForEvent('download');await page.getByRole('button',{name:'匯出',exact:true}).click();const stream=await (await file).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const buffer=Buffer.concat(chunks);
  expect(parseProfile(JSON.parse(buffer.toString('utf8'))).decks).toEqual(stored.decks);
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-action="import"]').click();await (await chooser).setFiles({name:'drafts.json',mimeType:'application/json',buffer});await page.locator('#confirm-import').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(stored);
});

test('saved deck workshop saves, switches, overwrites, reloads, exports and deletes independently',async({page})=>{
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();
  await page.getByLabel('卡組名稱',{exact:true}).fill('魔法工坊');await page.getByRole('button',{name:'保存卡組',exact:true}).click();
  const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0]);
  await page.locator('[data-preset="chaos"]').click();
  await page.getByLabel('卡組名稱',{exact:true}).fill('第二組');await page.getByRole('button',{name:'保存卡組',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));
  expect(saved.decks).toHaveLength(2);expect(saved.decks[0]).toEqual(first);expect(saved.decks[1].deck).not.toEqual(first.deck);
  await page.getByRole('button',{name:'全球隨機套裝',exact:true}).click();await page.locator('#confirm-random').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks)).toEqual(saved.decks);
  await page.getByLabel('已保存卡組',{exact:true}).selectOption(first.id);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).deck)).toEqual(first.deck);
  await page.locator('[data-remove]').first().click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0])).toEqual(first);
  await page.getByRole('button',{name:'保存卡組',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0])).toEqual(first);
  await page.getByRole('button',{name:'保存卡組',exact:true}).click();await page.getByRole('button',{name:'確認覆寫',exact:true}).click();
  const overwritten=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0]);
  expect(overwritten.deck).toHaveLength(first.deck.length-1);
  await page.reload();await page.locator('[data-nav="workshop"]').click();
  await page.getByLabel('已保存卡組',{exact:true}).selectOption(saved.decks[1].id);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).deck)).toEqual(saved.decks[1].deck);
  await page.screenshot({path:'.artifacts/saved-decks-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/saved-decks-mobile.png',fullPage:true});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'匯出',exact:true}).click();
  const stream=await (await download).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());expect(exported.decks).toEqual([overwritten,saved.decks[1]]);
  await page.getByRole('button',{name:'刪除已保存卡組',exact:true}).click();await page.locator('#confirm-delete-deck').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks)).toEqual([overwritten]);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).deck)).toEqual(saved.decks[1].deck);
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#saved-deck option')).toHaveCount(2);
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'匯入',exact:true}).click();
  await (await chooser).setFiles({name:'decks.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await page.locator('#confirm-import').click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks)).toEqual(exported.decks);
});

test('failed result saves preserve live statistics and later matches count exactly once',async({page})=>{
  const profile=freshProfile();profile.stats={wins:3,losses:2,games:5};
  profile.custom=Array.from({length:10},(_,i)=>({id:`custom-result-${i}`,name:`Result ${i}`,type:'monster',tag:'bonk',cost:0,attack:1,hp:20,speed:5,image:'',flavor:'',effects:[{trigger:'play',action:'damage',target:'self',amount:99}]}));
  profile.deck=profile.custom.map(card=>card.id);
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');
  await page.getByRole('button',{name:'新對決',exact:true}).click();await page.locator('[name="goal"]').selectOption('knockout');await page.getByRole('button',{name:'開始新對決',exact:true}).click();
  await page.evaluate(()=>{window.storageFails=true;const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return setItem.call(this,key,value);};});
  const finish=async()=>{
    for(let i=0;i<5;i++) {
      await page.locator('.hand-cards .type-monster').first().click();await page.getByRole('button',{name:'卡牌詳情',exact:true}).click();await page.locator('[data-play]').click();
    }
    await expect(page.locator('.result-dialog h2')).toHaveText('這次，網路贏了');
  };
  await finish();await expect(page.locator('#toast')).toContainText('瀏覽器儲存空間不足');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).stats)).toEqual(profile.stats);
  await page.getByRole('button',{name:'關閉',exact:true}).click();await page.locator('[data-nav="workshop"]').click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'匯出',exact:true}).click();
  const stream=await (await download).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks)).stats).toEqual(profile.stats);
  await page.evaluate(()=>window.storageFails=false);await page.getByLabel('卡組名稱',{exact:true}).fill('Recovered');await page.getByRole('button',{name:'保存卡組',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).stats)).toEqual(profile.stats);
  await page.locator('[data-nav="battle"]').click();await page.getByRole('button',{name:'新對決',exact:true}).click();await page.getByRole('button',{name:'開始新對決',exact:true}).click();
  await finish();await page.getByRole('button',{name:'關閉',exact:true}).click();
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="battle"]').click();await page.reload();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).stats)).toEqual({wins:3,losses:3,games:6});
});

test('large exported backups restore every custom card and oversized imports preserve the current profile',async({page})=>{
  const profile=freshProfile();
  profile.custom=Array.from({length:1000},(_,i)=>({id:`custom-backup-${i}`,name:`Backup ${i}`,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:`https://example.com/${'x'.repeat(1980)}`,flavor:'x'.repeat(160),effects:[]}));
  profile.deck[0]=profile.custom[0].id;profile.decks=[{id:'backup-deck',name:'Backup deck',deck:[...profile.deck]}];
  const original=parseProfile(profile);
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},original);
  await page.route('https://example.com/**',route=>route.abort());
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'匯出',exact:true}).click();
  const stream=await (await download).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const backup=Buffer.concat(chunks);expect(backup.length).toBeGreaterThan(2_000_000);expect(backup.length).toBeLessThan(10_000_000);
  const upload=async buffer=>{
    const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'匯入',exact:true}).click();
    await (await chooser).setFiles({name:'backup.json',mimeType:'application/json',buffer});
  };
  await upload(Buffer.from(JSON.stringify(freshProfile())));await page.locator('#confirm-import').click();
  await expect(page.locator('.small-count')).toHaveText('0 張自訂卡牌');
  await upload(backup);await expect(page.locator('#confirm-import')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom.length)).toBe(0);
  await page.locator('#confirm-import').click();await expect(page.locator('.small-count')).toHaveText('1000 張自訂卡牌');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(original);
  await upload(Buffer.concat([Buffer.from(JSON.stringify(freshProfile())),Buffer.alloc(10_000_001,32)]));
  await expect(page.locator('#toast')).toContainText('匯入檔案不得超過 10 MB');await expect(page.locator('dialog')).toBeHidden();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(original);
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('.small-count')).toHaveText('1000 張自訂卡牌');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(original);
});

test('saved deck rename works at capacity without changing cards or identity',async({page},testInfo)=>{
  const profile=freshProfile();profile.decks=Array.from({length:20},(_,i)=>({id:`deck-rename-${i}`,name:`組 ${i}`,deck:profile.deck.slice(i%3)}));
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();
  await expect(page.locator('[data-action="rename-deck"]')).toBeDisabled();
  await page.locator('#saved-deck').selectOption('deck-rename-0');await page.locator('.deck-list [data-remove]').first().click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));
  await page.locator('[data-action="rename-deck"]').click();await page.getByRole('button',{name:'取消',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(before);
  await page.locator('[data-action="rename-deck"]').click();const name=page.locator('#rename-deck-form input');
  await name.fill('   ');await name.press('Enter');await expect(page.locator('#rename-error')).toContainText('卡組名稱需為 1 至 48 字');
  await name.evaluate(input=>{input.value='x'.repeat(49);input.form.requestSubmit();});await expect(page.locator('#rename-error')).toContainText('卡組名稱需為 1 至 48 字');
  await name.fill('組 1');await name.press('Enter');await expect(page.locator('#rename-error')).toContainText('已有同名卡組');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(before);
  await name.fill('組 0');await name.press('Enter');await expect(page.locator('dialog')).toBeHidden();
  await page.locator('[data-action="rename-deck"]').click();const renamed='新名字 "<meme>"';await name.fill(renamed);await name.press('Enter');
  await expect(page.locator('dialog')).toBeHidden();await expect(page.locator('#saved-deck')).toHaveValue('deck-rename-0');await expect(page.locator('#deck-name')).toHaveValue(renamed);
  const expected={...before,decks:before.decks.map((deck,i)=>i===0?{...deck,name:renamed}:deck)};
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(expected);
  await page.screenshot({path:testInfo.outputPath('rename-desktop.png')});await page.setViewportSize({width:390,height:844});
  await expect(page.locator('[data-action="rename-deck"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const select=await page.locator('#saved-deck').boundingBox(),button=await page.locator('[data-action="rename-deck"]').boundingBox(),remove=await page.locator('[data-action="delete-deck"]').boundingBox();
  expect(select.x+select.width).toBeLessThanOrEqual(button.x);expect(button.x+button.width).toBeLessThanOrEqual(remove.x);
  await page.locator('#saved-deck').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('rename-mobile.png')});
  await page.locator('[data-action="rename-deck"]').click();await expect(name).toHaveValue(renamed);await page.screenshot({path:testInfo.outputPath('rename-dialog-mobile.png')});
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#saved-deck option[value="deck-rename-0"]')).toHaveText(renamed);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')))).toEqual(expected);
});

test('saved deck rename retains input on quota failure and rejects stale writes',async({page})=>{
  const profile=freshProfile();profile.decks=[{id:'deck-rename',name:'原始組',deck:[...profile.deck]}];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();await page.locator('#saved-deck').selectOption('deck-rename');
  const stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.evaluate(()=>{window.storageFails=true;const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return setItem.call(this,key,value);};});
  await page.locator('[data-action="rename-deck"]').click();const name=page.locator('#rename-deck-form input');await name.fill('新名字');await name.press('Enter');
  await expect(page.locator('#toast')).toContainText('瀏覽器儲存空間不足');await expect(name).toHaveValue('新名字');await expect(page.locator('#deck-name')).toHaveValue('原始組');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.evaluate(()=>window.storageFails=false);await name.press('Enter');await expect(page.locator('dialog')).toBeHidden();
  await page.locator('[data-action="rename-deck"]').click();await name.fill('不能覆蓋其他分頁');
  const external=await page.evaluate(()=>{const profile=JSON.parse(localStorage.getItem('meme-clash-v1'));profile.decks[0].name='其他分頁';const raw=JSON.stringify(profile);localStorage.setItem('meme-clash-v1',raw);return raw;});
  await name.press('Enter');await expect(name).toHaveValue('不能覆蓋其他分頁');await expect(page.locator('#deck-name')).toHaveValue('新名字');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(external);
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('#saved-deck option[value="deck-rename"]')).toHaveText('其他分頁');
});

test('saved deck and import quota failures preserve stored and live data until successful retry',async({page})=>{
  const original=freshProfile();original.decks=[{id:'deck-old',name:'原始組',deck:[...original.deck]},{id:'deck-other',name:'其他組',deck:original.deck.slice(1)}];
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),original);
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();
  await page.getByLabel('已保存卡組',{exact:true}).selectOption('deck-old');
  const list=await page.locator('.deck-list').textContent(),stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.evaluate(()=>{window.storageFails=true;const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return setItem.call(this,key,value);};});
  await page.getByLabel('卡組名稱',{exact:true}).fill('失敗組');await page.getByRole('button',{name:'保存卡組',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('瀏覽器儲存空間不足');await expect(page.locator('#saved-deck option')).toHaveCount(3);
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.getByRole('button',{name:'刪除已保存卡組',exact:true}).click();await page.locator('#confirm-delete-deck').click();
  await expect(page.locator('dialog')).toBeVisible();await expect(page.locator('#saved-deck option')).toHaveCount(3);
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.getByLabel('已保存卡組',{exact:true}).selectOption('deck-other');await expect(page.locator('#saved-deck')).toHaveValue('deck-old');
  expect(await page.locator('.deck-list').textContent()).toBe(list);expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  const incoming=freshProfile();incoming.custom=[{id:'custom-import',name:'匯入專用卡',type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}];incoming.deck[0]='custom-import';incoming.decks=[{id:'deck-import',name:'匯入組',deck:[...incoming.deck]}];
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'匯入',exact:true}).click();
  await (await chooser).setFiles({name:'incoming.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
  await page.locator('#confirm-import').click();await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('瀏覽器儲存空間不足');expect(await page.locator('.deck-list').textContent()).toBe(list);
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.getByRole('button',{name:'取消',exact:true}).click();await page.locator('[data-nav="collection"]').click();
  await page.getByRole('searchbox',{name:'搜尋卡牌'}).fill('匯入專用卡');await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(0);
  await page.locator('[data-nav="workshop"]').click();await page.evaluate(()=>window.storageFails=false);
  await page.getByRole('button',{name:'保存卡組',exact:true}).click();await expect(page.locator('#saved-deck option')).toHaveCount(4);
  const retryChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'匯入',exact:true}).click();
  await (await retryChooser).setFiles({name:'incoming.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
  await page.locator('#confirm-import').click();await expect(page.locator('dialog')).toBeHidden();await expect(page.locator('.deck-list')).toContainText('匯入專用卡');
});

test('refreshing a full web library preserves active and saved deck references across reload',async({page})=>{
  const profile=freshProfile();profile.web=Array.from({length:1000},(_,i)=>({id:`workshop-${i}`,name:`Web card ${i}`,url:`https://i.imgflip.com/workshop-${i}.jpg`}));
  profile.deck[0]='web-workshop-0';profile.decks=[{id:'deck-web',name:'網路保存組',deck:['web-workshop-1']}];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.route('https://api.imgflip.com/get_memes',route=>route.fulfill({json:{success:true,data:{memes:[{id:'workshop-new',name:'New web card',url:'https://i.imgflip.com/workshop-new.jpg'}]}}}));
  await page.goto('/');await page.locator('[data-nav="collection"]').click();await page.getByRole('button',{name:'更新網路卡庫',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('已更新 1 個模板');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));
  expect(saved.web).toHaveLength(1000);expect(saved.web.map(m=>m.id)).toEqual(expect.arrayContaining(['workshop-0','workshop-1','workshop-new']));
  expect(saved.web.map(m=>m.id)).not.toContain('workshop-2');expect(saved.decks).toEqual(profile.decks);expect(saved.deck).toEqual(profile.deck);
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('.deck-list')).toContainText('Web card 0');
  await page.getByLabel('已保存卡組',{exact:true}).selectOption('deck-web');await expect(page.locator('.deck-list')).toContainText('Web card 1');
});

test('custom card limit rejects creation but permits in-place edits without changing references',async({page})=>{
  const profile=freshProfile();profile.custom=Array.from({length:1000},(_,i)=>({id:`custom-limit-${i}`,name:`Limit card ${i}`,type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}));
  profile.deck=[profile.custom[0].id,'tape','imagination','stonks','handshake','reverse','safe','suit','fusion','tape'];profile.decks=[{id:'edit-saved',name:'保留參照',deck:[...profile.deck]}];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');await page.locator('[data-nav="workshop"]').click();const stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.getByLabel('卡牌名稱',{exact:true}).fill('超額卡牌');await page.getByRole('button',{name:'鑄造卡牌',exact:true}).click();
  await expect(page.locator('#form-error')).toHaveText('最多保存 1000 張自訂卡牌');expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');await page.locator('[data-card="custom-limit-0"]').click();await page.locator('[data-edit="custom-limit-0"]').click();
  await expect(page.getByRole('heading',{name:'編輯卡牌',exact:true})).toBeVisible();await page.getByLabel('卡牌名稱',{exact:true}).fill('Updated original');await page.locator('#card-form [name="attack"]').fill('7');
  await page.locator('[data-action="add-effect"]').click();await page.locator('[data-action="appearance"]').click();await page.locator('#interface-language').selectOption('en');await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'.artifacts/card-edit-mobile.png',fullPage:true});
  await page.evaluate(()=>{window.storageFails=true;const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='meme-clash-v1'&&window.storageFails)throw new DOMException('Quota exceeded','QuotaExceededError');return write.call(this,key,value);};});
  await page.locator('#card-form [type="submit"]').click();await expect(page.locator('#toast')).toContainText('Browser storage unavailable');expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-nav="workshop"]').click();await expect(page.getByRole('heading',{name:'Edit card',exact:true})).toBeVisible();await expect(page.locator('#card-form [name="name"]')).toHaveValue('Updated original');
  await page.evaluate(()=>window.storageFails=false);await page.locator('#card-form [type="submit"]').click();
  const edited=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));expect(edited.custom).toHaveLength(1000);expect(edited.custom[0]).toMatchObject({id:'custom-limit-0',name:'Updated original',attack:7});expect(edited.custom[0].effects).toHaveLength(1);
  expect(edited.deck).toEqual(profile.deck);expect(edited.decks).toEqual(profile.decks);expect(edited.custom.slice(1)).toEqual(parseProfile(profile).custom.slice(1));
  await page.locator('[data-card="custom-limit-0"]').click();await page.locator('[data-edit="custom-limit-0"]').click();await page.locator('[data-action="cancel-edit"]').click();await expect(page.locator('#card-form [name="name"]')).toHaveValue('');await expect(page.getByRole('heading',{name:'Create a card',exact:true})).toBeVisible();
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-card="custom-limit-0"]').click();await page.locator('[data-edit="custom-limit-0"]').click();
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-card="custom-limit-0"]').click();await page.locator('[data-template="custom-limit-0"]').click();
  await expect(page.getByRole('heading',{name:'Create a card',exact:true})).toBeVisible();await expect(page.locator('[data-action="cancel-edit"]')).toHaveCount(0);await page.locator('#card-form [type="submit"]').click();await expect(page.locator('#form-error')).toContainText('1000');
  await page.locator('[data-nav="battle"]').click();await expect(page.locator('.own-formation .board-unit-name')).toHaveText('Limit card 0');
  await page.locator('[data-action="new"]').click();await page.locator('#match-form [type="submit"]').click();await expect(page.locator('.own-formation .board-unit-name')).toHaveText('Updated original');
  await page.locator('[data-nav="collection"]').click();await page.locator('[data-card="custom-limit-0"]').click();await page.locator('[data-edit="custom-limit-0"]').click();await page.locator('#card-form [name="type"]').selectOption('trap');await page.locator('#card-form [type="submit"]').click();
  const changedType=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));expect(changedType.custom[0]).toMatchObject({id:'custom-limit-0',type:'trap'});expect(changedType.custom[0].effects[0].trigger).toBe('hit');expect(changedType.deck).toEqual(profile.deck);expect(changedType.decks).toEqual(profile.decks);
  await page.locator('[data-nav="battle"]').click();await expect(page.locator('.own-formation .board-unit-name')).toHaveText('Updated original');await page.locator('[data-action="new"]').click();await page.locator('#match-form [type="submit"]').click();await expect(page.locator('#match-error')).toContainText('10');await expect(page.locator('.own-formation .board-unit-name')).toHaveText('Updated original');await page.keyboard.press('Escape');
  await page.reload();await page.locator('[data-nav="workshop"]').click();await expect(page.locator('.small-count')).toHaveText('1000 custom cards');
});

test('deleting an edited card preserves its draft but never restores the deleted ID',async({page})=>{
  const profile=freshProfile();profile.custom=[{id:'custom-edit-delete',name:'編輯刪除測試',type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');await page.locator('[data-card="custom-edit-delete"]').click();await page.locator('[data-edit="custom-edit-delete"]').click();
  await page.locator('#card-form [name="name"]').fill('保留未保存草稿');await page.locator('[data-nav="collection"]').click();await page.locator('[data-card="custom-edit-delete"]').click();await page.locator('[data-delete="custom-edit-delete"]').click();await page.locator('#confirm-delete').click();
  await page.locator('[data-nav="workshop"]').click();await expect(page.getByRole('heading',{name:'創作卡牌',exact:true})).toBeVisible();await expect(page.locator('#card-form [name="name"]')).toHaveValue('保留未保存草稿');
  await page.locator('#card-form [type="submit"]').click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));expect(saved.custom).toHaveLength(1);expect(saved.custom[0].id).not.toBe('custom-edit-delete');expect(saved.custom[0].name).toBe('保留未保存草稿');
  await page.locator(`[data-card="${saved.custom[0].id}"]`).click();await page.locator(`[data-edit="${saved.custom[0].id}"]`).click();await page.locator('#card-form [name="name"]').fill('匯入後保留草稿');
  const chooser=page.waitForEvent('filechooser');await page.locator('[data-action="import"]').click();await (await chooser).setFiles({name:'replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(freshProfile()))});await page.locator('#confirm-import').click();
  await expect(page.getByRole('heading',{name:'創作卡牌',exact:true})).toBeVisible();await expect(page.locator('#card-form [name="name"]')).toHaveValue('匯入後保留草稿');await page.locator('#card-form [type="submit"]').click();const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));expect(imported.custom).toHaveLength(1);expect(imported.custom[0].id).not.toBe(saved.custom[0].id);
});

test('deleting a custom card removes it from every saved deck while preserving draft names',async({page})=>{
  const profile=freshProfile();profile.custom=[{id:'custom-deck',name:'移除測試',type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}];
  profile.deck[0]='custom-deck';profile.decks=[{id:'deck-custom',name:'保留名稱',deck:['custom-deck']},{id:'deck-full',name:'完整組',deck:[...profile.deck]}];
  await page.addInitScript(profile=>{if(!localStorage.getItem('meme-clash-v1'))localStorage.setItem('meme-clash-v1',JSON.stringify(profile));},profile);
  await page.goto('/');await page.locator('[data-nav="collection"]').click();await page.getByRole('searchbox',{name:'搜尋卡牌'}).fill('移除測試');
  await page.locator('.catalog-grid .meme-card').click();await page.getByRole('button',{name:'刪除自訂卡',exact:true}).click();await page.locator('#confirm-delete').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')));
  expect(saved.custom).toEqual([]);expect(saved.deck).not.toContain('custom-deck');expect(saved.decks[0]).toEqual({id:'deck-custom',name:'保留名稱',deck:[]});expect(saved.decks[1].deck).not.toContain('custom-deck');
  await page.reload();await page.locator('[data-nav="workshop"]').click();await page.getByLabel('已保存卡組',{exact:true}).selectOption('deck-custom');await expect(page.locator('.deck-count')).toHaveText('0/30');
  await page.getByRole('button',{name:'保存卡組',exact:true}).click();await page.locator('#confirm-save-deck').click();await expect(page.locator('#toast')).toHaveText('卡組草稿已保存');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).decks[0])).toEqual({id:'deck-custom',name:'保留名稱',deck:[]});
});

async function dragDeck(page,type='monster') {
  const custom=Array.from({length:10},(_,i)=>({id:`custom-drag-${i}`,name:`拖曳測試 ${i}`,type:i?type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[{trigger:type==='trap'&&i?'hit':'play',action:type==='spell'&&i?'damage':'shield',target:type==='spell'&&i?'enemy':'self',amount:3}]}));
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),{version:1,custom,deck:custom.map(c=>c.id),web:[],stats:{}});
  await page.goto('/');
}
async function dragCard(page,source,target,{cancel=false,touch=false}={}) {
  const a=await source.boundingBox(),b=await target.boundingBox();
  const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
  if(touch){
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12}]});
    await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await session.detach();
  }else{
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});
    if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
  }
}
test('drag deploys into a chosen lane, cancels safely, repositions units and supports keyboard selection',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await dragDeck(page);
  const hand=page.locator('.hand-cards [data-hand]'),own=page.locator('.own-formation');
  await dragCard(page,hand.first(),page.locator('.opponent-formation [data-slot="2"]'));
  await expect(hand).toHaveCount(5);await expect(page.locator('.energy-box strong')).toHaveText('3/ 3');
  await dragCard(page,hand.first(),own.locator('[data-slot="2"]'),{cancel:true});await expect(hand).toHaveCount(5);
  await dragCard(page,hand.first(),own.locator('[data-slot="2"]'));
  await expect(hand).toHaveCount(4);await expect(own.locator('[data-slot="2"]')).toHaveClass(/occupied/);
  await expect(page.locator('.energy-box strong')).toHaveText('2/ 3');
  const uid=await own.locator('[data-slot="2"]').getAttribute('data-unit');
  await dragCard(page,own.locator('[data-slot="2"]'),own.locator('[data-slot="1"]'));
  await expect(own.locator('[data-slot="1"]')).toHaveAttribute('data-unit',uid);
  await hand.first().focus();await page.keyboard.press('Enter');
  await own.locator('[data-slot="2"]').focus();await page.keyboard.press('Enter');
  await expect(hand).toHaveCount(3);await expect(own.locator('.occupied')).toHaveCount(3);
  await expect(page.locator('.drag-ghost')).toHaveCount(0);expect(errors).toEqual([]);
  await page.screenshot({path:'.artifacts/drag-duel-desktop.png',fullPage:true});
});
test('targeted spell drops damage the chosen enemy and refuse an ally',async({page})=>{
  await dragDeck(page,'spell');const hand=page.locator('.hand-cards [data-hand]');
  const enemy=page.locator('.opponent-formation .occupied'),hp=Number(await enemy.locator('.board-stats b').nth(1).innerText());
  await dragCard(page,hand.first(),page.locator('.own-formation .occupied'));
  await expect(hand).toHaveCount(5);
  await dragCard(page,hand.first(),enemy);await expect(hand).toHaveCount(4);
  await expect(enemy.locator('.board-stats b').nth(1)).toHaveText(String(hp-3));
});
test('touch drag deploys without scrolling the page, and touch cancellation spends nothing',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Native touch movement requires Chromium CDP; WebKit touch is not verified here.');
  await page.setViewportSize({width:390,height:844});await dragDeck(page);
  const hand=page.locator('.hand-cards [data-hand]'),target=page.locator('.own-formation [data-slot="1"]');
  await dragCard(page,hand.first(),target,{touch:true,cancel:true});await expect(hand).toHaveCount(5);
  const scroll=await page.evaluate(()=>scrollY);
  await dragCard(page,hand.first(),target,{touch:true});await expect(hand).toHaveCount(4);
  await expect(target).toHaveClass(/occupied/);expect(await page.evaluate(()=>scrollY)).toBe(scroll);
  await dragCard(page,hand.nth(2),hand.first(),{touch:true});
  await expect.poll(()=>page.locator('.hand-cards').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  await expect(hand).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/drag-duel-mobile.png',fullPage:true});
});
test('removed battle snapshots cannot corrupt decks and remain usable as new templates',async({page,context})=>{
  await dragDeck(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const name=await page.locator('.own-formation .board-unit-name').first().textContent();
  const id=await page.evaluate(name=>JSON.parse(localStorage.getItem('meme-clash-v1')).custom.find(c=>c.name===name).id,name);
  await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');
  await page.locator(`[data-card="${id}"]`).click();await page.locator(`[data-delete="${id}"]`).click();await page.locator('#confirm-delete').click();
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.locator('[data-nav="battle"]').click();await page.locator('.own-formation [data-slot="0"]').click();await page.locator('[data-action="inspect"]').click();
  await page.locator(`[data-add="${id}"]`).click();expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  expect(()=>parseProfile(JSON.parse(saved))).not.toThrow();await page.locator(`[data-template="${id}"]`).click();
  await expect(page.locator('#card-form [name="name"]')).toHaveValue(name);await page.locator('#card-form [type="submit"]').click();
  const created=parseProfile(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1'))));
  expect(created.custom.some(c=>c.id===id)).toBe(false);expect(created.deck).not.toContain(id);
  expect(created.custom.at(-1).name).toBe(name);expect(created.custom.at(-1).id).not.toBe(id);expect(errors).toEqual([]);
  const reload=await context.newPage();try{await reload.goto('/');await expect(reload.getByRole('button',{name:'原始存檔恢復',exact:true})).toHaveCount(0);}finally{await reload.close();}
});

test('mobile native taps deploy, reposition and cancel without unintended spending',async({browser,baseURL},testInfo)=>{
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await dragDeck(page);const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
    const hand=page.locator('.hand-cards [data-hand]'),own=page.locator('.own-formation');
    await hand.first().tap();await expect(hand.first()).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'取消選擇',exact:true}).tap();await expect(hand.first()).toHaveAttribute('aria-pressed','false');
    await expect(hand).toHaveCount(5);await expect(page.locator('.energy-box strong')).toHaveText('3/ 3');
    await hand.first().tap();await page.locator('.opponent-formation [data-slot="1"]').tap();
    await expect(hand).toHaveCount(5);await expect(page.locator('.energy-box strong')).toHaveText('3/ 3');
    await expect(hand.first()).toHaveAttribute('aria-pressed','false');await hand.first().tap();
    await own.locator('[data-slot="1"]').tap();await expect(hand).toHaveCount(4);await expect(page.locator('.energy-box strong')).toHaveText('2/ 3');
    const uid=await own.locator('[data-slot="1"]').getAttribute('data-unit');
    await own.locator('[data-slot="1"]').tap();await own.locator('[data-slot="2"]').tap();
    await expect(own.locator('[data-slot="2"]')).toHaveAttribute('data-unit',uid);await expect(page.locator('.energy-box strong')).toHaveText('2/ 3');
    await hand.first().tap();await page.getByRole('button',{name:'卡牌詳情',exact:true}).tap();await expect(page.locator('#modal')).toBeVisible();
    await page.getByRole('button',{name:'關閉',exact:true}).tap();await page.getByRole('button',{name:'取消選擇',exact:true}).tap();
    await own.locator('[data-slot="1"]').tap();await expect(hand).toHaveCount(4);await expect(own.locator('[data-slot="1"]')).not.toHaveClass(/occupied/);
    expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);expect(errors).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('native-mobile-taps.png'),fullPage:true});
  } finally {await context.close();}
});

test('dragging near the top edge scrolls a short viewport back to the board',async({page})=>{
  await page.setViewportSize({width:320,height:568});await dragDeck(page);
  const hand=page.locator('.hand-cards [data-hand]');await hand.first().scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  const rect=await hand.first().boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
  await page.mouse.move(160,10,{steps:12});await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  const target=await page.locator('.own-formation [data-slot="1"]').boundingBox();
  const point={x:target.x+target.width/2,y:target.y+8};
  await page.mouse.move(point.x,point.y,{steps:8});
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-drop]')?.matches('.own-formation [data-slot="1"]'),point)).toBe(true);
  await page.mouse.up();
  await expect(hand).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('dialogs use their current localized heading as an accessible name',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const profile=freshProfile();profile.custom=[{id:'custom-dialog-name',name:'魔法陷阱的角色',type:'monster',tag:'bonk',cost:1,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]}];
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),profile);
  await page.goto('/');const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  const check=async()=>await expect(page.getByRole('dialog')).toHaveAccessibleName(await page.locator('#modal h2').innerText());
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:844});
    await page.locator('[data-action="appearance"]').click();
    for(const locale of ['zh-Hant','en','ja','es']){
      await page.locator('#interface-language').selectOption(locale);await check();
      await expect(page.locator('#interface-language')).toBeFocused();
    }
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-action="appearance"]')).toBeFocused();
    await page.locator('[data-action="appearance"]').click();
    const theme=width===1440?'coral':'ice';
    await page.locator(`[name="theme"][value="${theme}"]`).focus();await page.keyboard.press('Space');
    await expect(page.locator(`[name="theme"][value="${theme}"]`)).toBeChecked();
    await expect(page.locator(`[name="theme"][value="${theme}"]`)).toBeFocused();
    await page.locator('#modal [data-action="close"]').click();
    await expect(page.locator('[data-action="appearance"]')).toBeFocused();
    await page.locator('[data-action="new"]').first().click();await check();
    await page.keyboard.press('Escape');
    await page.locator('[data-nav="collection"]').click();await page.locator('#origin-filter').selectOption('自訂');
    await page.locator('[data-card="custom-dialog-name"]').click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('魔法陷阱的角色');
    await page.locator('[data-delete="custom-dialog-name"]').click();await check();
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  }
  expect(errors).toEqual([]);
});

test('language changes preserve the duel, localize each view and persist on mobile',async({page})=>{
  test.setTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  const names=await page.locator('.hand-cards .card-name').allTextContents();
  const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  const untranslated=()=>page.locator('#app').evaluate(root=>{
    const results=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode())if(/\p{Script=Han}/u.test(node.nodeValue)&&!node.parentElement.closest('[data-original],.card-name,.unit-chip b,.deck-row>span>b,.art-fallback,#language-filter option:not([value="all"]):not([value="unknown"])'))results.push(node.nodeValue.trim());
    return [...new Set(results)];
  });
  for(const [locale,button] of [['en','Start clash'],['ja','衝突開始'],['es','Iniciar choque']]) {
    await page.locator('[data-action="appearance"]').click();
    await page.locator('#interface-language').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang',locale);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:button,exact:true})).toBeVisible();
    expect(await page.locator('.hand-cards .card-name').allTextContents()).toEqual(names);
    await expect(page.locator('#round-number')).toHaveText('01');
    if(locale!=='ja')expect(await untranslated()).toEqual([]);
    await page.setViewportSize({width:390,height:844});
    for(const screen of ['collection','workshop','battle']) {
      await page.locator(`[data-nav="${screen}"]`).click();
      if(locale!=='ja')expect(await untranslated()).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    }
    await page.screenshot({path:`.artifacts/language-${locale}-mobile.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Iniciar choque',exact:true}).click();
  await expect(page.locator('#round-number')).toHaveText('02',{timeout:15000});
  await expect(page.locator('#battle-log')).toContainText('Ronda 2');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','es');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  expect(errors).toEqual([]);
});

test('translated workshop and previews preserve user-authored card text',async({page})=>{
  await page.goto('/');await page.locator('[data-action="appearance"]').click();
  await page.locator('#interface-language').selectOption('en');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Deck workshop',exact:true}).click();
  await page.getByLabel('Card name',{exact:true}).fill('魔法陷阱的角色');
  await page.getByLabel('Flavor text',{exact:true}).fill('角色的魔法效果，沒有翻譯');
  await page.getByRole('button',{name:'Create card',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('魔法陷阱的角色');
  await page.locator('.catalog-grid .meme-card').click();
  await expect(page.locator('.detail-body h2')).toHaveText('魔法陷阱的角色');
  await expect(page.locator('.flavor')).toHaveText('角色的魔法效果，沒有翻譯');
  await page.getByRole('button',{name:'Play effect preview',exact:true}).click();
  await expect(page.locator('#modal-preview-stage [data-preview-status]')).toContainText('Collision',{timeout:8000});
  await page.screenshot({path:'.artifacts/language-en-preview.png',fullPage:true});
  await page.keyboard.press('Escape');await page.reload();
  await page.getByRole('button',{name:'Card library',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search cards'}).fill('魔法陷阱的角色');
  await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(1);
});

test('a delayed catalog refresh preserves an active collision and completes the round',async({page})=>{
  let release;const pending=new Promise(resolve=>release=resolve),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(profile=>localStorage.setItem('meme-clash-v1',JSON.stringify(profile)),freshProfile());
  await page.route('https://api.imgflip.com/get_memes',async route=>{await pending;await route.fulfill({json:{success:true,data:{memes:[{id:'late-round',name:'Late round meme',url:'https://i.imgflip.com/late-round.jpg'}]}}});});
  try {
    await page.goto('/');await page.locator('[data-nav="collection"]').click();
    const requested=page.waitForRequest('https://api.imgflip.com/get_memes');
    await page.getByRole('button',{name:'更新網路卡庫',exact:true}).click();await requested;
    await page.locator('[data-nav="battle"]').click();await page.getByRole('button',{name:'開始碰撞',exact:true}).click();
    await expect(page.locator('.duel-board')).toHaveClass(/is-battling/);
    const canvas=await page.locator('#arena').elementHandle();release();
    await expect(page.locator('#toast')).toContainText('已更新 1 個模板');
    expect(await canvas.evaluate(node=>node.isConnected)).toBe(true);
    await expect(page.locator('#round-number')).toHaveText('02',{timeout:15000});
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).web)).toEqual([{id:'late-round',name:'Late round meme',url:'https://i.imgflip.com/late-round.jpg'}]);
    await page.locator('[data-nav="collection"]').click();await page.locator('#search').fill('Late round meme');
    await expect(page.locator('[data-card="web-late-round"]')).toBeVisible();expect(errors).toEqual([]);
  } finally {release();}
});

test('real desktop match animates and finishes a round without console errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await expect(page.getByRole('heading',{name:'對戰',exact:true})).toBeVisible();
  await expect(page.locator('.hand-cards .meme-card')).toHaveCount(5);
  await expect.poll(()=>page.locator('.card-art img').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth>0).length)).toBeGreaterThan(0);
  await page.screenshot({path:'.artifacts/desktop.png',fullPage:true});
  await page.getByRole('button',{name:'開始碰撞'}).click();
  await expect(page.locator('#phase-chip')).toHaveText('碰撞對決中');
  const before=await page.locator('canvas').screenshot();
  await expect(page.locator('#collision-count')).not.toHaveText('0 次碰撞',{timeout:12000});
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/迷因對決：/);
  await page.locator('canvas').screenshot({path:'.artifacts/impact.png'});
  const after=await page.locator('canvas').screenshot();expect(before.equals(after)).toBeFalsy();
  await expect(page.locator('#round-number')).toHaveText('02',{timeout:15000});
  expect(errors).toEqual([]);
});

test('reduced-motion duel still reports impact results and advances the round',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByRole('button',{name:'開始碰撞'}).click();
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/迷因對決：/,{timeout:12000});
  await expect(page.locator('#round-number')).toHaveText('02',{timeout:15000});
});

test('hover and mobile card previews animate without spending cards or changing saved data',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  const before=await page.locator('.hand-cards').textContent(),stored=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.locator('.hand-cards .meme-card').first().hover();
  await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.locator('.hover-preview [data-preview-status]')).toContainText('碰撞',{timeout:8000});
  await page.screenshot({path:'.artifacts/hover-preview.png'});
  await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toBeHidden();
  expect(await page.locator('.hand-cards').textContent()).toBe(before);
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(stored);
  await page.setViewportSize({width:390,height:844});
  await page.locator('.hand-cards .meme-card').first().click();
  await page.getByRole('button',{name:'卡牌詳情'}).click();
  await page.getByRole('button',{name:'播放效果演示'}).click();
  await expect(page.locator('#modal-preview-stage canvas')).toBeVisible();
  await expect(page.locator('#modal-preview-stage [data-preview-status]')).toContainText('演示完成',{timeout:15000});
  await page.screenshot({path:'.artifacts/modal-preview-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'關閉',exact:true}).click();
  await expect(page.locator('#round-number')).toHaveText('01');expect(errors).toEqual([]);
});

test('random global decks require confirmation and daily challenge leaves the saved deck intact',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'卡組工坊'}).click();
  const before=await page.locator('.deck-list').textContent();
  await page.getByRole('button',{name:'全球隨機套裝',exact:true}).click();
  await page.getByRole('button',{name:'取消',exact:true}).click();expect(await page.locator('.deck-list').textContent()).toBe(before);
  await page.getByRole('button',{name:'全球隨機套裝',exact:true}).click();await page.getByRole('button',{name:'取代目前卡組'}).click();
  await expect(page.locator('.deck-count')).toContainText('20');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).deck);
  expect(saved.filter(id=>id.startsWith('world-')).length).toBe(12);
  await page.getByRole('button',{name:'每日挑戰',exact:true}).click();await page.getByRole('button',{name:'開始每日挑戰'}).click();
  await expect(page.locator('.duel-toolbar')).toContainText('每日挑戰');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('meme-clash-v1')).deck)).toEqual(saved);
  await page.getByRole('button',{name:'開始碰撞'}).click();await expect(page.locator('#round-number')).toHaveText('02',{timeout:15000});
});

test('palette swatches change the interface and survive reload without changing the deck',async({page})=>{
  await page.goto('/');const saved=await page.evaluate(()=>localStorage.getItem('meme-clash-v1'));
  await page.getByRole('button',{name:'語言與色系'}).click();
  await page.getByRole('radio',{name:'珊瑚熱浪'}).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme','coral');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#ffac91');
  await page.getByRole('button',{name:'關閉',exact:true}).click();await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','coral');
  expect(await page.evaluate(()=>localStorage.getItem('meme-clash-v1'))).toBe(saved);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'語言與色系'}).click();
  await page.getByRole('radio',{name:'冰河藍綠'}).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme','ice');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/palette-mobile.png',fullPage:true});
});

test('global library filters source language and semantic ability and preserves world cards in a saved deck',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'卡牌圖鑑'}).click();
  await page.getByRole('combobox',{name:'卡牌來源'}).selectOption('全球');
  await expect(page.locator('.results-heading')).toContainText('4807');
  await page.getByRole('combobox',{name:'來源語言',exact:true}).selectOption('zho');
  await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(3);
  await page.getByRole('combobox',{name:'梗意能力'}).selectOption('dance');
  await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(1);
  await page.locator('.catalog-grid .meme-card').click();
  await expect(page.locator('.meaning-detail')).toContainText('節奏上頭');
  await expect(page.locator('.meaning-detail')).toContainText('Chinese Rapping Dog');
  await expect(page.locator('.source-link')).toHaveAttribute('href',/api.templates.meme/);
  await page.getByRole('button',{name:'加入卡組'}).click();
  await page.reload();await page.getByRole('button',{name:'卡牌圖鑑'}).click();
  await expect(page.locator('.deck-list')).toContainText('Chinese Rapping Dog');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/world-library-mobile.png',fullPage:true});
});
test('collection, custom multi-effect card, saved deck and reload',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'卡牌圖鑑'}).click();
  await page.getByRole('searchbox',{name:'搜尋卡牌'}).fill('Doge');
  await page.locator('.catalog-grid .meme-card').first().click();
  await expect(page.getByRole('region',{name:'連攜套裝'})).toContainText('全員 BONK');
  await expect(page.getByRole('region',{name:'連攜套裝'})).toContainText('3 件追加');
  await page.getByRole('button',{name:'加入卡組'}).click();
  await expect(page.locator('.deck-count')).toContainText('21');
  await page.getByRole('button',{name:'卡組工坊'}).click();
  await page.getByLabel('卡牌名稱',{exact:true}).fill('測試連攜王');
  await page.getByRole('button',{name:'新增效果'}).click();
  await page.locator('.effect-row').nth(1).locator('[name="trigger"]').selectOption('hit');
  await page.locator('.effect-row').nth(1).locator('[name="action"]').selectOption('damage');
  await page.locator('.effect-row').nth(1).locator('[name="target"]').selectOption('enemy');
  await page.getByRole('button',{name:'鑄造卡牌'}).click();
  await expect(page.locator('.catalog-grid .meme-card')).toContainText('測試連攜王');
  await page.reload();await page.getByRole('button',{name:'卡牌圖鑑'}).click();
  await page.getByRole('searchbox',{name:'搜尋卡牌'}).fill('測試連攜王');
  await expect(page.locator('.catalog-grid .meme-card')).toHaveCount(1);
  await expect(page.locator('.deck-count')).toContainText('21');
  await page.screenshot({path:'.artifacts/collection.png',fullPage:true});
});
test('local two-player handoff conceals the next hand until accepted',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'新對決',exact:true}).click();
  await page.getByRole('combobox',{name:'對手',exact:true}).selectOption('local');
  await page.getByRole('combobox',{name:'勝利目標'}).selectOption('sandbox');
  await page.locator('[name="field"][value="moon"]').check();
  await page.getByRole('button',{name:'開始新對決'}).click();
  await expect(page.locator('.energy-box strong')).toContainText('∞');
  await page.getByRole('button',{name:'完成部署'}).click();
  await expect(page.locator('.hand-cards .meme-card')).toHaveCount(0);
  await expect(page.locator('#card-inspector .inspector-copy')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'我準備好了'})).toBeVisible();
  await expect(page.getByRole('button',{name:'關閉',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'我準備好了'}).click();
  await expect(page.locator('.hand-cards .meme-card')).toHaveCount(5);
  await page.getByRole('button',{name:'開始碰撞'}).click();
  await expect(page.locator('#round-number')).toHaveText('02',{timeout:15000});
});
test('mobile layouts, card action and field selection remain within viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#set-progress .synergy')).toHaveCount(6);
  await page.locator('.set-guide summary').click();
  await expect(page.locator('.set-guide')).toContainText('一起上月球');
  await expect(page.locator('.set-guide .set-rule')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/mobile.png',fullPage:true});
  await page.locator('.hand-cards .meme-card').first().click();
  await page.getByRole('button',{name:'卡牌詳情'}).click();
  await expect(page.locator('dialog')).toBeVisible();
  expect(await page.locator('dialog').evaluate(d=>d.getBoundingClientRect().right<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'關閉',exact:true}).click();
  await page.getByRole('button',{name:'更換場地'}).click();
  await page.locator('[name="field"][value="fine"]').check();
  await page.getByRole('button',{name:'開始新對決'}).click();
  await expect(page.locator('.field-token')).toContainText('This Is Fine');
  await page.getByRole('button',{name:'卡組工坊'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/workshop-mobile.png',fullPage:true});
});
