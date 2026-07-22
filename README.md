# Nemvol Backend

REST API for the Nemvol e-commerce platform. Built with [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and [Neon Postgres](https://neon.tech).

## Stack

- **Runtime:** Node.js + tsx
- **Framework:** Hono
- **Database:** Neon (serverless Postgres) via Drizzle ORM
- **Auth:** Clerk
- **Storage:** Cloudinary
- **Payments:** Paystack

## Getting Started

```bash
pnpm install
cp .env.example .env   # fill in your keys
pnpm db:migrate
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm start` | Start production server |
| `pnpm build` | Type-check |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Environment Variables

See `.env.example` for all required variables.

## Deployment

Designed to run on any Node.js host (Railway, Render, Fly.io, etc.).

Set all environment variables from `.env.example` in your host's dashboard before deploying.
