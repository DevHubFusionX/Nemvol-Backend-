import { Hono } from 'hono'
import { createHmac } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { paymentAttempts, subscriptions } from '../db/schema/index.ts'

export const webhookRoutes = new Hono()

webhookRoutes.post('/paystack', async (c) => {
  const sig  = c.req.header('x-paystack-signature')
  const body = await c.req.text()
  const hash = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body).digest('hex')

  if (hash !== sig) return c.json({ error: 'Invalid signature' }, 400)

  const event = JSON.parse(body) as { event: string; data: { reference: string; status: string } }

  if (event.event === 'charge.success') {
    const attempt = await db.query.paymentAttempts.findFirst({
      where: eq(paymentAttempts.reference, event.data.reference),
    })

    if (attempt && attempt.status === 'pending') {
      await db.update(paymentAttempts)
        .set({ status: 'verified' })
        .where(eq(paymentAttempts.id, attempt.id))

      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      await db.update(subscriptions)
        .set({ planId: attempt.planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: periodEnd, updatedAt: now })
        .where(eq(subscriptions.storeId, attempt.storeId))
    }
  }

  return c.json({ received: true })
})
