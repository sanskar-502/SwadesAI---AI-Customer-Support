# Frontend - React + Vite + Tailwind

This is the UI for the AI customer support system. It streams responses from the backend, shows a sidebar with conversation history, and displays tool reasoning status.

## Stack

- React 19 + Vite
- Tailwind CSS v4
- Vercel AI SDK `useChat`
- Hono RPC client for typed backend access

## Development

Install dependencies from the repo root:

```
npm install
```

Run the frontend:

```
npm run dev -w apps/web
```

The app runs at `http://localhost:5173`.

## Backend Connection

The frontend expects the backend to run on `http://localhost:3000`.

If you change ports, update:

- `apps/web/src/lib/api.ts`
- `apps/web/src/components/ChatInterface.tsx`

## Tailwind v4 Notes

Tailwind is configured with:

- `@tailwindcss/vite` in `apps/web/vite.config.ts`
- `@tailwindcss/postcss` in `apps/web/postcss.config.js`
- `@import "tailwindcss";` in `apps/web/src/index.css`

If styles do not apply, restart Vite and confirm the PostCSS config uses `@tailwindcss/postcss`.

## UI Features

- **Streaming chat** using `useChat` with `streamProtocol: "text"`.
- **Typing indicator** while waiting for assistant output.
- **Reasoning badge** when tool calls are active.
- **Conversation sidebar** populated from `GET /api/chat/conversations`.
- **Centered input** for empty chat, floating input for active chat.

## API Format

Requests are sent to:

```
POST http://localhost:3000/api/chat
```

Body format:

```
{
  "messages": [
    { "role": "user", "content": "Where is my order ORD-1002?" }
  ],
  "conversationId": "optional",
  "userId": "optional"
}
```

Notes:

- The backend persists conversations and messages.
- `/api/chat/sync` returns `conversationId` in JSON; `/api/chat` returns it in the `x-conversation-id` header.
- The current UI does not store `conversationId` yet. If you want strict per-thread chats, wire the header/field into the state and send it with each request.

## Troubleshooting

- **No styles:** ensure Vite is restarted and Tailwind config is correct.
- **No responses:** backend may be rate limited or Gemini quota exceeded.
- **CORS issues:** backend enables CORS for all origins by default.
