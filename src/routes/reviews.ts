import { Hono } from 'hono'
import { and, eq, lte, gte } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { reviews } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const reviewRoutes = new Hono<{ Variables: Variables }>()

// ── Public: storefront submits a review (no auth) ────────────────────────────
reviewRoutes.post('/submit', async (c) => {
  const body = await c.req.json<{
    storeId: string
    productId?: string
    productName: string
    customerName: string
    customerEmail?: string
    rating: string
    body?: string
  }>()
  const [review] = await db.insert(reviews).values({ ...body, status: 'pending' }).returning()
  return c.json(review, 201)
})

// ── Protected: dashboard routes ──────────────────────────────────────────────
reviewRoutes.use('/:path{.*}', tenantMiddleware)

reviewRoutes.get('/', async (c) => {
  const storeId = c.get('storeId')
  const { status, rating, q } = c.req.query()

  const rows = await db.query.reviews.findMany({
    where: and(
      eq(reviews.storeId, storeId),
      status ? eq(reviews.status, status as 'pending' | 'approved' | 'rejected') : undefined,
      rating === 'low'  ? lte(reviews.rating, '3') : undefined,
      rating === 'high' ? gte(reviews.rating, '4') : undefined,
    ),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  })

  const filtered = q
    ? rows.filter(r =>
        r.customerName.toLowerCase().includes(q.toLowerCase()) ||
        r.productName.toLowerCase().includes(q.toLowerCase())
      )
    : rows

  return c.json({ data: filtered, total: filtered.length })
})

reviewRoutes.patch('/:id/status', async (c) => {
  const storeId = c.get('storeId')
  const { status } = await c.req.json<{ status: 'approved' | 'rejected' }>()
  const [updated] = await db.update(reviews)
    .set({ status })
    .where(and(eq(reviews.id, c.req.param('id')), eq(reviews.storeId, storeId)))
    .returning()
  return c.json(updated)
})

reviewRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId')
  await db.delete(reviews)
    .where(and(eq(reviews.id, c.req.param('id')), eq(reviews.storeId, storeId)))
  return c.json({ success: true })
})
