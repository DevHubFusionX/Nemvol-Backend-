import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { stores } from './identity.ts'
import { products } from './catalogue.ts'

export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected'])

export const reviews = pgTable('reviews', {
  id:           uuid('id').primaryKey().defaultRandom(),
  storeId:      uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  productId:    uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName:  text('product_name').notNull(),   // snapshot
  customerName: text('customer_name').notNull(),
  customerEmail:text('customer_email'),
  rating:       text('rating').notNull(),          // '1'–'5'
  body:         text('body'),
  status:       reviewStatusEnum('status').default('pending'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})
