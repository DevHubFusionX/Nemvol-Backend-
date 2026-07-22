import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { shippingZones, stores } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const shippingRoutes = new Hono<{ Variables: Variables }>()
shippingRoutes.use('*', tenantMiddleware)

// ── Settings (master toggle + delivery mode) ─────────────────────────────────
shippingRoutes.get('/settings', async (c) => {
  const storeId = c.get('storeId')
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  if (!store) return c.json({ error: 'Not found' }, 404)
  return c.json({
    shippingEnabled: store.shippingEnabled === 'true',
    deliveryMode: store.deliveryMode ?? 'manual',
  })
})

shippingRoutes.patch('/settings', async (c) => {
  const storeId = c.get('storeId')
  const { shippingEnabled, deliveryMode } = await c.req.json<{ shippingEnabled?: boolean; deliveryMode?: string }>()
  const update: Record<string, string> = {}
  if (shippingEnabled !== undefined) update.shippingEnabled = String(shippingEnabled)
  if (deliveryMode !== undefined) update.deliveryMode = deliveryMode
  await db.update(stores).set({ ...update, updatedAt: new Date() }).where(eq(stores.id, storeId))
  return c.json({ ok: true })
})

// ── Zones ─────────────────────────────────────────────────────────────────────
shippingRoutes.get('/', async (c) => {
  const storeId = c.get('storeId')
  const rows = await db.query.shippingZones.findMany({ where: eq(shippingZones.storeId, storeId) })
  return c.json(rows)
})

shippingRoutes.post('/', async (c) => {
  const storeId = c.get('storeId')
  const body = await c.req.json<{
    name: string; regions: string[]; rateType: string
    rate?: string; minOrderFree?: string; minWeight?: string; maxWeight?: string; weightRate?: string
  }>()
  const [zone] = await db.insert(shippingZones).values({
    storeId,
    name: body.name,
    regions: JSON.stringify(body.regions),
    rateType: body.rateType,
    rate: body.rate ?? '0',
    minOrderFree: body.minOrderFree ?? null,
    minWeight: body.minWeight ?? null,
    maxWeight: body.maxWeight ?? null,
    weightRate: body.weightRate ?? null,
  }).returning()
  return c.json(zone, 201)
})

shippingRoutes.patch('/:id', async (c) => {
  const storeId = c.get('storeId')
  const body = await c.req.json<{
    name?: string; regions?: string[]; rateType?: string
    rate?: string; minOrderFree?: string; minWeight?: string; maxWeight?: string; weightRate?: string
  }>()
  const update: Record<string, string | null> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.regions !== undefined) update.regions = JSON.stringify(body.regions)
  if (body.rateType !== undefined) update.rateType = body.rateType
  if (body.rate !== undefined) update.rate = body.rate
  if (body.minOrderFree !== undefined) update.minOrderFree = body.minOrderFree || null
  if (body.minWeight !== undefined) update.minWeight = body.minWeight || null
  if (body.maxWeight !== undefined) update.maxWeight = body.maxWeight || null
  if (body.weightRate !== undefined) update.weightRate = body.weightRate || null
  const [zone] = await db.update(shippingZones)
    .set(update)
    .where(and(eq(shippingZones.id, c.req.param('id')), eq(shippingZones.storeId, storeId)))
    .returning()
  if (!zone) return c.json({ error: 'Not found' }, 404)
  return c.json(zone)
})

shippingRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId')
  await db.delete(shippingZones)
    .where(and(eq(shippingZones.id, c.req.param('id')), eq(shippingZones.storeId, storeId)))
  return c.json({ ok: true })
})
