import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { subscriptions, paymentAttempts } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const subscriptionRoutes = new Hono<{ Variables: Variables }>()
subscriptionRoutes.use('*', tenantMiddleware)

subscriptionRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.storeId, storeId) })
  if (!sub) return c.json({ error: 'Not found' }, 404)
  return c.json(sub)
})

// Initiate Paystack payment
subscriptionRoutes.post('/initiate', async (c) => {
  const storeId = c.get('storeId') as string
  const userId = c.get('userId') as string
  const { planId, email } = await c.req.json<{ planId: string; email: string }>()

  const PLAN_AMOUNTS: Record<string, number> = {
    starter: 1000000, // ₦10,000 in kobo
    growth:  1500000, // ₦15,000
    premium: 2500000, // ₦25,000
  }
  const amount = PLAN_AMOUNTS[planId]
  if (!amount) return c.json({ error: 'Invalid plan' }, 400)

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount,
      metadata: { storeId, userId, planId },
      callback_url: `${process.env.APP_URL ?? 'http://localhost:5173'}/dashboard/billing?verify=1`,
    }),
  })
  const data = await res.json() as { data: { authorization_url: string; reference: string } }
  return c.json({ url: data.data.authorization_url, reference: data.data.reference })
})

// Called by frontend after Paystack inline payment succeeds
subscriptionRoutes.post('/verify', async (c) => {
  const storeId = c.get('storeId') as string
  const { reference, planId } = await c.req.json<{ reference: string; planId: 'pro' | 'business' }>()

  // Verify with Paystack
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  })
  const { data } = await res.json() as { data: { status: string } }

  if (data.status !== 'success') return c.json({ error: 'Payment not successful' }, 400)

  await db.insert(paymentAttempts).values({
    storeId, planId, method: 'paystack', reference, status: 'verified',
  })

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const [sub] = await db.update(subscriptions)
    .set({ planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd, updatedAt: now })
    .where(eq(subscriptions.storeId, storeId))
    .returning()

  return c.json(sub)
})
