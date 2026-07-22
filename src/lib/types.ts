import type { Context } from 'hono'

export type Variables = {
  storeId: string
  userId: string
  role: 'owner' | 'admin' | 'manager' | 'staff'
}

export type AppContext = Context<{ Variables: Variables }>
