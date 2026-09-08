import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  purpose: text('purpose').notNull(),
  owner: text('owner').notNull(),
  head: text('head').notNull(),
  sequence: integer('sequence').notNull().default(0),
  createdAt: text('created_at').notNull(),
  origin: text('origin'),
  localStart: integer('local_start').notNull().default(1),
  readOnly: integer('read_only').notNull().default(0),
});
export const members = sqliteTable(
  'members',
  {
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id),
    principal: text('principal').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.principal] }),
    index('members_principal').on(t.principal),
  ],
);
export const entries = sqliteTable(
  'entries',
  {
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id),
    id: text('id').notNull(),
    sequence: integer('sequence').notNull(),
    kind: text('kind').notNull(),
    caseId: text('case_id'),
    record: text('record').notNull(),
    hash: text('hash').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.id] }),
    uniqueIndex('entries_sequence').on(t.spaceId, t.sequence),
  ],
);
export const imports = sqliteTable('imports', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  fingerprint: text('fingerprint').notNull(),
  envelope: text('envelope').notNull(),
  receivedAt: text('received_at').notNull(),
  receiver: text('receiver').notNull(),
});
export const keys = sqliteTable(
  'trusted_keys',
  {
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id),
    fingerprint: text('fingerprint').notNull(),
    label: text('label').notNull(),
    domain: text('domain').notNull(),
    status: text('status').notNull(),
    reason: text('reason').notNull(),
    updatedAt: text('updated_at').notNull(),
    issuer: text('issuer').notNull(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.fingerprint] })],
);
export const invitations = sqliteTable('invitations', {
  digest: text('digest').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  role: text('role').notNull(),
  expiresAt: text('expires_at').notNull(),
  usedBy: text('used_by'),
});
export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id),
    name: text('name').notNull(),
    type: text('type').notNull(),
    size: integer('size').notNull(),
    digest: text('digest').notNull(),
    objectKey: text('object_key').notNull(),
    uploader: text('uploader').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('attachments_space').on(t.spaceId)],
);
