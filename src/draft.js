import { TYPES, TAGS, FIELDS, ACTIONS, TARGETS, TRIGGERS } from './catalog.js';

export const DRAFT_KEY = 'meme-clash-card-draft-v1';
const dict = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.length <= max;
const scalar = value => text(value, 32) || (typeof value === 'number' && Number.isFinite(value));
const member = (values, value) => typeof value === 'string' && Object.hasOwn(values, value);
const empty = (error = false) => ({ card: null, editingId: '', source: '', changed: false, error });

function cleanDraft(draft) {
  if (!dict(draft) || !dict(draft.card) || !text(draft.editingId, 71) ||
    (draft.editingId !== '' && !/^custom-[a-zA-Z0-9-]{1,64}$/.test(draft.editingId)) || !text(draft.source, 16000)) return null;
  const card = draft.card;
  const field = card.field === undefined ? 'grid' : card.field;
  if (!text(card.name, 72) || !member(TYPES, card.type) || !member(TAGS, card.tag) ||
    !text(card.image, 2048) || !text(card.flavor, 160) || !FIELDS.some(item => item.id === field) ||
    !['cost', 'speed', 'attack', 'hp'].every(key => scalar(card[key])) ||
    !Array.isArray(card.effects) || card.effects.length > 4) return null;
  const effects = [];
  for (const effect of card.effects) {
    if (!dict(effect) || !member(TRIGGERS, effect.trigger) || !member(ACTIONS, effect.action) ||
      !member(TARGETS, effect.target) || !scalar(effect.amount)) return null;
    effects.push({ trigger: effect.trigger, action: effect.action, target: effect.target, amount: effect.amount });
  }
  return { card: { name: card.name, type: card.type, tag: card.tag, cost: card.cost, speed: card.speed,
    attack: card.attack, hp: card.hp, image: card.image, flavor: card.flavor, field, effects },
  editingId: draft.editingId, source: draft.source };
}

export function loadDraft(custom = []) {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw === null) return empty();
    const stored = JSON.parse(raw);
    if (!dict(stored) || stored.version !== 1) return empty(true);
    const draft = cleanDraft(stored);
    if (!draft) return empty(true);
    let changed = false;
    if (draft.editingId && !custom.some(card => card.id === draft.editingId && JSON.stringify(card) === draft.source)) {
      draft.editingId = '';
      draft.source = '';
      changed = true;
    }
    return { ...draft, changed, error: false };
  } catch { return empty(true); }
}

export function saveDraft(draft) {
  try {
    if (draft === null) sessionStorage.removeItem(DRAFT_KEY);
    else {
      const clean = cleanDraft(draft);
      if (!clean) return false;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, ...clean }));
    }
    return true;
  } catch { return false; }
}
