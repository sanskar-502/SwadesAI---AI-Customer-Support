import { z } from "zod";

export const messageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().min(1),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().min(1),
  }),
  z.object({
    role: z.literal("system"),
    content: z.string().min(1),
  }),
]);

export const chatBodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  conversationId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

export const messageBodySchema = z.object({
  message: messageSchema,
  conversationId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

export type ChatMessage = z.infer<typeof messageSchema>;
export type ChatBody = z.infer<typeof chatBodySchema>;
export type MessageBody = z.infer<typeof messageBodySchema>;
