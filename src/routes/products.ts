import { Hono } from 'hono'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { products, productVariants, productMedia, subscriptions } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

const PLAN_PRODUCT_LIMITS: Record<string, number> = { free: 10, pro: -1, business: -1 }

export const productRoutes = new Hono<{ Variables: Variables }>()
productRoutes.use('*', tenantMiddleware)

productRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { category, status, q } = c.req.query()

  const rows = await db.query.products.findMany({
    where: and(
      eq(products.storeId, storeId),
      status    ? eq(products.status, status as 'draft' | 'active' | 'archived') : undefined,
    ),
    with: { variants: true, media: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })

  const filtered = q
    ? rows.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
    : rows

  const byCat = category && category !== 'All'
    ? filtered.filter(p => {
        // category stored on variant attributes or product name — simple tag match for now
        return p.name.toLowerCase().includes(category.toLowerCase())
      })
    : filtered

  return c.json({ data: byCat, total: byCat.length })
})

productRoutes.get('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, c.req.param('id')), eq(products.storeId, storeId)),
    with: { variants: true, media: true },
  })
  if (!product) return c.json({ error: 'Not found' }, 404)
  return c.json(product)
})

productRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string

  // Enforce plan limit
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.storeId, storeId) })
  const limit = PLAN_PRODUCT_LIMITS[sub?.planId ?? 'free']
  if (limit !== -1) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.storeId, storeId))
    if (Number(count) >= limit) return c.json({ error: 'Plan product limit reached' }, 403)
  }

  const body = await c.req.json<{
    name: string; slug: string; description?: string; categoryId?: string; tags?: string[]
    status?: 'draft' | 'active'; variants: { sku?: string; price: string; compareAtPrice?: string; attributes?: string }[]
    mediaUrls?: string[]
  }>()

  const [product] = await db.insert(products).values({
    storeId, name: body.name, slug: body.slug,
    description: body.description, categoryId: body.categoryId,
    tags: JSON.stringify(body.tags ?? []), status: body.status ?? 'draft',
  }).returning()

  if (body.variants?.length) {
    await db.insert(productVariants).values(
      body.variants.map(v => ({ ...v, productId: product.id }))
    )
  }

  if (body.mediaUrls?.length) {
    await db.insert(productMedia).values(
      body.mediaUrls.map((url, i) => ({ productId: product.id, url, position: String(i) }))
    )
  }

  return c.json(product, 201)
})

productRoutes.patch('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const { variants, ...body } = await c.req.json<Partial<typeof products.$inferInsert> & {
    variants?: { id?: string; price?: string; compareAtPrice?: string; sku?: string }[]
  }>()

  const [updated] = await db.update(products)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(products.id, c.req.param('id')), eq(products.storeId, storeId)))
    .returning()

  // Update first variant price if provided
  if (variants?.[0]?.price) {
    const existing = await db.query.productVariants.findFirst({
      where: eq(productVariants.productId, updated.id),
    })
    if (existing) {
      await db.update(productVariants)
        .set({ price: variants[0].price, compareAtPrice: variants[0].compareAtPrice })
        .where(eq(productVariants.id, existing.id))
    }
  }

  return c.json(updated)
})

productRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(products)
    .where(and(eq(products.id, c.req.param('id')), eq(products.storeId, storeId)))
  return c.json({ success: true })
})
