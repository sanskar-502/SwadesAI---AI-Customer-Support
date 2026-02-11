# SwadesAI - AI Customer Support (Turborepo)

This monorepo contains a full-stack AI customer support system with a Hono backend, PostgreSQL + Prisma, and a React (Vite) frontend. The backend exposes streaming and sync chat endpoints, and the frontend uses Hono RPC for typed access to backend routes.

## Repo Structure

- `apps/backend` - Hono API, Prisma models, AI tools, seed script
- `apps/web` - React + Vite + Tailwind UI

## Requirements

- Node.js 18+
- npm 10+
- PostgreSQL database (local or hosted)

## Working Setup Instructions (Detailed)

This section is the full, step‑by‑step setup that reliably works end‑to‑end.

1. Prerequisites

- Node.js 18+ and npm 10+
- A PostgreSQL database (local or hosted)

2. Install dependencies (from repo root)

```
npm install
```

3. Configure backend environment

Create `apps/backend/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
GOOGLE_GENERATIVE_AI_API_KEY="your_gemini_key"
GEMINI_MODEL="gemini-2.5-flash"
```

Notes:

- `DATABASE_URL` must be valid or Prisma will fail.
- If you use a different Gemini model, update `GEMINI_MODEL`.

4. Apply database schema

```
cd apps/backend
npx prisma db push --schema prisma/schema.prisma
```

Expected: “Your database is now in sync with your Prisma schema.”

5. Seed the database

```
npx tsx prisma/seed.ts
```

Expected: no errors. This inserts a user, orders, invoices, FAQs, and a conversation.

6. Start the backend

```
npm run dev -w apps/backend
```

Expected: “Server is running on port 3000”.

7. Start the frontend (new terminal)

```
npm run dev -w apps/web
```

Open: `http://localhost:5173`

8. Verify backend is healthy

```
curl.exe http://localhost:3000/api/health
```

Expected:

```
{"status":"ok","timestamp":"..."}
```

9. Test the chat API (sync)

```
curl.exe -X POST "http://localhost:3000/api/chat/sync" `
  -H "Content-Type: application/json" `
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Where is my order ORD-1002?\"}]}"
```

Expected: JSON with `text` and `usage`.

10. Test the chat API (streaming)

```
curl.exe -N -X POST "http://localhost:3000/api/chat" `
  -H "Content-Type: application/json" `
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Where is my order ORD-1002?\"}]}"
```

Expected: streamed text output.

11. Run backend tests

```
npm test -w apps/backend
```

## Quick Start

1. Install dependencies from repo root:

```
npm install
```

2. Configure backend environment:

Create `apps/backend/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
GOOGLE_GENERATIVE_AI_API_KEY="your_gemini_key"
GEMINI_MODEL="gemini-2.5-flash"
```

3. Prepare database schema and seed data:

```
cd apps/backend
npx prisma db push --schema prisma/schema.prisma
npx tsx prisma/seed.ts
```

4. Run backend and frontend:

```
npm run dev -w apps/backend
npm run dev -w apps/web
```

Backend: `http://localhost:3000`  
Frontend: `http://localhost:5173`

## API Endpoints (Backend)

- `GET /api/health` - Health check
- `GET /api/chat/conversations` - Conversation list for sidebar
- `POST /api/chat` - Streaming chat (text stream)
- `POST /api/chat/sync` - Non-streaming JSON response

Request body format:

```
{
  "messages": [
    { "role": "user", "content": "Where is my order ORD-1002?" }
  ]
}
```

## Testing

Backend tests use Vitest:

```
npm test -w apps/backend
```

## Notes

- The backend compacts chat context to the last 10 messages.
- Gemini free-tier quotas are low. If you hit quota limits, you will receive a 429 with a friendly error message.
- The backend has rate limiting on `/api/*`.

See detailed guides in:
- `apps/backend/README.md`
- `apps/web/README.md`
