import { test, expect } from '@playwright/test';

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
  await expect(page.getByRole('heading',{name:'讓迷因，正面對決.'})).toBeVisible();
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
  await expect(page.locator('.battle-topline')).toContainText('每日挑戰');
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
  await expect(page.locator('dialog')).toBeVisible();
  expect(await page.locator('dialog').evaluate(d=>d.getBoundingClientRect().right<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'關閉',exact:true}).click();
  await page.getByRole('button',{name:'更換場地'}).click();
  await page.locator('[name="field"][value="fine"]').check();
  await page.getByRole('button',{name:'開始新對決'}).click();
  await expect(page.locator('.arena-stage')).toContainText('This Is Fine');
  await page.getByRole('button',{name:'卡組工坊'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:'.artifacts/workshop-mobile.png',fullPage:true});
});
