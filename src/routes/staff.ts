import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { staff } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const staffRoutes = new Hono<{ Variables: Variables }>()
staffRoutes.use('*', tenantMiddleware)

staffRoutes.get('/', async (c) => {
  const storeId = c.get('storeId')
  const rows = await db.query.staff.findMany({ where: eq(staff.storeId, storeId) })
  return c.json(rows)
})

staffRoutes.post('/', async (c) => {
  const storeId = c.get('storeId')
  const { name, email, role, branch } = await c.req.json<{ name: string; email: string; role: string; branch?: string }>()
  const [row] = await db.insert(staff)
    .values({ storeId, name, email, role, branch: branch || 'Main Branch' })
    .returning()
  return c.json(row, 201)
})

staffRoutes.patch('/:id', async (c) => {
  const storeId = c.get('storeId')
  const { role, branch, status } = await c.req.json<{ role?: string; branch?: string; status?: string }>()
  const update: Record<string, string> = {}
  if (role !== undefined) update.role = role
  if (branch !== undefined) update.branch = branch
  if (status !== undefined) update.status = status
  const [row] = await db.update(staff)
    .set(update)
    .where(and(eq(staff.id, c.req.param('id')), eq(staff.storeId, storeId)))
    .returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

staffRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId')
  await db.delete(staff).where(and(eq(staff.id, c.req.param('id')), eq(staff.storeId, storeId)))
  return c.json({ ok: true })
})
