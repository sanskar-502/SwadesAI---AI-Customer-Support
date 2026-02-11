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

export const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export type ChatMessage = z.infer<typeof messageSchema>;
export type ChatBody = z.infer<typeof bodySchema>;
