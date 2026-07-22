import { Hono } from 'hono'
import { and, eq, ilike, or } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { orders, orderLines, customers } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const orderRoutes = new Hono<{ Variables: Variables }>()
orderRoutes.use('*', tenantMiddleware)

orderRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { status, q } = c.req.query()

  const rows = await db.query.orders.findMany({
    where: and(
      eq(orders.storeId, storeId),
      status && status !== 'all' ? eq(orders.status, status as typeof orders.status._.data) : undefined,
    ),
    with: { lines: true, customer: true },
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  })

  const filtered = q
    ? rows.filter(o =>
        o.orderNumber.toLowerCase().includes(q.toLowerCase()) ||
        o.customer?.email?.toLowerCase().includes(q.toLowerCase()) ||
        o.customer?.firstName?.toLowerCase().includes(q.toLowerCase())
      )
    : rows

  return c.json({ data: filtered, total: filtered.length })
})

orderRoutes.get('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.storeId, storeId)),
    with: { lines: true },
  })
  if (!order) return c.json({ error: 'Not found' }, 404)
  return c.json(order)
})

orderRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{
    customerId?: string; subtotal: string; shippingCost?: string; total: string
    shippingAddress?: string; notes?: string; couponCode?: string
    lines: { variantId?: string; productName: string; variantLabel?: string; quantity: string; unitPrice: string; lineTotal: string }[]
  }>()

  const orderNumber = 'ORD-' + Date.now()

  const [order] = await db.insert(orders).values({
    storeId, orderNumber, customerId: body.customerId,
    subtotal: body.subtotal, shippingCost: body.shippingCost ?? '0',
    total: body.total, shippingAddress: body.shippingAddress,
    notes: body.notes, couponCode: body.couponCode,
  }).returning()

  if (body.lines?.length) {
    await db.insert(orderLines).values(body.lines.map(l => ({ ...l, orderId: order.id })))
  }

  return c.json(order, 201)
})

orderRoutes.patch('/:id/status', async (c) => {
  const storeId = c.get('storeId') as string
  const { status } = await c.req.json<{ status: typeof orders.status._.data }>()

  const [updated] = await db.update(orders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(orders.id, c.req.param('id')), eq(orders.storeId, storeId)))
    .returning()

  return c.json(updated)
})
