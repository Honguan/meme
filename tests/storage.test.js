import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, parseProfile, loadProfile, saveProfile, mergeCardPack, STORAGE_KEY } from '../src/storage.js';

test('card packs append fresh validated copies without replacing profile references or source IDs',()=>{
  const base={id:'custom-existing',name:'創作卡',type:'monster',tag:'chaos',cost:1,attack:3,hp:20,speed:5,image:'',flavor:'',effects:[],origin:'自訂'};
  const profile=freshProfile();profile.custom=[base];profile.deck[0]=base.id;profile.decks=[{id:'saved',name:'保留卡組',deck:[base.id]}];profile.favorites=[base.id];profile.stats={wins:3,losses:2,games:5};
  const cards=['monster','fusion','spell','trap','equip','field'].map(type=>({...base,type,field:'backrooms',effects:(['monster','fusion'].includes(type)?['play','hit','round','death']:[type==='trap'?'hit':'play']).map((trigger,i)=>({trigger,action:'shield',target:i%2?'enemy':'self',amount:i+1}))}));
  const pack={kind:'meme-clash-card-pack',version:1,cards},original=JSON.stringify({profile,pack}),next=mergeCardPack(profile,pack);
  assert.notEqual(next,profile);assert.notEqual(next.custom,profile.custom);assert.equal(next.custom[0],base);assert.equal(next.custom.length,7);
  for(const key of ['deck','decks','favorites','stats','web'])assert.equal(next[key],profile[key]);
  assert.equal(new Set(next.custom.map(c=>c.id)).size,7);
  next.custom.slice(1).forEach((card,i)=>{assert.match(card.id,/^custom-[a-zA-Z0-9-]{1,64}$/);assert.notEqual(card.id,base.id);assert.equal(card.origin,'自訂');assert.deepEqual(card.effects,cards[i].effects);if(card.type==='field')assert.equal(card.field,'backrooms');});
  assert.equal(JSON.stringify({profile,pack}),original);assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(next))).custom,next.custom);
  const repeated=mergeCardPack(next,pack);assert.equal(repeated.custom.length,13);assert.equal(new Set(repeated.custom.map(c=>c.id)).size,13);
  const uuid=globalThis.crypto.randomUUID,values=['existing','existing','fresh-1','fresh-1','fresh-2'];globalThis.crypto.randomUUID=()=>values.shift();
  try {const collision=mergeCardPack(profile,{...pack,cards:[base,base]});assert.deepEqual(collision.custom.map(c=>c.id),['custom-existing','custom-fresh-1','custom-fresh-2']);}
  finally {globalThis.crypto.randomUUID=uuid;}
});

test('card packs reject malformed cards and capacity overflow without partially changing the profile',()=>{
  const profile=freshProfile(),card={name:'合法卡',type:'monster',tag:'bonk',cost:0,attack:2,hp:20,speed:5,image:'',flavor:'',effects:[]},pack={kind:'meme-clash-card-pack',version:1,cards:[card]};
  const original=JSON.stringify(profile);
  for(const invalid of [null,{},freshProfile(),{...pack,version:2},{...pack,kind:'other'},{...pack,cards:[]},{...pack,cards:{}},{...pack,cards:Array(1001).fill(card)},
    {...pack,cards:[card,{...card,hp:0}]},{...pack,cards:[card,{...card,image:'javascript:alert(1)'}]},{...pack,cards:[card,{...card,effects:[{trigger:'play',action:'eval',target:'self',amount:1}]}]},
    {...pack,cards:[card,{...card,type:'spell',effects:[{trigger:'death',action:'heal',target:'self',amount:1}]}]}]){
    assert.throws(()=>mergeCardPack(profile,invalid));assert.equal(JSON.stringify(profile),original);
  }
  const full={...profile,custom:Array.from({length:999},(_,i)=>({...card,id:`custom-${i}`}))},before=JSON.stringify(full),next=mergeCardPack(full,pack);assert.equal(next.custom.length,1000);
  assert.throws(()=>mergeCardPack(next,pack),/1000/);assert.throws(()=>mergeCardPack(full,{...pack,cards:[card,card]}),/1000/);assert.equal(JSON.stringify(full),before);
});

test('unreadable and empty saves expose their exact original bytes without overwriting them',()=>{
  const previous=globalThis.localStorage;let stored;
  globalThis.localStorage={getItem(key){assert.equal(key,STORAGE_KEY);return stored;},setItem(){assert.fail('Loading must not write');}};
  try {
    for(const raw of ['', '{"version":1', JSON.stringify({...freshProfile(),version:2})]) {
      stored=raw;const loaded=loadProfile();
      assert.equal(loaded.raw,raw);assert.ok(loaded.error);assert.deepEqual(loaded.profile,freshProfile());assert.equal(stored,raw);
    }
    stored=null;assert.equal(loadProfile().error,'');assert.equal(loadProfile().raw,null);
    stored=JSON.stringify(freshProfile());assert.equal(loadProfile().error,'');assert.equal(loadProfile().raw,stored);
    globalThis.localStorage.getItem=()=>{throw new Error('Access denied');};
    assert.equal(loadProfile().raw,null);assert.ok(loadProfile().error);
  } finally {if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('expected save bytes reject stale writes, including external removal and unreadable replacements',()=>{
  const previous=globalThis.localStorage;let stored=null,writes=0;
  globalThis.localStorage={getItem(){return stored;},setItem(key,raw){assert.equal(key,STORAGE_KEY);stored=raw;writes++;}};
  try {
    const initial=loadProfile();assert.equal(initial.raw,null);
    const first=saveProfile(initial.profile,initial.raw);assert.equal(first,stored);assert.equal(writes,1);
    assert.equal(saveProfile(freshProfile(),null),null);assert.equal(stored,first);assert.equal(writes,1);
    const second=saveProfile({...initial.profile,stats:{wins:1,losses:0,games:1}},first);assert.equal(second,stored);assert.equal(writes,2);
    stored=null;assert.equal(saveProfile(initial.profile,second),null);assert.equal(stored,null);assert.equal(writes,2);
    stored='';const damaged=loadProfile();assert.equal(damaged.raw,'');assert.ok(damaged.error);
    stored=first;assert.equal(saveProfile(damaged.profile,damaged.raw),null);assert.equal(stored,first);assert.equal(writes,2);
    globalThis.localStorage.getItem=()=>{throw new Error('Access denied');};
    assert.throws(()=>saveProfile(initial.profile,first),/Access denied/);assert.equal(stored,first);assert.equal(writes,2);
  } finally {if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('version 1 profiles preserve saved decks and accept old profiles and drafts', () => {
  const original = freshProfile();
  const { decks, ...legacy } = original;
  assert.deepEqual(parseProfile(legacy).decks, []);
  original.decks = [{ id: 'deck-test', name: '  魔法工坊  ', deck: original.deck.slice(0, 1) }];
  const parsed = parseProfile(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(parsed.decks, [{ id: 'deck-test', name: '魔法工坊', deck: original.deck.slice(0, 1) }]);
  assert.notEqual(parsed.deck, original.deck);
  assert.notEqual(parsed.decks[0].deck, original.decks[0].deck);
  parsed.decks[0].deck.length = 0;
  assert.equal(original.decks[0].deck.length, 1);
});

test('favorites round-trip independently of decks and legacy saves default to none',()=>{
  const profile=freshProfile(),id=profile.deck[0];
  const {favorites,...legacy}=profile;assert.deepEqual(parseProfile(legacy).favorites,[]);
  profile.favorites=[id];const parsed=parseProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(parsed.favorites,[id]);assert.deepEqual(parsed.deck,profile.deck);assert.deepEqual(parsed.stats,profile.stats);
  parsed.favorites.length=0;assert.deepEqual(profile.favorites,[id]);
  for(const favorites of [null,{},id,[id,id],['unknown'],[null],Array(10000).fill(id)])assert.throws(()=>parseProfile({...profile,favorites}),/收藏/);
});

test('saved decks reject malformed IDs, names, cards and limits', () => {
  const profile = freshProfile();
  const saved = { id: 'deck-test', name: 'Test', deck: [] };
  for (const decks of [null, {}, Array.from({ length: 21 }, (_, i) => ({ ...saved, id: `deck-${i}` })),
    [null], [{ ...saved, id: '../bad' }], [{ ...saved, id: 'x'.repeat(65) }], [saved, saved],
    [{ ...saved, name: ' ' }], [{ ...saved, name: 'x'.repeat(49) }], [{ ...saved, deck: ['unknown'] }],
    [{ ...saved, deck: Array(31).fill(profile.deck[0]) }], [{ ...saved, deck: null }]]) {
    assert.throws(() => parseProfile({ ...profile, decks }));
  }
  assert.equal(parseProfile({ ...profile, decks: Array.from({ length: 20 }, (_, i) => ({ ...saved, id: `deck-${i}` })) }).decks.length, 20);
});

test('saveProfile exposes quota failure without replacing the old stored profile', () => {
  const original = JSON.stringify(freshProfile());
  const previous = globalThis.localStorage;
  let stored = original;
  globalThis.localStorage = { setItem(key) { assert.equal(key, STORAGE_KEY); throw new Error('QuotaExceededError'); }, getItem() { return stored; } };
  try {
    assert.throws(() => saveProfile({ ...freshProfile(), decks: [{ id: 'new', name: 'New', deck: [] }] }), /QuotaExceededError/);
    assert.equal(globalThis.localStorage.getItem(STORAGE_KEY), original);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
