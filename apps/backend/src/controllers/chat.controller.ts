import type { Context } from "hono";
import { agentService, QuotaExceededError } from "../services/agent.service";
import { bodySchema } from "../schemas/chat";

export const chatController = async (c: Context) => {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request body",
          issues: parsed.error.format(),
        },
        400
      );
    }

    const result = await agentService.runAgent(parsed.data.messages);
    return result.toTextStreamResponse();
  } catch (error) {
    console.error(error);
    if (error instanceof QuotaExceededError) {
      if (error.retryAfterSeconds) {
        c.header("Retry-After", String(Math.ceil(error.retryAfterSeconds)));
      }
      return c.json(
        {
          error: "AI quota exceeded. Please try again shortly.",
          retryAfterSeconds: error.retryAfterSeconds ?? null,
        },
        429
      );
    }
    return c.json({ error: "Internal Server Error" }, 500);
  }
};

export const chatSyncController = async (c: Context) => {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request body",
          issues: parsed.error.format(),
        },
        400
      );
    }

    const result = await agentService.runAgentSync(parsed.data.messages);
    return c.json({
      text: result.text,
      finishReason: result.finishReason,
      usage: result.usage,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof QuotaExceededError) {
      if (error.retryAfterSeconds) {
        c.header("Retry-After", String(Math.ceil(error.retryAfterSeconds)));
      }
      return c.json(
        {
          error: "AI quota exceeded. Please try again shortly.",
          retryAfterSeconds: error.retryAfterSeconds ?? null,
        },
        429
      );
    }
    return c.json({ error: "Internal Server Error" }, 500);
  }
};
