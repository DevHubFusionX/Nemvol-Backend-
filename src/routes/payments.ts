import { Hono } from 'hono'
import { and, eq, desc } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { orders, customers, expenses, paymentMethods } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const paymentRoutes = new Hono<{ Variables: Variables }>()
paymentRoutes.use('*', tenantMiddleware)

// Stats: revenue, pending payouts, completed payouts, failed count
paymentRoutes.get('/stats', async (c) => {
  const storeId = c.get('storeId') as string

  const allOrders = await db.query.orders.findMany({
    where: eq(orders.storeId, storeId),
  })

  const totalRevenue = allOrders
    .filter(o => ['delivered', 'confirmed', 'processing', 'shipped'].includes(o.status ?? ''))
    .reduce((sum, o) => sum + Number(o.total), 0)

  const pendingPayouts = allOrders
    .filter(o => o.status === 'pending')
    .reduce((sum, o) => sum + Number(o.total), 0)

  const completedPayouts = allOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + Number(o.total), 0)

  const failedCount = allOrders.filter(o => o.status === 'cancelled' || o.status === 'refunded').length

  return c.json({ totalRevenue, pendingPayouts, completedPayouts, failedCount })
})

// Transactions: orders as payment records
paymentRoutes.get('/transactions', async (c) => {
  const storeId = c.get('storeId') as string
  const { status, q, date } = c.req.query()

  const rows = await db.query.orders.findMany({
    where: and(
      eq(orders.storeId, storeId),
      status && status !== 'all' ? eq(orders.status, status as typeof orders.status._.data) : undefined,
    ),
    with: { customer: true },
    orderBy: [desc(orders.createdAt)],
  })

  const filtered = rows.filter(o => {
    if (q) {
      const search = q.toLowerCase()
      const name = `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.toLowerCase()
      if (!o.orderNumber.toLowerCase().includes(search) && !name.includes(search)) return false
    }
    if (date) {
      const d = new Date(o.createdAt!).toISOString().slice(0, 10)
      if (d !== date) return false
    }
    return true
  })

  return c.json({ data: filtered, total: filtered.length })
})

// Payment methods config
paymentRoutes.get('/methods', async (c) => {
  const storeId = c.get('storeId') as string
  const row = await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.storeId, storeId) })
  const methods = row ? JSON.parse(row.methods) : {}
  return c.json({ methods })
})

paymentRoutes.put('/methods', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{ methods: Record<string, unknown> }>()
  const methodsJson = JSON.stringify(body.methods)

  const existing = await db.query.paymentMethods.findFirst({ where: eq(paymentMethods.storeId, storeId) })
  if (existing) {
    await db.update(paymentMethods)
      .set({ methods: methodsJson, updatedAt: new Date() })
      .where(eq(paymentMethods.storeId, storeId))
  } else {
    await db.insert(paymentMethods).values({ storeId, methods: methodsJson })
  }
  return c.json({ ok: true })
})

// Expenses
paymentRoutes.get('/expenses', async (c) => {
  const storeId = c.get('storeId') as string
  const rows = await db.query.expenses.findMany({
    where: eq(expenses.storeId, storeId),
    orderBy: [desc(expenses.createdAt)],
  })
  return c.json({ data: rows, total: rows.length })
})

paymentRoutes.post('/expenses', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{ title: string; amount: string; category?: string; date?: string; note?: string }>()
  const [row] = await db.insert(expenses).values({ storeId, ...body }).returning()
  return c.json(row, 201)
})

paymentRoutes.delete('/expenses/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(expenses).where(and(eq(expenses.id, c.req.param('id')), eq(expenses.storeId, storeId)))
  return c.json({ ok: true })
})
