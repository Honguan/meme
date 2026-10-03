import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, parseProfile, loadProfile, saveProfile, STORAGE_KEY } from '../src/storage.js';

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
