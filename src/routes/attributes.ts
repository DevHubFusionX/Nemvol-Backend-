import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { productAttributes } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const attributeRoutes = new Hono<{ Variables: Variables }>()
attributeRoutes.use('*', tenantMiddleware)

attributeRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const rows = await db.query.productAttributes.findMany({ where: eq(productAttributes.storeId, storeId) })
  return c.json(rows)
})

attributeRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { name, type, values } = await c.req.json<{ name: string; type: string; values: string[] }>()
  const [attr] = await db.insert(productAttributes).values({
    storeId, name, type, values: JSON.stringify(values),
  }).returning()
  return c.json(attr, 201)
})

attributeRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(productAttributes).where(and(eq(productAttributes.id, c.req.param('id')), eq(productAttributes.storeId, storeId)))
  return c.json({ success: true })
})
