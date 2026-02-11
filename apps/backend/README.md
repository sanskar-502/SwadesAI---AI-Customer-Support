# Backend - Hono + Prisma + Gemini

This service powers the AI customer support API. It uses Hono for routing, Prisma for PostgreSQL access, and the Vercel AI SDK with Gemini for model calls.

## Stack

- Hono (HTTP API)
- Prisma + PostgreSQL (data layer)
- Vercel AI SDK + Gemini (LLM)
- Vitest (tests)

## Project Structure

- `src/app.ts` - Hono app, middleware, routes
- `src/index.ts` - Server entrypoint
- `src/controllers` - HTTP parsing/validation
- `src/services` - AI + database logic
- `src/routes` - Route definitions
- `src/schemas` - Zod schemas
- `prisma/schema.prisma` - Data models
- `prisma/seed.ts` - Seed script

## Environment

Create `apps/backend/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
GOOGLE_GENERATIVE_AI_API_KEY="your_gemini_key"
GEMINI_MODEL="gemini-2.5-flash"
```

Notes:

- `DATABASE_URL` must be set for Prisma.
- `GEMINI_MODEL` can be any model available to your API key.
- Gemini free-tier quotas are limited and may return 429 errors.

## Database

Apply schema:

```
npx prisma db push --schema prisma/schema.prisma
```

Seed data:

```
npx tsx prisma/seed.ts
```

Optional: inspect data

```
npx prisma studio --schema prisma/schema.prisma
```

## API Routes

- `GET /api/health`  
  Returns `{ status: "ok", timestamp: ... }`

- `GET /api/chat/conversations`  
  Returns recent conversations for the sidebar.

- `POST /api/chat`  
  Streaming text response.

- `POST /api/chat/sync`  
  JSON response:
  ```
  {
    "text": "...",
    "finishReason": "stop",
    "usage": { ... }
  }
  ```

## Router + Tools

The Router Agent decides which tool to call based on user intent.

Order Agent tools:

- `getOrderDetails(orderId)`
- `checkDeliveryStatus(orderId)`

Billing Agent tools:

- `getInvoiceDetails(invoiceNo)`
- `checkRefundStatus(invoiceNo)`

Support Agent tools:

- `searchProducts(query)` (FAQ knowledge base)
- `searchConversationHistory(query)`

All tools query PostgreSQL via Prisma and return structured data.

## Context Compaction

The service only sends the last 10 messages to the model:

- `messages.slice(-10)`

## Rate Limiting

Rate limiter is applied to `/api/*`:

- window: 15 minutes
- limit: 100 requests
- response: `429 { error: "Rate limit exceeded" }`

## Tests

Run tests:

```
npm test -w apps/backend
```

Watch mode:

```
npm run test:watch -w apps/backend
```

## Troubleshooting

- **Quota exceeded (Gemini):** You may receive 429 responses. Wait for reset, switch models, or use a paid key.
- **Prisma client missing:** Run `npx prisma generate --schema prisma/schema.prisma`.
- **Schema errors:** Ensure `DATABASE_URL` is set and valid.
