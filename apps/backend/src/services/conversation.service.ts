import { PrismaClient, MessageRole } from "@prisma/client";
import type { ChatMessage } from "../schemas/chat";

const prisma = new PrismaClient();

const ROLE_TO_DB: Record<ChatMessage["role"], MessageRole> = {
  user: "USER",
  assistant: "ASSISTANT",
  system: "SYSTEM",
};

const DB_TO_ROLE: Record<MessageRole, ChatMessage["role"]> = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
};

type ConversationSummary = {
  id: string;
  lastMessage: string;
  updatedAt: string;
};

type ConversationMessage = {
  id: string;
  role: ChatMessage["role"];
  content: string;
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

type EnsureConversationInput = {
  conversationId?: string;
  userId?: string;
};

async function resolveUserId(userId?: string): Promise<string> {
  if (userId) {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
  }

  const fallback = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!fallback) {
    throw new Error("No users found. Seed the database first.");
  }

  return fallback.id;
}

async function ensureConversation({
  conversationId,
  userId,
}: EnsureConversationInput) {
  if (conversationId) {
    const existing = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (existing) {
      return existing;
    }
  }

  const resolvedUserId = await resolveUserId(userId);

  const latest = await prisma.conversation.findFirst({
    where: { userId: resolvedUserId },
    orderBy: { updatedAt: "desc" },
  });

  if (latest) {
    return latest;
  }

  return prisma.conversation.create({
    data: { userId: resolvedUserId },
  });
}

async function appendMessage(conversationId: string, message: ChatMessage) {
  const role = ROLE_TO_DB[message.role];

  return prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        role,
        content: message.content,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return created;
  });
}

async function listConversations(): Promise<ConversationSummary[]> {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    lastMessage: conversation.messages[0]?.content ?? "",
    updatedAt: conversation.updatedAt.toISOString(),
  }));
}

async function getConversationById(
  id: string
): Promise<ConversationDetail | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return null;
  }

  return {
    id: conversation.id,
    userId: conversation.userId,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: DB_TO_ROLE[message.role],
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export const conversationService = {
  ensureConversation,
  appendMessage,
  listConversations,
  getConversationById,
};

export type { ConversationDetail, ConversationMessage, ConversationSummary };
