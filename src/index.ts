import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { clerkMiddleware } from '@hono/clerk-auth'

import { authRoutes }         from './routes/auth.ts'
import { storeRoutes }        from './routes/store.ts'
import { subscriptionRoutes } from './routes/subscription.ts'
import { productRoutes }      from './routes/products.ts'
import { orderRoutes }        from './routes/orders.ts'
import { customerRoutes }     from './routes/customers.ts'
import { invoiceRoutes }      from './routes/invoices.ts'
import { shippingRoutes }     from './routes/shipping.ts'
import { storefrontRoutes }   from './routes/storefront.ts'
import { purchaseRoutes }     from './routes/purchases.ts'
import { reviewRoutes }       from './routes/reviews.ts'
import { paymentRoutes }      from './routes/payments.ts'
import { toolsRoutes }        from './routes/tools.ts'
import { locationRoutes }     from './routes/locations.ts'
import { staffRoutes }        from './routes/staff.ts'
import { categoryRoutes }     from './routes/categories.ts'
import { attributeRoutes }    from './routes/attributes.ts'
import { giftCardRoutes }     from './routes/giftcards.ts'
import { uploadRoutes }       from './routes/upload.ts'
import { profileRoutes }      from './routes/profile.ts'
import { webhookRoutes }      from './routes/webhooks.ts'
import { publicRoutes }       from './routes/public.ts'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://nemvol.com',
    process.env.FRONTEND_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}))

// Public storefront routes — no auth required
app.route('/public', publicRoutes)

// Webhooks — no Clerk auth, HMAC verified inside the handler
app.route('/webhooks', webhookRoutes)

app.get('/health', (c) => c.json({ ok: true }))

// All other routes require a valid Clerk session
app.use('*', clerkMiddleware())

app.route('/auth',         authRoutes)
app.route('/store',        storeRoutes)
app.route('/subscription', subscriptionRoutes)
app.route('/products',     productRoutes)
app.route('/orders',       orderRoutes)
app.route('/customers',    customerRoutes)
app.route('/invoices',     invoiceRoutes)
app.route('/shipping',     shippingRoutes)
app.route('/storefront',   storefrontRoutes)
app.route('/purchases',    purchaseRoutes)
app.route('/reviews',      reviewRoutes)
app.route('/payments',     paymentRoutes)
app.route('/tools',        toolsRoutes)
app.route('/locations',    locationRoutes)
app.route('/staff',        staffRoutes)
app.route('/profile',      profileRoutes)
app.route('/upload',       uploadRoutes)
app.route('/categories',   categoryRoutes)
app.route('/attributes',   attributeRoutes)
app.route('/gift-cards',   giftCardRoutes)

const port = Number(process.env.PORT ?? 3001)
console.log(`🚀 nemvol-api running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })

export type AppType = typeof app
