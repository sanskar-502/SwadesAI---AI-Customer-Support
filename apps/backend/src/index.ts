// apps/backend/src/index.ts
import "dotenv/config";
import { serve } from '@hono/node-server'
import { app } from './app'

// Re-export the 'AppType' for the Frontend to use
export type { AppType } from './app'

// 3. Start the server
const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
