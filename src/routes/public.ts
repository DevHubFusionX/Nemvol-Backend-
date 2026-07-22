import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import {
  stores, products, shippingZones, storePages, leads, orders, orderLines, customers, paymentMethods,
} from '../db/schema/index.ts'

export const publicRoutes = new Hono()

// ── Helper: resolve store by slug ─────────────────────────────────────────────
async function getStoreBySlug(slug: string) {
  return db.query.stores.findFirst({ where: eq(stores.slug, slug) })
}

// ── GET /public/store/:slug ───────────────────────────────────────────────────
publicRoutes.get('/store/:slug', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)
  if (store.published !== 'true') return c.json({ error: 'Store not published' }, 403)

  // Parse toolsConfig so the storefront can read accessGate + whatsappEnabled
  let toolsConfig: Record<string, unknown> = {}
  try { toolsConfig = store.toolsConfig ? JSON.parse(store.toolsConfig) : {} } catch {}

  return c.json({
    id:          store.id,
    name:        store.name,
    slug:        store.slug,
    tagline:     store.tagline,
    logoUrl:     store.logoUrl,
    phone:       store.phone,
    whatsapp:    store.whatsapp,
    address:     store.address,
    country:     store.country,
    state:       store.state,
    currency:    store.currency,
    theme:       store.theme,
    published:   store.published,
    accentColor: store.accentColor,
    heroData:    store.heroData,
    socialLinks: store.socialLinks,
    toolsConfig,
    trackers:    store.trackers ? JSON.parse(store.trackers) : {},
  })
})

// ── GET /public/store/:slug/products ─────────────────────────────────────────
publicRoutes.get('/store/:slug/products', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const { q, category } = c.req.query()

  const rows = await db.query.products.findMany({
    where: and(
      eq(products.storeId, store.id),
      eq(products.status, 'active'),
    ),
    with: { category: true, variants: true, media: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })

  const filtered = rows
    .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .filter(p => !category || category === 'All' || p.category?.name === category)
    .map(({ category: cat, ...p }) => ({
      ...p,
      category: cat?.name ?? 'General',
    }))

  return c.json({ data: filtered, total: filtered.length })
})

// ── GET /public/store/:slug/shipping ─────────────────────────────────────────
publicRoutes.get('/store/:slug/shipping', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const zones = await db.query.shippingZones.findMany({
    where: eq(shippingZones.storeId, store.id),
  })
  return c.json({ zones, shippingEnabled: store.shippingEnabled === 'true' })
})

// ── GET /public/store/:slug/pages ─────────────────────────────────────────────
publicRoutes.get('/store/:slug/pages', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const pages = await db.query.storePages.findMany({
    where: and(eq(storePages.storeId, store.id), eq(storePages.published, 'true')),
  })
  return c.json(pages)
})

// ── GET /public/store/:slug/pages/:pageSlug ───────────────────────────────────
publicRoutes.get('/store/:slug/pages/:pageSlug', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const page = await db.query.storePages.findFirst({
    where: and(
      eq(storePages.storeId, store.id),
      eq(storePages.slug, c.req.param('pageSlug')),
      eq(storePages.published, 'true'),
    ),
  })
  if (!page) return c.json({ error: 'Page not found' }, 404)
  return c.json(page)
})

// ── GET /public/store/:slug/payment-methods ──────────────────────────────────
publicRoutes.get('/store/:slug/payment-methods', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const row = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.storeId, store.id),
  })

  let methods = {}
  try { methods = row?.methods ? JSON.parse(row.methods) : {} } catch {}
  return c.json({ methods })
})

// ── GET /public/store/:slug/orders ──────────────────────────────────────────
publicRoutes.get('/store/:slug/orders', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const { email } = c.req.query()
  if (!email) return c.json({ data: [], total: 0 })

  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.storeId, store.id), eq(customers.email, email)),
  })
  if (!customer) return c.json({ data: [], total: 0 })

  const rows = await db.query.orders.findMany({
    where: eq(orders.customerId, customer.id),
    with: { lines: true },
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  })

  // Enrich lines with product image via variantId
  const { productVariants, productMedia } = await import('../db/schema/catalogue.ts')
  const enriched = await Promise.all(rows.map(async (order) => ({
    ...order,
    lines: await Promise.all((order.lines ?? []).map(async (line) => {
      let imageUrl: string | null = null
      if (line.variantId) {
        const variant = await db.query.productVariants.findFirst({
          where: eq(productVariants.id, line.variantId),
        })
        if (variant?.productId) {
          const media = await db.query.productMedia.findFirst({
            where: eq(productMedia.productId, variant.productId),
            orderBy: (m, { asc }) => [asc(m.position)],
          })
          imageUrl = media?.url ?? null
        }
      }
      return { ...line, imageUrl }
    })),
  })))

  return c.json({ data: enriched, total: enriched.length })
})

// ── POST /public/store/:slug/orders ──────────────────────────────────────────
publicRoutes.post('/store/:slug/orders', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const body = await c.req.json<{
    email?: string
    firstName?: string
    lastName?: string
    phone?: string
    subtotal: string
    shippingCost?: string
    total: string
    shippingAddress?: string
    notes?: string
    couponCode?: string
    lines: {
      productName: string
      variantLabel?: string
      quantity: string
      unitPrice: string
      lineTotal: string
    }[]
  }>()

  // Find or create customer
  let customerId: string | undefined
  if (body.email || body.phone) {
    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.storeId, store.id),
        body.email ? eq(customers.email, body.email) : eq(customers.phone, body.phone ?? ''),
      ),
    })

    if (existing) {
      customerId = existing.id
      // Update totals
      await db.update(customers)
        .set({
          totalOrders: String(Number(existing.totalOrders) + 1),
          totalSpent:  String(Number(existing.totalSpent) + Number(body.total)),
        })
        .where(eq(customers.id, existing.id))
    } else {
      const [created] = await db.insert(customers).values({
        storeId:     store.id,
        email:       body.email,
        firstName:   body.firstName,
        lastName:    body.lastName,
        phone:       body.phone,
        totalOrders: '1',
        totalSpent:  body.total,
      }).returning()
      customerId = created.id
    }
  }

  const orderNumber = `NMV-${Date.now().toString(36).toUpperCase()}`

  const [order] = await db.insert(orders).values({
    storeId:         store.id,
    customerId,
    orderNumber,
    subtotal:        body.subtotal,
    shippingCost:    body.shippingCost ?? '0',
    total:           body.total,
    currency:        store.currency ?? 'NGN',
    shippingAddress: body.shippingAddress,
    notes:           body.notes,
    couponCode:      body.couponCode,
  }).returning()

  if (body.lines?.length) {
    await db.insert(orderLines).values(
      body.lines.map(l => ({ ...l, orderId: order.id }))
    )
  }

  return c.json({ id: order.id, orderNumber: order.orderNumber }, 201)
})

// ── POST /public/store/:slug/leads ────────────────────────────────────────────
publicRoutes.post('/store/:slug/leads', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  const body = await c.req.json<{ name?: string; email?: string; phone?: string; source?: string }>()
  const [lead] = await db.insert(leads).values({ ...body, storeId: store.id }).returning()
  return c.json(lead, 201)
})

// ── GET /public/store/:slug/reviews ──────────────────────────────────────────
publicRoutes.get('/store/:slug/reviews', async (c) => {
  const store = await getStoreBySlug(c.req.param('slug'))
  if (!store) return c.json({ error: 'Store not found' }, 404)

  // Import reviews schema inline to avoid circular deps
  const { reviews } = await import('../db/schema/reviews.ts')
  const rows = await db.query.reviews.findMany({
    where: and(eq(reviews.storeId, store.id), eq(reviews.status, 'approved')),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  })
  return c.json({ data: rows, total: rows.length })
})
