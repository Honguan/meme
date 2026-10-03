import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_KEY, loadDraft, saveDraft } from '../src/draft.js';

const card = () => ({ name: '', type: 'monster', tag: 'chaos', cost: '', speed: '0', attack: '-99', hp: 'nope',
  image: 'https://', flavor: '<b>unfinished</b>', effects: [] });
const draft = () => ({ card: card(), editingId: '', source: '' });
const empty = error => ({ card: null, editingId: '', source: '', changed: false, error });
function storage(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  let raw = null;
  const api = {
    getItem(key) { assert.equal(key, DRAFT_KEY); return raw; },
    setItem(key, value) { assert.equal(key, DRAFT_KEY); raw = value; },
    removeItem(key) { assert.equal(key, DRAFT_KEY); raw = null; },
  };
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: api });
  try { run(api, value => { raw = value; }, () => raw); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous);
    else delete globalThis.sessionStorage;
  }
}

test('empty saves and unfinished inputs round-trip only whitelisted fields', () => storage((api, setRaw, getRaw) => {
  assert.deepEqual(loadDraft(), empty(false));
  const input = draft();
  input.extra = 'discard';
  input.card.id = 'discard';
  assert.equal(saveDraft(input), true);
  const clean = { ...card(), field: 'grid' };
  assert.deepEqual(JSON.parse(getRaw()), { version: 1, card: clean, editingId: '', source: '' });
  assert.deepEqual(loadDraft(), { card: clean, editingId: '', source: '', changed: false, error: false });
  input.card.cost = 0;
  input.card.effects = [{ trigger: 'hit', action: 'damage', target: 'enemy', amount: '', extra: 'discard' },
    { trigger: 'play', action: 'draw', target: 'self', amount: 1.5 }];
  assert.equal(saveDraft(input), true);
  assert.equal(loadDraft().card.cost, 0);
  assert.deepEqual(loadDraft().card.effects, [{ trigger: 'hit', action: 'damage', target: 'enemy', amount: '' },
    { trigger: 'play', action: 'draw', target: 'self', amount: 1.5 }]);
}));

test('matching edit sources restore while changed or deleted cards become new drafts', () => storage(() => {
  const original = { ...card(), id: 'custom-123', origin: 'custom' };
  const input = { ...draft(), editingId: original.id, source: JSON.stringify(original) };
  input.card.name = 'unfinished edit';
  assert.equal(saveDraft(input), true);
  assert.deepEqual(loadDraft([original]), { ...input, card: { ...input.card, field: 'grid' }, changed: false, error: false });
  for (const custom of [[], [{ ...original, name: 'another tab' }]]) {
    const loaded = loadDraft(custom);
    assert.equal(loaded.card.name, input.card.name);
    assert.equal(loaded.editingId, '');
    assert.equal(loaded.source, '');
    assert.equal(loaded.changed, true);
    assert.equal(loaded.error, false);
  }
}));

test('malformed, unsupported, prototype enum and oversized drafts leave stored bytes untouched', () => storage((api, setRaw, getRaw) => {
  const invalidCards = [null, [], { ...card(), type: 'constructor' }, { ...card(), tag: '__proto__' },
    { ...card(), name: 'x'.repeat(73) }, { ...card(), image: 'x'.repeat(2049) }, { ...card(), flavor: 'x'.repeat(161) },
    { ...card(), cost: 'x'.repeat(33) }, { ...card(), speed: null }, { ...card(), attack: [] }, { ...card(), hp: {} },
    { ...card(), field: 'unknown' }, { ...card(), effects: null }, { ...card(), effects: Array(5).fill({}) },
    ...[null, [], { trigger: 'toString', action: 'draw', target: 'self', amount: 1 },
      { trigger: 'play', action: '__proto__', target: 'self', amount: 1 },
      { trigger: 'play', action: 'draw', target: 'constructor', amount: 1 },
      { trigger: 'play', action: 'draw', target: 'self', amount: 'x'.repeat(33) }].map(effect => ({ ...card(), effects: [effect] }))];
  const values = [null, [], { ...draft(), version: 2 }, { ...draft(), version: 1, editingId: '../bad' },
    { ...draft(), version: 1, editingId: `custom-${'x'.repeat(65)}` },
    { ...draft(), version: 1, source: 'x'.repeat(16001) },
    ...invalidCards.map(card => ({ ...draft(), version: 1, card }))];
  for (const raw of ['', '{"version":1', ...values.map(value => JSON.stringify(value))]) {
    setRaw(raw);
    assert.deepEqual(loadDraft(), empty(true));
    assert.equal(getRaw(), raw);
  }
  setRaw('original draft');
  for (const invalidCard of [...invalidCards, { ...card(), cost: Infinity }, { ...card(), hp: NaN }]) {
    assert.equal(saveDraft({ ...draft(), card: invalidCard }), false);
    assert.equal(getRaw(), 'original draft');
  }
  assert.equal(saveDraft([]), false);
  assert.equal(saveDraft({ ...draft(), source: 'x'.repeat(16001) }), false);
  assert.equal(getRaw(), 'original draft');
}));

test('storage failures preserve the original draft and successful clear removes it', () => storage((api, setRaw, getRaw) => {
  assert.equal(saveDraft(draft()), true);
  const original = getRaw();
  const get = api.getItem;
  api.getItem = () => { throw new Error('denied'); };
  assert.deepEqual(loadDraft(), empty(true));
  assert.equal(getRaw(), original);
  api.getItem = get;
  api.setItem = () => { throw new Error('quota'); };
  assert.equal(saveDraft(draft()), false);
  assert.equal(getRaw(), original);
  const remove = api.removeItem;
  api.removeItem = () => { throw new Error('denied'); };
  assert.equal(saveDraft(null), false);
  assert.equal(getRaw(), original);
  api.removeItem = remove;
  assert.equal(saveDraft(null), true);
  assert.equal(getRaw(), null);
  assert.deepEqual(loadDraft(), empty(false));
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('denied'); } });
  assert.deepEqual(loadDraft(), empty(true));
  assert.equal(saveDraft(draft()), false);
  assert.equal(saveDraft(null), false);
}));
