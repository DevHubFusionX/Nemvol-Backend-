import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { stores } from './identity.ts'

export const storePages = pgTable('store_pages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  title:     text('title').notNull(),
  slug:      text('slug').notNull(),
  content:   text('content'),
  published: text('published').default('false'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const domainStatusEnum = pgEnum('domain_status', ['pending', 'verified', 'failed'])

export const domains = pgTable('domains', {
  id:                uuid('id').primaryKey().defaultRandom(),
  storeId:           uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  domain:            text('domain').notNull().unique(),
  status:            domainStatusEnum('status').default('pending'),
  verificationToken: text('verification_token'),
  verifiedAt:        timestamp('verified_at'),
  createdAt:         timestamp('created_at').defaultNow(),
})

export const leads = pgTable('leads', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  email:     text('email'),
  phone:     text('phone'),
  name:      text('name'),
  source:    text('source'),
  createdAt: timestamp('created_at').defaultNow(),
})
