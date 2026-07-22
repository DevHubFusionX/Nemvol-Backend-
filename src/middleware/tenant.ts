import type { Context, Next } from 'hono'
import { getAuth } from '@hono/clerk-auth'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { users, storeMembers } from '../db/schema/index.ts'
import type { Variables } from '../lib/types.ts'

export async function tenantMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const auth = getAuth(c)
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401)

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, auth.userId),
  })
  if (!user) return c.json({ error: 'User not found' }, 404)

  const member = await db.query.storeMembers.findFirst({
    where: eq(storeMembers.userId, user.id),
    with: { store: true },
  })
  if (!member) return c.json({ error: 'No store found' }, 403)

  c.set('storeId', member.storeId)
  c.set('userId', user.id)
  c.set('role', member.role)
  await next()
}
