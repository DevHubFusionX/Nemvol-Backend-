import { Hono } from 'hono'
import { uploadBase64 } from '../lib/cloudinary.ts'
import { tenantMiddleware } from '../middleware/tenant.ts'
import type { Variables } from '../lib/types.ts'

export const uploadRoutes = new Hono<{ Variables: Variables }>()
uploadRoutes.use('*', tenantMiddleware)

// POST /upload  { base64: string, mimeType: string, folder?: string }
// Returns { url: string }
uploadRoutes.post('/', async (c) => {
  const storeId = c.get('storeId') as string
  const { base64, mimeType, folder = 'products' } = await c.req.json<{
    base64: string
    mimeType: string
    folder?: string
  }>()

  if (!base64 || !mimeType) return c.json({ error: 'base64 and mimeType required' }, 400)

  const url = await uploadBase64(base64, mimeType, `nemvol/${storeId}/${folder}`)
  return c.json({ url })
})
