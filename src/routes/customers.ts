import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { customers } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const customerRoutes = new Hono<{ Variables: Variables }>()
customerRoutes.use('*', tenantMiddleware)

customerRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { q } = c.req.query()
  const rows = await db.query.customers.findMany({
    where: eq(customers.storeId, storeId),
    orderBy: (cu, { desc }) => [desc(cu.createdAt)],
  })
  const filtered = q
    ? rows.filter(r =>
        [r.firstName, r.lastName, r.email, r.phone]
          .filter(Boolean)
          .some(v => v!.toLowerCase().includes(q.toLowerCase()))
      )
    : rows
  return c.json({ data: filtered, total: filtered.length })
})

customerRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Omit<typeof customers.$inferInsert, 'id' | 'storeId' | 'createdAt'>>()
  const [customer] = await db.insert(customers).values({ ...body, storeId }).returning()
  return c.json(customer, 201)
})

customerRoutes.patch('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Partial<typeof customers.$inferInsert>>()
  const [updated] = await db.update(customers)
    .set(body)
    .where(and(eq(customers.id, c.req.param('id')), eq(customers.storeId, storeId)))
    .returning()
  return c.json(updated)
})

customerRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(customers)
    .where(and(eq(customers.id, c.req.param('id')), eq(customers.storeId, storeId)))
  return c.json({ success: true })
})

// CSV import — parse rows and bulk insert
customerRoutes.post('/import', async (c) => {
  const storeId = c.get('storeId') as string
  const { rows } = await c.req.json<{
    rows: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string }[]
  }>()
  if (!rows?.length) return c.json({ error: 'No rows provided' }, 400)

  const inserted = await db.insert(customers)
    .values(rows.map(r => ({ ...r, storeId })))
    .returning()

  return c.json({ imported: inserted.length })
})
