import { generateText, stepCountIs, streamText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { ChatMessage } from "../schemas/chat";

const prisma = new PrismaClient();
const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY,
});

const rawModelId = process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";
const modelId = rawModelId.startsWith("models/")
  ? rawModelId.slice("models/".length)
  : rawModelId;

const routerSystemPrompt =
  "You are a Router Agent. Analyze the user's query. If it's about orders, use the Order Tools. If it's about billing, use the Billing Tools. If it's about FAQs or past conversations, use the Support Tools. If generic, answer directly. Respond in plain text only—no Markdown, no bullet points, no asterisks. If you list multiple fields, use short sentences separated by commas.";

const orderIdSchema = z.object({
  orderId: z.string().min(1),
});

const invoiceNoSchema = z.object({
  invoiceNo: z.string().min(1),
});

const productSearchSchema = z.object({
  query: z.string().min(1),
});
const conversationSearchSchema = z.object({
  query: z.string().min(1),
});

type OrderIdInput = z.infer<typeof orderIdSchema>;
type InvoiceNoInput = z.infer<typeof invoiceNoSchema>;
type ProductSearchInput = z.infer<typeof productSearchSchema>;
type ConversationSearchInput = z.infer<typeof conversationSearchSchema>;

const tools = {
  getOrderDetails: tool({
    description: "Get full order details by order ID or order number.",
    inputSchema: orderIdSchema,
    execute: async ({ orderId }: OrderIdInput) => {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id: orderId }, { orderNumber: orderId }],
        },
      });

      if (!order) {
        return { error: "Order not found", orderId };
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryDate: order.deliveryDate?.toISOString() ?? null,
        items: order.items,
        createdAt: order.createdAt.toISOString(),
      };
    },
  }),
  checkDeliveryStatus: tool({
    description: "Check delivery status and date by order ID or order number.",
    inputSchema: orderIdSchema,
    execute: async ({ orderId }: OrderIdInput) => {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ id: orderId }, { orderNumber: orderId }],
        },
      });

      if (!order) {
        return { error: "Order not found", orderId };
      }

      return {
        orderId: order.id,
        status: order.status,
        deliveryDate: order.deliveryDate?.toISOString() ?? null,
      };
    },
  }),
  getInvoiceDetails: tool({
    description: "Get invoice details by invoice number.",
    inputSchema: invoiceNoSchema,
    execute: async ({ invoiceNo }: InvoiceNoInput) => {
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNo },
      });

      if (!invoice) {
        return { error: "Invoice not found", invoiceNo };
      }

      return {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        amount: invoice.amount.toString(),
        status: invoice.status,
        dueDate: invoice.dueDate.toISOString(),
        createdAt: invoice.createdAt.toISOString(),
      };
    },
  }),
  checkRefundStatus: tool({
    description: "Check refund status for an invoice number.",
    inputSchema: invoiceNoSchema,
    execute: async ({ invoiceNo }: InvoiceNoInput) => {
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNo },
      });

      if (!invoice) {
        return { error: "Invoice not found", invoiceNo };
      }

      return {
        invoiceNo: invoice.invoiceNo,
        status: invoice.status,
        amount: invoice.amount.toString(),
        dueDate: invoice.dueDate.toISOString(),
        refunded: invoice.status === "REFUNDED",
      };
    },
  }),
  searchProducts: tool({
    description: "Search product FAQs using a query string.",
    inputSchema: productSearchSchema,
    execute: async ({ query }: ProductSearchInput) => {
      const results = await prisma.productFaq.findMany({
        where: {
          OR: [
            { question: { contains: query, mode: "insensitive" } },
            { answer: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      });

      return results.map((result) => ({
        id: result.id,
        question: result.question,
        answer: result.answer,
        category: result.category ?? null,
      }));
    },
  }),
  searchConversationHistory: tool({
    description: "Search past conversation history by keyword.",
    inputSchema: conversationSearchSchema,
    execute: async ({ query }: ConversationSearchInput) => {
      const results = await prisma.message.findMany({
        where: {
          content: { contains: query, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return results.map((result) => ({
        id: result.id,
        role: result.role,
        content: result.content,
        createdAt: result.createdAt.toISOString(),
      }));
    },
  }),
} as const;

export class QuotaExceededError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "QuotaExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const QUOTA_REGEX = /quota exceeded|resource_exhausted|rate limit/i;
const RETRY_REGEX = /retry in\s+([0-9.]+)s/i;

function extractRetryAfterSeconds(error: unknown): number | undefined {
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    const record = current as {
      message?: string;
      responseBody?: string;
      errors?: unknown[];
      cause?: unknown;
    };

    if (typeof record.message === "string") {
      const match = record.message.match(RETRY_REGEX);
      if (match) {
        const value = Number.parseFloat(match[1]);
        if (Number.isFinite(value)) return value;
      }
    }

    if (typeof record.responseBody === "string") {
      try {
        const parsed = JSON.parse(record.responseBody) as {
          error?: { details?: Array<{ retryDelay?: string; ["@type"]?: string }> };
        };
        const retryDetail = parsed.error?.details?.find(
          (detail) =>
            detail?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
        );
        if (retryDetail?.retryDelay) {
          const retryMatch = retryDetail.retryDelay.match(/([0-9.]+)s/);
          if (retryMatch) {
            const value = Number.parseFloat(retryMatch[1]);
            if (Number.isFinite(value)) return value;
          }
        }
      } catch {
        // ignore JSON parse failures
      }
    }

    if (Array.isArray(record.errors)) {
      queue.push(...record.errors);
    }
    if (record.cause) {
      queue.push(record.cause);
    }
  }

  return undefined;
}

function isQuotaError(error: unknown): boolean {
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    const record = current as {
      message?: string;
      statusCode?: number;
      errors?: unknown[];
      cause?: unknown;
    };

    if (record.statusCode === 429) return true;
    if (typeof record.message === "string" && QUOTA_REGEX.test(record.message)) {
      return true;
    }

    if (Array.isArray(record.errors)) {
      queue.push(...record.errors);
    }
    if (record.cause) {
      queue.push(record.cause);
    }
  }

  return false;
}

function mapQuotaError(error: unknown): QuotaExceededError | null {
  if (!isQuotaError(error)) return null;

  const retryAfterSeconds = extractRetryAfterSeconds(error);
  const retryMessage = retryAfterSeconds
    ? ` Please retry in about ${Math.ceil(retryAfterSeconds)} seconds.`
    : " Please retry in a moment.";

  return new QuotaExceededError(
    `AI quota exceeded.${retryMessage}`,
    retryAfterSeconds
  );
}

export const agentService = {
  async runAgent(messages: ChatMessage[]) {
    const compactedMessages = messages.slice(-10);

    try {
      const result = await streamText({
        model: google(modelId),
        system: routerSystemPrompt,
        messages: compactedMessages,
        tools,
        stopWhen: stepCountIs(3),
        maxRetries: 0,
      });

      return result;
    } catch (error) {
      const quotaError = mapQuotaError(error);
      if (quotaError) {
        throw quotaError;
      }
      throw error;
    }
  },
  async runAgentSync(messages: ChatMessage[]) {
    const compactedMessages = messages.slice(-10);

    try {
      const result = await generateText({
        model: google(modelId),
        system: routerSystemPrompt,
        messages: compactedMessages,
        tools,
        stopWhen: stepCountIs(3),
        maxRetries: 0,
      });

      return result;
    } catch (error) {
      const quotaError = mapQuotaError(error);
      if (quotaError) {
        throw quotaError;
      }
      throw error;
    }
  },
};
