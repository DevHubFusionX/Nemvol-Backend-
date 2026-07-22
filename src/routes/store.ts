import { Hono } from 'hono'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { stores } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

import { uploadBase64 } from '../lib/cloudinary.ts'

export const storeRoutes = new Hono<{ Variables: Variables }>()
storeRoutes.use('*', tenantMiddleware)

storeRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) })
  if (!store) return c.json({ error: 'Store not found' }, 404)
  return c.json(store)
})

// Check if a slug is available
storeRoutes.get('/slug-check', async (c) => {
  const storeId = c.get('storeId') as string
  const { slug } = c.req.query()
  if (!slug) return c.json({ available: false, error: 'Slug required' }, 400)

  const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '')
  if (clean.length < 3) return c.json({ available: false, error: 'Too short' })
  if (clean.length > 40) return c.json({ available: false, error: 'Too long' })

  const taken = await db.query.stores.findFirst({
    where: and(eq(stores.slug, clean), ne(stores.id, storeId)),
  })
  return c.json({ available: !taken, slug: clean })
})

storeRoutes.patch('/', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<Partial<typeof stores.$inferInsert>>()

  // If slug is being changed, sanitise and check uniqueness
  if (body.slug) {
    body.slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '')
    if (body.slug.length < 3) return c.json({ error: 'Slug too short (min 3 characters)' }, 400)
    const taken = await db.query.stores.findFirst({
      where: and(eq(stores.slug, body.slug), ne(stores.id, storeId)),
    })
    if (taken) return c.json({ error: 'This URL is already taken' }, 409)
  }

  const [updated] = await db.update(stores)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(stores.id, storeId))
    .returning()

  return c.json(updated)
})

// ── Logo upload (base64) ─────────────────────────────────────────────────────
storeRoutes.post('/logo', async (c) => {
  const storeId = c.get('storeId') as string
  const { logoBase64, mimeType } = await c.req.json<{ logoBase64: string; mimeType: string }>()
  if (!logoBase64) return c.json({ error: 'No logo provided' }, 400)

  const logoUrl = await uploadBase64(logoBase64, mimeType, `nemvol/${storeId}/logo`, 'logo')
  await db.update(stores).set({ logoUrl, updatedAt: new Date() }).where(eq(stores.id, storeId))
  return c.json({ logoUrl })
})
