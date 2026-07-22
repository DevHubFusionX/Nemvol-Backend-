import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../db/client.ts'
import { storePages, domains, leads, stores } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const storefrontRoutes = new Hono<{ Variables: Variables }>()
storefrontRoutes.use('*', tenantMiddleware)

// Pages
storefrontRoutes.get('/pages', async (c) => {
  const storeId = c.get('storeId') as string
  return c.json(await db.query.storePages.findMany({ where: eq(storePages.storeId, storeId) }))
})

storefrontRoutes.post('/pages', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Omit<typeof storePages.$inferInsert, 'id' | 'storeId' | 'createdAt'>>()
  const [page] = await db.insert(storePages).values({ ...body, storeId }).returning()
  return c.json(page, 201)
})

storefrontRoutes.patch('/pages/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Partial<typeof storePages.$inferInsert>>()
  const [updated] = await db.update(storePages)
    .set(body)
    .where(and(eq(storePages.id, c.req.param('id')), eq(storePages.storeId, storeId)))
    .returning()
  return c.json(updated)
})

storefrontRoutes.delete('/pages/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(storePages)
    .where(and(eq(storePages.id, c.req.param('id')), eq(storePages.storeId, storeId)))
  return c.json({ success: true })
})

// Domains
storefrontRoutes.get('/domains', async (c) => {
  const storeId = c.get('storeId') as string
  return c.json(await db.query.domains.findMany({ where: eq(domains.storeId, storeId) }))
})

storefrontRoutes.delete('/domains/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(domains).where(and(eq(domains.id, c.req.param('id')), eq(domains.storeId, storeId)))
  return c.json({ ok: true })
})

storefrontRoutes.post('/domains/connect', async (c) => {
  const storeId = c.get('storeId') as string
  const { domain } = await c.req.json<{ domain: string }>()
  const token = randomUUID()
  const [record] = await db.insert(domains)
    .values({ storeId, domain, verificationToken: token })
    .returning()
  return c.json({
    ...record,
    dnsRecords: [
      { type: 'CNAME', name: domain, value: 'storefronts.nemvol.com' },
      { type: 'TXT',   name: `_nemvol.${domain}`, value: token },
    ],
  }, 201)
})

// Storefront config (theme, published, accentColor, heroData)
storefrontRoutes.get('/config', async (c) => {
  const storeId = c.get('storeId') as string
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  if (!store) return c.json({ error: 'Not found' }, 404)
  return c.json({
    theme: store.theme,
    published: store.published,
    accentColor: store.accentColor,
    heroData: store.heroData,
    slug: store.slug,
    name: store.name,
    whatsapp: store.whatsapp,
    instagram: (store as Record<string, unknown>).instagram ?? '',
  })
})

storefrontRoutes.put('/config', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{
    theme?: string; published?: string; accentColor?: string
    heroData?: string; name?: string; whatsapp?: string
  }>()
  const [updated] = await db.update(stores)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(stores.id, storeId))
    .returning()
  return c.json(updated)
})

// Stats
storefrontRoutes.get('/stats', async (c) => {
  const storeId = c.get('storeId') as string
  const [pageCount, domainCount, leadCount] = await Promise.all([
    db.query.storePages.findMany({ where: eq(storePages.storeId, storeId) }).then(r => r.length),
    db.query.domains.findMany({ where: eq(domains.storeId, storeId) }).then(r => r.length),
    db.query.leads.findMany({ where: eq(leads.storeId, storeId) }).then(r => r.length),
  ])
  return c.json({ pageCount, domainCount, leadCount })
})

// Leads
storefrontRoutes.get('/leads', async (c) => {
  const storeId = c.get('storeId') as string
  return c.json(await db.query.leads.findMany({ where: eq(leads.storeId, storeId) }))
})

storefrontRoutes.post('/leads', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Omit<typeof leads.$inferInsert, 'id' | 'storeId' | 'createdAt'>>()
  const [lead] = await db.insert(leads).values({ ...body, storeId }).returning()
  return c.json(lead, 201)
})
