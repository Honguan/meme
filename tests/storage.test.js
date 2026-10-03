import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, parseProfile, saveProfile, STORAGE_KEY } from '../src/storage.js';

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
