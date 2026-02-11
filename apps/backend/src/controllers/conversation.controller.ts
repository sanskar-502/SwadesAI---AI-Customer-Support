import type { Context } from "hono";
import { messageBodySchema, type ChatMessage } from "../schemas/chat";
import { conversationService } from "../services/conversation.service";

const formatMessage = (message: {
  id: string;
  role: ChatMessage["role"];
  content: string;
  createdAt: Date;
}) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  createdAt: message.createdAt.toISOString(),
});

export const listConversationsController = async (c: Context) => {
  try {
    const conversations = await conversationService.listConversations();
    return c.json(conversations);
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to load conversations" }, 500);
  }
};

export const getConversationController = async (c: Context) => {
  try {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Conversation id is required" }, 400);
    }

    const conversation = await conversationService.getConversationById(id);
    if (!conversation) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    return c.json(conversation);
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to load conversation" }, 500);
  }
};

export const createMessageController = async (c: Context) => {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = messageBodySchema.safeParse(body);
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

    const created = await conversationService.appendMessage(
      conversation.id,
      parsed.data.message
    );

    const payload = formatMessage({
      id: created.id,
      role: parsed.data.message.role,
      content: created.content,
      createdAt: created.createdAt,
    });

    return c.json(
      {
        conversationId: conversation.id,
        message: payload,
      },
      201
    );
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to save message" }, 500);
  }
};
