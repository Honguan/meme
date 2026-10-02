import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const tickets = sqliteTable('match_tickets', {
  id: text('id').primaryKey(),
  joined: integer('joined').notNull(),
  seen: integer('seen').notNull(),
  loadout: text('loadout').notNull(),
  match: text('match_id'),
}, t => [index('tickets_queue').on(t.match, t.seen)]);

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  peer0: text('peer0').notNull(),
  peer1: text('peer1').notNull(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  expires: integer('expires').notNull(),
}, t => [index('matches_expiry').on(t.expires)]);
