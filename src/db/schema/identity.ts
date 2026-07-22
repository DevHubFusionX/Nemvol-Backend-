import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  clerkId:    text('clerk_id').notNull().unique(),
  email:      text('email').notNull().unique(),
  firstName:  text('first_name'),
  lastName:   text('last_name'),
  phone:      text('phone'),
  avatarUrl:  text('avatar_url'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const stores = pgTable('stores', {
  id:         uuid('id').primaryKey().defaultRandom(),
  ownerId:    uuid('owner_id').notNull().references(() => users.id),
  name:       text('name').notNull(),
  slug:       text('slug').notNull().unique(),
  logoUrl:    text('logo_url'),
  tagline:    text('tagline'),
  phone:      text('phone'),
  whatsapp:   text('whatsapp'),
  address:    text('address'),
  country:    text('country').default('NG'),
  state:      text('state'),
  currency:   text('currency').default('NGN'),
  theme:      text('theme').default('nubia'),
  published:  text('published').default('false'),
  accentColor: text('accent_color').default('#a8956a'),
  heroData:   text('hero_data'),   // JSON: { badge, heading, sub, cta }
  socialLinks: text('social_links'), // JSON: { facebook, twitter, instagram, tiktok }
  trackers:     text('trackers'),    // JSON: { meta, tiktok, google }
  toolsConfig:  text('tools_config'), // JSON: { accessGate: { enabled, fields, message }, whatsappEnabled }
  shippingEnabled: text('shipping_enabled').default('false'),
  deliveryMode: text('delivery_mode').default('manual'), // manual | logistics
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
})

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'manager', 'staff'])

export const storeMembers = pgTable('store_members', {
  id:          uuid('id').primaryKey().defaultRandom(),
  storeId:     uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').notNull().references(() => users.id),
  role:        memberRoleEnum('role').notNull().default('staff'),
  invitedAt:   timestamp('invited_at').defaultNow(),
  acceptedAt:  timestamp('accepted_at'),
})

export const staff = pgTable('staff', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  email:     text('email').notNull(),
  role:      text('role').notNull().default('Manager'),
  branch:    text('branch').default('Main Branch'),
  status:    text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const storesRelations = relations(stores, ({ one, many }) => ({
  owner:   one(users, { fields: [stores.ownerId], references: [users.id] }),
  members: many(storeMembers),
}))

export const usersRelations = relations(users, ({ many }) => ({
  stores: many(stores),
}))

export const storeMembersRelations = relations(storeMembers, ({ one }) => ({
  store: one(stores, { fields: [storeMembers.storeId], references: [stores.id] }),
  user:  one(users,  { fields: [storeMembers.userId],  references: [users.id]  }),
}))
