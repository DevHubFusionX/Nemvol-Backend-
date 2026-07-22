import { Hono } from 'hono'
import { getAuth } from '@hono/clerk-auth'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users, stores, storeMembers, subscriptions } from '../db/schema/index.ts'

export const authRoutes = new Hono()

// POST /auth/onboard — called once after Clerk sign-up
authRoutes.post('/onboard', async (c) => {
  const auth = getAuth(c)
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{ email: string; firstName?: string; lastName?: string }>()

  // Idempotent — return existing user if already onboarded
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, auth.userId) })
  if (existing) return c.json({ message: 'Already onboarded' }, 200)

  const base = body.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const suffix = Math.random().toString(36).slice(2, 6) // e.g. "x4k2"
  const slug = `${base}-${suffix}`

  const [user] = await db.insert(users).values({
    clerkId:   auth.userId,
    email:     body.email,
    firstName: body.firstName,
    lastName:  body.lastName,
  }).returning()

  const [store] = await db.insert(stores).values({
    ownerId: user.id,
    name:    body.firstName ? `${body.firstName}'s Store` : 'My Store',
    slug,
  }).returning()

  await db.insert(storeMembers).values({ storeId: store.id, userId: user.id, role: 'owner' })

  const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
  await db.insert(subscriptions).values({ storeId: store.id, status: 'trialing', trialEndsAt })

  return c.json({ user, store }, 201)
})
