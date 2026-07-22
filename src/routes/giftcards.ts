import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { giftCards } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

export const giftCardRoutes = new Hono<{ Variables: Variables }>()
giftCardRoutes.use('*', tenantMiddleware)

giftCardRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const rows = await db.query.giftCards.findMany({ where: eq(giftCards.storeId, storeId) })
  return c.json(rows)
})

giftCardRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { value, quantity, expiresAt, message } = await c.req.json<{
    value: string; quantity: string; expiresAt?: string; message?: string
  }>()

  const qty = Math.max(1, Number(quantity))
  const inserted = await Promise.all(
    Array.from({ length: qty }).map(() =>
      db.insert(giftCards).values({
        storeId, value, quantity: '1',
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        message,
        code: generateCode(),
      }).returning()
    )
  )

  return c.json(inserted.map(r => r[0]), 201)
})

giftCardRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(giftCards).where(and(eq(giftCards.id, c.req.param('id')), eq(giftCards.storeId, storeId)))
  return c.json({ success: true })
})
