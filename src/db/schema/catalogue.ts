import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { stores } from './identity.ts'

export const productStatusEnum = pgEnum('product_status', ['draft', 'active', 'archived'])

export const categories = pgTable('categories', {
  id:       uuid('id').primaryKey().defaultRandom(),
  storeId:  uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name:     text('name').notNull(),
  slug:     text('slug').notNull(),
  parentId: uuid('parent_id'),
})

export const products = pgTable('products', {
  id:          uuid('id').primaryKey().defaultRandom(),
  storeId:     uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  categoryId:  uuid('category_id').references(() => categories.id),
  name:        text('name').notNull(),
  slug:        text('slug').notNull(),
  description: text('description'),
  status:      productStatusEnum('status').default('draft'),
  tags:        text('tags').default('[]'),   // JSON array
  rating:      text('rating'),
  reviewCount: text('review_count').default('0'),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
})

export const productVariants = pgTable('product_variants', {
  id:             uuid('id').primaryKey().defaultRandom(),
  productId:      uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku:            text('sku'),
  price:          text('price').notNull(),
  compareAtPrice: text('compare_at_price'),
  attributes:     text('attributes'),   // JSON: { color, size, ... }
  weight:         text('weight'),
})

export const productMedia = pgTable('product_media', {
  id:        uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url:       text('url').notNull(),
  position:  text('position').default('0'),
})

export const locations = pgTable('locations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  address:   text('address'),
  city:      text('city'),
  state:     text('state'),
  phone:     text('phone'),
  type:      text('type').default('Branch'), // Branch | Logistics Hub | Pickup Point
  isDefault: text('is_default').default('false'),
})

export const inventoryMovements = pgTable('inventory_movements', {
  id:          uuid('id').primaryKey().defaultRandom(),
  variantId:   uuid('variant_id').notNull().references(() => productVariants.id),
  locationId:  uuid('location_id').references(() => locations.id),
  type:        text('type').notNull(), // receive | reserve | release | transfer_out | transfer_in | adjustment
  quantity:    text('quantity').notNull(),
  referenceId: uuid('reference_id'),
  note:        text('note'),
  createdAt:   timestamp('created_at').defaultNow(),
})

export const productAttributes = pgTable('product_attributes', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  type:      text('type').notNull().default('text'), // text | color | number
  values:    text('values').notNull().default('[]'), // JSON array of strings
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const giftCards = pgTable('gift_cards', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  value:     text('value').notNull(),
  quantity:  text('quantity').notNull().default('1'),
  expiresAt: timestamp('expires_at'),
  message:   text('message'),
  code:      text('code').notNull().unique(),
  status:    text('status').notNull().default('active'), // active | used | expired
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  media:    many(productMedia),
}))

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}))

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, { fields: [productMedia.productId], references: [products.id] }),
}))
