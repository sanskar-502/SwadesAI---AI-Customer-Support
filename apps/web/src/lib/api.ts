// apps/web/src/lib/api.ts
import { hc } from "hono/client";
// Import the type directly from the backend file!
import type { AppType } from "../../../backend/src/index";

// Create the fully typed client
export const API_BASE =
  import.meta.env.VITE_API_BASE?.toString().trim() ||
  "http://localhost:3000";

const client = hc<AppType>(API_BASE);

export default client;
