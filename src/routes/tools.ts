import { Hono } from 'hono'
import { and, eq, desc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { stores } from '../db/schema/index.ts'
import { leads } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const toolsRoutes = new Hono<{ Variables: Variables }>()
toolsRoutes.use('*', tenantMiddleware)

// ── Get full tools config ────────────────────────────────────────────────────
toolsRoutes.get('/config', async (c) => {
  const storeId = c.get('storeId') as string
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  if (!store) return c.json({ error: 'Not found' }, 404)

  return c.json({
    whatsapp: store.whatsapp ?? '',
    trackers: store.trackers ? JSON.parse(store.trackers) : {},
    toolsConfig: store.toolsConfig ? JSON.parse(store.toolsConfig) : {},
  })
})

// ── Save WhatsApp number + enabled flag ──────────────────────────────────────
toolsRoutes.patch('/whatsapp', async (c) => {
  const storeId = c.get('storeId') as string
  const { whatsapp, whatsappEnabled } = await c.req.json<{ whatsapp?: string; whatsappEnabled?: boolean }>()

  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  const existing = store?.toolsConfig ? JSON.parse(store.toolsConfig) : {}
  const toolsConfig = JSON.stringify({ ...existing, whatsappEnabled: whatsappEnabled ?? existing.whatsappEnabled })

  await db.update(stores)
    .set({ whatsapp: whatsapp ?? store?.whatsapp, toolsConfig, updatedAt: new Date() })
    .where(eq(stores.id, storeId))

  return c.json({ ok: true })
})

// ── Save tracker pixel IDs ───────────────────────────────────────────────────
toolsRoutes.put('/trackers', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Record<string, string>>()

  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  const existing = store?.trackers ? JSON.parse(store.trackers) : {}
  const trackers = JSON.stringify({ ...existing, ...body })

  await db.update(stores).set({ trackers, updatedAt: new Date() }).where(eq(stores.id, storeId))
  return c.json({ ok: true })
})

// ── Save access gate config ──────────────────────────────────────────────────
toolsRoutes.put('/access-gate', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{ enabled: boolean; fields: string[]; message?: string }>()

  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  const existing = store?.toolsConfig ? JSON.parse(store.toolsConfig) : {}
  const toolsConfig = JSON.stringify({ ...existing, accessGate: body })

  await db.update(stores).set({ toolsConfig, updatedAt: new Date() }).where(eq(stores.id, storeId))
  return c.json({ ok: true })
})

// ── Leads (access gate captures) ────────────────────────────────────────────
toolsRoutes.get('/leads', async (c) => {
  const storeId = c.get('storeId') as string
  const { q } = c.req.query()

  const rows = await db.query.leads.findMany({
    where: eq(leads.storeId, storeId),
    orderBy: [desc(leads.createdAt)],
  })

  const filtered = q
    ? rows.filter(r =>
        (r.name ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (r.email ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : rows

  return c.json({ data: filtered, total: filtered.length })
})

toolsRoutes.delete('/leads/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(leads).where(and(eq(leads.id, c.req.param('id')), eq(leads.storeId, storeId)))
  return c.json({ ok: true })
})
