import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { stores } from './identity.ts'

export const planEnum    = pgEnum('plan_id',    ['free', 'pro', 'business'])
export const subStatusEnum = pgEnum('sub_status', ['trialing', 'active', 'past_due', 'cancelled', 'pending_verification'])

export const subscriptions = pgTable('subscriptions', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  storeId:              uuid('store_id').notNull().references(() => stores.id).unique(),
  planId:               planEnum('plan_id').notNull().default('free'),
  status:               subStatusEnum('status').notNull().default('trialing'),
  trialEndsAt:          timestamp('trial_ends_at'),
  currentPeriodStart:   timestamp('current_period_start'),
  currentPeriodEnd:     timestamp('current_period_end'),
  paystackSubCode:      text('paystack_sub_code'),
  updatedAt:            timestamp('updated_at').defaultNow(),
})

export const paymentAttempts = pgTable('payment_attempts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  storeId:     uuid('store_id').notNull().references(() => stores.id),
  planId:      planEnum('plan_id').notNull(),
  method:      text('method').notNull(),       // 'paystack' | 'bank_transfer'
  reference:   text('reference').unique(),
  proofUrl:    text('proof_url'),
  status:      text('status').notNull().default('pending'), // pending | verified | failed
  amountKobo:  text('amount_kobo'),
  createdAt:   timestamp('created_at').defaultNow(),
})
