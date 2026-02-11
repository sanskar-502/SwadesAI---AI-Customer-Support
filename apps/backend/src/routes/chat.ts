import { Hono } from "hono";
import { chatController, chatSyncController } from "../controllers/chat.controller";
import {
  createMessageController,
  getConversationController,
  listConversationsController,
} from "../controllers/conversation.controller";

export const chatRoutes = new Hono()
  .post("/", chatController)
  .post("/sync", chatSyncController)
  .post("/messages", createMessageController)
  .get("/conversations", listConversationsController)
  .get("/conversations/:id", getConversationController);

export type ChatRouteType = typeof chatRoutes;
