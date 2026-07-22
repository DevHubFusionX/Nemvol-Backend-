import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { stores } from './identity.ts'

export const shippingZones = pgTable('shipping_zones', {
  id:            uuid('id').primaryKey().defaultRandom(),
  storeId:       uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  regions:       text('regions'),       // JSON array of states
  rate:          text('rate').default('0'),
  rateType:      text('rate_type').default('flat'), // flat | free | weight
  minOrderFree:  text('min_order_free'),
  minWeight:     text('min_weight'),
  maxWeight:     text('max_weight'),
  weightRate:    text('weight_rate'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

export const suppliers = pgTable('suppliers', {
  id:      uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name:    text('name').notNull(),
  email:   text('email'),
  phone:   text('phone'),
})

export const purchases = pgTable('purchases', {
  id:           uuid('id').primaryKey().defaultRandom(),
  storeId:      uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  supplierId:   uuid('supplier_id').references(() => suppliers.id),
  status:       text('status').default('pending'), // pending | completed | cancelled
  total:        text('total').notNull(),
  items:        text('items'),        // JSON string of line items
  notes:        text('notes'),
  expectedDate: text('expected_date'),
  createdAt:    timestamp('created_at').defaultNow(),
})

export const purchasesRelations = relations(purchases, ({ one }) => ({
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
}))
