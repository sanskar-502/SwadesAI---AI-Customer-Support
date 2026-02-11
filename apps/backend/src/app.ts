import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { chatRoutes } from "./routes/chat";
import { agentsRoutes } from "./routes/agents";

const app = new Hono();

// Middleware
app.use("/*", cors());
app.use(
  "/api/*",
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-6",
    keyGenerator: (c) =>
      c.req.header("x-forwarded-for") ??
      c.req.header("x-real-ip") ??
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-client-ip") ??
      "unknown",
    message: { error: "Rate limit exceeded" },
    statusCode: 429,
  })
);

// Routes
const routes = app
  .get("/", (c) => {
    return c.json({ message: "Backend is active" });
  })
  .get("/api/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date() });
  })
  .route("/api/chat", chatRoutes)
  .route("/api/agents", agentsRoutes);

export type AppType = typeof routes;
export { app, routes };
