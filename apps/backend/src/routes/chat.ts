import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import {
  chatController,
  chatSyncController,
} from "../controllers/chat.controller";

const prisma = new PrismaClient();

export const chatRoutes = new Hono()
  .post("/", chatController)
  .post("/sync", chatSyncController)
  .get("/conversations", async (c) => {
    try {
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

      const payload = conversations.map((conversation) => ({
        id: conversation.id,
        lastMessage: conversation.messages[0]?.content ?? "",
        updatedAt: conversation.updatedAt.toISOString(),
      }));

      return c.json(payload);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to load conversations" }, 500);
    }
  });

export type ChatRouteType = typeof chatRoutes;
