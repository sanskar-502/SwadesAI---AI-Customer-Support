// apps/web/src/lib/api.ts
import { hc } from 'hono/client'
// Import the type directly from the backend file!
import type { AppType } from '../../../backend/src/index'

// Create the fully typed client
const client = hc<AppType>('http://localhost:3000')

export default client