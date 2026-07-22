import { Hono } from 'hono'
import { and, eq, count } from 'drizzle-orm'
import { db } from '../db/client.ts'
import { invoices } from '../db/schema/index.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const invoiceRoutes = new Hono<{ Variables: Variables }>()
invoiceRoutes.use('*', tenantMiddleware)

invoiceRoutes.get('/stats', async (c) => {
  const storeId = c.get('storeId') as string
  const rows = await db.query.invoices.findMany({ where: eq(invoices.storeId, storeId) })

  const total   = rows.length
  const paid    = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.total), 0)
  const unpaid  = rows.filter(r => r.status === 'unpaid' || r.status === 'draft' || r.status === 'sent')
                      .reduce((s, r) => s + Number(r.total), 0)
  const overdue = rows.filter(r => r.status === 'overdue').length

  return c.json({ total, paid, unpaid, overdue })
})

invoiceRoutes.get('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { status, q } = c.req.query()

  const rows = await db.query.invoices.findMany({
    where: and(
      eq(invoices.storeId, storeId),
      status ? eq(invoices.status, status) : undefined,
    ),
    orderBy: (inv, { desc }) => [desc(inv.createdAt)],
  })

  const filtered = q
    ? rows.filter(r =>
        r.invoiceNumber.toLowerCase().includes(q.toLowerCase()) ||
        (r.customerName ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (r.customerEmail ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : rows

  return c.json({ data: filtered, total: filtered.length })
})

invoiceRoutes.get('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const row = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, c.req.param('id')), eq(invoices.storeId, storeId)),
  })
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

invoiceRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{
    customerName: string; customerEmail: string; dueDate?: string
    total: string; lineItems?: string; note?: string; status?: string; orderId?: string
  }>()

  // Sequential invoice number: count existing invoices for this store
  const [{ count: existing }] = await db
    .select({ count: count() })
    .from(invoices)
    .where(eq(invoices.storeId, storeId))

  const invoiceNumber = 'INV-' + String(Number(existing) + 1).padStart(4, '0')

  const [invoice] = await db.insert(invoices).values({
    storeId,
    invoiceNumber,
    customerName:  body.customerName,
    customerEmail: body.customerEmail,
    total:         body.total,
    lineItems:     body.lineItems,
    note:          body.note,
    status:        body.status ?? 'draft',
    dueDate:       body.dueDate ? new Date(body.dueDate) : undefined,
    orderId:       body.orderId,
  }).returning()

  return c.json(invoice, 201)
})

invoiceRoutes.patch('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  const body = await c.req.json<{
    status?: string; note?: string; dueDate?: string
    customerName?: string; customerEmail?: string; total?: string; lineItems?: string
  }>()

  const updateData: Record<string, unknown> = {}
  if (body.status        !== undefined) updateData.status        = body.status
  if (body.note          !== undefined) updateData.note          = body.note
  if (body.customerName  !== undefined) updateData.customerName  = body.customerName
  if (body.customerEmail !== undefined) updateData.customerEmail = body.customerEmail
  if (body.total         !== undefined) updateData.total         = body.total
  if (body.lineItems     !== undefined) updateData.lineItems     = body.lineItems
  if (body.dueDate       !== undefined) updateData.dueDate       = new Date(body.dueDate)

  const [updated] = await db.update(invoices)
    .set(updateData)
    .where(and(eq(invoices.id, c.req.param('id')), eq(invoices.storeId, storeId)))
    .returning()

  return c.json(updated)
})

invoiceRoutes.delete('/:id', async (c) => {
  const storeId = c.get('storeId') as string
  await db.delete(invoices).where(and(eq(invoices.id, c.req.param('id')), eq(invoices.storeId, storeId)))
  return c.json({ ok: true })
})
