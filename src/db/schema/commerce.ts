import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { stores } from './identity.ts'
import { productVariants } from './catalogue.ts'

export const customers = pgTable('customers', {
  id:          uuid('id').primaryKey().defaultRandom(),
  storeId:     uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  email:       text('email'),
  firstName:   text('first_name'),
  lastName:    text('last_name'),
  phone:       text('phone'),
  address:     text('address'),
  totalOrders: text('total_orders').default('0'),
  totalSpent:  text('total_spent').default('0'),
  createdAt:   timestamp('created_at').defaultNow(),
})

export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
])

export const orders = pgTable('orders', {
  id:              uuid('id').primaryKey().defaultRandom(),
  storeId:         uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId:      uuid('customer_id').references(() => customers.id),
  orderNumber:     text('order_number').notNull().unique(),
  status:          orderStatusEnum('status').default('pending'),
  subtotal:        text('subtotal').notNull(),
  shippingCost:    text('shipping_cost').default('0'),
  discount:        text('discount').default('0'),
  total:           text('total').notNull(),
  currency:        text('currency').default('NGN'),
  shippingAddress: text('shipping_address'),  // JSON
  couponCode:      text('coupon_code'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').defaultNow(),
  updatedAt:       timestamp('updated_at').defaultNow(),
})

export const orderLines = pgTable('order_lines', {
  id:           uuid('id').primaryKey().defaultRandom(),
  orderId:      uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  variantId:    uuid('variant_id').references(() => productVariants.id),
  productName:  text('product_name').notNull(),
  variantLabel: text('variant_label'),
  quantity:     text('quantity').notNull(),
  unitPrice:    text('unit_price').notNull(),
  lineTotal:    text('line_total').notNull(),
})

export const invoices = pgTable('invoices', {
  id:            uuid('id').primaryKey().defaultRandom(),
  storeId:       uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  customerId:    uuid('customer_id').references(() => customers.id),
  orderId:       uuid('order_id').references(() => orders.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  customerName:  text('customer_name'),
  customerEmail: text('customer_email'),
  status:        text('status').default('draft'), // draft | sent | paid | overdue
  total:         text('total').notNull(),
  lineItems:     text('line_items'),  // JSON array
  note:          text('note'),
  dueDate:       timestamp('due_date'),
  createdAt:     timestamp('created_at').defaultNow(),
})

export const expenses = pgTable('expenses', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  title:     text('title').notNull(),
  amount:    text('amount').notNull(),
  category:  text('category').default('Other'),
  date:      text('date'),
  note:      text('note'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const paymentMethods = pgTable('payment_methods', {
  id:        uuid('id').primaryKey().defaultRandom(),
  storeId:   uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }).unique(),
  methods:   text('methods').notNull().default('{}'), // JSON: { cards, transfer, pod } enabled flags + bank details
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  lines: many(orderLines),
}))

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
  order: one(orders, { fields: [orderLines.orderId], references: [orders.id] }),
}))

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}))
