import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { categories } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const categoryRoutes = new Hono<{ Variables: Variables }>()
categoryRoutes.use('*', tenantMiddleware)

categoryRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const rows = await db.query.categories.findMany({ where: eq(categories.storeId, storeId) })
  return c.json(rows)
})

categoryRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { name, slug } = await c.req.json<{ name: string; slug: string }>()
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.storeId, storeId), eq(categories.slug, slug)),
  })
  if (existing) return c.json({ error: 'A category with this name already exists' }, 409)
  const [cat] = await db.insert(categories).values({ storeId, name, slug }).returning()
  return c.json(cat, 201)
})

categoryRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(categories).where(and(eq(categories.id, c.req.param('id')), eq(categories.storeId, storeId)))
  return c.json({ success: true })
})
