import { Hono } from 'hono'
import { getAuth } from '@hono/clerk-auth'
import { createClerkClient } from '@clerk/backend'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

import { uploadBase64 } from '../lib/cloudinary.ts'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

export const profileRoutes = new Hono<{ Variables: Variables }>()
profileRoutes.use('*', tenantMiddleware)

// ── Get profile ───────────────────────────────────────────────────────────────
profileRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

// ── Update name / phone ───────────────────────────────────────────────────────
profileRoutes.patch('/', async (c) => {
  const userId = c.get('userId')
  const auth = getAuth(c)
  const { firstName, lastName, phone } = await c.req.json<{ firstName?: string; lastName?: string; phone?: string }>()

  const update: Record<string, string> = {}
  if (firstName !== undefined) update.firstName = firstName
  if (lastName !== undefined) update.lastName = lastName
  if (phone !== undefined) update.phone = phone

  const [user] = await db.update(users).set(update).where(eq(users.id, userId)).returning()

  // Sync name to Clerk
  if (auth?.userId && (firstName !== undefined || lastName !== undefined)) {
    await clerk.users.updateUser(auth.userId, {
      firstName: firstName ?? user.firstName ?? undefined,
      lastName: lastName ?? user.lastName ?? undefined,
    }).catch(() => {}) // non-fatal
  }

  return c.json(user)
})

// ── Upload avatar (base64) ────────────────────────────────────────────────────
profileRoutes.post('/avatar', async (c) => {
  const userId = c.get('userId')
  const { avatarBase64, mimeType } = await c.req.json<{ avatarBase64: string; mimeType: string }>()
  if (!avatarBase64) return c.json({ error: 'No image provided' }, 400)
  const avatarUrl = await uploadBase64(avatarBase64, mimeType, `nemvol/avatars`, userId)
  const [user] = await db.update(users).set({ avatarUrl }).where(eq(users.id, userId)).returning()
  return c.json({ avatarUrl: user.avatarUrl })
})

// ── Change password ───────────────────────────────────────────────────────────
profileRoutes.post('/password', async (c) => {
  const auth = getAuth(c)
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401)
  const { newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>()
  try {
    await clerk.users.updateUser(auth.userId, { password: newPassword })
    return c.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update password'
    return c.json({ error: msg }, 400)
  }
})
