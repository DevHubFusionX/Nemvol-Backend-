import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { purchases, suppliers } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const purchaseRoutes = new Hono<{ Variables: Variables }>()
purchaseRoutes.use('*', tenantMiddleware)

// ── Suppliers (must be before /:id to avoid Hono matching /suppliers as an id) ──

purchaseRoutes.get('/suppliers', async (c) => {
  const storeId = c.get('storeId')
  const rows = await db.query.suppliers.findMany({ where: eq(suppliers.storeId, storeId) })
  return c.json(rows)
})

purchaseRoutes.post('/suppliers', async (c) => {
  const storeId = c.get('storeId')
  const body = await c.req.json<{ name: string; email?: string; phone?: string }>()
  const [supplier] = await db.insert(suppliers).values({ ...body, storeId }).returning()
  return c.json(supplier, 201)
})

purchaseRoutes.delete('/suppliers/:id', async (c) => {
  const storeId = c.get('storeId')
  await db.delete(suppliers)
    .where(and(eq(suppliers.id, c.req.param('id')), eq(suppliers.storeId, storeId)))
  return c.json({ success: true })
})

// ── Purchases ────────────────────────────────────────────────────────────────

purchaseRoutes.get('/', async (c) => {
  const storeId = c.get('storeId')
  const { status, q } = c.req.query()
  const rows = await db.query.purchases.findMany({
    where: and(
      eq(purchases.storeId, storeId),
      status && status !== 'all' ? eq(purchases.status, status) : undefined,
    ),
    with: { supplier: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })
  const filtered = q
    ? rows.filter(p =>
        p.supplier?.name?.toLowerCase().includes(q.toLowerCase()) ||
        p.id.toLowerCase().includes(q.toLowerCase())
      )
    : rows
  return c.json({ data: filtered, total: filtered.length })
})

purchaseRoutes.get('/:id', async (c) => {
  const storeId = c.get('storeId')
  const purchase = await db.query.purchases.findFirst({
    where: and(eq(purchases.id, c.req.param('id')), eq(purchases.storeId, storeId)),
    with: { supplier: true },
  })
  if (!purchase) return c.json({ error: 'Not found' }, 404)
  return c.json(purchase)
})

purchaseRoutes.post('/', async (c) => {
  const storeId = c.get('storeId')
  const body = await c.req.json<{
    supplierId?: string
    status?: string
    total: string
    items?: string
    notes?: string
    expectedDate?: string
  }>()
  const [purchase] = await db.insert(purchases)
    .values({
      storeId,
      supplierId:   body.supplierId,
      status:       body.status ?? 'pending',
      total:        body.total,
      items:        body.items,
      notes:        body.notes,
      expectedDate: body.expectedDate,
    })
    .returning()
  return c.json(purchase, 201)
})

purchaseRoutes.patch('/:id/status', async (c) => {
  const storeId = c.get('storeId')
  const { status } = await c.req.json<{ status: string }>()
  const [updated] = await db.update(purchases)
    .set({ status })
    .where(and(eq(purchases.id, c.req.param('id')), eq(purchases.storeId, storeId)))
    .returning()
  return c.json(updated)
})

purchaseRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId')
  await db.delete(purchases)
    .where(and(eq(purchases.id, c.req.param('id')), eq(purchases.storeId, storeId)))
  return c.json({ success: true })
})
