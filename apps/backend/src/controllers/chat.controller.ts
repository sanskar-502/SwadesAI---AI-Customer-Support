import type { Context } from "hono";
import { agentService, QuotaExceededError } from "../services/agent.service";
import { chatBodySchema } from "../schemas/chat";
import type { ChatMessage } from "../schemas/chat";
import { conversationService } from "../services/conversation.service";

const getLatestUserMessage = (messages: ChatMessage[]): ChatMessage | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "user") {
      return message;
    }
  }
  return null;
};

export const chatController = async (c: Context) => {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = chatBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request body",
          issues: parsed.error.format(),
        },
        400
      );
    }

    const conversation = await conversationService.ensureConversation({
      conversationId: parsed.data.conversationId,
      userId: parsed.data.userId,
    });

    const latestUserMessage = getLatestUserMessage(parsed.data.messages);
    if (latestUserMessage) {
      await conversationService.appendMessage(conversation.id, latestUserMessage);
    }

    const result = await agentService.runAgent(parsed.data.messages, {
      onFinish: async (finalResult) => {
        const assistantText = finalResult.text?.trim();
        if (!assistantText) return;
        try {
          await conversationService.appendMessage(conversation.id, {
            role: "assistant",
            content: assistantText,
          });
        } catch (persistError) {
          console.error("Failed to persist assistant message", persistError);
        }
      },
    });

    c.header("x-conversation-id", conversation.id);
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

    const parsed = chatBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request body",
          issues: parsed.error.format(),
        },
        400
      );
    }

    const conversation = await conversationService.ensureConversation({
      conversationId: parsed.data.conversationId,
      userId: parsed.data.userId,
    });

    const latestUserMessage = getLatestUserMessage(parsed.data.messages);
    if (latestUserMessage) {
      await conversationService.appendMessage(conversation.id, latestUserMessage);
    }

    const result = await agentService.runAgentSync(parsed.data.messages);
    const assistantText = result.text?.trim();
    if (assistantText) {
      await conversationService.appendMessage(conversation.id, {
        role: "assistant",
        content: assistantText,
      });
    }

    return c.json({
      conversationId: conversation.id,
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
