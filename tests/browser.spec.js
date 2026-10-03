import { test, expect } from '@playwright/test';
import { freshProfile, parseProfile } from '../src/storage.js';
import { CATALOG } from '../src/catalog.js';

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
  await page.getByRole('button',{name:'保存卡組',exact:true}).click();await expect(page.locator('#toast')).toContainText('卡組至少 10 張');
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
test('touch drag deploys without scrolling the page, and touch cancellation spends nothing',async({page})=>{
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
