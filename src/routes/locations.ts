import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { locations } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const locationRoutes = new Hono<{ Variables: Variables }>()
locationRoutes.use('*', tenantMiddleware)

locationRoutes.get('/', async (c) => {
  const storeId = c.get('storeId')
  const rows = await db.query.locations.findMany({ where: eq(locations.storeId, storeId) })
  return c.json(rows)
})

locationRoutes.post('/', async (c) => {
  const storeId = c.get('storeId')
  const body = await c.req.json<{ name: string; address: string; city: string; state: string; phone?: string; type: string }>()
  const [row] = await db.insert(locations)
    .values({ storeId, name: body.name, address: body.address, city: body.city, state: body.state, phone: body.phone || null, type: body.type })
    .returning()
  return c.json(row, 201)
})

locationRoutes.patch('/:id', async (c) => {
  const storeId = c.get('storeId')
  const body = await c.req.json<{ name: string; address: string; city: string; state: string; phone?: string; type: string }>()
  const [row] = await db.update(locations)
    .set({ name: body.name, address: body.address, city: body.city, state: body.state, phone: body.phone || null, type: body.type })
    .where(and(eq(locations.id, c.req.param('id')), eq(locations.storeId, storeId)))
    .returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

locationRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId')
  await db.delete(locations).where(and(eq(locations.id, c.req.param('id')), eq(locations.storeId, storeId)))
  return c.json({ ok: true })
})
